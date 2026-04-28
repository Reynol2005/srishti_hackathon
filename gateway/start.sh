#!/bin/bash
# ═══════════════════════════════════════════════════════════
# EcoVoice — Gateway Startup Script (run inside Termux)
#
# Starts both:
#   1. sms_watcher.py  — polls for incoming SMS, forwards to backend
#   2. sms_server.py   — HTTP server for outgoing SMS (called by n8n)
#
# Usage:
#   bash start.sh
#
# To stop:
#   Press Ctrl+C (kills both processes)
# ═══════════════════════════════════════════════════════════

set -e

# ── Configuration (edit these!) ───────────────────────────
export BACKEND_URL="${BACKEND_URL:-http://192.168.1.100:8080}"
export POLL_INTERVAL="${POLL_INTERVAL:-5}"
export SMS_PORT="${SMS_PORT:-8765}"
export API_KEY="${API_KEY:-ecovoice-hackathon-2026}"

echo "═══════════════════════════════════════════════════"
echo "  EcoVoice Android SMS Gateway"
echo "═══════════════════════════════════════════════════"
echo "  Backend URL  : $BACKEND_URL"
echo "  SMS Server   : port $SMS_PORT"
echo "  Poll interval: ${POLL_INTERVAL}s"
echo "═══════════════════════════════════════════════════"
echo ""

# Keep device awake
termux-wake-lock 2>/dev/null || echo "⚠️  termux-wake-lock not available"

# Trap Ctrl+C to kill both background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down gateway..."
    kill $WATCHER_PID $SERVER_PID 2>/dev/null
    termux-wake-unlock 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Start SMS server (outgoing) in background
echo "🚀 Starting SMS server on port $SMS_PORT..."
python sms_server.py &
SERVER_PID=$!

# Small delay so server starts first
sleep 2

# Start SMS watcher (incoming) in background
echo "🚀 Starting SMS watcher..."
python sms_watcher.py &
WATCHER_PID=$!

echo ""
echo "✅ Gateway running! Press Ctrl+C to stop."
echo ""

# Wait for either process to exit
wait
