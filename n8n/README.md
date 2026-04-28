# 🔄 EcoVoice — n8n Workflow

## Setup

1. Install n8n: `npm install -g n8n`
2. Start: `n8n` → opens at http://localhost:5678
3. Create account (local only)
4. Import workflow: **Workflows → Import from File → select `ecovoice-daily-nudge.json`**

## Environment Variables

Set these in n8n's **Settings → Variables**:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://ykiscuduyrpxqrnmfxxw.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Your service role key |
| `SMS_GATEWAY_URL` | `http://<phone-ip>:8765` |
| `SMS_GATEWAY_API_KEY` | `ecovoice-hackathon-2026` |

## Test

Click **"Execute Workflow"** to run manually (don't wait for 7 PM).

## Workflow Nodes

1. **Schedule Trigger** — fires daily at 7:00 PM
2. **Fetch Today Reports** — HTTP GET to Supabase REST API
3. **Compute Stats & Build SMS** — JavaScript: avg score, top performer, SMS body
4. **Send SMS via Gateway** — HTTP POST to Termux gateway (continues on failure)
