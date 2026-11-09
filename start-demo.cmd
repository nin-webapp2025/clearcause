@echo off
REM ClearCause - double-click this file to start the whole demo.
REM It just runs start-demo.ps1 next to it, so you never need to open PowerShell yourself.

cd /d "%~dp0"
title ClearCause demo

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1" %*

echo.
echo ------------------------------------------------------------
echo  The demo has stopped. You can close this window.
echo  If something went wrong above, the logs are in the 'logs'
echo  folder next to this file.
echo ------------------------------------------------------------
pause
