"""
IVR Webhook API — Exotel → Supabase pipeline.

Receives caller digit-presses from Exotel, computes a daily eco-score,
and upserts the result into a Supabase PostgreSQL table.
"""

import os
from datetime import date

from dotenv import load_dotenv
from flask import Flask, request, jsonify
from supabase import create_client, Client

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]

app = Flask(__name__)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Lookup maps ───────────────────────────────────────────────────────────────
SEGREGATION_MAP = {"1": True, "2": False}
VOLUME_MAP      = {"1": "Low", "2": "Med", "3": "High"}
REUSE_MAP       = {"1": True, "2": False}


def _parse_digits(raw: str) -> dict:
    """
    Parse a 3-digit sequence like '1-2-1' into structured choices.

    Returns a dict with keys: segregated, volume, reused.
    Raises ValueError on bad input.
    """
    parts = [p.strip() for p in raw.split("-")]
    if len(parts) != 3:
        raise ValueError(f"Expected 3 digits separated by '-', got: {raw!r}")

    seg_key, vol_key, reuse_key = parts

    if seg_key not in SEGREGATION_MAP:
        raise ValueError(f"Invalid segregation digit: {seg_key!r}")
    if vol_key not in VOLUME_MAP:
        raise ValueError(f"Invalid volume digit: {vol_key!r}")
    if reuse_key not in REUSE_MAP:
        raise ValueError(f"Invalid reuse digit: {reuse_key!r}")

    return {
        "segregated": SEGREGATION_MAP[seg_key],
        "volume":     VOLUME_MAP[vol_key],
        "reused":     REUSE_MAP[reuse_key],
    }


def _calculate_eco_score(choices: dict) -> int:
    """
    Compute the daily eco-score.

    Scoring rules:
      +10 if waste is segregated
      +5  if waste is reused
      +5  if volume is Low
    """
    score = 0
    if choices["segregated"]:
        score += 10
    if choices["reused"]:
        score += 5
    if choices["volume"] == "Low":
        score += 5
    return score


# ── Webhook endpoint ──────────────────────────────────────────────────────────
@app.route("/ivr/webhook", methods=["POST"])
def ivr_webhook():
    """
    Receive Exotel IVR form-data, compute eco-score, and upsert into Supabase.

    Expected form fields:
        CallFrom  — caller phone number (e.g. '09876543210')
        digits    — pressed digits in '1-2-1' format
    """
    phone_number: str = request.form.get("CallFrom", "").strip()
    digits_raw: str   = request.form.get("digits", "").strip()

    # ── Validate required fields ──────────────────────────────────────────
    if not phone_number:
        return jsonify({"error": "Missing 'CallFrom' field"}), 400
    if not digits_raw:
        return jsonify({"error": "Missing 'digits' field"}), 400

    # ── Parse & score ─────────────────────────────────────────────────────
    try:
        choices = _parse_digits(digits_raw)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    eco_score = _calculate_eco_score(choices)
    today     = date.today().isoformat()  # 'YYYY-MM-DD'

    # ── Upsert into Supabase ──────────────────────────────────────────────
    # Uses ON CONFLICT (phone_number, report_date) to update if a row
    # already exists for the same caller on the same day.
    row = {
        "phone_number":   phone_number,
        "report_date":    today,
        "segregated":     choices["segregated"],
        "volume":         choices["volume"],
        "reused":         choices["reused"],
        "daily_eco_score": eco_score,
    }

    try:
        result = (
            supabase
            .table("daily_reports")
            .upsert(row, on_conflict="phone_number,report_date")
            .execute()
        )
    except Exception as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({
        "message":        "Report saved",
        "phone_number":   phone_number,
        "report_date":    today,
        "daily_eco_score": eco_score,
        "choices":        choices,
    }), 200


# ── Dev server ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
