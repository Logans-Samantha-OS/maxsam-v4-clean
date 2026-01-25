# CLAUDE.md - MaxSam V4 Quick Reference

## Project Overview

MaxSam V4 is an automated real estate money machine that:
1. Ingests Dallas County foreclosure excess funds data
2. Scores leads with Eleanor AI
3. Contacts owners via Sam AI (Twilio SMS)
4. Generates and sends contracts via DocuSign
5. Tracks deals through to payment
6. Notifies Logan via Telegram

**Owner:** Logan Toups, Richardson, TX
**Revenue Model:** 25% excess funds recovery fee, 10% wholesale fee
**All revenue → 100% to Logan (configurable for future partners)**

### Revenue Streams (IMPORTANT - No Client Invoicing!)

**Excess Funds Recovery (25% fee):**
- COUNTY holds excess funds from tax sale
- We find the original property owner
- Owner signs assignment agreement
- We file claim with COUNTY
- COUNTY disburses funds
- We take 25% fee, send 75% to owner
- NO client invoice - money comes from county payout

**Wholesale Deals (10% assignment fee):**
- We find distressed property, get it under contract
- We find BUYER willing to pay more
- We assign contract to buyer
- BUYER pays assignment fee at closing via TITLE COMPANY
- NO client invoice - money comes through title company

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 19, Tailwind CSS
- **Database:** Supabase PostgreSQL
- **Deployment:** Vercel
- **Integrations:** DocuSign, Twilio, Stripe, Telegram, ElevenLabs

## Key Files

```
lib/
  eleanor.ts          # Lead scoring engine (0-100 score)
  docusign.ts         # DocuSign JWT auth & envelope creation
  contract-generator.ts  # Generate contracts from templates
  twilio.ts           # SMS/voice via Twilio
  sam-outreach.ts     # Autonomous outreach engine
  stripe.ts           # (Deprecated - not used for client payments)
  skip-tracing.ts     # Contact info lookup
  telegram.ts         # Notification system
  supabase/server.ts  # Server-side Supabase client

app/
  page.tsx            # Main dashboard
  settings/page.tsx   # Configuration UI
  morning-brief/page.tsx  # Daily summary
  sellers/page.jsx    # Lead management
  api/                # All API routes

templates/
  excess-funds-recovery.html   # 25% fee contract
  wholesale-assignment.html    # 10% fee contract
  dual-deal.html              # Combined contract

supabase/migrations/
  001_complete_schema.sql     # Database schema
```

## Database Tables

- `maxsam_leads` - Lead data with Eleanor scores
- `contracts` - DocuSign contracts
- `deals` - **NEW** Deal tracking (excess funds claims & wholesale closings)
- `buyers` - Investor/buyer network
- `revenue` - Payment tracking (linked to deals)
- `opt_outs` - TCPA compliance
- `status_history` - Audit trail
- `system_config` - Settings
- `communication_logs` - SMS/call history

## API Routes

```
GET/POST  /api/leads              # List/create leads
GET/PUT   /api/leads/[id]         # Get/update lead
POST      /api/leads/[id]         # Actions: score, skip-trace, send-sms, generate-contract

POST      /api/eleanor/score      # Score single lead
POST      /api/eleanor/score-all  # Batch score
GET       /api/eleanor/explain/[id]  # Scoring breakdown

GET/POST  /api/contracts          # List/create contracts
POST      /api/contracts/[id]     # Actions: resend, void

GET/POST  /api/deals              # List/create deals
GET/PUT   /api/deals/[id]         # Get/update deal
POST      /api/deals/[id]         # Actions: file_claim, approve_claim, record_county_payout,
                                  #          assign_buyer, schedule_closing, close_deal

POST      /api/docusign/webhook   # DocuSign events → Creates deal record
POST      /api/twilio/inbound-sms # Incoming SMS
POST      /api/stripe/webhook     # (Deprecated - not used for client payments)

POST      /api/sam/run-batch      # Run outreach
GET/PUT   /api/settings           # System config
GET/POST  /api/morning-brief      # Daily summary
POST      /api/telegram/notify    # Send notification

POST      /api/cron/import-leads  # Daily import (5:30 AM)
POST      /api/cron/score-leads   # Daily scoring (6:00 AM)
POST      /api/cron/outreach      # Hourly outreach (9 AM - 8 PM)
```

## Eleanor Scoring Formula

```
Base: 0 points
+ Excess Funds:
  - $50K+: 40 pts
  - $30K+: 35 pts
  - $20K+: 30 pts
  - $15K+: 25 pts
  - $10K+: 20 pts
  - $5K+:  10 pts

+ Wholesale Potential (equity):
  - $50K+: 25 pts
  - $30K+: 20 pts
  - $20K+: 15 pts
  - $10K+: 10 pts
  - $5K+:   5 pts

+ Contact Quality:
  - Phone: 10 pts
  - Email: 5 pts
  - Full name: 5 pts

+ Location (Dallas zips):
  - Hot: 10 pts
  - Warm: 7 pts
  - Standard: 3 pts

+ Risk (subtract for issues)

= Score (0-100)
Grade: A+ (85+), A (75+), B (60+), C (45+), D (<45)
Priority: Hot (A+/A), Warm (B), Cold (C/D)
```

## Commands for Development

```bash
# Development
npm run dev

# Build
npm run build

# Test API
curl -X POST http://localhost:3000/api/eleanor/score-all

# Deploy
vercel

# View logs
vercel logs
```

## Revenue Flow

### Excess Funds Recovery Flow
1. Lead ingested → Scored by Eleanor
2. Sam contacts via SMS
3. Owner responds YES → Status: Qualified
4. Contract generated → Sent via DocuSign
5. Owner signs → Deal record created, Telegram notification
6. File claim with COUNTY
7. County approves claim
8. County disburses funds → We take 25%, send 75% to owner
9. MONEY IN ACCOUNT

### Wholesale Deal Flow
1. Lead ingested → Scored by Eleanor
2. Sam contacts via SMS
3. Owner responds YES → Status: Qualified
4. Contract generated → Sent via DocuSign
5. Owner signs → Deal record created, Telegram notification
6. Find BUYER, assign contract
7. Schedule closing with TITLE COMPANY
8. Title company pays assignment fee at closing
9. MONEY IN ACCOUNT

**NOTE:** We do NOT invoice clients via Stripe. Money flows from county/title company.

## Key Configuration

Settings are stored in `system_config` table and editable via `/settings`:
- Legal entity name
- Fee percentages (25% excess, 10% wholesale)
- Owner/partner split (default: 100% owner)
- Outreach settings
- Dallas County PDF URL

## TCPA Compliance

- All outreach respects opt-out list
- Keywords: STOP, UNSUBSCRIBE, CANCEL → Auto opt-out
- Max 5 contact attempts per lead
- Business hours only (9 AM - 8 PM)

## Next Development

1. Voice AI integration (ElevenLabs)
2. Buyer network notifications
3. Multi-county support
4. Partner portal (when Max joins)
5. Advanced analytics
