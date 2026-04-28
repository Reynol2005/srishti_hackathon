# 📲 EcoVoice SMS Notifier (`cron/`)

End-of-day SMS nudge system that motivates users by sharing community waste-segregation scores.

## How it works

```
┌──────────────┐    query today's     ┌────────────────┐
│   Cron Job   │ ──────────────────►  │   Supabase DB  │
│  (7 PM daily)│                      │ waste_reports   │
└──────┬───────┘                      └────────────────┘
       │
       │  aggregate scores
       │  find top performer
       ▼
┌──────────────┐    send SMS via      ┌────────────────┐
│  notifier.js │ ──────────────────►  │   Twilio API   │
│              │                      │                │
└──────────────┘                      └────────────────┘
```

## Quick start

```bash
# 1. Install dependencies
cd cron
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase + Twilio credentials

# 3. Test without sending real SMS
npm run dry-run

# 4. Run for real
npm start
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Service-role key (not the anon key) |
| `TWILIO_ACCOUNT_SID` | ✅ | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | ✅ | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | ✅ | Your Twilio sender number (E.164) |
| `DRY_RUN` | ❌ | Set to `true` to log without sending |

## Scheduling with cron

Add this to your server's crontab (`crontab -e`):

```cron
# Run EcoVoice SMS notifier daily at 7:00 PM IST
30 13 * * * cd /path/to/srishti_hackathon/cron && /usr/bin/node notifier.js >> /var/log/ecovoice-notifier.log 2>&1
```

> **Note:** `13:30 UTC` = `19:00 IST`. Adjust for your timezone.

### Windows Task Scheduler

```powershell
schtasks /create /tn "EcoVoice SMS Notifier" /tr "node D:\srishti_hackathon\cron\notifier.js" /sc daily /st 19:00
```

## SMS template

```
🌿 EcoVoice Update: Your community scored an average of [X] today!
User [+91****3210] is leading the street.
Tip for tomorrow: separating wet waste earns you +10 points! ♻️
```

## Error handling

- **Missing env vars** → Script exits with code `1` and prints which vars are missing.
- **Supabase query failure** → Script throws and exits with code `1`.
- **Individual SMS failure** → Logged but does NOT stop the loop. Script continues to the next user.
- **All messages sent but some failed** → Script exits with code `2` (useful for alerting).
- **Rate limiting** → 1-second delay between messages to respect Twilio limits.

## Database schema

See [`../database/schema.sql`](../database/schema.sql) for the `waste_reports` table definition.
