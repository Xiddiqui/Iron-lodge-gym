#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Iron Lodge Gym — ZKTeco K50 Bridge Launcher
# This script is called by the macOS LaunchAgent on login.
# Placed in ~/ironlodge-bridge/ to avoid macOS TCC restrictions
# ─────────────────────────────────────────────────────────────

DEVICE_IP="192.168.18.46"
DEVICE_PORT="4370"
SERVER_URL="https://iron-lodge-gym.vercel.app"
BRIDGE_DIR="$HOME/ironlodge-bridge"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:$PATH"

cd "$BRIDGE_DIR" || exit 1

# Create virtualenv if not exists
if [ ! -d "$BRIDGE_DIR/venv" ]; then
    python3 -m venv "$BRIDGE_DIR/venv"
fi

# Activate virtualenv
source "$BRIDGE_DIR/venv/bin/activate"

# Ensure pyzk and requests are installed inside virtualenv
pip install --quiet pyzk requests

echo "[Bridge Launcher] Starting ZKTeco K50 Bridge at $(date)"
echo "[Bridge Launcher] Device: $DEVICE_IP:$DEVICE_PORT → Server: $SERVER_URL"

# Run the bridge using virtualenv python (unbuffered output for real-time logging)
exec python3 -u "$BRIDGE_DIR/zkteco_bridge.py" \
  --ip "$DEVICE_IP" \
  --port "$DEVICE_PORT" \
  --server "$SERVER_URL"
