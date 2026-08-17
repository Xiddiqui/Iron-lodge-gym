@echo off
setlocal EnableDelayedExpansion
:: ============================================================================
:: IRON LODGE GYM — ZKTeco K50 Biometric Bridge One-Click Installer
:: Domain: https://ironlodgegym.com
:: ============================================================================
title Iron Lodge Gym - Biometric Bridge Installer
color 0B

echo ============================================================================
echo   IRON LODGE GYM — ZKTeco K50 Biometric Bridge Installer
echo   Live Server: https://ironlodgegym.com
echo ============================================================================
echo.

:: 1. Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Administrator privileges required. Requesting elevation...
    powershell -NoProfile -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

:: 2. Find Python executable
echo [*] Detecting Python installation...
set "PYTHON_EXE="

:: Check standard python command
python --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%I in ('where python') do (
        if not defined PYTHON_EXE set "PYTHON_EXE=%%I"
    )
)

:: Check py launcher
if not defined PYTHON_EXE (
    py --version >nul 2>&1
    if %errorlevel% equ 0 (
        for /f "delims=" %%I in ('where py') do (
            if not defined PYTHON_EXE set "PYTHON_EXE=%%I"
        )
    )
)

:: Check common AppData / Program Files paths
if not defined PYTHON_EXE (
    for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*" "C:\Python3*" "%ProgramFiles%\Python3*" "%ProgramFiles(x86)%\Python3*") do (
        if exist "%%D\python.exe" (
            set "PYTHON_EXE=%%D\python.exe"
        )
    )
)

if not defined PYTHON_EXE (
    echo.
    echo ============================================================================
    echo [ERROR] Python 3 was not detected on this system!
    echo ============================================================================
    echo Please install Python 3.8+ from: https://www.python.org/downloads/
    echo IMPORTANT: During Python installation, check the box:
    echo   [X] "Add Python to PATH"
    echo ============================================================================
    echo.
    pause
    exit /b 1
)

echo [OK] Using Python: %PYTHON_EXE%
echo.

:: 3. Stop any existing Bridge instances & tasks
echo [*] Stopping any existing bridge tasks and processes...
schtasks /end /tn "IronLodge_K50_Bridge" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*zkteco_bridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: 4. Installation Directory
set "INSTALL_DIR=C:\IronLodgeBridge"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [*] Copying bridge scripts to %INSTALL_DIR%...
if exist "%~dp0zkteco_bridge.py" (
    copy /Y "%~dp0zkteco_bridge.py" "%INSTALL_DIR%\" >nul
) else (
    echo [!] Warning: zkteco_bridge.py not found in current folder.
)

:: 5. Prompt for Configuration
echo.
echo ----------------------------------------------------------------------------
echo  BRIDGE CONFIGURATION
echo ----------------------------------------------------------------------------
set "DEFAULT_IP=192.168.18.215"
set /p K50_IP="Enter K50 Device IP Address [Default: %DEFAULT_IP%]: "
if "%K50_IP%"=="" set "K50_IP=%DEFAULT_IP%"

set "DEFAULT_URL=https://ironlodgegym.com"
set /p USER_URL="Enter Gym Web App URL [Default: %DEFAULT_URL%]: "
if "%USER_URL%"=="" set "USER_URL=%DEFAULT_URL%"

