"""
EcoVoice — SMS Watcher (Incoming SMS → Spring Boot Backend)
============================================================
Runs inside Termux on an Android phone.

Polls for new incoming SMS every few seconds, parses messages
matching the "X-Y-Z" waste report format, and forwards them
to the Spring Boot backend via HTTP POST.

Sends an auto-reply SMS back to the user with their score.

Usage (in Termux):
    python sms_watcher.py

Environment variables:
    BACKEND_URL   — Spring Boot base URL (default: http://192.168.1.100:8080)
    POLL_INTERVAL — Seconds between polls (default: 5)
"""

import json
import os
import re
import subprocess
import sys
import time

import requests

# ── Configuration ───────────────────────────────────────────
BACKEND_URL = os.environ.get("BACKEND_URL", "http://192.168.1.100:8080")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "5"))
DIGIT_PATTERN = re.compile(r"^([12])-([123])-([12])$")

# Track processed message IDs to avoid duplicates
processed_ids = set()


# ── Termux helpers ──────────────────────────────────────────

def get_recent_sms(limit=20):
    """Fetch recent inbox SMS via termux-sms-list."""
    try:
        result = subprocess.run(
            ["termux-sms-list", "-l", str(limit), "-t", "inbox"],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode != 0:
            print(f"  ⚠️  termux-sms-list error: {result.stderr.strip()}")
            return []
        return json.loads(result.stdout) if result.stdout.strip() else []
    except subprocess.TimeoutExpired:
        print("  ⚠️  termux-sms-list timed out")
        return []
    except json.JSONDecodeError:
        print("  ⚠️  Failed to parse SMS list JSON")
        return []


def send_sms(phone, message):
    """Send an SMS via termux-sms-send."""
    try:
        subprocess.run(
            ["termux-sms-send", "-n", phone, message],
            timeout=30
        )
        print(f"  📤 Reply sent → {phone}")
    except subprocess.TimeoutExpired:
        print(f"  ⚠️  SMS send timed out → {phone}")
    except Exception as e:
        print(f"  ⚠️  SMS send error → {phone}: {e}")


# ── Core logic ──────────────────────────────────────────────

def build_success_reply(data):
    """Build a user-friendly auto-reply from the backend response."""
    score = data.get("score", 0)
    bd = data.get("breakdown", {})

    seg = bd.get("segregated", {})
    vol = bd.get("volume", {})
    reu = bd.get("reused", {})

    lines = [
        f"🌿 EcoVoice Report Saved!",
        f"Score: {score}/20",
        "",
        f"{'✅' if seg.get('value') else '❌'} Segregated: +{seg.get('points', 0)}",
        f"📦 Volume: {vol.get('value', '?')} (+{vol.get('points', 0)})",
        f"{'♻️' if reu.get('value') else '❌'} Reused: +{reu.get('points', 0)}",
        "",
        "Keep up the great work! 💪"
    ]
    return "\n".join(lines)


ERROR_REPLY = (
    "❌ Invalid format. Please send your waste report as:\n"
    "[segregated]-[volume]-[reused]\n\n"
    "Example: 1-2-1\n"
    "Digit 1: 1=Yes, 2=No (segregated?)\n"
    "Digit 2: 1=Low, 2=Med, 3=High (volume)\n"
    "Digit 3: 1=Yes, 2=No (reused?)\n\n"
    "Try again!"
)


def process_message(sms):
    """Parse an SMS and forward to the backend."""
    phone = sms.get("number", "").strip()
    body = sms.get("body", "").strip()
    msg_id = sms.get("_id")

    if not phone or not body:
        return

    print(f"  📩 New SMS from {phone}: \"{body}\"")

    # Check if it matches the digit format
    match = DIGIT_PATTERN.match(body)
    if not match:
        print(f"     ↳ Does not match X-Y-Z format, sending help reply")
        send_sms(phone, ERROR_REPLY)
        return

    # Forward to Spring Boot backend
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/report",
            json={"phoneNumber": phone, "digits": body},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            reply = build_success_reply(data)
            print(f"     ↳ Score: {data.get('score', '?')}/20 — sending reply")
            send_sms(phone, reply)
        else:
            error_msg = response.json().get("error", "Unknown error")
            print(f"     ↳ Backend error ({response.status_code}): {error_msg}")
            send_sms(phone, f"❌ Error: {error_msg}\nPlease try again.")

    except requests.ConnectionError:
        print(f"     ↳ Backend unreachable at {BACKEND_URL}")
        send_sms(phone, "❌ Server unreachable. Please try again later.")
    except requests.Timeout:
        print(f"     ↳ Backend request timed out")
        send_sms(phone, "❌ Server timed out. Please try again later.")
    except Exception as e:
        print(f"     ↳ Unexpected error: {e}")
        send_sms(phone, "❌ Something went wrong. Please try again.")


# ── Main loop ───────────────────────────────────────────────

def main():
    print("═══════════════════════════════════════════════════")
    print("  EcoVoice SMS Watcher")
    print(f"  Backend: {BACKEND_URL}")
    print(f"  Poll interval: {POLL_INTERVAL}s")
    print("═══════════════════════════════════════════════════")
    print()
    print("👂 Listening for incoming SMS...\n")

    # Pre-load existing message IDs so we don't re-process old messages
    existing = get_recent_sms(50)
    for msg in existing:
        processed_ids.add(msg.get("_id"))
    print(f"  📋 Loaded {len(processed_ids)} existing message IDs (will skip these)\n")

    while True:
        try:
            messages = get_recent_sms(20)
            for msg in messages:
                msg_id = msg.get("_id")
                if msg_id and msg_id not in processed_ids:
                    processed_ids.add(msg_id)
                    process_message(msg)

        except KeyboardInterrupt:
            print("\n\n👋 Watcher stopped.")
            sys.exit(0)
        except Exception as e:
            print(f"  ⚠️  Loop error: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
