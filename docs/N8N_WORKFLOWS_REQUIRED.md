# MaxSam V4 - Required n8n Workflows for Full Automation

## Overview

This document specifies the n8n workflows needed to fully automate MaxSam V4. Each workflow corresponds to a toggle in the Workflow Control Panel.

---

## 1. INTAKE WORKFLOW

**Purpose:** Automatically import and score leads from Dallas County excess funds PDF

**Toggle:** `intake_enabled`

**Schedule:** Daily at 5:30 AM CT

### Workflow Steps:

```
[Cron Trigger: 5:30 AM]
    ↓
[HTTP Request: Check Gate]
    → GET https://maxsam-v4-clean.vercel.app/api/governance
    → Check: intake_enabled === true AND system_killed === false
    ↓
[IF Gate Enabled]
    ↓
[HTTP Request: Download PDF]
    → Dallas County excess funds URL (configured in system_config)
    ↓
[HTTP Request: Parse PDF]
    → POST https://maxsam-v4-clean.vercel.app/api/import/parse-pdf
    → Body: { pdf_url: "..." }
    ↓
[HTTP Request: Process Leads]
    → POST https://maxsam-v4-clean.vercel.app/api/import/process
    → Body: { leads: [...parsed data...] }
    ↓
[HTTP Request: Score All]
    → POST https://maxsam-v4-clean.vercel.app/api/eleanor/score-all
    ↓
[HTTP Request: Classify All]
    → POST https://maxsam-v4-clean.vercel.app/api/classification/backfill
    ↓
[HTTP Request: Notify]
    → POST https://maxsam-v4-clean.vercel.app/api/telegram/notify
    → Body: { message: "Intake complete: X new leads imported, Y scored" }
```

### Expected Output:
- New leads added to `maxsam_leads` table
- All leads scored by Eleanor (0-100)
- All leads classified (A/B/C)
- Telegram notification sent

---

## 2. OUTREACH WORKFLOW

**Purpose:** Send SMS/voice outreach to qualified leads via SAM

**Toggle:** `outreach_enabled`

**Schedule:** Hourly, 9 AM - 8 PM CT (business hours only)

### Workflow Steps:

```
[Cron Trigger: Every hour, 9-20]
    ↓
[HTTP Request: Check Gate]
    → GET https://maxsam-v4-clean.vercel.app/api/governance
    → Check: outreach_enabled === true AND system_killed === false
    → Check: autonomy_level >= 3 (FULL AUTO required for outreach)
    ↓
[IF Gate Enabled AND Autonomy >= 3]
    ↓
[HTTP Request: Get Priority Queue]
    → GET https://maxsam-v4-clean.vercel.app/api/ralph/queue
    → Returns leads ranked by class (A → B → C) and priority
    ↓
[Loop: For each lead in batch (max 20)]
    ↓
    [HTTP Request: Check Opt-Out]
        → Query opt_outs table for phone number
        ↓
    [IF Not Opted Out]
        ↓
        [HTTP Request: Send SMS]
            → POST https://maxsam-v4-clean.vercel.app/api/leads/{id}/sms
            → Body: { template: "initial_contact" }
        ↓
        [HTTP Request: Log Activity]
            → POST https://maxsam-v4-clean.vercel.app/api/activity
            → Body: { lead_id, activity_type: "sms_sent" }
    ↓
[End Loop]
    ↓
[HTTP Request: Notify]
    → POST https://maxsam-v4-clean.vercel.app/api/telegram/notify
    → Body: { message: "Outreach batch complete: X messages sent" }
```

### TCPA Compliance Built-in:
- Respects opt-out list
- Business hours only (9 AM - 8 PM)
- Max 5 contact attempts per lead
- Cooldown between attempts (Class A: 4hr, B: 6hr, C: 24hr)

---

## 3. CONTRACTS WORKFLOW

**Purpose:** Generate and send contracts via DocuSign when leads qualify

**Toggle:** `contracts_enabled`

**Trigger:** Event-based (lead status → "qualified")

### Workflow Steps:

