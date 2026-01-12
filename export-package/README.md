# MaxSam County License Package
## Autonomous Excess Funds Recovery System

> **Version**: V4.0  
> **License**: Per-County Commercial License  
> **Setup Time**: ~2 hours

---

## What's Included

```
MaxSam-County-Package/
├── n8n-workflows/              # All 18 production workflows (JSON)
│   ├── 1.2-pdf-processor.json
│   ├── 2.1-eleanor-scorer.json
│   ├── 2.2-skip-trace.json
│   ├── 2.9-golden-detector.json
│   ├── 3.0-sam-initial-sms.json
│   ├── 3.1-sms-consent.json
│   ├── 3.2-sms-agreement.json
│   ├── 4.1-document-generator.json
│   ├── 5.1-claim-status.json
│   ├── 5.2-daily-metrics.json
│   ├── 6.1-fee-invoice.json
│   └── 6.2-stripe-webhook.json
│
├── supabase/
│   ├── schema.sql              # Complete database structure
│   ├── functions.sql           # Edge functions
│   └── policies.sql            # Row-level security
│
├── vercel-app/                 # Next.js 14 dashboard
│   └── (full git repo)
│
├── legal-templates/
│   ├── assignment-agreement.docx
│   ├── heir-affidavit.docx
│   ├── w9-template.pdf
│   └── county-claim-form-template.docx
│
├── config/
│   ├── county-config.json      # Your county settings
│   ├── .env.template           # API keys template
│   └── twilio-setup.md         # A2P 10DLC guide
│
├── docs/
│   ├── SETUP.md                # Step-by-step setup
│   ├── PRIME.md                # AI context document
│   ├── WEBHOOK_MAP.md          # Workflow connections
│   └── TROUBLESHOOTING.md      # Common issues
│
└── README.md                   # Quick start
```

---

## Required Accounts (Customer Provides)

| Service | Purpose | Est. Cost |
|---------|---------|-----------|
| N8N Cloud | Workflow automation | $20/mo |
| Supabase | Database + auth | Free tier works |
| Vercel | Dashboard hosting | Free tier works |
| Twilio | SMS outreach | ~$50/mo |
| SerpAPI | Skip tracing | $50/mo (5K searches) |
| BoldSign | E-signatures | Free tier (100/mo) |
| Stripe | Payment collection | 2.9% + 30¢ per tx |
| OpenAI | AI features | ~$20/mo |

**Total Infrastructure: ~$140/mo**

---

## Setup Checklist

### 1. Database (15 min)
- [ ] Create Supabase project
- [ ] Run `supabase/schema.sql`
- [ ] Copy connection string

### 2. Workflows (30 min)
- [ ] Create N8N Cloud account
- [ ] Import all workflow JSONs
- [ ] Update Postgres credentials
- [ ] Update webhook URLs

### 3. Dashboard (15 min)
- [ ] Fork Vercel app
- [ ] Connect to your Supabase
- [ ] Deploy

### 4. Communications (30 min)
- [ ] Create Twilio account
- [ ] Register A2P 10DLC campaign
- [ ] Create Telegram bot
- [ ] Update workflow credentials

### 5. Payments (15 min)
- [ ] Connect Stripe account
- [ ] Configure webhook endpoint
- [ ] Set fee percentages

### 6. County Config (15 min)
- [ ] Update county name in workflows
- [ ] Find county excess funds PDF source
- [ ] Configure PDF processor for format

---

## County Configuration

Edit `config/county-config.json`:

```json
{
  "county_name": "YOUR_COUNTY",
  "state": "YOUR_STATE",
  "excess_funds_url": "https://...",
  "pdf_format": "standard",
  "fee_percentage": 25,
  "wholesale_fee": 10,
  "timezone": "America/Chicago",
  "business_hours": {
    "start": 9,
    "end": 20
  }
}
```

---

## Pricing Tiers

### Tier 1: Single County License
- **$4,997 setup** + **$497/mo**
- 1 county
- Email support
- Quarterly updates

### Tier 2: Regional License (5 Counties)
- **$14,997 setup** + **$997/mo**
- 5 counties
- Priority support
- Monthly updates
- Buyer network access

### Tier 3: Enterprise (Unlimited)
- **$49,997 setup** + **$2,997/mo**
- Unlimited counties
- Dedicated support
- Weekly updates
- White-label option
- Buyer network access
- Eleanor AI customization

---

## What They Get

### Immediately
- Fully functional lead processing system
- AI-powered lead scoring (Eleanor)
- Automated skip tracing
- SMS outreach automation (Sam)
- Contract generation
- E-signature collection
- Payment processing
- Real-time dashboard

### Eleanor AI Capabilities
- Lead scoring (0-100)
- Priority grading (A+ to D)
- Golden lead detection
- Buyer matching
- Custom algorithm training

### Sam AI Capabilities
- TCPA-compliant SMS
- Natural conversation flow
- Consent management
- Objection handling
- Appointment setting

---

## ROI Calculator

| Monthly Leads | Avg Excess | Recovery Rate | Your 25% Fee | Net After Costs |
|---------------|------------|---------------|--------------|-----------------|
| 50 | $30,000 | 15% | $56,250 | $55,750 |
| 100 | $30,000 | 15% | $112,500 | $112,000 |
| 200 | $30,000 | 15% | $225,000 | $224,500 |

**Break-even: 1 deal per month**

---

## Support Included

- Setup assistance (2 hours)
- Workflow customization
- County PDF format adaptation
- 30-day launch support
- Access to updates
- Community Discord

---

## Legal Notes

- Customer responsible for state/county compliance
- Customer provides own business entity
- Fee structures must comply with local regulations
- MaxSam provides software license only, not legal advice
