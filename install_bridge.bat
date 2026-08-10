@echo off
:: ============================================================================
:: IRON LODGE GYM — ZKTeco K50 Biometric Bridge One-Click Installer for Windows
:: ============================================================================
title Iron Lodge Gym - Biometric Bridge Installer
color 0A

echo ============================================================================
echo   IRON LODGE GYM — ZKTeco K50 Biometric Bridge Installer
echo ============================================================================
echo.

:: 1. Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Requesting Administrator privileges...
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

:: 2. Set Installation Directory
set INSTALL_DIR=C:\IronLodgeBridge
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [*] Copying bridge files to %INSTALL_DIR%...
copy /Y "%~dp0zkteco_bridge.py" "%INSTALL_DIR%\" >nul

:: 3. Ask for K50 Device IP
echo.
set /p K50_IP="Enter the K50 Device IP Address (default: 192.168.18.215): "
if "%K50_IP%"=="" set K50_IP=192.168.18.215

set /p VERCEL_URL="Enter your Web App URL (default: https://iron-lodge-gym.vercel.app): "
if "%VERCEL_URL%"=="" set VERCEL_URL=https://iron-lodge-gym.vercel.app

:: 4. Create the start_bridge.bat script
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo if not exist "venv" python -m venv venv
echo call venv\Scripts\activate.bat
echo pip install --quiet pyzk requests
echo python -u zkteco_bridge.py --ip %K50_IP% --port 4370 --server %VERCEL_URL% ^>^> bridge.log 2^>^&1
) > "%INSTALL_DIR%\start_bridge.bat"

:: 5. Create Windows Scheduled Task (Runs on Windows startup silently)
echo.
echo [*] Registering Windows Auto-Start Background Task...
schtasks /create /tn "IronLodge_K50_Bridge" /tr "cmd.exe /c \"%INSTALL_DIR%\start_bridge.bat\"" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f >nul 2>&1

if %errorlevel% neq 0 (
    :: Fallback to ONLOGON if ONSTART SYSTEM fails
    schtasks /create /tn "IronLodge_K50_Bridge" /tr "cmd.exe /c \"%INSTALL_DIR%\start_bridge.bat\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1
)

:: 6. Start the task immediately right now
echo [*] Starting background bridge service now...
schtasks /run /tn "IronLodge_K50_Bridge" >nul 2>&1

echo.
echo ============================================================================
echo [SUCCESS] ZKTeco K50 Bridge is now installed and running in background!
echo [SUCCESS] It will automatically start every time this PC turns on.
echo ============================================================================
echo.
pause
