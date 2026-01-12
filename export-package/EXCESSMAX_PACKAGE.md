# ExcessMax Package
## Automated Excess Funds Recovery System

> **"Find money owed to people, help them claim it, take 25%"**

---

## What It Does

```
COUNTY PDFs → EXTRACT LEADS → SKIP TRACE OWNERS → SMS OUTREACH → AGREEMENT → FILE CLAIM → COLLECT FEE
```

1. **Ingests county excess funds PDFs** (Dallas, Tarrant, Collin, etc.)
2. **Extracts owner info** using AI (names, addresses, amounts, case numbers)
3. **Skip traces owners** to find current phone/email/address
4. **Sam (AI) reaches out** via TCPA-compliant SMS
5. **Sends assignment agreement** via BoldSign e-signature
6. **Files claim** with county on behalf of owner
7. **Collects 25% fee** when funds are disbursed

---

## Package Contents

```
ExcessMax-Package/
├── n8n-workflows/
│   ├── pdf-processor.json         # Extract data from county PDFs
│   ├── eleanor-scorer.json        # Score & prioritize leads
│   ├── skip-trace-enricher.json   # Find contact info
│   ├── golden-lead-detector.json  # Find cross-referenced leads
│   ├── sam-initial-sms.json       # First contact
│   ├── sam-sms-consent.json       # Handle replies
│   ├── sam-sms-agreement.json     # Send agreement
│   ├── document-generator.json    # Create legal docs
│   ├── claim-status-tracker.json  # Track filed claims
│   └── daily-metrics.json         # Dashboard stats
│
├── supabase/
│   ├── schema.sql                 # Complete database
│   └── functions.sql              # Edge functions
│
├── vercel-app/
│   └── (Next.js dashboard)
│
├── legal-templates/
│   ├── assignment-agreement.docx  # Client signs this
│   ├── heir-affidavit.docx        # For deceased owners
│   ├── w9-template.pdf            # Tax form
│   └── county-claim-forms/        # Per-county templates
│
├── config/
│   ├── county-config.json         # County-specific settings
│   ├── .env.template              # API keys needed
│   ├── twilio-a2p-guide.md        # SMS compliance setup
│   └── boldsign-setup.md          # E-signature setup
│
├── docs/
│   ├── SETUP.md                   # 3-hour setup guide
│   ├── LEGAL-COMPLIANCE.md        # State requirements
│   ├── SMS-SCRIPTS.md             # Sam's conversation flows
│   └── COUNTY-SPECIFICS.md        # How each county works
│
└── README.md
```

---

## Revenue Model

| Monthly Leads | Avg Excess Amount | Recovery Rate | Your 25% | Monthly Revenue |
|---------------|-------------------|---------------|----------|-----------------|
| 100 | $30,000 | 15% | $112,500 | $112,500 |
| 200 | $30,000 | 15% | $225,000 | $225,000 |
| 500 | $30,000 | 15% | $562,500 | $562,500 |

**One $100K claim = $25,000 fee**

---

## Pricing

### Single County License
- **$4,997 setup** + **$497/mo**
- 1 county
- All workflows
- Legal templates
- Email support
- Monthly PDF processing

### Regional License (5 Counties)
- **$14,997 setup** + **$997/mo**
- 5 counties
- Priority support
- Quarterly strategy call
- Custom county PDF parsers

### State License (Unlimited Counties)
- **$49,997 setup** + **$2,497/mo**
- All counties in state
- Dedicated support
- White-label option
- Custom development

---

## Required Infrastructure

| Service | Purpose | Cost |
|---------|---------|------|
| N8N Cloud | Workflows | $20/mo |
| Supabase | Database | Free |
| Vercel | Dashboard | Free |
| Twilio | SMS | ~$50/mo |
| BoldSign | E-signatures | Free tier |
| Stripe | Payments | 2.9% + 30¢ |

**Total: ~$70/mo + payment processing**

---

## Legal Considerations

- Must comply with state finder's fee laws (varies by state)
- Texas: No license required for excess funds recovery
- California: Requires license
- Some states cap fees at 10-15%
- Always use proper assignment agreements
- Client signs before any work begins

---

## What Makes This Different from Manual

| Manual Process | ExcessMax |
|----------------|-----------|
| Hours searching PDFs | AI extracts in minutes |
| Days skip tracing | Automated enrichment |
| Cold calling hundreds | Sam SMS outreach 24/7 |
| Faxing agreements | E-signature in seconds |
| Tracking in spreadsheets | Real-time dashboard |
| 5-10 deals/month max | 50+ deals/month possible |

---

## The Eleanor Advantage

Eleanor (AI) scores every lead on:
- **Expiration urgency** (days until claim deadline)
- **Amount** (higher = more fee)
- **Contact quality** (has phone = higher)
- **Cross-reference** (on distressed list too = GOLDEN)

This means you work the RIGHT leads, not all leads.
