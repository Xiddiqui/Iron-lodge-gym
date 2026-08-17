#!/usr/bin/env python3
"""
ZKTeco K50 Local Bridge Script for Iron Lodge Gym
=================================================
Connects to the ZKTeco K50 device over LAN (Port 4370)
and forwards real-time fingerprint punches to your live Vercel web app.

Usage:
    python3 zkteco_bridge.py --ip <K50_DEVICE_IP> --server <DOMAIN_URL>

Example:
    python3 zkteco_bridge.py --ip 192.168.18.215 --server https://ironlodgegym.com
"""

import sys
import time
import argparse
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

def normalize_url(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if not url:
        return "https://ironlodgegym.com"
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"
    return url

def send_punch_to_webapp(server_url, user_id, timestamp_str):
    cdata_endpoint = f"{server_url}/api/iclock/cdata?table=ATTLOG&SN=K50_LOCAL_BRIDGE"
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
            print(f"[Web Sync] ✅ Sent punch for User #{user_id} to web app -> Success! ({res.text.strip()})")
        else:
            print(f"[Web Sync] ⚠️ Web app returned status {res.status_code}: {res.text}")
    except Exception as req_err:
        print(f"[Web Sync] ❌ Failed to reach web app: {req_err}")

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
    print("  IRON LODGE GYM — ZKTeco K50 Live Biometric Bridge")
    print("=" * 60)
    print(f"  Target Device IP : {device_ip}:{device_port}")
    print(f"  Target Web App   : {server_url}")
    print("=" * 60)

    # Perform quick handshake check with web server
    try:
        test_url = f"{server_url}/api/iclock/cdata?SN=K50_LOCAL_BRIDGE"
        res = requests.get(test_url, timeout=8)
        if res.status_code == 200:
            print(f"[Web Sync] ✅ Successfully verified connection to web app: {server_url}")
        else:
            print(f"[Web Sync] ⚠️ Web server replied with status {res.status_code} at {test_url}")
    except Exception as e:
        print(f"[Web Sync] ⚠️ Warning: Could not reach web app ({e}). Bridge will still run and retry punches.")

    # Try TCP mode first, then UDP fallback
    force_udp_modes = [False, True]

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
                print(f"[Bridge] ✅ Connected successfully via {mode_name}! Listening for real-time fingerprint punches...")
                connected = True
                break
            except Exception as conn_err:
                print(f"[Bridge] {mode_name} connection attempt failed ({conn_err})")

        if not connected:
            print("\n[Bridge] ⚠️ Could not connect via TCP or UDP.")
            print(f"  Check: Is {device_ip} the active IP address on the K50 screen?")
            print("[Bridge] Retrying in 5 seconds...")
            time.sleep(5)
            continue

        try:
            # Try real-time event streaming first
            try:
                for attendance in conn.live_capture():
                    if attendance is None:
                        continue
                    user_id = str(attendance.user_id)
                    timestamp_str = attendance.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                    send_punch_to_webapp(server_url, user_id, timestamp_str)
            except Exception as live_err:
                print(f"[Bridge] Live capture ended/fallback to polling mode ({live_err})...")

                # Polling fallback: check logs every 2 seconds for new scans
                seen_records = set()
                try:
                    logs = conn.get_attendance() or []
                    for rec in logs:
                        seen_records.add((str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S")))
                except Exception:
                    pass

                print("[Bridge] 🔄 Polling mode active — place your finger on the K50 device...")
                while True:
                    time.sleep(2)
                    try:
                        logs = conn.get_attendance() or []
                        for rec in logs:
                            key = (str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                            if key not in seen_records:
                                seen_records.add(key)
                                send_punch_to_webapp(server_url, rec.user_id, rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                    except Exception as poll_err:
                        print(f"[Bridge] Polling read error: {poll_err}")
                        break

        except KeyboardInterrupt:
            print("\n[Bridge] Exiting...")
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass
            sys.exit(0)
        except Exception as e:
            print(f"[Bridge] ⚠️ Error during operation: {e}")
            time.sleep(3)
        finally:
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass

if __name__ == "__main__":
    main()
