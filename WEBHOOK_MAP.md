# WEBHOOK CONNECTIVITY MAP - MaxSam V4
> **Generated**: January 10, 2026

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INGESTION LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [1.2] PDF Processor ────────────────────────────────────────────────►  │
│       ↓ inserts to maxsam_leads                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          PROCESSING LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [2.1] Eleanor Scorer ◄─── Schedule: Every 1 hour                       │
│       ↓ scores leads, updates eleanor_score/grade/priority              │
│       │                                                                  │
│       └──► (NO LONGER TRIGGERS SKIP TRACE - runs independently)         │
│                                                                          │
│  [2.2] Skip Trace Enricher ◄─── Schedule: Every 2 hours                 │
│       ↓ finds phones via SerpAPI                                        │
│       │                                                                  │
│       └──► Updates phone, status → 'enriched'                           │
│                                                                          │
│  [2.9] Zillow Golden Detector ◄─── Schedule: Every 2 hours              │
│       ↓ cross-references excess_funds + distressed                      │
│       │                                                                  │
│       └──► Updates is_golden, sends Telegram alert                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          OUTREACH LAYER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [3.0] Sam Initial SMS ◄─── Webhook: /sam-initial-outreach              │
│       │                     Manual trigger only                          │
│       │                                                                  │
│       ├──► POST /webhook/sms-consent                                    │
│       ▼                                                                  │
│  [3.1] Sam SMS Consent ◄─── Webhook: /sms-consent                       │
│       │                                                                  │
│       ├──► POST /webhook/sms-agreement                                  │
│       ▼                                                                  │
│  [3.2] Sam SMS Agreement ◄─── Webhook: /sms-agreement                   │
│       │                                                                  │
│       ├──► POST /webhook/doc-generator                                  │
│       ▼                                                                  │
│  [4.1] Document Generator ◄─── Webhook: /doc-generator                  │
│       │                                                                  │
│       └──► Creates contract, sends BoldSign                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          TRACKING LAYER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [5.1] Claim Status ◄─── Schedule: Daily                                │
│       ↓ checks claim progress                                           │
│                                                                          │
│  [5.2] Daily Metrics ◄─── Schedule: Daily 8 AM                          │
│       ↓ updates maxsam_daily_stats                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          PAYMENTS LAYER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [6.1] Fee Invoice ◄─── Webhook: triggered by claim completion          │
│       ↓ creates Stripe payment link                                      │
│                                                                          │
│  [6.2] Stripe Webhook ◄─── External: Stripe events                      │
│       ↓ handles payment.success → marks paid                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

## Webhook URLs (Production)

| Workflow | Path | Full URL |
|----------|------|----------|
| [2.1] Eleanor Scorer | /eleanor-score | https://skooki.app.n8n.cloud/webhook/eleanor-score |
| [2.2] Skip Trace | /skip-trace | https://skooki.app.n8n.cloud/webhook/skip-trace |
| [2.9] Golden Detector | /zillow-scan | https://skooki.app.n8n.cloud/webhook/zillow-scan |
| [3.0] Sam Initial | /sam-initial-outreach | https://skooki.app.n8n.cloud/webhook/sam-initial-outreach |
| [3.1] SMS Consent | /sms-consent | https://skooki.app.n8n.cloud/webhook/sms-consent |
| [3.2] SMS Agreement | /sms-agreement | https://skooki.app.n8n.cloud/webhook/sms-agreement |
| [4.1] Doc Generator | /doc-generator | https://skooki.app.n8n.cloud/webhook/doc-generator |
| [0.1] Prime Agent | /prime/gather | https://skooki.app.n8n.cloud/webhook/prime/gather |

## External Webhooks (Inbound)

| Service | Endpoint | Handler |
|---------|----------|---------|
| Twilio SMS | /api/twilio/inbound-sms | Next.js API route |
| Stripe | /api/stripe/webhook | Next.js API route |
| BoldSign | /api/boldsign/webhook | Next.js API route |

## Current Trigger Schedule

| Workflow | Trigger | Frequency |
|----------|---------|-----------|
| [2.1] Eleanor Scorer | Schedule | Every 1 hour |
| [2.2] Skip Trace | Schedule | Every 2 hours |
| [2.9] Golden Detector | Schedule | Every 2 hours |
| [5.1] Claim Status | Schedule | Daily |
| [5.2] Daily Metrics | Schedule | Daily 8 AM |
| [3.2] 10-Day Countdown | Schedule | Daily |

## Chain Dependencies (What Triggers What)

**INDEPENDENT (Schedule-based, no upstream trigger):**
- [2.1] Eleanor Scorer
- [2.2] Skip Trace Enricher
- [2.9] Golden Detector
- [5.1] Claim Status
- [5.2] Daily Metrics

**CHAINED (Webhook-triggered by other workflows):**
```
[3.0] Sam Initial SMS
    └──► [3.1] Sam SMS Consent
           └──► [3.2] Sam SMS Agreement
                   └──► [4.1] Document Generator
```

## Key Design Decisions

1. **Decoupled Processing**: Eleanor, Skip Trace, and Golden Detector run independently on schedules rather than chaining. This prevents cascade failures.

2. **Outreach Chain**: SMS workflows are chained because they represent a linear conversation flow.

3. **No Cross-Dependencies**: Processing workflows don't trigger each other to avoid error propagation.

4. **Telegram Notifications**: Only sent when there are actual results (prevented spam).
