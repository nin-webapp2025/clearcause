import { useEffect, useRef, useState } from "react"
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react"
import { ConnectionController } from "@reown/appkit-core"
import { Loader2, LogOut, Wallet } from "lucide-react"
import { toast } from "react-toastify"
import { appkit } from "../config/connection"
import { ENABLE_DEMO_WALLET, RPC_URL } from "../constant/chain"
import { Button } from "./ui/button"

const shortAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`
const CONNECTION_TIMEOUT_MS = 15000
const METAMASK_UUID = "7677b54f-3486-46e2-4e37-bf8747814f91"
const METAMASK_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23f6851b' d='M20.6 2 13 7.6l1.4-3.3L20.6 2ZM3.4 2 11 7.7 9.6 4.3 3.4 2Zm14.5 13.1-2 3.1 4.3 1.2 1.2-4.2-3.5-.1Zm-15.3.1 1.2 4.2 4.3-1.2-2-3.1-3.5.1Z'/%3E%3C/svg%3E"
const DEMO_WALLET_UUID = "63c0a090-ec5f-4f31-9330-2f36078aa750"
const DEMO_SESSION_KEY = "clearcause.demo-wallet.connected"
let localDemoProvider
let demoReconnectPromise

const createLocalDemoProvider = () => {
  if (localDemoProvider) return localDemoProvider

  const listeners = new Map()
  const rpcRequest = async (method, params = []) => {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    })
    const payload = await response.json()
    if (payload.error) {
      const error = new Error(payload.error.message)
      error.code = payload.error.code
      throw error
    }
    return payload.result
  }

  localDemoProvider = {
    isClearCauseDemoWallet: true,
    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts") return rpcRequest("eth_accounts")
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null
      if (method === "wallet_revokePermissions") return null
      return rpcRequest(method, params)
    },
    on: (event, callback) => {
      const callbacks = listeners.get(event) || new Set()
      callbacks.add(callback)
      listeners.set(event, callbacks)
    },
    removeListener: (event, callback) => listeners.get(event)?.delete(callback),
  }

  return localDemoProvider
}

const getLegacyInjectedProvider = () => {
  const ethereum = window.ethereum
  if (!ethereum) return null

  if (Array.isArray(ethereum.providers)) {
    return ethereum.providers.find((provider) => provider.isMetaMask) || ethereum.providers[0] || null
  }

  return ethereum
}

const announceInjectedProvider = (provider) => {
  const isDemoWallet = provider.isClearCauseDemoWallet
  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: {
        info: {
          uuid: isDemoWallet ? DEMO_WALLET_UUID : METAMASK_UUID,
          name: isDemoWallet ? "ClearCause Demo Wallet" : provider.isMetaMask ? "MetaMask" : "Browser Wallet",
          icon: METAMASK_ICON,
          rdns: isDemoWallet ? "local.clearcause.wallet" : provider.isMetaMask ? "io.metamask" : "injected.browser.wallet",
        },
        provider,
      },
    }),
  )
}

const findInjectedConnector = () => {
  const connectors = appkit.getConnectors("eip155")
  const injected = connectors.filter(
    (connector) =>
      connector.provider &&
      (connector.type === "ANNOUNCED" || (connector.type === "INJECTED" && Boolean(window.ethereum))),
  )

  return (
    injected.find((connector) => connector.info?.rdns === "io.metamask") ||
    injected.find((connector) => connector.name?.toLowerCase().includes("metamask")) ||
    injected[0]
  )
}

const findDemoConnector = () => appkit
  .getConnectors("eip155")
  .find((connector) => connector.info?.rdns === "local.clearcause.wallet")

const waitForDemoConnector = async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    // AppKit and this component initialize independently on a hard reload. A
    // one-time EIP-6963 announcement can happen before AppKit is listening.
    announceInjectedProvider(createLocalDemoProvider())
    const connector = findDemoConnector()
    if (connector) return connector
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }
  return null
}

const connectWithTimeout = (connector) =>
  Promise.race([
    ConnectionController.connectExternal(connector, "eip155"),
    new Promise((_, reject) =>
      window.setTimeout(() => reject(new Error("Wallet connection timed out. Unlock MetaMask and try again.")), CONNECTION_TIMEOUT_MS),
    ),
  ])

export default function WalletButton() {
  const { address, isConnected } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider("eip155")
  const [connecting, setConnecting] = useState(false)
  const reconnectAttempted = useRef(false)
  const isDemoWallet = Boolean(walletProvider?.isClearCauseDemoWallet)

  useEffect(() => {
    if (!ENABLE_DEMO_WALLET || isConnected || reconnectAttempted.current) return
    reconnectAttempted.current = true

    // EIP-6963 providers must be announced again after a page reload. Remembering
    // only this opt-in flag avoids reconnecting after the user chose Disconnect.
    if (localStorage.getItem(DEMO_SESSION_KEY) !== "true") return
    announceInjectedProvider(createLocalDemoProvider())
    demoReconnectPromise ||= waitForDemoConnector()
      .then(async (connector) => {
        if (!connector) throw new Error("The local demo wallet could not be restored.")
        await connectWithTimeout(connector)
      })
      .finally(() => { demoReconnectPromise = null })
    demoReconnectPromise.catch((error) => {
      localStorage.removeItem(DEMO_SESSION_KEY)
      console.error("Demo wallet reconnection failed:", error)
    })
  }, [isConnected])

  const connect = async () => {
    if (connecting) return

    setConnecting(true)
    try {
      // Re-request announcements in case the extension loaded after AppKit.
      window.dispatchEvent(new Event("eip6963:requestProvider"))
      await new Promise((resolve) => window.setTimeout(resolve, 150))

      let connector = findInjectedConnector()
      if (!connector) {
        const legacyProvider = getLegacyInjectedProvider()
        if (legacyProvider) {
          announceInjectedProvider(legacyProvider)
          await new Promise((resolve) => window.setTimeout(resolve, 150))
          connector = findInjectedConnector()
        }
      }

      if (!connector && ENABLE_DEMO_WALLET) {
        announceInjectedProvider(createLocalDemoProvider())
        await new Promise((resolve) => window.setTimeout(resolve, 150))
        connector = findInjectedConnector()
      }

      if (!connector) {
        toast.error("No browser wallet was detected. Install or unlock MetaMask, then try again.")
        return
      }

      await connectWithTimeout(connector)
      if (connector.info?.rdns === "local.clearcause.wallet") {
        localStorage.setItem(DEMO_SESSION_KEY, "true")
        toast.success("Connected to the local ClearCause demo wallet.")
      }
    } catch (error) {
      const message = error?.message || "Wallet connection failed"
      if (/reject|denied|cancel/i.test(message)) {
        toast.info("Wallet connection was cancelled.")
      } else if (/switch network/i.test(message)) {
        toast.error("MetaMask could not switch to the ClearCause network. Check that the local blockchain is running.")
      } else {
        toast.error(message)
      }
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      if (isDemoWallet) localStorage.removeItem(DEMO_SESSION_KEY)
      await appkit.disconnect()
    } catch {
      toast.error("Could not disconnect the wallet. Lock or disconnect it from MetaMask.")
    }
  }

  if (isConnected && address) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={disconnect}
        title={isDemoWallet ? "Disconnect local demo wallet" : "Disconnect wallet"}
      >
        <Wallet className="mr-2 h-4 w-4" />
        {isDemoWallet && <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">Demo</span>}
        {shortAddress(address)}
        <LogOut className="ml-2 h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button type="button" onClick={connect} disabled={connecting} aria-busy={connecting}>
      {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
      {connecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  )
}
