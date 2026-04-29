"""
EcoVoice — SMS + Voice Gateway Server
======================================
Runs as a Flask server (locally or in Termux).

Features:
  1. Outgoing SMS via termux-sms-send (POST /send-sms)
  2. IVR Voice Call handling via Twilio webhooks:
     - Incoming call → plays language selection recording
     - Caller presses 1 → English recording
     - Caller presses 2 → Kannada recording

Usage:
    python sms_server.py

Environment variables:
    SMS_PORT    — Server port (default: 8765)
    API_KEY     — Required header for authentication (default: ecovoice-hackathon-2026)
"""

import os
import subprocess

from flask import Flask, request, jsonify, send_from_directory, Response

app = Flask(__name__)

PORT = int(os.environ.get("SMS_PORT", "8765"))
API_KEY = os.environ.get("API_KEY", "ecovoice-hackathon-2026")

# ── Voice recordings directory ─────────────────────────────
VOICE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voice_recordings")


# ═══════════════════════════════════════════════════════════
#  SMS ENDPOINTS (unchanged)
# ═══════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════
#  VOICE / IVR ENDPOINTS (Twilio-compatible TwiML)
# ═══════════════════════════════════════════════════════════

def twiml_response(xml_body):
    """Wrap TwiML content in a proper XML Response and return as HTTP response."""
    twiml = f'<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n{xml_body}\n</Response>'
    return Response(twiml, mimetype="application/xml")


@app.route("/voice/audio/<filename>")
def serve_audio(filename):
    """
    Serve voice recording files so Twilio can fetch and play them.

    Files served from the voice_recordings/ directory.
    """
    print(f"  🔊 Audio requested: {filename}")
    return send_from_directory(VOICE_DIR, filename)


@app.route("/voice/incoming", methods=["GET", "POST"])
def voice_incoming():
    """
    Twilio webhook: called when someone dials your Twilio number.

    Plays the welcome/language-selection recording and waits
    for the caller to press 1 (English) or 2 (Kannada).
    """
    caller = request.values.get("From", "unknown")
    print(f"  📞 Incoming call from {caller}")

    # Build the public URL for the audio file
    host = request.host_url.rstrip("/")
    welcome_url = f"{host}/voice/audio/welcome.mp3"

    # <Gather> collects a single DTMF digit, then POSTs to /voice/handle-key
    xml = f"""  <Gather numDigits="1" action="/voice/handle-key" method="POST">
    <Play>{welcome_url}</Play>
  </Gather>
  <Say>We did not receive any input. Goodbye.</Say>
  <Hangup/>"""

    return twiml_response(xml)


@app.route("/voice/handle-key", methods=["POST"])
def voice_handle_key():
    """
    Twilio webhook: called after the caller presses a digit.

    1 → Play English recording
    2 → Play Kannada recording
    Other → Replay the language selection menu
    """
    digit = request.values.get("Digits", "")
    caller = request.values.get("From", "unknown")
    host = request.host_url.rstrip("/")

    print(f"  🔢 Caller {caller} pressed: {digit}")

    if digit == "1":
        audio_url = f"{host}/voice/audio/english.mp3"
        print(f"     ↳ Playing English recording")
        xml = f"""  <Play>{audio_url}</Play>
  <Say>Thank you for calling EcoVoice. Goodbye!</Say>
  <Hangup/>"""

    elif digit == "2":
        audio_url = f"{host}/voice/audio/kannada.mp3"
        print(f"     ↳ Playing Kannada recording")
        xml = f"""  <Play>{audio_url}</Play>
  <Say>Thank you for calling EcoVoice. Goodbye!</Say>
  <Hangup/>"""

    else:
        print(f"     ↳ Invalid digit, replaying menu")
        # Invalid input — replay the welcome menu
        welcome_url = f"{host}/voice/audio/welcome.mp3"
        xml = f"""  <Say>Invalid selection.</Say>
  <Gather numDigits="1" action="/voice/handle-key" method="POST">
    <Play>{welcome_url}</Play>
  </Gather>
  <Say>We did not receive any input. Goodbye.</Say>
  <Hangup/>"""

    return twiml_response(xml)


# ═══════════════════════════════════════════════════════════
#  HEALTH CHECK
# ═══════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint for n8n / monitoring."""
    return jsonify({"status": "ok", "service": "ecovoice-sms-voice-gateway"}), 200


if __name__ == "__main__":
    print("═══════════════════════════════════════════════════")
    print("  EcoVoice SMS + Voice Gateway Server")
    print(f"  Listening on 0.0.0.0:{PORT}")
    print(f"  API Key: {API_KEY[:8]}...")
    print("─────────────────────────────────────────────────")
    print("  Voice Endpoints:")
    print("    POST /voice/incoming    → Twilio incoming call webhook")
    print("    POST /voice/handle-key  → DTMF keypress handler")
    print("    GET  /voice/audio/<file>→ Audio file server")
    print("─────────────────────────────────────────────────")
    print(f"  Voice recordings: {VOICE_DIR}")
    # Verify audio files exist
    for fname in ["welcome.mp3", "english.mp3", "kannada.mp3"]:
        fpath = os.path.join(VOICE_DIR, fname)
        status = "✅" if os.path.isfile(fpath) else "❌ MISSING"
        print(f"    {status}  {fname}")
    print("═══════════════════════════════════════════════════\n")
    app.run(host="0.0.0.0", port=PORT, debug=False)
