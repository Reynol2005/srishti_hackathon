# IVR Eco-Score Webhook

A lightweight Flask API that receives IVR digit-presses from **Exotel**, computes a daily eco-score, and stores the result in **Supabase**.

---

## How It Works

| Digit | Position | Meaning |
|-------|----------|---------|
| **1st** — Segregation | `1` = True, `2` = False |
| **2nd** — Volume | `1` = Low, `2` = Med, `3` = High |
| **3rd** — Reuse | `1` = True, `2` = False |

**Scoring:**
- +10 if waste is segregated
- +5 if waste is reused
- +5 if volume is Low

Maximum possible score: **20**

---

## Prerequisites

- Python 3.10+
- A [Supabase](https://supabase.com) project with a table called `daily_reports`

### Supabase Table Setup

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE daily_reports (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_number   TEXT        NOT NULL,
    report_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
    segregated     BOOLEAN     NOT NULL,
    volume         TEXT        NOT NULL CHECK (volume IN ('Low', 'Med', 'High')),
    reused         BOOLEAN     NOT NULL,
    daily_eco_score INTEGER    NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (phone_number, report_date)
);

-- Auto-update the updated_at timestamp on every change
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_reports_updated
    BEFORE UPDATE ON daily_reports
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
```

---

## Local Setup

```bash
# 1. Clone & enter the directory
cd Shrishti

# 2. Create a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
copy .env.example .env
# Then edit .env with your real Supabase URL and key

# 5. Run the server
python app.py
```

The server starts at **http://127.0.0.1:5000**.

---

## Testing the Endpoint

```bash
curl -X POST http://127.0.0.1:5000/ivr/webhook \
     -d "CallFrom=09876543210" \
     -d "digits=1-2-1"
```

**Expected response:**

```json
{
  "message": "Report saved",
  "phone_number": "09876543210",
  "report_date": "2026-04-28",
  "daily_eco_score": 15,
  "choices": {
    "segregated": true,
    "volume": "Med",
    "reused": true
  }
}
```

### Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Same phone + same date calls again | Existing row is **updated** (upsert) |
| Missing `CallFrom` or `digits` | `400 Bad Request` with error message |
| Invalid digit value (e.g. `4-2-1`) | `400 Bad Request` with validation error |
| Database unreachable | `500 Internal Server Error` |

---

## Project Structure

```
Shrishti/
├── app.py              # Flask application
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variable template
└── README.md           # This file
```
