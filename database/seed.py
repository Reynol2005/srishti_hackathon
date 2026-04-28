"""
EcoVoice — Database Seed Script
================================
Populates the `waste_reports` table with realistic fake data.

Setup
-----
1. Install dependencies:
       pip install supabase python-dotenv

2. Create a `.env` file in the project root (or this directory) with:
       SUPABASE_URL=https://<your-project-ref>.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

   ⚠️  Use the **service_role** key (not the anon key) so RLS is bypassed
       during seeding.

3. Run the script:
       python database/seed.py

Data Shape
----------
- 20 unique phone numbers (households)
- 7 days of history per household  →  140 total rows
- Day 3: 5 random households receive a penalty event (score = -10)
- Day 5: those 5 households show a recovery (boosted scores)
"""

import os
import random
import uuid
from datetime import date, timedelta

from dotenv import load_dotenv
from supabase import create_client, Client

# ── Load environment variables ──────────────────────────────
load_dotenv()  # reads from .env in cwd or parent dirs

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Constants ───────────────────────────────────────────────
NUM_HOUSEHOLDS = 20
NUM_DAYS = 7
START_DATE = date.today() - timedelta(days=NUM_DAYS - 1)  # 7 days ending today
NUM_PENALTY_HOUSEHOLDS = 5
PENALTY_DAY = 3   # 1-indexed day number
RECOVERY_DAY = 5  # 1-indexed day number

random.seed(42)  # reproducible runs


# ── Helper: generate realistic Indian mobile numbers ────────
def generate_phone_numbers(n: int) -> list[str]:
    """Return *n* unique phone numbers in +91-XXXXXXXXXX format."""
    prefixes = ["70", "72", "73", "74", "75", "76", "77", "78", "79",
                "80", "81", "82", "83", "84", "85", "86", "87", "88",
                "89", "90", "91", "92", "93", "94", "95", "96", "97",
                "98", "99"]
    numbers: set[str] = set()
    while len(numbers) < n:
        prefix = random.choice(prefixes)
        rest = "".join([str(random.randint(0, 9)) for _ in range(8)])
        numbers.add(f"+91-{prefix}{rest}")
    return sorted(numbers)


# ── Scoring function ────────────────────────────────────────
def calculate_eco_score(
    is_segregated: bool,
    is_reused: bool,
    volume_level: int,
) -> int:
    """
    Compute the daily eco-score for a single report.

    Rules:
        +10  if waste is segregated
        +5   if waste is reused
        +5   if volume_level == 1  (low waste)
        +0   if volume_level == 2
        +0   if volume_level == 3  (high waste)
    """
    score = 0
    if is_segregated:
        score += 10
    if is_reused:
        score += 5
    if volume_level == 1:
        score += 5
    return score


# ── Generate seed data ──────────────────────────────────────
def build_seed_rows() -> list[dict]:
    phones = generate_phone_numbers(NUM_HOUSEHOLDS)

    # Pick 5 random households for the penalty event
    penalty_phones = set(random.sample(phones, NUM_PENALTY_HOUSEHOLDS))

    rows: list[dict] = []

    for day_num in range(1, NUM_DAYS + 1):
        report_date = START_DATE + timedelta(days=day_num - 1)

        for phone in phones:
            # ── Penalty event on Day 3 ──────────────────────
            if day_num == PENALTY_DAY and phone in penalty_phones:
                rows.append({
                    "id": str(uuid.uuid4()),
                    "phone_number": phone,
                    "report_date": report_date.isoformat(),
                    "is_segregated": False,
                    "volume_level": 3,
                    "is_reused": False,
                    "daily_eco_score": -10,  # penalty
                })
                continue

            # ── Recovery boost on Day 5 ─────────────────────
            if day_num == RECOVERY_DAY and phone in penalty_phones:
                rows.append({
                    "id": str(uuid.uuid4()),
                    "phone_number": phone,
                    "report_date": report_date.isoformat(),
                    "is_segregated": True,
                    "volume_level": 1,
                    "is_reused": True,
                    "daily_eco_score": 20,  # full marks: 10 + 5 + 5
                })
                continue

            # ── Normal day: randomise behaviour ─────────────
            is_segregated = random.random() < 0.7   # 70 % segregate
            is_reused = random.random() < 0.4        # 40 % reuse
            volume_level = random.choices(
                [1, 2, 3], weights=[0.3, 0.4, 0.3]
            )[0]

            score = calculate_eco_score(is_segregated, is_reused, volume_level)

            rows.append({
                "id": str(uuid.uuid4()),
                "phone_number": phone,
                "report_date": report_date.isoformat(),
                "is_segregated": is_segregated,
                "volume_level": volume_level,
                "is_reused": is_reused,
                "daily_eco_score": score,
            })

    return rows


# ── Insert into Supabase ────────────────────────────────────
def seed_database() -> None:
    rows = build_seed_rows()

    print(f"🌱 Seeding {len(rows)} rows into waste_reports …")
    print(f"   Households : {NUM_HOUSEHOLDS}")
    print(f"   Days       : {NUM_DAYS}")
    print(f"   Date range : {START_DATE} → {START_DATE + timedelta(days=NUM_DAYS - 1)}")
    print()

    # Supabase client supports bulk upsert; we batch in groups of 50
    BATCH_SIZE = 50
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        response = (
            supabase.table("waste_reports")
            .upsert(batch, on_conflict="phone_number,report_date")
            .execute()
        )
        inserted = len(response.data) if response.data else 0
        print(f"   ✅ Batch {i // BATCH_SIZE + 1}: upserted {inserted} rows")

    print()
    print("🎉 Seeding complete!")

    # ── Quick sanity check ──────────────────────────────────
    count = (
        supabase.table("waste_reports")
        .select("id", count="exact")
        .execute()
    )
    print(f"   Total rows in waste_reports: {count.count}")

    # Show penalty-day snapshot
    penalty_snapshot = (
        supabase.table("waste_reports")
        .select("phone_number, daily_eco_score")
        .eq("report_date", (START_DATE + timedelta(days=PENALTY_DAY - 1)).isoformat())
        .eq("daily_eco_score", -10)
        .execute()
    )
    print(f"   Penalty events on Day {PENALTY_DAY}: {len(penalty_snapshot.data)} households")


if __name__ == "__main__":
    seed_database()
