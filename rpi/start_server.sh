#!/bin/bash
# GridSentinel — Flask server launcher
# Activates venv and runs server.py, restarting on crash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/venv/bin/activate"
SERVER="$SCRIPT_DIR/server.py"
LOG="$SCRIPT_DIR/server.log"

echo "[$(date)] Starting GridSentinel server..." | tee -a "$LOG"

source "$VENV"

while true; do
    echo "[$(date)] Launching server.py..." | tee -a "$LOG"
    python "$SERVER" >> "$LOG" 2>&1
    EXIT_CODE=$?
    echo "[$(date)] server.py exited with code $EXIT_CODE. Restarting in 5s..." | tee -a "$LOG"
    sleep 5
done
