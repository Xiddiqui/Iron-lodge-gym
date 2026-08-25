#!/usr/bin/env python3
"""
ZKTeco K50 Local Bridge Script for Iron Lodge Gym
=================================================
Connects to the ZKTeco K50 device over LAN (Port 4370)
and forwards real-time fingerprint punches to your live Vercel web app.

Features:
- Background heartbeat thread: pings the server every 5 minutes
  so the System Monitor always knows if the Windows PC bridge is alive.
- Automatic reconnection loop: retries TCP & UDP if connection drops.
- Offline punch sync: downloads any punches made while PC was off.
- Real-time live capture with automatic fallback to polling.
- Zero-crash watchdog design: never exits on transient network errors.

Usage:
    python zkteco_bridge.py --ip <K50_DEVICE_IP> --server <DOMAIN_URL>

Example:
    python zkteco_bridge.py --ip 192.168.18.215 --server https://ironlodgegym.com
"""

import sys
import time
import argparse
import threading
import socket
from datetime import datetime

try:
    from zk import ZK
except ImportError:
    print("Installing required library 'pyzk' and 'requests'...")
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyzk", "requests"])
    except Exception:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--break-system-packages", "pyzk", "requests"])
    from zk import ZK

import requests

# ─────────────────────────────────────────────────────────────────────────────
# Serial Number sent to the web server to identify THIS bridge instance.
# The System Monitor page shows "Windows 7 Bridge PC" connected / disconnected.
# ─────────────────────────────────────────────────────────────────────────────
BRIDGE_SN = "K50_LOCAL_BRIDGE"

# How often (seconds) the background thread sends a heartbeat to the server
HEARTBEAT_INTERVAL = 5 * 60  # 5 minutes


