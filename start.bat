@echo off
REM FreeLLM Router - one-click start for Windows
title FreeLLM Router
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Trying to install it with winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo.
    echo Please install Node.js LTS from https://nodejs.org and run start.bat again.
    start https://nodejs.org
    pause
    exit /b 1
  )
  echo.
  echo Node.js installed. Close this window and double-click start.bat again.
  pause
  exit /b 0
)

for /f %%a in ('node -p "process.versions.node.split('.')[0]"') do set NODEMAJOR=%%a
if %NODEMAJOR% LSS 20 (
  echo Your Node.js is too old. Please install Node.js 20 or newer from https://nodejs.org
  pause
  exit /b 1
)

if not defined PORT set PORT=8787
echo.
echo  FreeLLM Router is starting...
echo  Open:  http://localhost:%PORT%   (Setup page opens in your browser)
echo  API :  http://localhost:%PORT%/v1
echo  Stop:  close this window or press Ctrl+C
echo.
start "" "http://localhost:%PORT%"
set HOST=127.0.0.1
node src\server.js --port %PORT%
pause
