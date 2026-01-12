# PRIME.md - MaxSam V4 Context Primer
> **Last Updated**: January 10, 2026
> **Purpose**: Load this into agent context BEFORE starting any work

---

## 🎯 CURRENT GOAL
Autonomous excess funds recovery + wholesale real estate system generating $110K/month

---

## 📍 PROJECT STATE

| Component | Location/URL | Status |
|-----------|--------------|--------|
| **Frontend** | `C:\Users\MrTin\Downloads\MaxSam-V4` | Next.js 14 app |
| **Deployed** | maxsam-v4-clean.vercel.app | LIVE |
| **N8N Cloud** | skooki.app.n8n.cloud | 17/36 workflows active |
| **Database** | Supabase `tidcqvhxdsbnfykbvygs` | ~400 leads |
| **Twilio** | +1 469-942-9668 | A2P 10DLC pending |
| **Telegram** | Chat ID 8487686924 | Active notifications |

---

## 🧠 THE THREE AGENTS

### ALEX - Data Operations
- **Stack**: Code-based PDF parsing (NOT DocumentAI - that was abandoned)
- **Role**: Ingest county PDFs → Extract leads → Skip trace phone numbers
- **Skip Trace**: SerpAPI → TruePeopleSearch (77% success rate)
- **Knowledge Base**: NotebookLM (human reference) + Supabase knowledge_chunks (API)

### ELEANOR - Lead Scoring
- **Stack**: Claude Sonnet 4 via Anthropic API in N8N
- **Role**: Score leads 0-100, assign grades (A+/A/B/C/D), generate opening lines
- **Formula**: $50K+=40pts, phone=+10pts, hot zip=+10pts
- **Workflow**: `[2.1] MaxSam - Process - Eleanor Lead Scorer`

### SAM - Outreach & Closing
- **Stack**: GPT-4o via OpenAI API in N8N + Twilio SMS
- **Role**: Contact leads, handle responses, send contracts
- **Personality**: Friendly, empathetic, never pushy
- **TCPA**: Business hours only (9AM-8PM), respects STOP/UNSUBSCRIBE

---

## 💰 REVENUE MODEL

### Excess Funds Recovery (Primary)
- County holds funds from tax sales owed to former owners
- Logan finds owners, gets them to sign fee agreement
- Files claim with county, county cuts TWO checks (client + Logan)
- **Fee**: 10-30% (set by county law, no invoicing needed)
- **Timeline**: ~30 days from filing to payment

### Wholesale Real Estate (Secondary)
- Find distressed property owners via Zillow/Redfin crawling
- Offer 90% of asking with 10-day inspection period
- Assign contract to cash buyer (hedge funds, bulk investors)
- **Fee**: 10% assignment fee at closing
- **Golden Leads**: People on BOTH excess funds list AND Zillow listings

---

## 📜 HISTORY - WHAT WAS TRIED & ABANDONED

### MaxSam-V4-Backend (ABANDONED)
- **Location**: `C:\Users\MrTin\Downloads\MaxSam-V4-Backend`
- **What it was**: Docker microservices (mcp-gateway, county-scraper, eleanor-scorer, sam-messenger)
- **Why abandoned**: Only skeleton stubs built (just health checks). Pivoted to N8N Cloud because visual workflow builder is faster to iterate than raw Node.js microservices.
- **Lesson**: Don't over-engineer infrastructure. N8N handles orchestration better.

### DocumentAI + Gemini Approach (ABANDONED)
- **What it was**: Google DocumentAI for OCR + Gemini for extraction
- **Why abandoned**: Code-based PDF parsing works fine, simpler, no API costs
- **Current approach**: Direct PDF parsing in N8N Code nodes

### V3 SaaS Multi-Tenant Model (ABANDONED)
- **Location**: `C:\Users\MrTin\Documents\MaxSam-V3`
- **What it was**: Multi-tenant SaaS for selling to other wholesalers ($5K install + $1.5K/mo)
- **Why abandoned**: Focus on single-operator (Logan) first, prove the model, then scale
- **Lesson**: Don't build for customers you don't have yet

### DocuSign (ABANDONED)
- **Why abandoned**: Expensive, complex OAuth
- **Current approach**: BoldSign for free e-signatures

---

## 🔧 ACTIVE N8N WORKFLOWS (17 of 36)

### Ingestion
- `[1.2] MaxSam - Ingest - PDF Processor` - Process county PDFs

### Processing
- `[2.1] MaxSam - Process - Eleanor Lead Scorer` - Score with Claude
- `[2.2] MaxSam - Process - Skip Trace Enricher` - Find phone numbers (DEACTIVATED - was spamming Telegram)
- `[2.8] MaxSam - Full Lead Enrichment Pipeline` - Complete enrichment
- `[2.9] MaxSam - Zillow Golden Lead Detector` - Cross-reference detection
- `[2.9] MaxSam - ARV Calculator + Buyer Matcher` - Property valuation

