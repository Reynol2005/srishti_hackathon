-- ============================================================
-- EcoVoice — Supabase (PostgreSQL) Schema
-- Table: waste_reports
-- 
-- Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor)
-- or via the Supabase CLI: supabase db push
-- ============================================================

-- Enable the uuid-ossp extension (needed for uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------
-- Primary table: waste_reports
-- One row = one household's daily waste report
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS waste_reports (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number    TEXT        NOT NULL,
    report_date     DATE        NOT NULL,
    is_segregated   BOOLEAN     NOT NULL DEFAULT FALSE,
    volume_level    INTEGER     NOT NULL CHECK (volume_level BETWEEN 1 AND 3),
    is_reused       BOOLEAN     NOT NULL DEFAULT FALSE,
    daily_eco_score INTEGER     NOT NULL DEFAULT 0,

    -- Ensure one report per household per day
    CONSTRAINT unique_phone_date UNIQUE (phone_number, report_date)
);

-- -----------------------------------------------------------
-- Indexes for common query patterns
-- -----------------------------------------------------------

-- Fast lookups by phone number (household history)
CREATE INDEX IF NOT EXISTS idx_waste_reports_phone
    ON waste_reports (phone_number);

-- Fast lookups/sorting by date (daily dashboards, trends)
CREATE INDEX IF NOT EXISTS idx_waste_reports_date
    ON waste_reports (report_date);

-- Composite index for leaderboard / per-day-per-phone queries
CREATE INDEX IF NOT EXISTS idx_waste_reports_phone_date
    ON waste_reports (phone_number, report_date);

-- -----------------------------------------------------------
-- Row Level Security (RLS) — enable but keep open for now.
-- Tighten policies before production.
-- -----------------------------------------------------------
ALTER TABLE waste_reports ENABLE ROW LEVEL SECURITY;

-- Allow full access for authenticated & anon roles during development
CREATE POLICY "Allow all access during development"
    ON waste_reports
    FOR ALL
    USING (true)
    WITH CHECK (true);
