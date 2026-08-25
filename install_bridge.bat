@echo off
setlocal EnableDelayedExpansion
:: ============================================================================
:: IRON LODGE GYM -- ZKTeco K50 Biometric Bridge One-Click Installer
:: Compatible with Windows 7, Windows 8, Windows 10, and Windows 11 (32 & 64 bit)
:: Domain: https://ironlodgegym.com
:: ============================================================================
title Iron Lodge Gym - Biometric Bridge Installer
color 0B

echo ============================================================================
echo   IRON LODGE GYM -- ZKTeco K50 Biometric Bridge Installer
echo   Live Server: https://ironlodgegym.com
echo ============================================================================
echo.

:: 1. Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Administrator privileges required. Requesting elevation...
    powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs" 2>nul
    if %errorlevel% neq 0 (
        echo [!] Please right-click this file and select "Run as Administrator".
        pause
    )
    exit /b
)

:: 2. Find Python executable
echo [*] Detecting Python installation...
set "PYTHON_EXE="

:: Check standard python command
python --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%I in ('where python 2^>nul') do (
        if not defined PYTHON_EXE set "PYTHON_EXE=%%I"
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

:: Check common paths (Windows 7 / 10 / 11)
if not defined PYTHON_EXE (
    for /d %%D in ("C:\Python38*" "C:\Python39*" "C:\Python310*" "C:\Python311*" "%LOCALAPPDATA%\Programs\Python\Python38*" "%LOCALAPPDATA%\Programs\Python\Python39*" "%LOCALAPPDATA%\Programs\Python\Python310*" "%ProgramFiles%\Python38*" "%ProgramFiles(x86)%\Python38*") do (
        if exist "%%~D\python.exe" (
            set "PYTHON_EXE=%%~D\python.exe"
        )
    )
)

:: 3. Download & Install Python 3.8.10 if not present (Python 3.8 is the official Windows 7 compatible release)
if not defined PYTHON_EXE (
    echo.
    echo ============================================================================
    echo [*] Python was not found. Downloading Python 3.8.10 (Compatible with Windows 7)...
    echo ============================================================================
    
    set "PY_URL=https://www.python.org/ftp/python/3.8.10/python-3.8.10.exe"
    if "%PROCESSOR_ARCHITECTURE%"=="AMD64" set "PY_URL=https://www.python.org/ftp/python/3.8.10/python-3.8.10-amd64.exe"
    if defined PROCESSOR_ARCHITEW6432 set "PY_URL=https://www.python.org/ftp/python/3.8.10/python-3.8.10-amd64.exe"
    
    echo [*] Downloading installer from python.org...
    powershell -NoProfile -Command "[System.Net.ServicePointManager]::SecurityProtocol = 3072 -bor 768 -bor 192; $wc = New-Object System.Net.WebClient; $wc.DownloadFile('!PY_URL!', \"$env:TEMP\python_installer.exe\")" >nul 2>&1
    
    if exist "%TEMP%\python_installer.exe" (
        echo [*] Installing Python 3.8.10 silently (this takes ~1-2 minutes)...
        "%TEMP%\python_installer.exe" /passive InstallAllUsers=1 PrependPath=1 Include_test=0 Include_doc=0 Include_tcltk=0
        timeout /t 6 /nobreak >nul 2>&1
        
        for /d %%D in ("%ProgramFiles%\Python38*" "%ProgramFiles(x86)%\Python38*" "%LOCALAPPDATA%\Programs\Python\Python38*" "C:\Python38*") do (
            if exist "%%~D\python.exe" set "PYTHON_EXE=%%~D\python.exe"
        )
        del /f /q "%TEMP%\python_installer.exe" >nul 2>&1
    )
)

if not defined PYTHON_EXE (
    echo.
    echo ============================================================================
    echo [NOTE FOR WINDOWS 7]
    echo Python could not be installed automatically.
    echo Please download and install Python 3.8.10 manually from:
    echo   https://www.python.org/ftp/python/3.8.10/python-3.8.10-amd64.exe (64-bit)
    echo   OR: https://www.python.org/ftp/python/3.8.10/python-3.8.10.exe (32-bit)
    echo.
    echo IMPORTANT: In the installer, check: [X] "Add Python 3.8 to PATH"
    echo Then run this installer again!
    echo ============================================================================
    pause
    exit /b 1
)

echo [OK] Using Python: %PYTHON_EXE%
echo.

:: 4. Stop any existing Bridge instances & tasks
echo [*] Stopping any running bridge instances...
taskkill /f /fi "WINDOWTITLE eq Iron Lodge Gym*" >nul 2>&1
wmic process where "name='python.exe' and commandline like '%%zkteco_bridge%%'" call terminate >nul 2>&1
powershell -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*zkteco_bridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: 5. Create Installation Directory
set "INSTALL_DIR=C:\IronLodgeBridge"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: 6. Setup Bridge Script in INSTALL_DIR
echo [*] Setting up bridge script in %INSTALL_DIR%...
if exist "%~dp0zkteco_bridge.py" (
    copy /y "%~dp0zkteco_bridge.py" "%INSTALL_DIR%\zkteco_bridge.py" >nul
) else (
(
echo #!/usr/bin/env python3
echo import sys
echo import time
echo import argparse
echo import threading
echo import socket
echo from datetime import datetime
echo.
echo try:
echo     from zk import ZK
echo except ImportError:
echo     import subprocess
echo     try:
echo         subprocess.check_call([sys.executable, "-m", "pip", "install", "pyzk", "requests"]^)
echo     except Exception:
echo         subprocess.check_call([sys.executable, "-m", "pip", "install", "--break-system-packages", "pyzk", "requests"]^)
echo     from zk import ZK
echo.
echo import requests
echo.
echo BRIDGE_SN = "K50_LOCAL_BRIDGE"
echo HEARTBEAT_INTERVAL = 5 * 60
echo.
echo def normalize_url(url: str^) -^> str:
echo     url = (url or ""^).strip(^).rstrip("/"^)
echo     if not url:
echo         return "https://ironlodgegym.com"
echo     if not url.startswith("http://"^) and not url.startswith("https://"^):
echo         url = f"https://{url}"
echo     return url
echo.
echo def get_local_ip(^):
echo     try:
echo         s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM^)
echo         s.connect(("8.8.8.8", 80^)^)
echo         ip = s.getsockname(^)[0]
echo         s.close(^)
echo         return ip
echo     except Exception:
echo         return "unknown"
echo.
echo def heartbeat_loop(server_url: str, stop_event: threading.Event^):
echo     local_ip = get_local_ip(^)
echo     heartbeat_url = f"{server_url}/api/iclock/cdata?SN={BRIDGE_SN}"
echo     print(f"[Heartbeat] Background heartbeat started -- pinging every {HEARTBEAT_INTERVAL // 60} min"^)
echo     while not stop_event.is_set(^):
echo         try:
echo             res = requests.get(heartbeat_url, headers={"X-Bridge-IP": local_ip}, timeout=10^)
echo             ts = datetime.now(^).strftime("%%H:%%M:%%S"^)
echo             if res.status_code == 200:
echo                 print(f"[Heartbeat] [OK] {ts} -- Server confirmed bridge is alive"^)
echo             else:
echo                 print(f"[Heartbeat] [WARN] {ts} -- Server replied status {res.status_code}"^)
echo         except Exception as e:
echo             ts = datetime.now(^).strftime("%%H:%%M:%%S"^)
echo             print(f"[Heartbeat] [WARN] {ts} -- Could not reach server: {e}"^)
echo         stop_event.wait(timeout=HEARTBEAT_INTERVAL^)
echo.
echo def send_punch_to_webapp(server_url, user_id, timestamp_str^):
echo     cdata_endpoint = f"{server_url}/api/iclock/cdata?table=ATTLOG&SN={BRIDGE_SN}"
echo     body = f"{user_id}\t{timestamp_str}\t0\t1\t0\t0\t0"
echo     print(f"\n[Fingerprint Punch] User ID: {user_id} | Time: {timestamp_str}"^)
echo     try:
echo         res = requests.post(cdata_endpoint, data=body, headers={"Content-Type": "text/plain; charset=utf-8"}, timeout=10^)
echo         if res.status_code == 200:
echo             print(f"[Web Sync] [OK] Sent punch for User #{user_id} to web app -> Success! ({res.text.strip(^)})"^)
echo         else:
echo             print(f"[Web Sync] [WARN] Web app returned status {res.status_code}: {res.text}"^)
echo     except Exception as req_err:
echo         print(f"[Web Sync] [ERROR] Failed to reach web app: {req_err}"^)
echo.
echo def main(^):
echo     parser = argparse.ArgumentParser(description="ZKTeco K50 Bridge to Iron Lodge Gym Web App"^)
echo     parser.add_argument("--ip", required=True, help="IP address of K50 device"^)
echo     parser.add_argument("--port", type=int, default=4370, help="Port of K50 device"^)
echo     parser.add_argument("--server", default="https://ironlodgegym.com", help="Live web app URL"^)
echo     args = parser.parse_args(^)
echo     device_ip = args.ip
echo     device_port = args.port
echo     server_url = normalize_url(args.server^)
echo.
echo     print("=" * 60^)
echo     print("  IRON LODGE GYM -- ZKTeco K50 Live Biometric Bridge"^)
echo     print("=" * 60^)
echo     print(f"  Target Device IP : {device_ip}:{device_port}"^)
echo     print(f"  Target Web App   : {server_url}"^)
echo     print("=" * 60^)
echo.
echo     stop_event = threading.Event(^)
echo     heartbeat_thread = threading.Thread(target=heartbeat_loop, args=(server_url, stop_event^), daemon=True^)
echo     heartbeat_thread.start(^)
echo.
echo     force_udp_modes = [False, True]
echo     while True:
echo         conn = None
echo         connected = False
echo         for udp in force_udp_modes:
echo             mode_name = "UDP" if udp else "TCP"
echo             try:
echo                 print(f"\n[Bridge] Trying {mode_name} connection to ZKTeco K50 at {device_ip}:{device_port}..."^)
echo                 zk = ZK(device_ip, port=device_port, timeout=8, password=0, force_udp=udp^)
echo                 zk.omits_ping = True
echo                 conn = zk.connect(^)
echo                 print(f"[Bridge] [OK] Connected successfully via {mode_name}! Listening for punches..."^)
echo                 connected = True
echo                 break
echo             except Exception as conn_err:
echo                 print(f"[Bridge] {mode_name} connection attempt failed ({conn_err})"^)
echo         if not connected:
echo             print(f"\n[Bridge] [WARN] Could not connect to K50 at {device_ip}:{device_port}."^)
echo             print("  Check: Is K50 powered on? Is IP correct? Is Comm Key set to 0?"^)
echo             print("[Bridge] Retrying in 5 seconds..."^)
echo             time.sleep(5^)
echo             continue
echo         try:
echo             seen_records = set(^)
echo             try:
echo                 print("[Bridge] Checking for punches made while PC was off..."^)
echo                 all_logs = conn.get_attendance(^) or []
echo                 today_str = datetime.now(^).strftime("%%Y-%%m-%%d"^)
echo                 recent_logs = [r for r in all_logs if r.timestamp.strftime("%%Y-%%m-%%d"^) >= today_str]
echo                 print(f"[Bridge] Found {len(recent_logs)} punch records for today. Syncing to web app..."^)
echo                 for rec in recent_logs:
echo                     key = (str(rec.user_id^), rec.timestamp.strftime("%%Y-%%m-%%d %%H:%%M:%%S"^)^)
echo                     seen_records.add(key^)
echo                     send_punch_to_webapp(server_url, str(rec.user_id^), rec.timestamp.strftime("%%Y-%%m-%%d %%H:%%M:%%S"^)^)
echo                 for rec in all_logs:
echo                     seen_records.add((str(rec.user_id^), rec.timestamp.strftime("%%Y-%%m-%%d %%H:%%M:%%S"^)^)^)
echo                 print("[Bridge] [OK] Sync complete. Listening for new punches..."^)
echo             except Exception as sync_err:
echo                 print(f"[Bridge] Initial offline sync notice: {sync_err}"^)
echo             try:
echo                 for attendance in conn.live_capture(^):
echo                     if attendance is None:
echo                         continue
echo                     user_id = str(attendance.user_id^)
echo                     timestamp_str = attendance.timestamp.strftime('%%Y-%%m-%%d %%H:%%M:%%S'^)
echo                     key = (user_id, timestamp_str^)
echo                     if key not in seen_records:
echo                         seen_records.add(key^)
echo                         send_punch_to_webapp(server_url, user_id, timestamp_str^)
echo             except Exception as live_err:
echo                 print(f"[Bridge] Live capture fallback to polling mode ({live_err})..."^)
echo                 while True:
echo                     time.sleep(2^)
echo                     try:
echo                         logs = conn.get_attendance(^) or []
echo                         for rec in logs:
echo                             key = (str(rec.user_id^), rec.timestamp.strftime('%%Y-%%m-%%d %%H:%%M:%%S'^)^)
echo                             if key not in seen_records:
echo                                 seen_records.add(key^)
echo                                 send_punch_to_webapp(server_url, str(rec.user_id^), rec.timestamp.strftime('%%Y-%%m-%%d %%H:%%M:%%S'^)^)
echo                     except Exception as poll_err:
echo                         print(f"[Bridge] Polling read error: {poll_err}"^)
echo                         break
echo         except KeyboardInterrupt:
echo             if conn:
echo                 conn.disconnect(^)
echo             sys.exit(0^)
echo         except Exception as e:
echo             print(f"[Bridge] [ERROR] {e}"^)
echo             time.sleep(3^)
echo         finally:
echo             if conn:
echo                 try:
echo                     conn.disconnect(^)
echo                 except Exception:
echo                     pass
echo.
echo if __name__ == '__main__':
echo     main(^)
) > "%INSTALL_DIR%\zkteco_bridge.py"
)

