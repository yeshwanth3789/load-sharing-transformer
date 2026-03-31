#!/bin/bash
# GridSentinel — One-time setup script
# Run this once after cloning on the RPi

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/6] Pulling latest code..."
cd "$SCRIPT_DIR/.."
git pull

echo "[2/6] Making start_server.sh executable..."
chmod +x "$SCRIPT_DIR/start_server.sh"

echo "[3/6] Setting up virtual environment..."
python3 -m venv --system-site-packages "$SCRIPT_DIR/venv"
source "$SCRIPT_DIR/venv/bin/activate"

echo "[4/6] Installing Python packages..."
pip install -r "$SCRIPT_DIR/requirements.txt"

echo "[5/6] Installing systemd service..."
sudo cp "$SCRIPT_DIR/gridsentinel.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gridsentinel
sudo systemctl start gridsentinel

echo "[6/6] Done!"
echo ""
echo "Server status:"
sudo systemctl status gridsentinel --no-pager
echo ""
echo "To watch live logs: tail -f $SCRIPT_DIR/server.log"
