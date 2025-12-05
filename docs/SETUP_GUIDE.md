# MaxSam V4 Setup Guide

This guide walks you through setting up all the services required for MaxSam V4 to operate as a fully autonomous real estate money machine.

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- A Vercel account for deployment

## Quick Start

```bash
# 1. Clone and install
git clone <your-repo>
cd maxsam-v4-clean
npm install

# 2. Copy environment file
cp .env.example .env.local

# 3. Fill in your credentials (see sections below)

# 4. Run database migration (copy SQL to Supabase)
# Open supabase/migrations/001_complete_schema.sql
# Copy contents to Supabase SQL Editor and run

# 5. Start development
npm run dev

# 6. Open http://localhost:3000
```

---

## 1. Supabase Setup (Database)

### Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your project URL and API keys

### Run Migration
1. Go to SQL Editor in Supabase dashboard
2. Copy contents of `supabase/migrations/001_complete_schema.sql`
3. Run the migration

### Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## 2. DocuSign Setup (Contracts)

### Create Developer Account
1. Go to [developers.docusign.com](https://developers.docusign.com)
2. Create a free developer account

### Create Integration
1. Go to Apps and Keys
2. Create new integration
3. Select "Authorization Code Grant" and "JWT Grant"
4. Add redirect URI: `https://your-domain.com/api/docusign/callback`
5. Generate RSA keypair
6. Note your Integration Key and User ID

### Grant Consent (One-time)
Visit this URL (replace with your values):
```
https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=YOUR_INTEGRATION_KEY&redirect_uri=YOUR_REDIRECT_URI
```

### Environment Variables
```bash
DOCUSIGN_ACCOUNT_ID=7a03fde4-49b0-4e8c-af4f-1a7e4f9f3707
DOCUSIGN_USER_ID=0dcf40eb-50a1-4890-a8a8-03dbff554681
DOCUSIGN_INTEGRATION_KEY=a508ced6-9237-44ab-a8be-8f188e730751
DOCUSIGN_RSA_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
DOCUSIGN_BASE_URL=https://demo.docusign.net/restapi
DOCUSIGN_AUTH_SERVER=https://account-d.docusign.com
```

**Note:** For production, change `account-d` to `account` and `demo.docusign.net` to `docusign.net`.

---

## 3. Twilio Setup (SMS/Voice)

### Create Account
1. Go to [twilio.com](https://www.twilio.com)
2. Create account and get phone number

### A2P 10DLC Registration (REQUIRED for SMS)
This is critical for deliverability in the US:

1. Go to Twilio Console > Messaging > Services
2. Create new Messaging Service
3. Register your brand (business info)
4. Register campaign (use "Marketing" or "Mixed" for real estate)
5. Wait for approval (1-5 business days)

### Environment Variables
```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

### Configure Webhooks
In Twilio Console:
1. Go to Phone Numbers > Your Number
2. Set Messaging webhook: `https://your-domain.com/api/twilio/inbound-sms`
3. Method: POST

---

## 4. Stripe Setup (Payments)

### Create Account
1. Go to [stripe.com](https://stripe.com)
2. Create account and complete verification

### Get API Keys
1. Go to Developers > API Keys
2. Get both publishable and secret keys

### Configure Webhooks
1. Go to Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events: `invoice.paid`, `invoice.payment_failed`, `invoice.sent`
4. Note the webhook signing secret

### Environment Variables
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 5. Telegram Setup (Notifications)

### Create Bot
1. Open Telegram and search for @BotFather
2. Send `/newbot`
3. Follow prompts to name your bot
4. Save the bot token

### Get Chat ID
1. Start a chat with your bot
2. Send any message
3. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
4. Find your chat ID in the response

### Environment Variables
```bash
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_CHAT_ID=123456789
```

### Test
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<CHAT_ID>&text=Test message"
```

---

## 6. Skip Tracing (Optional)

### BatchSkipTracing
1. Go to [batchskiptracing.com](https://batchskiptracing.com)
2. Create account
3. Get API key from settings

### Environment Variables
```bash
BATCH_SKIP_TRACING_API_KEY=...
```

---

## 7. ElevenLabs (Optional - Voice AI)

### Setup
1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Create account
3. Get API key

### Environment Variables
```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

---

## 8. Vercel Deployment

### Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
# ... repeat for all variables
```

### Configure Cron Jobs
Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/import-leads",
      "schedule": "30 5 * * *"
    },
    {
      "path": "/api/cron/score-leads",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/morning-brief",
      "schedule": "15 6 * * *"
    },
    {
      "path": "/api/cron/outreach",
      "schedule": "0 9-20 * * *"
    }
  ]
}
```

---

## 9. Webhook URLs Summary

After deployment, configure these webhooks in each service:

| Service | Webhook URL |
|---------|-------------|
| DocuSign | `https://your-domain.com/api/docusign/webhook` |
| Twilio SMS | `https://your-domain.com/api/twilio/inbound-sms` |
| Stripe | `https://your-domain.com/api/stripe/webhook` |

---

## 10. Testing

### Test Each Integration
```bash
# Test Telegram
curl -X POST https://your-domain.com/api/telegram/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Test notification"}'

# Test Eleanor Scoring
curl -X POST https://your-domain.com/api/eleanor/score \
  -H "Content-Type: application/json" \
  -d '{"lead_data": {"excess_funds_amount": 25000}}'

# Test Settings
curl https://your-domain.com/api/settings
```

### Verify Dashboard
1. Open https://your-domain.com
2. Check all metrics load
3. Navigate to Settings
4. Verify integration status shows green

---

## Troubleshooting

### DocuSign "Consent Required"
Visit the consent URL shown in the error, grant access, then retry.

### Twilio Messages Not Delivering
1. Check A2P 10DLC registration status
2. Verify phone number format (E.164: +1XXXXXXXXXX)
3. Check opt-out list

### Stripe Webhooks Failing
1. Verify webhook URL is correct
2. Check webhook signing secret
3. Ensure events are selected

### Database Errors
1. Run migration again
2. Check Supabase service role key
3. Verify RLS policies

---

## Support

For issues, check:
- GitHub Issues
- Vercel deployment logs
- Supabase logs
- Integration dashboards (Twilio, Stripe, DocuSign)
