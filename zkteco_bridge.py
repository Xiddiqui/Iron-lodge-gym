#!/usr/bin/env python3
"""
ZKTeco K50 Local Bridge Script for Iron Lodge Gym
=================================================
Connects to the ZKTeco K50 biometric device over LAN (Port 4370)
and forwards real-time fingerprint punches to your live web app.

Features:
- Windows 10 & 11 100% compatible (UTF-8 console, socket lock, persistent retry).
- Single-Instance Lock: Ensures only ONE bridge instance runs even if triggered
  by both boot scheduler and user startup.
- Offline Punch Catch-Up: Automatically syncs punches from the past 7 days on start.
- Failed Punch Retry Queue: Retries punches if the internet temporarily drops.
- Heartbeat Thread: Pings the server every 5 minutes for the System Monitor.
- Auto-reconnect: Seamlessly handles LAN disconnects, power cycles, and Wi-Fi drops.
- Dual-mode connection: Tries TCP first, falls back to UDP.
- Live capture with graceful fallback to continuous polling.

Usage:
    python zkteco_bridge.py --ip <K50_IP> --server <SERVER_URL>
    (Or simply run `python zkteco_bridge.py` if config.json is present)
"""

import sys
import os
import time
import json
import argparse
import threading
import socket
from datetime import datetime, timedelta

# Force unbuffered output so messages print instantly on Windows console
os.environ["PYTHONUNBUFFERED"] = "1"
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    except Exception:
        pass

# Ensure required libraries are installed
try:
    from zk import ZK
except ImportError:
    print("[Setup] Required library 'pyzk' not found. Installing pyzk and requests...")
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyzk", "requests"])
    except Exception:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "pyzk", "requests"])
    from zk import ZK

try:
    import requests
except ImportError:
    print("[Setup] Installing 'requests' library...")
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    except Exception:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "requests"])
    import requests

# ─────────────────────────────────────────────────────────────────────────────
# Bridge Constants
# ─────────────────────────────────────────────────────────────────────────────
BRIDGE_SN = "K50_LOCAL_BRIDGE"
HEARTBEAT_INTERVAL = 5 * 60  # 5 minutes
LOCK_PORT = 43719            # Dedicated localhost port for single-instance lock

# In-memory queue for punches that failed to send due to internet outages
pending_punch_queue = []
queue_lock = threading.Lock()


def acquire_single_instance_lock():
    """
    Ensure only ONE instance of the bridge runs at any time.
    If another process is running, this process exits cleanly.
    """
    try:
        lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # On Windows, binding without SO_REUSEADDR prevents second bind
        lock_socket.bind(("127.0.0.1", LOCK_PORT))
        return lock_socket
    except (socket.error, OSError):
        print(f"[Bridge] Another instance of Iron Lodge Bridge is already running (Port {LOCK_PORT} locked). Exiting.")
        sys.exit(0)


def normalize_url(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if not url:
        return "https://ironlodgegym.com"
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"
    return url


def get_local_ip() -> str:
    """Best-effort local IP address of this PC."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def load_config() -> dict:
    """Load config from config.json in the script's directory if present."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_file = os.path.join(script_dir, "config.json")
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Config] Warning: Could not read config.json: {e}")
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# Web Server Communication
# ─────────────────────────────────────────────────────────────────────────────
def send_punch_to_webapp(server_url: str, user_id: str, timestamp_str: str) -> bool:
    """
    Sends an ATTLOG fingerprint punch to the web app.
    Returns True if successfully sent and acknowledged, False if failed.
    """
    cdata_endpoint = f"{server_url}/api/iclock/cdata?table=ATTLOG&SN={BRIDGE_SN}"
    body = f"{user_id}\t{timestamp_str}\t0\t1\t0\t0\t0"

    print(f"\n[Punch] User ID: {user_id} | Time: {timestamp_str}")
    try:
        res = requests.post(
            cdata_endpoint,
            data=body,
            headers={"Content-Type": "text/plain; charset=utf-8"},
            timeout=10,
        )
        if res.status_code == 200:
            print(f"[Web Sync] [OK] Punch synced for User #{user_id} -> {res.text.strip()}")
            return True
        else:
            print(f"[Web Sync] [WARN] Server returned status {res.status_code}: {res.text}")
            return False
    except Exception as req_err:
        print(f"[Web Sync] [ERROR] Could not reach server ({req_err}). Queued for retry.")
        return False


