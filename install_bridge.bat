@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
:: ============================================================================
:: IRON LODGE GYM -- ZKTeco K50 Biometric Bridge One-Click Installer
:: Optimized for Windows 10, Windows 11, Windows 8, and Windows 7 (32 & 64 bit)
:: Live Domain: https://ironlodgegym.com
:: ============================================================================
title Iron Lodge Gym - Biometric Bridge Installer (Windows 10/11)
color 0B

echo ============================================================================
echo   IRON LODGE GYM -- ZKTeco K50 Biometric Bridge Installer
echo   Target OS: Windows 10 / 11 / 7 (32-bit and 64-bit)
echo   Live Server: https://ironlodgegym.com
echo ============================================================================
echo.

:: 1. Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Requesting Administrator elevation...
    powershell -NoProfile -Command "Start-Process 'cmd.exe' -ArgumentList '/k cd /d \"%~dp0\" && \"%~f0\"' -Verb RunAs" 2>nul
    if %errorlevel% neq 0 (
        echo [!] Administrator privileges required.
        echo [!] Please right-click install_bridge.bat and select "Run as Administrator".
        pause
    )
    exit /b
)

:: 2. Find Python executable
echo [*] Detecting Python installation on Windows...
set "PYTHON_EXE="

:: Check standard python command
python --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%I in ('where python 2^>nul') do (
        if not defined PYTHON_EXE (
            echo %%I | findstr /i "WindowsApps" >nul
            if errorlevel 1 (
                set "PYTHON_EXE=%%I"
            )
        )
    )
)

:: Check py launcher
if not defined PYTHON_EXE (
    py --version >nul 2>&1
    if %errorlevel% equ 0 (
        for /f "delims=" %%I in ('where py 2^>nul') do (
            if not defined PYTHON_EXE set "PYTHON_EXE=%%I"
        )
    )
)

:: Check common Windows 10 & 11 directories (Python 3.8 - 3.13)
if not defined PYTHON_EXE (
    for /d %%D in (
        "%LOCALAPPDATA%\Programs\Python\Python313*"
        "%LOCALAPPDATA%\Programs\Python\Python312*"
        "%LOCALAPPDATA%\Programs\Python\Python311*"
        "%LOCALAPPDATA%\Programs\Python\Python310*"
        "%LOCALAPPDATA%\Programs\Python\Python39*"
        "%LOCALAPPDATA%\Programs\Python\Python38*"
        "%ProgramFiles%\Python313*"
        "%ProgramFiles%\Python312*"
        "%ProgramFiles%\Python311*"
        "%ProgramFiles%\Python310*"
        "%ProgramFiles%\Python39*"
        "%ProgramFiles%\Python38*"
        "%ProgramFiles(x86)%\Python313*"
        "%ProgramFiles(x86)%\Python312*"
        "%ProgramFiles(x86)%\Python311*"
        "%ProgramFiles(x86)%\Python310*"
        "%ProgramFiles(x86)%\Python39*"
        "%ProgramFiles(x86)%\Python38*"
        "C:\Python313*"
        "C:\Python312*"
        "C:\Python311*"
        "C:\Python310*"
        "C:\Python39*"
        "C:\Python38*"
    ) do (
        if exist "%%~D\python.exe" (
            set "PYTHON_EXE=%%~D\python.exe"
        )
    )
)

:: 3. Download & Install Python 3.11 if not present on Windows 10
if not defined PYTHON_EXE (
    echo.
    echo ============================================================================
    echo [*] Python not detected. Downloading Python 3.11 for Windows 10...
    echo ============================================================================
    
    set "PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    if "%PROCESSOR_ARCHITECTURE%"=="x86" (
        if not defined PROCESSOR_ARCHITEW6432 (
            set "PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9.exe"
        )
    )
    
    echo [*] Downloading Python installer from python.org...
    powershell -NoProfile -Command "[System.Net.ServicePointManager]::SecurityProtocol = 3072 -bor 768 -bor 192; $wc = New-Object System.Net.WebClient; $wc.DownloadFile('!PY_URL!', \"$env:TEMP\python_installer.exe\")" >nul 2>&1
    
    if exist "%TEMP%\python_installer.exe" (
        echo [*] Installing Python 3.11 silently with PATH enabled (takes ~1-2 minutes)...
        "%TEMP%\python_installer.exe" /passive InstallAllUsers=1 PrependPath=1 Include_test=0 Include_doc=0 Include_tcltk=0
        timeout /t 8 /nobreak >nul 2>&1
        
        for /d %%D in (
            "%ProgramFiles%\Python311*"
            "%LOCALAPPDATA%\Programs\Python\Python311*"
            "C:\Python311*"
            "%ProgramFiles(x86)%\Python311*"
        ) do (
            if exist "%%~D\python.exe" set "PYTHON_EXE=%%~D\python.exe"
        )
        del /f /q "%TEMP%\python_installer.exe" >nul 2>&1
    )
)

