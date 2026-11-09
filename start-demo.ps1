<#
    ClearCause - start the whole demo with one command (Windows PowerShell).

    From the project folder:

        powershell -ExecutionPolicy Bypass -File .\start-demo.ps1

    It starts a local blockchain, deploys the contracts, loads demo campaigns
    (two honest, eight fraudulent), starts the fraud-detection service and opens
    the website. Press Ctrl+C in this window to stop everything.

    Options:
        -NoSeed      skip the demo campaigns and start with an empty platform
        -NoMl        skip the Python anomaly model (the rules still run)
        -NoBrowser   do not open the browser automatically
        -ReownProjectId <id>   wallet-connect project id from https://cloud.reown.com
                               (only needed once; it is saved into client\.env)
#>
param(
    [switch]$NoSeed,
    [switch]$NoMl,
    [switch]$NoBrowser,
    [string]$ReownProjectId = ""
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$procs = [System.Collections.ArrayList]::new()

function Say($msg, $colour = "Cyan") { Write-Host "`n==> $msg" -ForegroundColor $colour }
function Note($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }

function Start-Bg($name, $exe, $argline, $workdir, $logfile, $envVars = @{}) {
    foreach ($k in $envVars.Keys) { [Environment]::SetEnvironmentVariable($k, $envVars[$k], "Process") }
    $p = Start-Process -FilePath $exe -ArgumentList $argline -WorkingDirectory $workdir `
        -RedirectStandardOutput $logfile -RedirectStandardError "$logfile.err" `
        -NoNewWindow -PassThru
    foreach ($k in $envVars.Keys) { [Environment]::SetEnvironmentVariable($k, $null, "Process") }
    [void]$procs.Add([pscustomobject]@{ Name = $name; Proc = $p; Log = $logfile })
    return $p
}

# Pulls one captured group out of text. Returns $null when nothing matches, instead of
# throwing "Cannot index into a null array" the way a direct .Matches.Groups[1] does.
function Get-Capture($text, $pattern) {
    $hit = $text | Select-String -Pattern $pattern | Select-Object -First 1
    if ($null -eq $hit) { return $null }
    return $hit.Matches[0].Groups[1].Value.Trim()
}

function Wait-Port($port, $what, $seconds = 90) {
    for ($i = 0; $i -lt $seconds * 2; $i++) {
        try {
            $c = New-Object Net.Sockets.TcpClient
            $c.Connect("127.0.0.1", $port); $c.Close()
            return
        } catch { Start-Sleep -Milliseconds 500 }
    }
    throw "$what did not start listening on port $port. Check the log files in $logDir."
}

# Reads client\.env, replaces the keys we manage, keeps everything else the user set.
function Set-EnvFile($path, [hashtable]$values) {
    $lines = @()
    if (Test-Path $path) { $lines = Get-Content $path }
    foreach ($key in $values.Keys) {
        $line = "$key=$($values[$key])"
        $found = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$([regex]::Escape($key))\s*=") { $lines[$i] = $line; $found = $true; break }
        }
        if (-not $found) { $lines += $line }
    }
    Set-Content -Path $path -Value $lines -Encoding UTF8
}

function Stop-All {
    Say "Stopping" "Yellow"
    foreach ($entry in $procs) {
        if ($entry.Proc -and -not $entry.Proc.HasExited) {
            Note "stopping $($entry.Name)"
            try { Stop-Process -Id $entry.Proc.Id -Force -ErrorAction SilentlyContinue } catch {}
            # npm/npx spawn children; clear anything still holding our ports
            try {
                Get-CimInstance Win32_Process -Filter "ParentProcessId=$($entry.Proc.Id)" |
                    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
            } catch {}
        }
    }
    Write-Host "`nAll stopped.`n" -ForegroundColor Yellow
}

