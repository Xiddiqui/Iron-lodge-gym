#!/usr/bin/env python3
"""
ZKTeco K50 High-Speed Local Bridge Script for Iron Lodge Gym
============================================================
Connects to the ZKTeco K50 device over LAN (Port 4370)
and forwards real-time fingerprint punches instantly (<0.5s) to your live web app.

Usage:
    python3 zkteco_bridge.py --ip <K50_DEVICE_IP> --server <DOMAIN_URL>

Example:
    python3 zkteco_bridge.py --ip 192.168.18.215 --server https://ironlodgegym.com
"""

import sys
import time
import argparse
from datetime import datetime
import socket

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

session = requests.Session()

def normalize_url(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if not url:
        return "https://ironlodgegym.com"
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"
    return url

def send_punch_to_webapp(server_url: str, user_id: str, timestamp_str: str) -> bool:
    cdata_endpoint = f"{server_url}/api/iclock/cdata?table=ATTLOG&SN=K50_LOCAL_BRIDGE"
    body = f"{user_id}\t{timestamp_str}\t0\t1\t0\t0\t0"

    print(f"\n[⚡ Real-Time Punch] User ID: {user_id} | Time: {timestamp_str}")
    try:
        res = session.post(
            cdata_endpoint,
            data=body,
            headers={"Content-Type": "text/plain; charset=utf-8"},
            timeout=5,
        )
        if res.status_code == 200:
            print(f"[Web Sync] ✅ Instant sync User #{user_id} -> Portal Updated! ({res.text.strip()})")
            return True
        else:
            print(f"[Web Sync] ⚠️ Web app returned status {res.status_code}: {res.text}")
            return False
    except Exception as req_err:
        print(f"[Web Sync] ❌ Failed to reach web app: {req_err}")
        return False

def get_device_attendance_count(conn):
    """Attempt fast attendance count read from K50 device (takes <20ms)"""
    try:
        if hasattr(conn, 'get_attendance_count'):
            return conn.get_attendance_count()
        if hasattr(conn, 'read_sizes'):
            sizes = conn.read_sizes()
            if isinstance(sizes, dict) and 'attendance' in sizes:
                return sizes['attendance']
    except Exception:
        pass
    return None

def main():
    parser = argparse.ArgumentParser(description="ZKTeco K50 High-Speed Bridge to Iron Lodge Gym")
    parser.add_argument("--ip", required=True, help="IP address of K50 device (e.g. 192.168.18.215)")
    parser.add_argument("--port", type=int, default=4370, help="Port of K50 device (default: 4370)")
    parser.add_argument("--server", default="https://ironlodgegym.com", help="Live web app URL")
    args = parser.parse_args()

    device_ip = args.ip
    device_port = args.port
    server_url = normalize_url(args.server)

    print("=" * 65)
    print("  IRON LODGE GYM — ZKTeco K50 Instant Biometric Bridge")
    print("=" * 65)
    print(f"  Target Device IP : {device_ip}:{device_port}")
    print(f"  Target Web App   : {server_url}")
    print("=" * 65)

    # Initial web server handshake check
    try:
        test_url = f"{server_url}/api/iclock/cdata?SN=K50_LOCAL_BRIDGE"
        res = session.get(test_url, timeout=6)
        if res.status_code == 200:
            print(f"[Web Sync] ✅ Successfully verified connection to web app: {server_url}")
        else:
            print(f"[Web Sync] ⚠️ Web server replied with status {res.status_code} at {test_url}")
    except Exception as e:
        print(f"[Web Sync] ⚠️ Warning: Could not reach web app ({e}). Bridge will retry on punches.")

    force_udp_modes = [False, True]
    seen_records = set()

    while True:
        conn = None
        connected = False

        for udp in force_udp_modes:
            mode_name = "UDP" if udp else "TCP"
            try:
                print(f"\n[Bridge] Connecting to ZKTeco K50 via {mode_name} ({device_ip}:{device_port})...")
                zk = ZK(device_ip, port=device_port, timeout=5, password=0, force_udp=udp)
                zk.omits_ping = True
                conn = zk.connect()
                print(f"[Bridge] ✅ Connected via {mode_name}! Setting up real-time event listener...")
                connected = True
                break
            except Exception as conn_err:
                print(f"[Bridge] {mode_name} connection failed ({conn_err})")

        if not connected:
            print("\n[Bridge] ⚠️ Unable to connect to K50 device. Retrying in 4 seconds...")
            time.sleep(4)
            continue

        try:
            # 1. Sync any existing punches for today
            try:
                print("[Bridge] 🔄 Checking attendance records...")
                all_logs = conn.get_attendance() or []
                today_str = datetime.now().strftime("%Y-%m-%d")
                recent_logs = [r for r in all_logs if r.timestamp.strftime("%Y-%m-%d") >= today_str]

                print(f"[Bridge] Loaded {len(all_logs)} total logs ({len(recent_logs)} today).")
                for rec in recent_logs:
                    key = (str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                    if key not in seen_records:
                        seen_records.add(key)
                        send_punch_to_webapp(server_url, rec.user_id, rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))

                for rec in all_logs:
                    seen_records.add((str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S")))

                last_att_count = len(all_logs)
            except Exception as sync_err:
                print(f"[Bridge] ⚠️ Note: Initial offline sync skipped ({sync_err})")
                last_att_count = 0

            print("\n[Bridge] 🟢 LIVE MONITOR ACTIVE — Fingerprint punches will show IMMEDIATELY on portal.")

            # 2. Continuous real-time listener loop with resilient recovery
            live_supported = True

            while True:
                if live_supported:
                    try:
                        # live_capture yields punch events instantly as finger touches the sensor
                        for attendance in conn.live_capture():
                            if attendance is None:
                                continue
                            user_id = str(attendance.user_id)
                            timestamp_str = attendance.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                            key = (user_id, timestamp_str)
                            if key not in seen_records:
                                seen_records.add(key)
                                send_punch_to_webapp(server_url, user_id, timestamp_str)
                    except (socket.timeout, TimeoutError):
                        # Normal socket timeout during idle periods — do NOT abort live capture!
                        continue
                    except Exception as live_err:
                        err_msg = str(live_err).lower()
                        if "timed out" in err_msg or "timeout" in err_msg:
                            # Idle timeout, continue listening
                            continue
                        print(f"[Bridge] Live capture notice ({live_err}). Switching to high-speed smart poll...")
                        live_supported = False

                # High-speed smart poll fallback (0.3s interval)
                if not live_supported:
                    time.sleep(0.3)
                    try:
                        current_count = get_device_attendance_count(conn)

                        # If count is supported and hasn't changed, skip heavy read!
                        if current_count is not None and current_count == last_att_count:
                            continue

                        # Count increased or count read not supported -> fetch logs
                        logs = conn.get_attendance() or []
                        if current_count is not None:
                            last_att_count = current_count
                        else:
                            last_att_count = len(logs)

                        for rec in logs:
                            key = (str(rec.user_id), rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
                            if key not in seen_records:
                                seen_records.add(key)
                                send_punch_to_webapp(server_url, rec.user_id, rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"))

                    except Exception as poll_err:
                        print(f"[Bridge] Connection lost ({poll_err}). Reconnecting...")
                        break

        except KeyboardInterrupt:
            print("\n[Bridge] Stopping...")
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass
            sys.exit(0)
        except Exception as e:
            print(f"[Bridge] ⚠️ Runtime error: {e}")
            time.sleep(2)
        finally:
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass

if __name__ == "__main__":
    main()