if not defined PYTHON_EXE (
    echo.
    echo ============================================================================
    echo [ACTION REQUIRED - INSTALL PYTHON]
    echo Python could not be automatically detected.
    echo.
    echo 1. Download Python from: https://www.python.org/downloads/
    echo 2. Run the installer.
    echo 3. VERY IMPORTANT: Check the box [X] "Add python.exe to PATH"
    echo 4. Click "Install Now"
    echo 5. Run this installer again!
    echo ============================================================================
    pause
    exit /b 1
)

echo [OK] Python Detected: %PYTHON_EXE%
echo.

:: 4. Stop any existing Bridge instances & tasks
echo [*] Stopping any existing bridge processes...
taskkill /f /fi "WINDOWTITLE eq Iron Lodge Gym*" >nul 2>&1
taskkill /f /im python.exe /fi "WINDOWTITLE eq *zkteco*" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*zkteco_bridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: 5. Create Installation Directory
set "INSTALL_DIR=C:\IronLodgeBridge"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: 6. Setup Bridge Script in INSTALL_DIR
echo [*] Setting up bridge files in %INSTALL_DIR%...
if exist "%~dp0zkteco_bridge.py" (
    copy /y "%~dp0zkteco_bridge.py" "%INSTALL_DIR%\zkteco_bridge.py" >nul
)

:: 7. Windows Defender Firewall Rule for Port 4370
echo [*] Adding Windows Firewall rules for Port 4370 (ZKTeco K50 Communication)...
netsh advfirewall firewall delete rule name="IronLodge_ZKTeco_4370" >nul 2>&1
netsh advfirewall firewall add rule name="IronLodge_ZKTeco_4370" dir=in action=allow protocol=TCP localport=4370 >nul 2>&1
netsh advfirewall firewall add rule name="IronLodge_ZKTeco_4370" dir=in action=allow protocol=UDP localport=4370 >nul 2>&1
netsh advfirewall firewall add rule name="IronLodge_ZKTeco_4370" dir=out action=allow protocol=TCP localport=4370 >nul 2>&1
netsh advfirewall firewall add rule name="IronLodge_ZKTeco_4370" dir=out action=allow protocol=UDP localport=4370 >nul 2>&1

:: 8. Prompt for Configuration
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

set "WEB_URL=%USER_URL%"
if not "%WEB_URL:~0,4%"=="http" set "WEB_URL=https://%WEB_URL%"
if "%WEB_URL:~-1%"=="/" set "WEB_URL=%WEB_URL:~0,-1%"

echo.
echo Configuration:
echo   - Device IP : %K50_IP%:4370
echo   - Server URL: %WEB_URL%
echo.

:: Save config.json for python script
(
echo {
echo   "device_ip": "%K50_IP%",
echo   "device_port": 4370,
echo   "server_url": "%WEB_URL%"
echo }
) > "%INSTALL_DIR%\config.json"

:: 9. Connectivity Pre-flight Test
echo [*] Testing connection to web server: %WEB_URL% ...
powershell -NoProfile -Command "[System.Net.ServicePointManager]::SecurityProtocol = 3072 -bor 768 -bor 192; try { $wc = New-Object System.Net.WebClient; $r = $wc.DownloadString('%WEB_URL%/api/iclock/cdata?SN=INSTALL_CHECK'); Write-Output '[OK] Web server reached successfully!' } catch { Write-Output ('[WARN] Could not reach web server: ' + $_.Exception.Message) }"