:: Normalize URL using powershell (ensures https:// and removes trailing slashes)
for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "$u='%USER_URL%'.Trim().TrimEnd('/'); if (-not ($u.StartsWith('http://') -or $u.StartsWith('https://'))) { $u='https://' + $u }; Write-Output $u"`) do (
    set "WEB_URL=%%U"
)

echo.
echo Configuration:
echo   - Device IP : %K50_IP%:4370
echo   - Server URL: %WEB_URL%
echo.

:: 6. Connectivity Pre-flight Test
echo [*] Testing connection to web server: %WEB_URL% ...
powershell -NoProfile -Command "try { $res = Invoke-WebRequest -Uri '%WEB_URL%/api/iclock/cdata?SN=INSTALL_CHECK' -UseBasicParsing -TimeoutSec 10; if ($res.StatusCode -eq 200) { Write-Output '[OK] Web server reached successfully!' } else { Write-Output ('[WARN] Server replied with code: ' + $res.StatusCode) } } catch { Write-Output ('[WARN] Could not reach web server: ' + $_.Exception.Message) }"

echo.
echo [*] Testing LAN ping to K50 device at %K50_IP% ...
ping -n 2 -w 1000 %K50_IP% >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] K50 Device responded to ping!
) else (
    echo [!] Note: K50 device did not respond to ping.
    echo     (Ensure K50 is powered on, connected to the router/switch, and has IP %K50_IP%)
)

:: 7. Setup Virtual Environment and Dependencies
echo.
echo [*] Setting up Python virtual environment at %INSTALL_DIR%\venv ...
if not exist "%INSTALL_DIR%\venv\Scripts\python.exe" (
    "%PYTHON_EXE%" -m venv "%INSTALL_DIR%\venv"
)

echo [*] Installing required Python libraries (pyzk, requests)...
"%INSTALL_DIR%\venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
"%INSTALL_DIR%\venv\Scripts\python.exe" -m pip install --quiet pyzk requests

:: 8. Create start_bridge.bat
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo "%INSTALL_DIR%\venv\Scripts\python.exe" -u zkteco_bridge.py --ip %K50_IP% --port 4370 --server %WEB_URL% ^>^> "%INSTALL_DIR%\bridge.log" 2^>^&1
) > "%INSTALL_DIR%\start_bridge.bat"

:: 9. Create start_bridge_hidden.vbs (for completely silent background startup)
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run chr(34^) ^& "%INSTALL_DIR%\start_bridge.bat" ^& chr(34^), 0
echo Set WshShell = Nothing
) > "%INSTALL_DIR%\start_bridge_hidden.vbs"

:: 10. Create run_bridge_visible.bat (for live debugging with a visible terminal)
(
echo @echo off
echo title Iron Lodge Gym - Biometric Live Bridge
echo color 0A
echo cd /d "%INSTALL_DIR%"
echo echo ============================================================================
echo echo   IRON LODGE GYM - LIVE BIOMETRIC CONSOLE
echo echo   Device: %K50_IP%:4370  --^>  Server: %WEB_URL%
echo echo ============================================================================
echo echo.
echo "%INSTALL_DIR%\venv\Scripts\python.exe" -u zkteco_bridge.py --ip %K50_IP% --port 4370 --server %WEB_URL%
echo.
echo Bridge stopped. Press any key to close...
echo pause ^>nul
) > "%INSTALL_DIR%\run_bridge_visible.bat"

:: 11. Create view_logs.bat
(
echo @echo off
echo title Iron Lodge Gym - Bridge Logs
echo cd /d "%INSTALL_DIR%"
echo if not exist "bridge.log" (
echo   echo No logs found yet.
echo   pause
echo   exit /b
echo ^)
echo powershell -NoProfile -Command "Get-Content -Path '%INSTALL_DIR%\bridge.log' -Tail 50 -Wait"
) > "%INSTALL_DIR%\view_logs.bat"

:: 12. Create stop_bridge.bat
(
echo @echo off
echo echo [*] Stopping Iron Lodge Bridge...
echo schtasks /end /tn "IronLodge_K50_Bridge" ^>nul 2^>^&1
echo powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*zkteco_bridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" ^>nul 2^>^&1
echo [OK] Bridge stopped.
echo pause
) > "%INSTALL_DIR%\stop_bridge.bat"

:: 13. Create Desktop Shortcuts for Convenience
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $d = [Environment]::GetFolderPath('Desktop'); $s1 = $ws.CreateShortcut(\"$d\Iron Lodge Bridge - Live Console.lnk\"); $s1.TargetPath = '%INSTALL_DIR%\run_bridge_visible.bat'; $s1.WorkingDirectory = '%INSTALL_DIR%'; $s1.Save(); $s2 = $ws.CreateShortcut(\"$d\Iron Lodge Bridge - View Logs.lnk\"); $s2.TargetPath = '%INSTALL_DIR%\view_logs.bat'; $s2.WorkingDirectory = '%INSTALL_DIR%'; $s2.Save()" >nul 2>&1

:: 14. Register Windows Auto-Start Task
echo.
echo [*] Registering Windows Auto-Start Task (IronLodge_K50_Bridge)...
schtasks /create /tn "IronLodge_K50_Bridge" /tr "wscript.exe \"%INSTALL_DIR%\start_bridge_hidden.vbs\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1

if %errorlevel% neq 0 (
    :: Fallback to startup folder shortcut
    echo [!] Scheduled task registration notice. Adding to Startup folder...
    powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\IronLodge_K50_Bridge.lnk\"); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%INSTALL_DIR%\start_bridge_hidden.vbs\"'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Save()" >nul 2>&1
)

:: 15. Start the background service right now
echo [*] Starting background bridge service now...
wscript.exe "%INSTALL_DIR%\start_bridge_hidden.vbs"

timeout /t 2 /nobreak >nul 2>&1

echo.
echo ============================================================================
echo  [SUCCESS] ZKTeco K50 Bridge is now installed and running in the background!
echo ============================================================================
echo.
echo  - Target Server : %WEB_URL%
echo  - Target K50 IP : %K50_IP%:4370
echo  - Installation : %INSTALL_DIR%
echo.
echo  Desktop shortcuts created:
echo    1. "Iron Lodge Bridge - Live Console" (Opens interactive window to test punches)
echo    2. "Iron Lodge Bridge - View Logs"    (Shows live log file updates)
echo.
echo  The bridge will now automatically start every time this PC turns on.
echo ============================================================================
echo.
pause