```
[Webhook Trigger: Lead Status Changed]
    → Listen for status = "qualified" OR "ready_for_contract"
    ↓
[HTTP Request: Check Gate]
    → GET https://maxsam-v4-clean.vercel.app/api/governance
    → Check: contracts_enabled === true AND system_killed === false
    ↓
[IF Gate Enabled]
    ↓
[HTTP Request: Get Lead Details]
    → GET https://maxsam-v4-clean.vercel.app/api/leads/{lead_id}
    ↓
[HTTP Request: Get Classification]
    → Determine contract type based on lead_class:
        - Class A → dual-deal.html (25% + 10%)
        - Class B → excess-funds-recovery.html (25%)
        - Class C → excess-funds-recovery.html (25%)
    ↓
[HTTP Request: Generate Contract]
    → POST https://maxsam-v4-clean.vercel.app/api/contracts
    → Body: {
        lead_id,
        template: "excess-funds-recovery" | "dual-deal",
        owner_name,
        property_address,
        excess_amount,
        fee_percent: 25
      }
    ↓
[HTTP Request: Send for Signing]
    → POST https://maxsam-v4-clean.vercel.app/api/contracts/send
    → Body: { contract_id, signer_email, signer_name }
    ↓
[HTTP Request: Update Lead Status]
    → PUT https://maxsam-v4-clean.vercel.app/api/leads/{lead_id}
    → Body: { status: "contract_sent" }
    ↓
[HTTP Request: Notify]
    → POST https://maxsam-v4-clean.vercel.app/api/telegram/notify
    → Body: { message: "Contract sent to {owner_name} for ${amount}" }
```

### Contract Templates Available:
- `templates/excess-funds-recovery.html` - 25% fee
- `templates/wholesale-assignment.html` - 10% fee
- `templates/dual-deal.html` - Combined 25% + 10%

---

## 4. PAYMENTS WORKFLOW

**Purpose:** Create and send Stripe invoices when contracts are signed

**Toggle:** `payments_enabled`

**Trigger:** Event-based (DocuSign webhook → contract signed)

### Workflow Steps:

```
[Webhook Trigger: DocuSign Contract Signed]
    → POST https://maxsam-v4-clean.vercel.app/api/docusign/webhook
    → Event: "envelope-completed"
    ↓
[HTTP Request: Check Gate]
    → GET https://maxsam-v4-clean.vercel.app/api/governance
    → Check: payments_enabled === true AND system_killed === false
    ↓
[IF Gate Enabled]
    ↓
[HTTP Request: Get Contract Details]
    → GET https://maxsam-v4-clean.vercel.app/api/contracts/{contract_id}
    ↓
[HTTP Request: Calculate Fee]
    → fee = excess_amount * 0.25 (or 0.35 for dual deal)
    ↓
[HTTP Request: Create Invoice]
    → POST https://maxsam-v4-clean.vercel.app/api/deals/{lead_id}/invoice
    → Body: {
        amount: fee,
        description: "Excess funds recovery fee - {property_address}",
        customer_email: owner_email
      }
    ↓
[HTTP Request: Update Lead Status]
    → PUT https://maxsam-v4-clean.vercel.app/api/leads/{lead_id}
    → Body: { status: "invoice_sent" }
    ↓
[HTTP Request: Notify]
    → POST https://maxsam-v4-clean.vercel.app/api/telegram/notify
    → Body: { message: "🎉 CONTRACT SIGNED! Invoice sent for ${fee} to {owner_name}" }
```

---

## 5. RESPONSE HANDLER WORKFLOW

**Purpose:** Process inbound SMS responses and update lead status

**Toggle:** Part of `outreach_enabled`

**Trigger:** Event-based (Twilio webhook → inbound SMS)

### Workflow Steps:

```
[Webhook Trigger: Twilio Inbound SMS]
    → POST https://maxsam-v4-clean.vercel.app/api/twilio/inbound-sms
    ↓
[Parse Message]
    → Extract: from_number, message_body
    ↓
[HTTP Request: Find Lead by Phone]
    → GET https://maxsam-v4-clean.vercel.app/api/leads?phone={from_number}
    ↓
[Analyze Response]
    → Check for opt-out keywords: STOP, UNSUBSCRIBE, CANCEL, QUIT
    → Check for positive signals: YES, INTERESTED, CALL ME, INFO
    → Check for negative signals: NO, NOT INTERESTED, WRONG NUMBER
    ↓
[IF Opt-Out Keyword]
    → INSERT into opt_outs table
    → Update lead status: "opted_out"
    ↓
[ELSE IF Positive Signal]
    → Update lead status: "interested" or "qualified"
    → Notify via Telegram: "🔥 HOT RESPONSE from {name}!"
    ↓
[ELSE IF Negative Signal]
    → Update lead status: "not_interested"
    ↓
[Log Activity]
    → POST https://maxsam-v4-clean.vercel.app/api/activity
    → Body: { lead_id, activity_type: "sms_received", content: message_body }
```

