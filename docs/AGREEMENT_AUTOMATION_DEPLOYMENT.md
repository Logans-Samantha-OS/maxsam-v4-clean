# Agreement Automation Engine - Deployment Guide

## System Overview

The Agreement Automation Engine enables **fully automated, mobile-first agreement signing** for MaxSam V4. Clients can:

1. Reply **1**, **2**, or **3** to an SMS
2. Receive a **single signing link**
3. Sign on their phone in **under 60 seconds**

The system then:
- Archives signed PDFs to Dropbox + Google Drive
- Updates Supabase with complete audit trail
- Notifies Sam to proceed to next phase
- Sends Telegram notification to Logan

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT JOURNEY                                       │
│                                                                              │
│   SMS: "YES"  →  Menu: "Reply 1, 2, or 3"  →  SMS: "3"  →  Signing Link    │
│                                                                              │
│   1️⃣ Excess Funds Recovery (25% fee)                                        │
│   2️⃣ Wholesale/Assignment (10% fee)                                         │
│   3️⃣ BOTH (Combined agreement)                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM FLOW                                          │
│                                                                              │
│   Twilio SMS → MaxSam API → JotForm Sign → Webhook → n8n Workflows         │
│                                                                              │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                    │
│   │   Dispatch   │   │  Completion  │   │  Follow-Up   │                    │
│   │   Workflow   │   │   Workflow   │   │   Workflow   │                    │
│   │              │   │              │   │              │                    │
│   │ • Validate   │   │ • Update DB  │   │ • +2h remind │                    │
│   │ • Create pkt │   │ • Fetch PDF  │   │ • +24h remind│                    │
│   │ • Gen link   │   │ • Dropbox    │   │ • +72h remind│                    │
│   │ • Send SMS   │   │ • G Drive    │   │ • Escalate   │                    │
│   │ • Send email │   │ • Telegram   │   │              │                    │
│   │ • Telegram   │   │ • Confirm    │   │              │                    │
│   └──────────────┘   └──────────────┘   └──────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Signing Provider: JotForm Sign

**Selected:** JotForm Sign (Primary)

**Rationale:**
- ✅ Free tier: 5 docs/month, $29/mo unlimited
- ✅ REST API with webhooks
- ✅ Mobile-optimized signing UX
- ✅ Pre-filled form fields
- ✅ Multi-document packets
- ✅ No enterprise pricing wall

**Fallback:** Dropbox Sign → SignWell

---

## Environment Variables Required

Add these to your `.env.local` and Vercel environment:

```bash
# JotForm Sign (REQUIRED)
JOTFORM_API_KEY=your_jotform_api_key
JOTFORM_EXCESS_FUNDS_FORM_ID=your_excess_funds_form_id
JOTFORM_WHOLESALE_FORM_ID=your_wholesale_form_id
JOTFORM_WEBHOOK_SECRET=your_webhook_secret

# n8n Webhooks (REQUIRED)
N8N_AGREEMENT_DISPATCH_WEBHOOK=https://skooki.app.n8n.cloud/webhook/agreement-dispatch
N8N_AGREEMENT_COMPLETION_WEBHOOK=https://skooki.app.n8n.cloud/webhook/agreement-completion
N8N_SEND_EMAIL_WEBHOOK=https://skooki.app.n8n.cloud/webhook/send-email

# Existing (should already be set)
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx
NEXT_PUBLIC_APP_URL=https://maxsam.vercel.app
```

---

## Database Migration

Run the Supabase migration:

```sql
-- File: supabase/migrations/20260120150000_agreement_automation.sql

-- Creates:
-- • agreement_packets (main tracking table)
-- • agreement_documents (individual docs in packet)
-- • agreement_events (full audit trail)
-- • agreement_templates (master agreement refs)
-- • Helper functions for packet lifecycle
```

**Deploy via Supabase Dashboard:**
1. Go to SQL Editor
2. Paste the migration file contents
3. Run

Or via CLI:
```bash
npx supabase db push
```

---

## n8n Workflow Deployment

Import these workflows into n8n:

### 1. Agreement Dispatch Workflow
**File:** `n8n/agreement_dispatch_workflow.json`
**Webhook:** `POST /webhook/agreement-dispatch`

**Credentials Required:**
- Supabase API
- Twilio API
- Gmail OAuth2
- Telegram API

### 2. Agreement Completion Workflow
**File:** `n8n/agreement_completion_workflow.json`
**Webhook:** `POST /webhook/agreement-completion`

**Credentials Required:**
- Supabase API
- Twilio API
- Dropbox OAuth2
- Google Drive OAuth2
- Telegram API

### 3. Agreement Follow-Up Workflow
**File:** `n8n/agreement_followup_workflow.json`
**Schedule:** Runs hourly

**Credentials Required:**
- Supabase API
- Twilio API
- Telegram API

---

## JotForm Sign Setup

### 1. Create Forms

Create two JotForm forms with signing enabled:

**Excess Funds Recovery Form:**
- Fields: client_name, client_email, client_phone, property_address, case_number, excess_funds_amount, total_fee_amount, agreement_date, packet_id, lead_id
- Enable e-signature widget
- Add signature field with anchor text

**Wholesale Assignment Form:**
- Same fields as above
- Different contract content

### 2. Configure Webhooks

In JotForm settings for each form:
- Add webhook URL: `https://maxsam.vercel.app/api/webhooks/jotform-sign`
- Select events: Submission received

### 3. Get Form IDs

