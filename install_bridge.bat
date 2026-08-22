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
    echo [*] Python was not found. Downloading Python 3.8.10 (Compatible with Windows 7)...
    echo ============================================================================
    
    set "PY_URL=https://www.python.org/ftp/python/3.8.10/python-3.8.10.exe"
    if "%PROCESSOR_ARCHITECTURE%"=="AMD64" set "PY_URL=https://www.python.org/ftp/python/3.8.10/python-3.8.10-amd64.exe"
    if defined PROCESSOR_ARCHITEW6432 set "PY_URL=https://www.python.org/ftp/python/3.8.10/python-3.8.10-amd64.exe"
    
    echo [*] Downloading from: !PY_URL!
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls; (New-Object System.Net.WebClient).DownloadFile('!PY_URL!', \"$env:TEMP\python_installer.exe\")" >nul 2>&1
    
    if exist "%TEMP%\python_installer.exe" (
        echo [*] Installing Python 3.8.10 silently (this takes ~1 minute)...
        "%TEMP%\python_installer.exe" /passive InstallAllUsers=1 PrependPath=1 Include_test=0 Include_doc=0 Include_tcltk=0
        timeout /t 5 /nobreak >nul
        
        for /d %%D in ("%ProgramFiles%\Python38*" "%ProgramFiles(x86)%\Python38*" "%LOCALAPPDATA%\Programs\Python\Python38*" "C:\Python38*") do (
            if exist "%%D\python.exe" set "PYTHON_EXE=%%D\python.exe"
        )
        if exist "%TEMP%\python_installer.exe" del /f /q "%TEMP%\python_installer.exe" >nul 2>&1
    )
)

