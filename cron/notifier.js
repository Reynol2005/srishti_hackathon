/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  EcoVoice — End-of-Day SMS Nudge System                     ║
 * ║  Runs daily at 7 PM via cron / task scheduler.              ║
 * ║                                                              ║
 * ║  1. Queries Supabase `waste_reports` for today's data.      ║
 * ║  2. Finds the top performing phone number.                  ║
 * ║  3. Calculates community average score.                     ║
 * ║  4. Sends a motivational SMS to every unique user.          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const twilio = require("twilio");

// ────────────────────────────────────────────────────────────────
// Configuration & validation
// ────────────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌  Missing required environment variables:\n   ${missing.join(", ")}`);
  console.error("   → Copy .env.example to .env and fill in your credentials.");
  process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN === "true";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Returns today's date range in ISO format (local timezone start/end).
 * Uses UTC boundaries for simplicity; adjust if you need IST-aware days.
 */
function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

/**
 * Masks a phone number for public display.
 * "+919876543210" → "+91****3210"
 */
function maskPhone(phone) {
  if (!phone || phone.length < 6) return "****";
  const visible = 4; // last N digits shown
  const prefix = phone.slice(0, phone.length - visible - 4);
  const masked = "****";
  const suffix = phone.slice(-visible);
  return `${prefix}${masked}${suffix}`;
}

/**
 * Small delay helper — avoids hammering the Twilio API.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────────────────────
// Core logic
// ────────────────────────────────────────────────────────────────

/**
 * Fetch today's waste reports from Supabase.
 */
async function fetchTodayReports() {
  const { startISO, endISO } = getTodayRange();

  const { data, error } = await supabase
    .from("waste_reports")
    .select("phone_number, score")
    .gte("created_at", startISO)
    .lt("created_at", endISO);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Aggregate reports:
 *  - community average score
 *  - top performing phone number (highest total score)
 *  - list of all unique phone numbers
 */
function aggregateReports(reports) {
  if (reports.length === 0) {
    return { avgScore: 0, topPhone: null, uniquePhones: [] };
  }

  // Total scores per phone number
  const scoreboard = {};
  let totalScore = 0;

  for (const r of reports) {
    const phone = r.phone_number;
    const score = Number(r.score) || 0;
    totalScore += score;
    scoreboard[phone] = (scoreboard[phone] || 0) + score;
  }

  const avgScore = (totalScore / reports.length).toFixed(1);

  // Determine the top performer
  let topPhone = null;
  let topScore = -Infinity;
  for (const [phone, score] of Object.entries(scoreboard)) {
    if (score > topScore) {
      topScore = score;
      topPhone = phone;
    }
  }

  const uniquePhones = Object.keys(scoreboard);

  return { avgScore, topPhone, uniquePhones };
}

/**
 * Build the SMS body.
 */
function buildMessage(avgScore, maskedTopPhone) {
  return (
    `🌿 EcoVoice Update: Your community scored an average of ${avgScore} today! ` +
    `User ${maskedTopPhone} is leading the street. ` +
    `Tip for tomorrow: separating wet waste earns you +10 points! ♻️`
  );
}

/**
 * Send an SMS via Twilio with per-message error handling.
 * Returns { success: boolean, phone: string, error?: string }.
 */
async function sendSMS(to, body) {
  if (DRY_RUN) {
    console.log(`   📨 [DRY RUN] → ${to}`);
    return { success: true, phone: to };
  }

  try {
    const message = await twilioClient.messages.create({
      body,
      from: TWILIO_FROM,
      to,
    });
    console.log(`   ✅  Sent → ${to}  (SID: ${message.sid})`);
    return { success: true, phone: to, sid: message.sid };
  } catch (err) {
    console.error(`   ⚠️  Failed → ${to}  (${err.message})`);
    return { success: false, phone: to, error: err.message };
  }
}

// ────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log("═══════════════════════════════════════════════════");
  console.log("  EcoVoice SMS Notifier");
  console.log(`  ${new Date().toLocaleString()}`);
  if (DRY_RUN) console.log("  ⚡ DRY RUN MODE — no SMS will be sent");
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Fetch reports
  console.log("📊  Fetching today's waste reports…");
  const reports = await fetchTodayReports();
  console.log(`   Found ${reports.length} report(s) for today.\n`);

  if (reports.length === 0) {
    console.log("ℹ️  No reports found for today. Nothing to send. Exiting.");
    return;
  }

  // 2. Aggregate
  const { avgScore, topPhone, uniquePhones } = aggregateReports(reports);
  const maskedTop = maskPhone(topPhone);
  console.log(`📈  Community average score : ${avgScore}`);
  console.log(`🏆  Top performer           : ${maskedTop}`);
  console.log(`👥  Unique users            : ${uniquePhones.length}\n`);

  // 3. Build message
  const messageBody = buildMessage(avgScore, maskedTop);
  console.log(`💬  Message template:\n   "${messageBody}"\n`);

  // 4. Send SMS to all unique users
  console.log("📤  Sending SMS messages…");
  const results = { sent: 0, failed: 0, errors: [] };

  for (const phone of uniquePhones) {
    const result = await sendSMS(phone, messageBody);
    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push({ phone: result.phone, error: result.error });
    }

    // Throttle: ~1 msg/sec to respect Twilio rate limits
    await sleep(1000);
  }

  // 5. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  📋  Summary");
  console.log(`     Sent     : ${results.sent}`);
  console.log(`     Failed   : ${results.failed}`);
  console.log(`     Duration : ${elapsed}s`);

  if (results.errors.length > 0) {
    console.log("\n  ⚠️  Failed deliveries:");
    for (const e of results.errors) {
      console.log(`     • ${e.phone} — ${e.error}`);
    }
  }

  console.log("═══════════════════════════════════════════════════");

  // Exit with non-zero if any messages failed (useful for monitoring)
  if (results.failed > 0) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("\n💥  Unhandled error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