def queue_punch_for_retry(user_id: str, timestamp_str: str):
    """Adds a failed punch to the retry queue."""
    with queue_lock:
        item = (user_id, timestamp_str)
        if item not in pending_punch_queue:
            pending_punch_queue.append(item)
            print(f"[Retry Queue] Punch queued for User #{user_id} ({len(pending_punch_queue)} pending)")


def flush_retry_queue(server_url: str):
    """Attempts to send any punches in the retry queue."""
    with queue_lock:
        if not pending_punch_queue:
            return
        print(f"[Retry Queue] Retrying {len(pending_punch_queue)} pending punches...")
        remaining = []
        for user_id, timestamp_str in pending_punch_queue:
            success = send_punch_to_webapp(server_url, user_id, timestamp_str)
            if not success:
                remaining.append((user_id, timestamp_str))
        pending_punch_queue.clear()
        pending_punch_queue.extend(remaining)


# ─────────────────────────────────────────────────────────────────────────────
# Background Heartbeat & Retry Loop
# ─────────────────────────────────────────────────────────────────────────────
def heartbeat_loop(server_url: str, stop_event: threading.Event):
    """Background thread: sends GET heartbeat every 5 min & flushes retry queue."""
    local_ip = get_local_ip()
    heartbeat_url = f"{server_url}/api/iclock/cdata?SN={BRIDGE_SN}"

    print(f"[Heartbeat] Background thread active -- pinging every {HEARTBEAT_INTERVAL // 60} min")
    print(f"[Heartbeat] Local IP: {local_ip}")

    # Check retry queue every 30 seconds
    ticks = 0
    while not stop_event.is_set():
        ticks += 1

        # Periodic queue flush every 30 seconds
        if pending_punch_queue:
            flush_retry_queue(server_url)

        # Heartbeat every HEARTBEAT_INTERVAL seconds
        if ticks % (HEARTBEAT_INTERVAL // 5) == 0 or ticks == 1:
            try:
                res = requests.get(
                    heartbeat_url,
                    headers={"X-Bridge-IP": local_ip},
                    timeout=10,
                )
                ts = datetime.now().strftime("%H:%M:%S")
                if res.status_code == 200:
                    print(f"[Heartbeat] [OK] {ts} -- Server confirmed bridge is online")
                else:
                    print(f"[Heartbeat] [WARN] {ts} -- Server status {res.status_code}")
            except Exception as e:
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"[Heartbeat] [WARN] {ts} -- Server unreachable: {e}")

        stop_event.wait(timeout=5)

    print("[Heartbeat] Stopped.")