try {
    # ---------- prerequisites -------------------------------------------------
    Say "Checking what is installed"
    foreach ($cmd in @("node", "npm")) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            throw "$cmd was not found. Install Node.js 18 or newer from https://nodejs.org and run this again."
        }
    }
    Note "node $(node -v)"

    $python = $null
    if (-not $NoMl) {
        foreach ($c in @("python", "py", "python3")) {
            if (Get-Command $c -ErrorAction SilentlyContinue) { $python = $c; break }
        }
        if (-not $python) { Note "Python not found, so the anomaly model is skipped (the rules still run)." }
    }

    $logDir = Join-Path $root "logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    # ---------- dependencies --------------------------------------------------
    # A folder called node_modules is not proof of a finished install: a dropped connection
    # leaves a half-populated one behind. So look for the actual tool each part needs.
    function Install-Part($part, $marker) {
        $dir = Join-Path $root $part
        if (Test-Path (Join-Path $dir $marker)) { return }
        Say "Installing dependencies for $part (several minutes on a first run)"
        Push-Location $dir
        $code = 1
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            npm install --no-audit --no-fund --fetch-retries 5 --fetch-retry-maxtimeout 120000 --fetch-timeout 600000
            $code = $LASTEXITCODE
            if ($code -eq 0) { break }
            if ($attempt -lt 3) {
                Note "That attempt failed, which is usually a dropped connection. Retrying ($attempt of 3)..."
                Start-Sleep -Seconds 8
            }
        }
        Pop-Location
        if ($code -ne 0) {
            throw "npm install kept failing in $part. Check your internet connection, close VS Code if it has this folder open, then run this again. Finished parts are not reinstalled."
        }
        if (-not (Test-Path (Join-Path $dir $marker))) {
            throw "npm install finished in $part but $marker is still missing. Delete $dir\node_modules and run this again."
        }
    }

    Install-Part "contract"      "node_modules\.bin\hardhat.cmd"
    Install-Part "client"        "node_modules\.bin\vite.cmd"
    Install-Part "fraud\service" "node_modules\express"

    # Call the tools directly instead of through npx. npx asks "Ok to proceed?" when a tool
    # is missing, and with output redirected to a log file nobody can answer it.
    $hardhat = Join-Path $root "contract\node_modules\.bin\hardhat.cmd"
    $vite    = Join-Path $root "client\node_modules\.bin\vite.cmd"

    # ---------- blockchain ----------------------------------------------------
    Say "Starting the local blockchain"
    Start-Bg "blockchain" $hardhat "node" (Join-Path $root "contract") (Join-Path $logDir "chain.log") | Out-Null
    Wait-Port 8545 "The local blockchain"
    Note "listening on http://127.0.0.1:8545"

    # ---------- deploy --------------------------------------------------------
    Say "Deploying the contracts"
    Push-Location (Join-Path $root "contract")
    $deployOut = & $hardhat run scripts/deploy.ts --network localhost 2>&1
    Pop-Location
    $deployOut | Set-Content (Join-Path $logDir "deploy.log")
    $kyc   = Get-Capture $deployOut "VITE_APP_KYC_MANAGER_ADDRESS=(.+)"
    $addr  = Get-Capture $deployOut "VITE_APP_CONTRACT_ADDRESS=(.+)"
    $block = Get-Capture $deployOut "VITE_APP_DEPLOY_BLOCK=(.+)"
    if (-not $addr) { throw "Could not read the contract address from the deploy output. See $logDir\deploy.log" }
    if (-not $block) { $block = "0" }
    Note "ClearCause at $addr"

    # ---------- website configuration ----------------------------------------
    $envFile = Join-Path $root "client\.env"
    $settings = @{
        "VITE_APP_CHAIN"                  = "localhost"
        "VITE_ENABLE_DEMO_WALLET"         = "true"
        "VITE_APP_RPC_URL"                = "http://127.0.0.1:8545"
        "VITE_APP_KYC_MANAGER_ADDRESS"    = $kyc
        "VITE_APP_CONTRACT_ADDRESS"       = $addr
        "VITE_APP_DEPLOY_BLOCK"           = $block
        "VITE_FRAUD_API_URL"              = "http://127.0.0.1:4000"
    }
    if ($ReownProjectId) { $settings["VITE_APP_APPKIT_PROJECT_ID"] = $ReownProjectId }
    Set-EnvFile $envFile $settings
    $existingId = Get-Capture (Get-Content $envFile) "^VITE_APP_APPKIT_PROJECT_ID=(.+)"
    if (-not $existingId) {
        Note "No Reown project id set. WalletConnect is disabled; injected wallets remain available."
        Note "Get a free one at https://cloud.reown.com and rerun with -ReownProjectId <id>."
    }

    # ---------- anomaly model (optional) --------------------------------------
    $mlUrl = ""
    if ($python) {
        # A Python on PATH is not enough: the model needs joblib, scikit-learn and flask.
        & $python -c "import joblib, sklearn, flask" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Note "Python is here, but the model's packages are not installed, so the rules will run alone."
            Note "To switch the anomaly model on (it catches serial campaign spam, which the rules miss):"
            Note "    $python -m pip install -r fraud\ml\requirements.txt"
            $python = $null
        }
    }
    if ($python) {
        $modelFile = Join-Path $root "fraud\ml\model\isolation_forest.joblib"
        if (Test-Path $modelFile) {
            Say "Starting the anomaly model"
            Start-Bg "model" $python "serve.py --model model --port 5001" (Join-Path $root "fraud\ml") (Join-Path $logDir "model.log") | Out-Null
            Start-Sleep -Seconds 4
            try { Wait-Port 5001 "The anomaly model" 20; $mlUrl = "http://127.0.0.1:5001"; Note "listening on $mlUrl" }
            catch { Note "The model did not start, so the rules will run on their own. See $logDir\model.log" }
        } else {
            Note "No trained model found, so the rules will run on their own."
            Note "To train one: cd fraud\ml; pip install -r requirements.txt; python generate_data.py; python train.py"
        }
    }

    # ---------- demo data -----------------------------------------------------
    if (-not $NoSeed) {
        Say "Creating the demo campaigns (this takes a minute)"
        Push-Location (Join-Path $root "fraud\service")
        $env:ML_URL = $mlUrl; $env:NO_ACT = "1"
        & node scripts/integration-demo.mjs 2>&1 | Tee-Object -FilePath (Join-Path $logDir "seed.log") | Select-String "^(PASS|FAIL|Seeded|Scan)" | ForEach-Object { Note $_ }
        $env:ML_URL = $null; $env:NO_ACT = $null
        Pop-Location
    }

    # ---------- fraud service -------------------------------------------------
    Say "Starting the fraud-detection service"
    Start-Bg "fraud service" "node" "src/server.js" (Join-Path $root "fraud\service") (Join-Path $logDir "fraud.log") `
        @{ ML_URL = $mlUrl; PORT = "4000"; POLL_MS = "10000" } | Out-Null
    Wait-Port 4000 "The fraud service"
    Note "listening on http://127.0.0.1:4000"

    # ---------- website -------------------------------------------------------
    Say "Starting the website"
    Start-Bg "website" $vite "--host 127.0.0.1 --port 5173" (Join-Path $root "client") (Join-Path $logDir "web.log") | Out-Null
    Wait-Port 5173 "The website"

    # ---------- ready ---------------------------------------------------------
    Write-Host ""
    Write-Host "  ClearCause is running" -ForegroundColor Green
    Write-Host "  ---------------------" -ForegroundColor Green
    Write-Host "  Website        http://127.0.0.1:5173   (use this, not localhost)"
    Write-Host "  Fraud service  http://127.0.0.1:4000/api/risk"
    Write-Host "  Blockchain     http://127.0.0.1:8545  (chain id 31337)"
    Write-Host ""
    Write-Host "  To sign in as the administrator:" -ForegroundColor Green
    Write-Host "    1. In MetaMask add a network: RPC http://127.0.0.1:8545, chain id 31337, symbol ETH"
    Write-Host "    2. Import the FIRST private key printed in logs\chain.log"
    Write-Host "       (these are public test keys and hold no real money)"
    Write-Host "    3. Open http://127.0.0.1:5173/dashboard/admin to review campaigns"
    Write-Host ""
    Write-Host "  Press Ctrl+C to stop everything." -ForegroundColor Yellow
    Write-Host ""

    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:5173" }

    while ($true) {
        Start-Sleep -Seconds 2
        foreach ($entry in $procs) {
            if ($entry.Proc.HasExited) {
                Write-Host "`n$($entry.Name) stopped unexpectedly. Its log: $($entry.Log)" -ForegroundColor Red
                return
            }
        }
    }
}
finally {
    Stop-All
}