echo.
echo [*] Testing LAN ping to K50 device at %K50_IP% ...
ping -n 2 -w 1000 %K50_IP% >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] K50 Device responded to ping!
) else (
    echo [!] Note: K50 device did not respond to ping.
    echo     (Ensure K50 is powered on, connected to LAN, and configured with IP %K50_IP%)
)

:: 10. Install Required Python Libraries (pyzk, requests)
echo.
echo [*] Installing required Python libraries (pyzk, requests)...
"%PYTHON_EXE%" -m pip install --upgrade pip --quiet >nul 2>&1
"%PYTHON_EXE%" -m pip install pyzk requests >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Retrying pip install with user flag...
    "%PYTHON_EXE%" -m pip install --user pyzk requests
)

:: 11. Create start_bridge.bat (Watchdog loop with timestamped logging)
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo :WATCHDOG
echo [%%DATE%% %%TIME%%] Starting Iron Lodge Bridge... ^>^> "%INSTALL_DIR%\bridge.log"
echo "%PYTHON_EXE%" -u "%INSTALL_DIR%\zkteco_bridge.py" --ip %K50_IP% --port 4370 --server %WEB_URL% ^>^> "%INSTALL_DIR%\bridge.log" 2^>^&1
echo [%%DATE%% %%TIME%%] Bridge process exited. Restarting in 5 seconds... ^>^> "%INSTALL_DIR%\bridge.log"
echo ping -n 6 127.0.0.1 ^>nul
echo goto WATCHDOG
) > "%INSTALL_DIR%\start_bridge.bat"

:: 12. Create start_bridge_hidden.vbs (Runs background watchdog silently)
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run chr(34^) ^& "%INSTALL_DIR%\start_bridge.bat" ^& chr(34^), 0
echo Set WshShell = Nothing
) > "%INSTALL_DIR%\start_bridge_hidden.vbs"

:: 13. Create run_bridge_visible.bat (Live Interactive Console)
(
echo @echo off
echo title Iron Lodge Gym - Biometric Live Bridge Console
echo color 0A
echo cd /d "%INSTALL_DIR%"
echo echo ============================================================================
echo echo   IRON LODGE GYM - LIVE BIOMETRIC CONSOLE
echo echo   Device: %K50_IP%:4370  --^>  Server: %WEB_URL%
echo echo ============================================================================
echo echo.
echo echo [*] Stopping background instance before opening interactive console...
echo powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*zkteco_bridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" ^>nul 2^>^&1
echo timeout /t 2 /nobreak ^>nul 2^>^&1
echo echo [*] Running Bridge in visible console mode...
echo echo.
echo "%PYTHON_EXE%" -u "%INSTALL_DIR%\zkteco_bridge.py" --ip %K50_IP% --port 4370 --server %WEB_URL%
echo.
echo ============================================================================
echo Bridge process ended.
echo Resuming background service...
echo wscript.exe "%INSTALL_DIR%\start_bridge_hidden.vbs"
echo.
echo Press any key to close this console.
echo pause ^>nul
) > "%INSTALL_DIR%\run_bridge_visible.bat"

:: 14. Create view_logs.bat
(
echo @echo off
echo title Iron Lodge Gym - Bridge Logs
echo cd /d "%INSTALL_DIR%"
echo if not exist "bridge.log" (
echo   echo No logs created yet.
echo   pause
echo   exit /b
echo ^)
echo type "%INSTALL_DIR%\bridge.log"
echo.
echo ============================================================================
echo End of log. Press any key to refresh...
echo pause ^>nul
echo "%INSTALL_DIR%\view_logs.bat"
) > "%INSTALL_DIR%\view_logs.bat"

:: 15. Create stop_bridge.bat
(
echo @echo off
echo echo [*] Stopping Iron Lodge Bridge...
echo powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*zkteco_bridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" ^>nul 2^>^&1
echo echo [OK] Bridge stopped.
echo pause
) > "%INSTALL_DIR%\stop_bridge.bat"

:: 16. Create restart_bridge.bat
(
echo @echo off
echo echo [*] Restarting Iron Lodge Bridge Service...
echo powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*zkteco_bridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" ^>nul 2^>^&1
echo timeout /t 2 /nobreak ^>nul 2^>^&1
echo wscript.exe "%INSTALL_DIR%\start_bridge_hidden.vbs"
echo echo [OK] Bridge service restarted in background.
echo timeout /t 3 /nobreak ^>nul 2^>^&1
) > "%INSTALL_DIR%\restart_bridge.bat"