:: 7. Windows Defender Firewall Rule for Port 4370
echo [*] Adding Windows Firewall rules for Port 4370 (ZKTeco Biometric)...
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
    echo     (Ensure K50 is powered on, connected to router/switch, and has IP %K50_IP%)
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

:: 11. Create start_bridge.bat (Includes auto-restarting watchdog loop)
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo :WATCHDOG
echo [%DATE% %TIME%] Starting Iron Lodge Bridge... ^>^> "%INSTALL_DIR%\bridge.log"
echo "%PYTHON_EXE%" -u zkteco_bridge.py --ip %K50_IP% --port 4370 --server %WEB_URL% ^>^> "%INSTALL_DIR%\bridge.log" 2^>^&1
echo [%DATE% %TIME%] Bridge stopped. Auto-restarting in 5 seconds... ^>^> "%INSTALL_DIR%\bridge.log"
echo ping -n 6 127.0.0.1 ^>nul
echo goto WATCHDOG
) > "%INSTALL_DIR%\start_bridge.bat"

:: 12. Create start_bridge_hidden.vbs (Runs silently in background with no CMD window)
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
echo echo [*] Stopping background instance before opening console...
echo wmic process where "name='python.exe' and commandline like '%%%%zkteco_bridge%%%%'" call terminate ^>nul 2^>^&1
echo echo.
echo "%PYTHON_EXE%" -u zkteco_bridge.py --ip %K50_IP% --port 4370 --server %WEB_URL%
echo.
echo ============================================================================
echo Bridge closed.
echo Starting background service again...
echo wscript.exe "%INSTALL_DIR%\start_bridge_hidden.vbs"
echo pause
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
echo wmic process where "name='python.exe' and commandline like '%%%%zkteco_bridge%%%%'" call terminate ^>nul 2^>^&1
echo powershell -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*zkteco_bridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" ^>nul 2^>^&1
echo echo [OK] Bridge stopped.
echo pause
) > "%INSTALL_DIR%\stop_bridge.bat"