---

## 6. PAYMENT RECEIVED WORKFLOW

**Purpose:** Handle successful Stripe payments and update revenue

**Toggle:** Part of `payments_enabled`

**Trigger:** Event-based (Stripe webhook → payment succeeded)

### Workflow Steps:

```
[Webhook Trigger: Stripe Payment Succeeded]
    → POST https://maxsam-v4-clean.vercel.app/api/stripe/webhook
    → Event: "payment_intent.succeeded"
    ↓
[HTTP Request: Get Payment Details]
    → Extract: amount, customer_email, invoice_id
    ↓
[HTTP Request: Find Lead by Invoice]
    → Match invoice to lead via contracts table
    ↓
[HTTP Request: Update Revenue]
    → INSERT into revenue table
    → Body: { lead_id, amount, payment_date, source: "stripe" }
    ↓
[HTTP Request: Update Lead Status]
    → PUT https://maxsam-v4-clean.vercel.app/api/leads/{lead_id}
    → Body: { status: "paid" }
    ↓
[HTTP Request: Notify]
    → POST https://maxsam-v4-clean.vercel.app/api/telegram/notify
    → Body: { message: "💰 PAYMENT RECEIVED! ${amount} from {owner_name}" }
```

---

## Workflow Registration

After creating each workflow in n8n, register it in Supabase:

```sql
INSERT INTO workflow_controls (workflow_name, n8n_workflow_id, description, enabled, category)
VALUES
  ('Daily Lead Import', 'n8n-workflow-id-1', 'Import and score leads from Dallas County PDF', true, 'intake'),
  ('Hourly Outreach', 'n8n-workflow-id-2', 'SAM SMS campaigns to qualified leads', true, 'outreach'),
  ('Contract Generation', 'n8n-workflow-id-3', 'Generate and send DocuSign contracts', true, 'contracts'),
  ('Invoice Creation', 'n8n-workflow-id-4', 'Create Stripe invoices on contract signing', true, 'payments'),
  ('Response Handler', 'n8n-workflow-id-5', 'Process inbound SMS responses', true, 'outreach'),
  ('Payment Handler', 'n8n-workflow-id-6', 'Handle Stripe payment webhooks', true, 'payments');
```

---

## Environment Variables for n8n

Required in n8n credentials/environment:

```
MAXSAM_API_URL=https://maxsam-v4-clean.vercel.app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
DOCUSIGN_INTEGRATION_KEY=your-docusign-key
STRIPE_SECRET_KEY=your-stripe-key
TELEGRAM_BOT_TOKEN=your-telegram-token
TELEGRAM_CHAT_ID=your-chat-id
```

---

## Automation Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        DAILY INTAKE (5:30 AM)                   │
│  PDF Download → Parse → Import → Score → Classify → Notify      │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    HOURLY OUTREACH (9 AM - 8 PM)                │
│  Get Queue → Check Opt-outs → Send SMS → Log Activity → Notify  │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RESPONSE HANDLER (Real-time)                  │
│  Inbound SMS → Parse → Update Status → Notify if Hot            │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CONTRACT GENERATION (Event)                   │
│  Lead Qualified → Generate Contract → Send DocuSign → Notify    │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    INVOICE CREATION (Event)                      │
│  Contract Signed → Calculate Fee → Create Invoice → Notify      │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT HANDLER (Event)                       │
│  Payment Received → Update Revenue → Update Status → Notify     │
└─────────────────────────────────────────────────────────────────┘
                                ↓
                          💰 MONEY IN ACCOUNT
```

---

## Priority Order

Build workflows in this order:

1. **Response Handler** - Critical for catching hot leads
2. **Daily Intake** - Feed the pipeline
3. **Hourly Outreach** - Generate responses
4. **Contract Generation** - Convert qualified leads
5. **Invoice Creation** - Bill for services
6. **Payment Handler** - Track revenue

---

## Testing Checklist

Before enabling each workflow:

- [ ] Gate check working (stops if disabled)
- [ ] API endpoints responding correctly
- [ ] Telegram notifications arriving
- [ ] Database updates persisting
- [ ] Error handling graceful (no silent failures)
- [ ] Logs accessible in n8n

---

## Control Panel Integration

Once workflows are registered, they can be controlled from:

1. **CEO Dashboard** (`/dashboard/stats`) - Workflow Control Panel toggles
2. **System Control Center** (`/dashboard/governance`) - Individual gate controls
3. **API** - `POST /api/governance` for programmatic control
