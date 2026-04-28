"""
EcoVoice — SMS Server (Outgoing SMS via Termux)
=================================================
Runs inside Termux on an Android phone.

Flask server that accepts HTTP POST requests from n8n
to send outgoing SMS messages via termux-sms-send.

Usage (in Termux):
    python sms_server.py

Environment variables:
    SMS_PORT    — Server port (default: 8765)
    API_KEY     — Required header for authentication (default: ecovoice-hackathon-2026)
"""

import os
import subprocess

from flask import Flask, request, jsonify

app = Flask(__name__)

PORT = int(os.environ.get("SMS_PORT", "8765"))
API_KEY = os.environ.get("API_KEY", "ecovoice-hackathon-2026")


def send_sms(phone, message):
    """Send an SMS using termux-sms-send."""
    try:
        result = subprocess.run(
            ["termux-sms-send", "-n", phone, message],
            capture_output=True, text=True, timeout=30
        )
        return result.returncode == 0, result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        return False, str(e)


@app.route("/send-sms", methods=["POST"])
def handle_send_sms():
    """
    Send an SMS message.

    Headers:
        X-API-Key: <api_key>

    Body (JSON):
        { "phone": "+919876543210", "message": "Hello!" }
    """
    # ── Auth check ────────────────────────────────────────
    provided_key = request.headers.get("X-API-Key", "")
    if provided_key != API_KEY:
        return jsonify({"status": "error", "message": "Invalid API key"}), 401

    # ── Parse body ────────────────────────────────────────
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"status": "error", "message": "Invalid JSON body"}), 400

    phone = data.get("phone", "").strip()
    message = data.get("message", "").strip()

    if not phone:
        return jsonify({"status": "error", "message": "Missing 'phone'"}), 400
    if not message:
        return jsonify({"status": "error", "message": "Missing 'message'"}), 400

    # ── Send ──────────────────────────────────────────────
    success, error = send_sms(phone, message)

    if success:
        print(f"  ✅ SMS sent → {phone}")
        return jsonify({"status": "success", "phone": phone}), 200
    else:
        print(f"  ⚠️  SMS failed → {phone}: {error}")
        return jsonify({"status": "failed", "phone": phone, "error": error}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint for n8n / monitoring."""
    return jsonify({"status": "ok", "service": "ecovoice-sms-gateway"}), 200


if __name__ == "__main__":
    print("═══════════════════════════════════════════════════")
    print("  EcoVoice SMS Gateway Server")
    print(f"  Listening on 0.0.0.0:{PORT}")
    print(f"  API Key: {API_KEY[:8]}...")
    print("═══════════════════════════════════════════════════\n")
    app.run(host="0.0.0.0", port=PORT, debug=False)