The form ID is in the URL when editing:
`https://form.jotform.com/FORM_ID_HERE`

Add to environment variables.

---

## API Endpoints

### Create Agreement Packet
```bash
POST /api/agreements
{
  "lead_id": "uuid",
  "selection_code": 1|2|3,
  "triggered_by": "sms"|"ui"|"api"|"workflow",
  "send_immediately": true
}

Response:
{
  "success": true,
  "packet_id": "uuid",
  "signing_link": "https://form.jotform.com/...",
  "sms_sent": true,
  "email_sent": true
}
```

### List Agreement Packets
```bash
GET /api/agreements?status=sent&lead_id=uuid&limit=50
```

### Get Packet Details
```bash
GET /api/agreements/{packet_id}
```

### Packet Actions
```bash
POST /api/agreements/{packet_id}
{
  "action": "resend"|"remind"|"void",
  "reason": "optional reason for void"
}
```

### JotForm Webhook
```bash
POST /api/webhooks/jotform-sign
# Automatically called by JotForm on signing events
```

---

## SMS Flow

### Client Replies "YES"
```
Sam: "Hi [Name]! I have info about funds owed to you..."
Client: "YES"
Sam: "Which service would you like?
      Reply 1, 2, or 3:
      1️⃣ Excess Funds Recovery ($X available)
      2️⃣ Property Purchase (cash offer)
      3️⃣ BOTH services"
```

### Client Selects Option
```
Client: "3"
Sam: "Perfect! Your Combined Agreement is ready.
      Sign in 60 seconds: https://form.jotform.com/..."
```

### Natural Language Support
The system also accepts:
- "one", "first", "excess funds" → Option 1
- "two", "wholesale" → Option 2
- "three", "both", "dual" → Option 3

---

## Reminder Schedule

| Reminder | Time After Send | Message Tone |
|----------|-----------------|--------------|
| 1st | +2 hours | Friendly nudge |
| 2nd | +24 hours | Add urgency |
| 3rd | +72 hours | Final notice |
| Escalate | After 3rd | Telegram alert |

---

## File Storage Structure

### Dropbox
```
/MAXSAM V4/
├── Templates/
│   ├── Excess_Funds_Recovery_Agreement.pdf
│   └── Wholesale_Assignment_Agreement.pdf
└── Signed/
    └── {Client Name}/
        └── 2025-01-20_Excess_Funds_Agreement.pdf
```

### Google Drive (NotebookLM)
```
/NotebookLM/
└── Clients/
    └── {Client Name}/
        └── Agreements/
            └── 2025-01-20_Agreement.pdf
```

---

## Monitoring

### Telegram Notifications

**Agreement Sent:**
```
📝 AGREEMENT SENT!
📋 Excess Funds
👤 John Smith
🏠 123 Main St
💰 $15,000
📱 +1234567890
Packet ID: abc-123
```

**Agreement Signed:**
```
✅ AGREEMENT SIGNED!
🎉 John Smith signed!
⭐ DUAL DEAL
🏠 123 Main St
💰 Total Fee: $5,000
📁 PDFs uploaded to Dropbox & Drive
```

**Escalation:**
```
⚠️ ESCALATION: Agreement unsigned after 3 reminders
👤 John Smith
🏠 123 Main St
Manual follow-up recommended.
```

### Database Queries

```sql
-- Unsigned packets needing attention
SELECT * FROM agreement_packets
WHERE status = 'sent'
AND created_at < NOW() - INTERVAL '72 hours';

-- Conversion rate
SELECT
  COUNT(*) FILTER (WHERE status = 'signed') * 100.0 / COUNT(*) as conversion_rate
FROM agreement_packets
WHERE created_at > NOW() - INTERVAL '30 days';

-- Recent events
SELECT * FROM agreement_events
ORDER BY created_at DESC
LIMIT 50;
```

---

## Testing

### 1. Manual API Test
```bash
curl -X POST https://maxsam.vercel.app/api/agreements \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "your-test-lead-id",
    "selection_code": 1,
    "send_immediately": false
  }'
```

### 2. SMS Test
Send "YES" to the Twilio number from a phone associated with a test lead.

### 3. Webhook Test
Use JotForm's webhook tester or manually POST to `/api/webhooks/jotform-sign`.

---

## Troubleshooting

### No SMS Sent
- Check Twilio credentials
- Verify phone number format (E.164)
- Check opt-out list

### Agreement Not Created
- Verify lead has phone number
- Check JotForm form IDs are correct
- Review server logs

### Webhook Not Received
- Verify JotForm webhook URL is correct
- Check webhook is enabled in JotForm
- Review n8n execution logs

### PDF Not Uploaded
- Check Dropbox/Google Drive credentials in n8n
- Verify folder permissions
- Check file size limits

---

## Next Steps After Deployment

1. **Create JotForm forms** with proper fields and signature widgets
2. **Set environment variables** in Vercel
3. **Run database migration** in Supabase
4. **Import n8n workflows** and configure credentials
5. **Configure JotForm webhooks** to point to your API
6. **Test end-to-end** with a test lead

---

## Success Definition

A client can:
- Reply **1**, **2**, or **3**
- Receive **one link**
- Sign on their phone in **under 60 seconds**

And the system will:
- ✅ Archive agreements to Dropbox + Google Drive
- ✅ Update Supabase with full audit trail
- ✅ Notify Sam to proceed
- ✅ Alert Logan via Telegram
- ✅ Proceed **autonomously**