# ─────────────────────────────────────────────────────────────────────────────
# Main Application Loop
# ─────────────────────────────────────────────────────────────────────────────
def main():
    # 1. Acquire single-instance lock to prevent duplicate processes
    _lock = acquire_single_instance_lock()

    # 2. Parse arguments and configuration
    file_cfg = load_config()

    parser = argparse.ArgumentParser(description="ZKTeco K50 Biometric Bridge - Iron Lodge Gym")
    parser.add_argument("--ip", default=file_cfg.get("device_ip") or os.environ.get("K50_IP") or "192.168.18.215",
                        help="IP address of K50 device (e.g. 192.168.18.215)")
    parser.add_argument("--port", type=int, default=file_cfg.get("device_port") or 4370,
                        help="Port of K50 device (default: 4370)")
    parser.add_argument("--server", default=file_cfg.get("server_url") or os.environ.get("SERVER_URL") or "https://ironlodgegym.com",
                        help="Live web app URL (default: https://ironlodgegym.com)")
    args = parser.parse_args()

    device_ip = args.ip
    device_port = args.port
    server_url = normalize_url(args.server)

    print("=" * 65)
    print("  IRON LODGE GYM -- ZKTeco K50 Windows 10/11 Biometric Bridge")
    print("=" * 65)
    print(f"  Target Device IP : {device_ip}:{device_port}")
    print(f"  Target Web App   : {server_url}")
    print(f"  Bridge ID (SN)   : {BRIDGE_SN}")
    print(f"  Heartbeat every  : {HEARTBEAT_INTERVAL // 60} minutes")
    print(f"  Lookback Catchup : 7 days")
    print("=" * 65)

    # 3. Test connection to web app
    try:
        test_url = f"{server_url}/api/iclock/cdata?SN={BRIDGE_SN}"
        res = requests.get(test_url, timeout=8)
        if res.status_code == 200:
            print(f"[Web Sync] [OK] Successfully reached web app: {server_url}")
        else:
            print(f"[Web Sync] [WARN] Web server replied with status {res.status_code}")
    except Exception as e:
        print(f"[Web Sync] [WARN] Initial server check failed ({e}). Bridge will retry automatically.")

    # 4. Start background heartbeat and retry thread
    stop_event = threading.Event()
    heartbeat_thread = threading.Thread(
        target=heartbeat_loop,
        args=(server_url, stop_event),
        daemon=True,
        name="HeartbeatThread",
    )
    heartbeat_thread.start()

    force_udp_modes = [False, True]
    seen_records = set()

    try:
        while True:
            conn = None
            connected = False

            # Try TCP connection first, then UDP
            for udp in force_udp_modes:
                mode_name = "UDP" if udp else "TCP"
                try:
                    print(f"\n[Bridge] Connecting via {mode_name} to ZKTeco K50 at {device_ip}:{device_port}...")
                    zk = ZK(device_ip, port=device_port, timeout=8, password=0, force_udp=udp)
                    zk.omits_ping = True

                    conn = zk.connect()
                    print(f"[Bridge] [OK] Connected via {mode_name}! Listening for fingerprint punches...")
                    connected = True
                    break
                except Exception as conn_err:
                    print(f"[Bridge] {mode_name} connection attempt failed ({conn_err})")

            if not connected:
                print(f"\n[Bridge] [WARN] Could not connect to K50 device at {device_ip}:{device_port}.")
                print(f"  Check 1: Is {device_ip} the exact IP assigned to the K50?")
                print("  Check 2: Is the Ethernet cable firmly connected to the router?")
                print("  Check 3: Is 'Comm Key' set to 0 in K50 Comm Settings?")
                print("[Bridge] Retrying connection in 5 seconds...")
                time.sleep(5)
                continue

            try:
                # 5. Offline Catch-Up: Download punches from past 7 days (covers shutdowns/weekends)
                try:
                    print("[Bridge] Checking for punches recorded while bridge PC was off...")
                    all_logs = conn.get_attendance() or []
                    cutoff_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
                    recent_logs = [r for r in all_logs if r.timestamp.strftime("%Y-%m-%d") >= cutoff_date]

                    print(f"[Bridge] Found {len(recent_logs)} punch records in past 7 days.")
                    for rec in recent_logs:
                        key = (str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                        if key not in seen_records:
                            seen_records.add(key)
                            success = send_punch_to_webapp(server_url, str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                            if not success:
                                queue_punch_for_retry(str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))

                    for rec in all_logs:
                        seen_records.add((str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S")))
                    print("[Bridge] [OK] Offline catch-up completed. Ready for live punches.")
                except Exception as sync_err:
                    print(f"[Bridge] [WARN] Offline catch-up note: {sync_err}")

                # 6. Live event streaming
                try:
                    print("[Bridge] Real-time live capture stream active.")
                    for attendance in conn.live_capture():
                        if attendance is None:
                            continue
                        user_id = str(attendance.user_id)
                        timestamp_str = attendance.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                        key = (user_id, timestamp_str)
                        if key not in seen_records:
                            seen_records.add(key)
                            success = send_punch_to_webapp(server_url, user_id, timestamp_str)
                            if not success:
                                queue_punch_for_retry(user_id, timestamp_str)
                except Exception as live_err:
                    print(f"[Bridge] Live capture stream ended ({live_err}). Switching to polling mode...")
                    while True:
                        time.sleep(2)
                        try:
                            logs = conn.get_attendance() or []
                            for rec in logs:
                                user_id = str(rec.user_id)
                                timestamp_str = rec.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                                key = (user_id, timestamp_str)
                                if key not in seen_records:
                                    seen_records.add(key)
                                    success = send_punch_to_webapp(server_url, user_id, timestamp_str)
                                    if not success:
                                        queue_punch_for_retry(user_id, timestamp_str)
                        except Exception as poll_err:
                            print(f"[Bridge] Polling read error: {poll_err}")
                            break

            except Exception as e:
                print(f"[Bridge] [ERROR] Connection error: {e}")
                time.sleep(3)
            finally:
                if conn:
                    try:
                        conn.disconnect()
                    except Exception:
                        pass

    except KeyboardInterrupt:
        print("\n[Bridge] Stopping Iron Lodge Bridge...")
        stop_event.set()
        heartbeat_thread.join(timeout=3)
        sys.exit(0)


if __name__ == "__main__":
    main()