if not defined PYTHON_EXE (
    echo.
    echo ============================================================================
    echo [NOTE FOR WINDOWS 7]
    echo Windows 7 does not support modern Python 3.9+. It requires Python 3.8.10!
    echo ============================================================================
    echo Please download and install Python 3.8.10 using this direct link:
    echo   https://www.python.org/ftp/python/3.8.10/python-3.8.10-amd64.exe (64-bit)
    echo   OR: https://www.python.org/ftp/python/3.8.10/python-3.8.10.exe (32-bit)
    echo.
    echo IMPORTANT: In the installer window, CHECK: [X] "Add Python 3.8 to PATH"
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

:: 5. Ensure zkteco_bridge.py is always generated / embedded
echo [*] Setting up bridge script in %INSTALL_DIR%...
(
echo #!/usr/bin/env python3
echo import sys
echo import time
echo import argparse
echo from datetime import datetime
echo import socket
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
echo session = requests.Session(^)
echo.
echo def normalize_url(url: str^) -^> str:
echo     url = (url or ""^).strip(^).rstrip("/"^)
echo     if not url:
echo         return "https://ironlodgegym.com"
echo     if not url.startswith("http://"^) and not url.startswith("https://"^):
echo         url = f"https://{url}"
echo     return url
echo.
echo def send_punch_to_webapp(server_url, user_id, timestamp_str^):
echo     cdata_endpoint = f"{server_url}/api/iclock/cdata?table=ATTLOG^&SN=K50_LOCAL_BRIDGE"
echo     body = f"{user_id}\t{timestamp_str}\t0\t1\t0\t0\t0"
echo     print(f"\n[⚡ Real-Time Punch] User ID: {user_id} ^| Time: {timestamp_str}"^)
echo     try:
echo         res = session.post(
echo             cdata_endpoint,
echo             data=body,
echo             headers={"Content-Type": "text/plain; charset=utf-8"},
echo             timeout=5,
echo         ^)
echo         if res.status_code == 200:
echo             print(f"[Web Sync] [OK] Instant sync User #{user_id} -> Success! ({res.text.strip()})"^)
echo             return True
echo         else:
echo             print(f"[Web Sync] [WARN] Web app returned status {res.status_code}: {res.text}"^)
echo             return False
echo     except Exception as req_err:
echo         print(f"[Web Sync] [ERROR] Failed to reach web app: {req_err}"^)
echo         return False
echo.
echo def get_device_attendance_count(conn^):
echo     try:
echo         if hasattr(conn, 'get_attendance_count'^):
echo             return conn.get_attendance_count(^)
echo         if hasattr(conn, 'read_sizes'^):
echo             sizes = conn.read_sizes(^)
echo             if isinstance(sizes, dict^) and 'attendance' in sizes:
echo                 return sizes['attendance']
echo     except Exception:
echo         pass
echo     return None
echo.
echo def main(^):
echo     parser = argparse.ArgumentParser(description="ZKTeco K50 High-Speed Bridge"^)
echo     parser.add_argument("--ip", required=True, help="IP address of the K50 device"^)
echo     parser.add_argument("--port", type=int, default=4370, help="Port of K50 device"^)
echo     parser.add_argument("--server", default="https://ironlodgegym.com", help="Live web app URL"^)
echo     args = parser.parse_args(^)
echo.
echo     device_ip = args.ip
echo     device_port = args.port
echo     server_url = normalize_url(args.server^)
echo.
echo     print("=" * 65^)
echo     print("  IRON LODGE GYM -- ZKTeco K50 Instant Biometric Bridge"^)
echo     print("=" * 65^)
echo     print(f"  Target Device IP : {device_ip}:{device_port}"^)
echo     print(f"  Target Web App   : {server_url}"^)
echo     print("=" * 65^)
echo.
echo     try:
echo         test_url = f"{server_url}/api/iclock/cdata?SN=K50_LOCAL_BRIDGE"
echo         res = session.get(test_url, timeout=6^)
echo         if res.status_code == 200:
echo             print(f"[Web Sync] [OK] Successfully verified connection: {server_url}"^)
echo         else:
echo             print(f"[Web Sync] [WARN] Web server replied with status {res.status_code}"^)
echo     except Exception as e:
echo         print(f"[Web Sync] [WARN] Could not reach web app ({e}). Bridge will retry on punches."^)
echo.
echo     force_udp_modes = [False, True]
echo     seen_records = set(^)
echo.
echo     while True:
echo         conn = None
echo         connected = False
echo         for udp in force_udp_modes:
echo             mode_name = "UDP" if udp else "TCP"
echo             try:
echo                 print(f"\n[Bridge] Connecting to K50 via {mode_name} ({device_ip}:{device_port})..."^)
echo                 zk = ZK(device_ip, port=device_port, timeout=5, password=0, force_udp=udp^)
echo                 zk.omits_ping = True
echo                 conn = zk.connect(^)
echo                 print(f"[Bridge] [OK] Connected via {mode_name}! Real-time listener active..."^)
echo                 connected = True
echo                 break
echo             except Exception as conn_err:
echo                 print(f"[Bridge] {mode_name} connection attempt failed ({conn_err})"^)
echo.
echo         if not connected:
echo             print(f"\n[Bridge] [WARN] Could not connect to K50 at {device_ip}:{device_port}."^)
echo             print("[Bridge] Retrying in 4 seconds..."^)
echo             time.sleep(4^)
echo             continue
echo.
echo         try:
echo             try:
echo                 print("[Bridge] Syncing today's offline punches..."^)
echo                 all_logs = conn.get_attendance(^) or []
echo                 today_str = datetime.now(^).strftime("%%Y-%%m-%%d"^)
echo                 recent_logs = [r for r in all_logs if r.timestamp.strftime("%%Y-%%m-%%d"^) >= today_str]
echo                 print(f"[Bridge] Loaded {len(all_logs)} total logs ({len(recent_logs)} today)."^)
echo                 for rec in recent_logs:
echo                     key = (str(rec.user_id^), rec.timestamp.strftime("%%Y-%%m-%%d %%H:%%M:%%S"^)^)
echo                     if key not in seen_records:
echo                         seen_records.add(key^)
echo                         send_punch_to_webapp(server_url, rec.user_id, rec.timestamp.strftime("%%Y-%%m-%%d %%H:%%M:%%S"^)^)
echo                 for rec in all_logs:
echo                     seen_records.add((str(rec.user_id^), rec.timestamp.strftime("%%Y-%%m-%%d %%H:%%M:%%S"^)^)^)
echo                 last_att_count = len(all_logs^)
echo             except Exception as sync_err:
echo                 print(f"[Bridge] Initial offline sync notice: {sync_err}"^)
echo                 last_att_count = 0
echo.
echo             print("\n[Bridge] LIVE MONITOR ACTIVE -- Fingerprint punches will show IMMEDIATELY on portal."^)
echo             live_supported = True
echo.
echo             while True:
echo                 if live_supported:
echo                     try:
echo                         for attendance in conn.live_capture(^):
echo                             if attendance is None:
echo                                 continue
echo                             user_id = str(attendance.user_id^)
echo                             timestamp_str = attendance.timestamp.strftime('%%Y-%%m-%%d %%H:%%M:%%S'^)
echo                             key = (user_id, timestamp_str^)
echo                             if key not in seen_records:
echo                                 seen_records.add(key^)
echo                                 send_punch_to_webapp(server_url, user_id, timestamp_str^)
echo                     except (socket.timeout, TimeoutError^):
echo                         continue
echo                     except Exception as live_err:
echo                         err_msg = str(live_err^).lower(^)
echo                         if "timed out" in err_msg or "timeout" in err_msg:
echo                             continue
echo                         print(f"[Bridge] Live capture switching to smart poll ({live_err})..."^)
echo                         live_supported = False
echo.
echo                 if not live_supported:
echo                     time.sleep(0.3^)
echo                     try:
echo                         current_count = get_device_attendance_count(conn^)
echo                         if current_count is not None and current_count == last_att_count:
echo                             continue
echo                         logs = conn.get_attendance(^) or []
echo                         if current_count is not None:
echo                             last_att_count = current_count
echo                         else:
echo                             last_att_count = len(logs^)
echo                         for rec in logs:
echo                             key = (str(rec.user_id^), rec.timestamp.strftime('%%Y-%%m-%%d %%H:%%M:%%S'^)^)
echo                             if key not in seen_records:
echo                                 seen_records.add(key^)
echo                                 send_punch_to_webapp(server_url, rec.user_id, rec.timestamp.strftime('%%Y-%%m-%%d %%H:%%M:%%S'^)^)
echo                     except Exception as poll_err:
echo                         print(f"[Bridge] Polling read error: {poll_err}"^)
echo                         break
echo.
echo         except KeyboardInterrupt:
echo             if conn:
echo                 conn.disconnect(^)
echo             sys.exit(0^)
echo         except Exception as e:
echo             print(f"[Bridge] [ERROR] {e}"^)
echo             time.sleep(2^)
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

:: 6. Windows Defender Firewall Rule for Port 4370
echo [*] Adding Windows Firewall rules for Port 4370 (ZKTeco Biometric)...
netsh advfirewall firewall delete rule name="IronLodge_ZKTeco_4370" >nul 2>&1
netsh advfirewall firewall add rule name="IronLodge_ZKTeco_4370" dir=in action=allow protocol=TCP localport=4370 >nul 2>&1
netsh advfirewall firewall add rule name="IronLodge_ZKTeco_4370" dir=in action=allow protocol=UDP localport=4370 >nul 2>&1
netsh advfirewall firewall add rule name="IronLodge_ZKTeco_4370" dir=out action=allow protocol=TCP localport=4370 >nul 2>&1
netsh advfirewall firewall add rule name="IronLodge_ZKTeco_4370" dir=out action=allow protocol=UDP localport=4370 >nul 2>&1

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