:: 16. Create restart_bridge.bat
(
echo @echo off
echo echo [*] Restarting Iron Lodge Bridge Service...
echo wmic process where "name='python.exe' and commandline like '%%%%zkteco_bridge%%%%'" call terminate ^>nul 2^>^&1
echo timeout /t 2 /nobreak ^>nul 2^>^&1
echo wscript.exe "%INSTALL_DIR%\start_bridge_hidden.vbs"
echo echo [OK] Bridge service restarted in background.
echo timeout /t 3 /nobreak ^>nul 2^>^&1
) > "%INSTALL_DIR%\restart_bridge.bat"

:: 17. Register Auto-Start (Multiple methods to guarantee 100% reliability)
echo [*] Registering Auto-Start on Windows boot...

:: Method A: Windows Registry Run Key (Works 100% across all Windows versions)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "IronLodgeK50Bridge" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\start_bridge_hidden.vbs\"" /f >nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "IronLodgeK50Bridge" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\start_bridge_hidden.vbs\"" /f >nul 2>&1

:: Method B: Windows Startup Folder Shortcut
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $startup = [Environment]::GetFolderPath('Startup'); $s = $ws.CreateShortcut(\"$startup\IronLodge_K50_Bridge.lnk\"); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%INSTALL_DIR%\start_bridge_hidden.vbs\"'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Save()" >nul 2>&1

:: Method C: Scheduled Task
schtasks /create /tn "IronLodge_K50_Bridge" /tr "wscript.exe \"%INSTALL_DIR%\start_bridge_hidden.vbs\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1

:: 18. Create Desktop Shortcuts for Staff
echo [*] Creating Desktop shortcuts...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $s1 = $ws.CreateShortcut(\"$desktop\Iron Lodge Bridge - Live Console.lnk\"); $s1.TargetPath = '%INSTALL_DIR%\run_bridge_visible.bat'; $s1.WorkingDirectory = '%INSTALL_DIR%'; $s1.Save(); $s2 = $ws.CreateShortcut(\"$desktop\Iron Lodge Bridge - View Logs.lnk\"); $s2.TargetPath = '%INSTALL_DIR%\view_logs.bat'; $s2.WorkingDirectory = '%INSTALL_DIR%'; $s2.Save(); $s3 = $ws.CreateShortcut(\"$desktop\Iron Lodge Bridge - Restart Service.lnk\"); $s3.TargetPath = '%INSTALL_DIR%\restart_bridge.bat'; $s3.WorkingDirectory = '%INSTALL_DIR%'; $s3.Save()" >nul 2>&1

:: 19. Start the background service right now
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
echo  Desktop shortcuts created on client's screen:
echo    1. "Iron Lodge Bridge - Live Console"      (Open to test fingerprint punches live)
echo    2. "Iron Lodge Bridge - Restart Service"   (Restart if connection ever needs reset)
echo    3. "Iron Lodge Bridge - View Logs"         (View sync activity log)
echo.
echo  The bridge will now automatically start every time this PC powers on.
echo ============================================================================
echo.
pause