:: 17. Configure Auto-Start on Windows 10 / 11
echo [*] Registering 100%% Reliable Auto-Start mechanisms...

:: Method A: Windows Task Scheduler (Runs on User Logon with Highest Privileges)
schtasks /delete /tn "IronLodge_K50_Bridge" /f >nul 2>&1
schtasks /create /tn "IronLodge_K50_Bridge" /tr "wscript.exe \"%INSTALL_DIR%\start_bridge_hidden.vbs\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1

:: Method B: Windows Task Scheduler (Runs on System Startup / Boot)
schtasks /delete /tn "IronLodge_K50_Bridge_Boot" /f >nul 2>&1
schtasks /create /tn "IronLodge_K50_Bridge_Boot" /tr "wscript.exe \"%INSTALL_DIR%\start_bridge_hidden.vbs\"" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f >nul 2>&1

:: Method C: Registry Run Keys (HKCU & HKLM)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "IronLodgeK50Bridge" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\start_bridge_hidden.vbs\"" /f >nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "IronLodgeK50Bridge" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\start_bridge_hidden.vbs\"" /f >nul 2>&1

:: Method D: Windows Startup Folder Shortcut (Current User & All Users)
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $userStartup = [Environment]::GetFolderPath('Startup'); $s1 = $ws.CreateShortcut(\"$userStartup\IronLodge_K50_Bridge.lnk\"); $s1.TargetPath = 'wscript.exe'; $s1.Arguments = '\"%INSTALL_DIR%\start_bridge_hidden.vbs\"'; $s1.WorkingDirectory = '%INSTALL_DIR%'; $s1.Save()" >nul 2>&1
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $commonStartup = [Environment]::GetFolderPath('CommonStartup'); if ($commonStartup) { $s2 = $ws.CreateShortcut(\"$commonStartup\IronLodge_K50_Bridge.lnk\"); $s2.TargetPath = 'wscript.exe'; $s2.Arguments = '\"%INSTALL_DIR%\start_bridge_hidden.vbs\"'; $s2.WorkingDirectory = '%INSTALL_DIR%'; $s2.Save() }" >nul 2>&1

:: 18. Create Desktop Shortcuts for Staff
echo [*] Creating Desktop shortcuts...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $s1 = $ws.CreateShortcut(\"$desktop\Iron Lodge Bridge - Live Console.lnk\"); $s1.TargetPath = '%INSTALL_DIR%\run_bridge_visible.bat'; $s1.WorkingDirectory = '%INSTALL_DIR%'; $s1.Save(); $s2 = $ws.CreateShortcut(\"$desktop\Iron Lodge Bridge - View Logs.lnk\"); $s2.TargetPath = '%INSTALL_DIR%\view_logs.bat'; $s2.WorkingDirectory = '%INSTALL_DIR%'; $s2.Save(); $s3 = $ws.CreateShortcut(\"$desktop\Iron Lodge Bridge - Restart Service.lnk\"); $s3.TargetPath = '%INSTALL_DIR%\restart_bridge.bat'; $s3.WorkingDirectory = '%INSTALL_DIR%'; $s3.Save()" >nul 2>&1

:: 19. Start the background service right now
echo [*] Starting background bridge service now...
wscript.exe "%INSTALL_DIR%\start_bridge_hidden.vbs"

timeout /t 2 /nobreak >nul 2>&1

echo.
echo ============================================================================
echo  [SUCCESS] ZKTeco K50 Bridge is now installed and active!
echo ============================================================================
echo.
echo  - Target Server : %WEB_URL%
echo  - Target K50 IP : %K50_IP%:4370
echo  - Installed At  : %INSTALL_DIR%
echo.
echo  Desktop shortcuts created on your screen:
echo    1. "Iron Lodge Bridge - Live Console"      (Open to watch fingerprint punches live)
echo    2. "Iron Lodge Bridge - Restart Service"   (Restart if connection ever needs reset)
echo    3. "Iron Lodge Bridge - View Logs"         (View sync activity log)
echo.
echo  The bridge is registered to auto-start automatically on every Windows boot
echo  and whenever any user signs in.
echo ============================================================================
echo.
pause
