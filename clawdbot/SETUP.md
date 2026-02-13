# Clawdbot LLM Gate — Setup Instructions

## Problem
Clawdbot hitting Claude API HTTP 429 (30K input tokens/min rate limit).

## Solution
`llm-gate.js` — queues Claude calls, enforces throttle, retries with backoff.

---

## Step 1: Install Dependencies

```powershell
cd C:\Users\MrTin\clawd
npm init -y
npm install p-queue
```

## Step 2: Copy Gate File

Copy `clawdbot/llm-gate.js` from this repo to:
```
C:\Users\MrTin\clawd\hooks\llm-gate.js
```

## Step 3a: If Hooks ARE Supported

Check:
```powershell
clawdbot hooks --help 2>&1
```

If hooks exist, add to `C:\Users\MrTin\.clawdbot\clawdbot.json`:
```json
{
  "hooks": {
    "message.before": "C:\\Users\\MrTin\\clawd\\hooks\\llm-gate.js"
  }
}
```

## Step 3b: If Hooks Are NOT Supported (Plan B)

Find the Anthropic API call file:
```powershell
Select-String -Path "C:\Users\MrTin\AppData\Roaming\npm\node_modules\clawdbot\**\*.js" -Pattern "messages\.create" -Recurse | Select -First 10
```

Then monkey-patch it (see PLAN_B_PATCH section at bottom of `llm-gate.js`).

## Step 4: Restart

```powershell
clawdbot gateway stop
clawdbot gateway run --verbose
```

## Step 5: Test

Send 5 rapid Telegram messages. Expected:
- Messages get coalesced (2s buffer)
- Only 1 Claude API call fires
- Check `/metrics` command for stats

## Ops Commands (Skip Claude)

| Command | Action |
|---------|--------|
| `/status` | Show queue + system status |
| `/metrics` | LLM gate statistics |
| `/health` | Ping/pong |
| `/stop` | Pause Claude queue |
| `/start` | Resume Claude queue |