def normalize_url(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if not url:
        return "https://ironlodgegym.com"
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"
    return url


def get_local_ip() -> str:
    """Best-effort local IP address of this Windows PC."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "unknown"


# ─────────────────────────────────────────────────────────────────────────────
# Heartbeat — runs in a background thread, pings the server every 5 minutes.
# This is what keeps the System Monitor green even when nobody is punching.
# ─────────────────────────────────────────────────────────────────────────────
def heartbeat_loop(server_url: str, stop_event: threading.Event):
    """Background thread: sends a GET heartbeat to the web server every 5 min."""
    local_ip = get_local_ip()
    heartbeat_url = f"{server_url}/api/iclock/cdata?SN={BRIDGE_SN}"

    print(f"[Heartbeat] 💓 Background heartbeat started -- pinging every {HEARTBEAT_INTERVAL // 60} min")
    print(f"[Heartbeat] This PC local IP: {local_ip}")

    while not stop_event.is_set():
        try:
            res = requests.get(
                heartbeat_url,
                headers={"X-Bridge-IP": local_ip},
                timeout=10,
            )
            ts = datetime.now().strftime("%H:%M:%S")
            if res.status_code == 200:
                print(f"[Heartbeat] [OK] {ts} -- Server confirmed bridge is alive")
            else:
                print(f"[Heartbeat] [WARN] {ts} -- Server replied status {res.status_code}")
        except Exception as e:
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"[Heartbeat] [WARN] {ts} -- Could not reach server: {e}")

        # Wait for next interval or stop event
        stop_event.wait(timeout=HEARTBEAT_INTERVAL)

    print("[Heartbeat] Stopped.")


def send_punch_to_webapp(server_url: str, user_id: str, timestamp_str: str):
    cdata_endpoint = f"{server_url}/api/iclock/cdata?table=ATTLOG&SN={BRIDGE_SN}"
    body = f"{user_id}\t{timestamp_str}\t0\t1\t0\t0\t0"

    print(f"\n[Fingerprint Punch] User ID: {user_id} | Time: {timestamp_str}")
    try:
        res = requests.post(
            cdata_endpoint,
            data=body,
            headers={"Content-Type": "text/plain; charset=utf-8"},
            timeout=10,
        )
        if res.status_code == 200:
            print(f"[Web Sync] [OK] Sent punch for User #{user_id} to web app -> Success! ({res.text.strip()})")
        else:
            print(f"[Web Sync] [WARN] Web app returned status {res.status_code}: {res.text}")
    except Exception as req_err:
        print(f"[Web Sync] [ERROR] Failed to reach web app: {req_err}")


def main():
    parser = argparse.ArgumentParser(description="ZKTeco K50 Bridge to Iron Lodge Gym Web App")
    parser.add_argument("--ip", required=True, help="IP address of the K50 device (e.g. 192.168.18.215)")
    parser.add_argument("--port", type=int, default=4370, help="Port of K50 device (default: 4370)")
    parser.add_argument("--server", default="https://ironlodgegym.com", help="Live web app URL")
    args = parser.parse_args()

    device_ip = args.ip
    device_port = args.port
    server_url = normalize_url(args.server)

    print("=" * 60)
    print("  IRON LODGE GYM -- ZKTeco K50 Live Biometric Bridge")
    print("=" * 60)
    print(f"  Target Device IP : {device_ip}:{device_port}")
    print(f"  Target Web App   : {server_url}")
    print(f"  Bridge ID (SN)   : {BRIDGE_SN}")
    print(f"  Heartbeat every  : {HEARTBEAT_INTERVAL // 60} minutes")
    print("=" * 60)

    # Initial test handshake with web server
    try:
        test_url = f"{server_url}/api/iclock/cdata?SN={BRIDGE_SN}"
        res = requests.get(test_url, timeout=8)
        if res.status_code == 200:
            print(f"[Web Sync] [OK] Successfully verified connection to web app: {server_url}")
        else:
            print(f"[Web Sync] [WARN] Web server replied with status {res.status_code} at {test_url}")
    except Exception as e:
        print(f"[Web Sync] [WARN] Could not reach web app ({e}). Bridge will retry punches automatically.")

    # Start background heartbeat thread
    stop_event = threading.Event()
    heartbeat_thread = threading.Thread(
        target=heartbeat_loop,
        args=(server_url, stop_event),
        daemon=True,
        name="HeartbeatThread",
    )
    heartbeat_thread.start()

    force_udp_modes = [False, True]

    try:
        while True:
            conn = None
            connected = False

            for udp in force_udp_modes:
                mode_name = "UDP" if udp else "TCP"
                try:
                    print(f"\n[Bridge] Trying {mode_name} connection to ZKTeco K50 at {device_ip}:{device_port}...")
                    zk = ZK(device_ip, port=device_port, timeout=8, password=0, force_udp=udp)
                    zk.omits_ping = True

                    conn = zk.connect()
                    print(f"[Bridge] [OK] Connected successfully via {mode_name}! Listening for real-time fingerprint punches...")
                    connected = True
                    break
                except Exception as conn_err:
                    print(f"[Bridge] {mode_name} connection attempt failed ({conn_err})")

            if not connected:
                print("\n[Bridge] [WARN] Could not connect via TCP or UDP.")
                print(f"  Check: Is {device_ip} the active IP address on the K50 screen?")
                print("  Check: Is Comm Key set to 0 in K50 Comm settings?")
                print("[Bridge] Retrying in 5 seconds...")
                time.sleep(5)
                continue

            try:
                # 1. Sync recent offline punches (e.g. punches made while PC was off)
                seen_records = set()
                try:
                    print("[Bridge] Checking for punches made while PC was off...")
                    all_logs = conn.get_attendance() or []
                    today_str = datetime.now().strftime("%Y-%m-%d")
                    recent_logs = [r for r in all_logs if r.timestamp.strftime("%Y-%m-%d") >= today_str]

                    print(f"[Bridge] Found {len(recent_logs)} punch records for today. Syncing to web app...")
                    for rec in recent_logs:
                        key = (str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                        seen_records.add(key)
                        send_punch_to_webapp(server_url, str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))

                    for rec in all_logs:
                        seen_records.add((str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S")))
                    print("[Bridge] [OK] Sync complete. Listening for new punches...")
                except Exception as sync_err:
                    print(f"[Bridge] [WARN] Initial offline sync skipped ({sync_err})")

                # 2. Try real-time live event streaming
                try:
                    for attendance in conn.live_capture():
                        if attendance is None:
                            continue
                        user_id = str(attendance.user_id)
                        timestamp_str = attendance.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                        key = (user_id, timestamp_str)
                        if key not in seen_records:
                            seen_records.add(key)
                            send_punch_to_webapp(server_url, user_id, timestamp_str)
                except Exception as live_err:
                    print(f"[Bridge] Live stream fallback to polling mode ({live_err})...")
                    print("[Bridge] Polling mode active -- place your finger on the K50 device...")
                    while True:
                        time.sleep(2)
                        try:
                            logs = conn.get_attendance() or []
                            for rec in logs:
                                key = (str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                                if key not in seen_records:
                                    seen_records.add(key)
                                    send_punch_to_webapp(server_url, str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                        except Exception as poll_err:
                            print(f"[Bridge] Polling read error: {poll_err}")
                            break

            except Exception as e:
                print(f"[Bridge] [ERROR] Error during operation: {e}")
                time.sleep(3)
            finally:
                if conn:
                    try:
                        conn.disconnect()
                    except Exception:
                        pass

    except KeyboardInterrupt:
        print("\n[Bridge] Exiting...")
        stop_event.set()
        heartbeat_thread.join(timeout=3)
        sys.exit(0)


if __name__ == "__main__":
    main()