### Outreach
- `[3.0] MaxSam - Outreach - Sam Initial SMS` - First contact
- `[3.1] MaxSam - Sam Buyer Outreach + Messaging` - Buyer side
- `[3.1] MaxSam - Outreach - Sam SMS Consent` - Get consent
- `[3.2] MaxSam - Outreach - Sam SMS Agreement` - Send agreement
- `[3.2] MaxSam - 10-Day Countdown Tracker` - Wholesale deadlines
- `[3.3] MaxSam - Outreach - VAPI Voice Handler` - Voice AI

### Filing & Tracking
- `[4.1] MaxSam - Filing - Document Generator` - Create contracts
- `[5.1] MaxSam - Tracking - Claim Status` - Track claims
- `[5.2] MaxSam - Tracking - Daily Metrics` - Dashboard stats

### Payments
- `[6.1] MaxSam - Payments - Fee Invoice` - Stripe invoices
- `[6.2] MaxSam - Payments - Stripe Webhook` - Payment events

### Utility
- `[0.1] Prime Agent - Context Gatherer` - THIS PRIMING SYSTEM

---

## ⚠️ KNOWN ISSUES & BLOCKERS

| Issue | Status | Notes |
|-------|--------|-------|
| Twilio A2P 10DLC | PENDING | SMS may be filtered until approved |
| Skip trace workflow | DEACTIVATED | Was spamming Telegram, needs rate limiting |
| alex-knowledge MCP | BROKEN | Needs SUPABASE_SERVICE_KEY in claude_desktop_config.json |
| Buyers API 505 error | NEEDS FIX | `/api/buyers` route throwing errors |

---

## 📂 KEY FILES TO READ FIRST

```
MaxSam-V4/
├── CLAUDE.md              # Quick reference (READ THIS)
├── lib/
│   ├── eleanor.ts         # Scoring logic
│   ├── sam-outreach.ts    # Outreach engine
│   ├── skip-tracing.ts    # Phone lookup
│   └── twilio.ts          # SMS integration
├── app/api/               # All API routes
├── supabase/migrations/   # Database schema
└── templates/             # Contract HTML templates
```

**Downloads folder** (reference files):
- `maxsam_v4_architecture.md` - System design doc
- `maxsam-v4-*.json` - N8N workflow exports
- `maxsam_v4_*.sql` - Database schemas
- `*NotebookLM.md` - Documentation exports

---

## 🔗 WEBHOOK ENDPOINTS

| Endpoint | Purpose |
|----------|---------|
| `POST /prime/gather` | Prime Agent context gathering |
| `POST /maxsam/csv-upload` | Upload CSV leads |
| `POST /api/twilio/inbound-sms` | Receive SMS responses |
| `POST /api/docusign/webhook` | Contract events |
| `POST /api/stripe/webhook` | Payment events |

---

## 🛠️ SKILLS & CAPABILITIES

### What the system CAN do now:
- ✅ Ingest Dallas County excess funds PDFs
- ✅ Score leads with Eleanor (Claude API)
- ✅ Skip trace phone numbers (77% success)
- ✅ Send SMS via Twilio (when A2P approved)
- ✅ Generate contracts from templates
- ✅ Send e-signatures via BoldSign
- ✅ Track claim status
- ✅ Send Telegram notifications
- ✅ Create Stripe invoices

### What still needs work:
- ⏳ Voice AI outreach (VAPI integration)
- ⏳ Automated buyer matching
- ⏳ Multi-county expansion
- ⏳ Bulk buyer portal

---

## 🎯 DECISION LOGIC FOR SAM

When contacting a lead, Sam presents options based on lead type:

```
IF has_excess_funds AND is_distressed:
    Present BOTH options (35% combined fee potential)
    → "Golden Lead" - highest priority

ELSE IF has_excess_funds:
    Present Option 1: Excess Funds Recovery
    → 25% fee, county pays directly

ELSE IF is_distressed:
    Present Option 2: Wholesale Property Sale
    → 10% assignment fee at closing
```

---

## 📊 CURRENT METRICS (Query Supabase for live)

- Total leads: ~400
- Scored leads: ~363
- High-value opportunities: 8 ($248K+ potential)
- Skip trace success rate: 77%
- Active workflows: 17

---

## 🚀 HOW TO PRIME

**In Claude.ai chat:**
```
You: "Prime MaxSam"
Claude: [Calls N8N webhook, reads this file, synthesizes briefing]
Claude: "Here's your situational awareness: [briefing]"
You: "Let's work on [specific task]"
```

**The prime command triggers:**
1. Read PRIME.md (this file)
2. Query N8N for workflow status
3. Query Supabase for recent leads/errors
4. Compile into actionable briefing

---

*This file is the single source of truth for priming. Update it as the project evolves.*
