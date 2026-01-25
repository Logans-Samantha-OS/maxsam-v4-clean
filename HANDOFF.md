# MAXSAM V4 DEVELOPMENT HANDOFF
## Last Updated: January 25, 2026 (Sunday ~1:30 AM CT)

---

## 🎯 PROJECT OVERVIEW

**MaxSam V4** is an AI-powered excess funds recovery and wholesale real estate automation system.

**Business Model:**
- **Excess Funds Recovery (25% fee)**: Find property owners owed money by county → Help them claim it → Get paid from county payout (NOT from client)
- **Wholesale Deals (10% fee)**: Contract distressed properties → Assign to buyers → Get paid at closing via title company

**Key Point**: The client NEVER pays us directly. Money comes from county disbursements or title company at closing.

---

## 🔗 CRITICAL URLS & CREDENTIALS

### Production
- **Dashboard**: https://maxsam-v4-clean.vercel.app
- **Vercel Project ID**: prj_j995qw1vseFKgQlygLsbAEyLZ4VK
- **Supabase**: https://tidcqvhxdsbnfykbvygs.supabase.co

### Local Development
- **Main Directory**: `C:\Users\MrTin\Downloads\MaxSam-V4`
- **DO NOT USE WORKTREES** - They create new Vercel projects without env vars

### N8N Workflows
- **URL**: https://skooki.app.n8n.cloud
- **Webhook Base**: https://skooki.app.n8n.cloud/webhook/

### MCP Config Location
- `C:\Users\MrTin\AppData\Roaming\Claude\claude_desktop_config.json`

---

## 👥 THE AGENTS

| Agent | Role | Technology |
|-------|------|------------|
| **ALEX** | Data operations, skip tracing, NotebookLM queries | Gemini + DocumentAI + NotebookLM |
| **ELEANOR** | Lead scoring and analysis (0-100 scores) | Claude |
| **SAM** | SMS outreach and deal closing | GPT-4o + Twilio |
| **RALPH** | Meta-agent orchestrator | Coordinates all agents |

---

## ✅ COMPLETED FEATURES

### Infrastructure
- [x] Vercel deployment working (maxsam-v4-clean.vercel.app)
- [x] Supabase database connected (227 leads)
- [x] Twilio SMS integration (outbound working)
- [x] Environment variables configured
- [x] MCP servers configured (filesystem, n8n, memory, serpapi, alex-knowledge, puppeteer, notebooklm)

### Dashboard Pages
- [x] /dashboard - Executive overview
- [x] /dashboard/leads - All leads with filters
- [x] /dashboard/golden-leads - High-value leads (score 80+, has phone)
- [x] /dashboard/messages - SMS conversation view
- [x] /dashboard/pipeline - Deal pipeline
- [x] /dashboard/command-center - Agent controls
- [x] /dashboard/upload (Smart Import) - PDF/CSV upload
- [x] /dashboard/stats - Analytics

### Core Functionality
- [x] SMS Send button works (fixed 1/25/2026)
- [x] Quick action buttons (Initial Outreach, Follow Up, Urgency, etc.)
- [x] ELEANOR lead scoring (leads have scores)
- [x] Lead details sidebar with amount, score, property info
- [x] Colorful UI badges on messages page

### Cron Jobs (Scheduled in vercel.json)
- [x] Morning Brief - 8:00 AM CT → Telegram
- [x] SAM Campaign - 9:00 AM CT → SMS to qualified leads

### Payment Flow
- [x] Corrected revenue model (no client invoicing)
- [x] Deals table with correct fields (county payout, title company, etc.)
- [x] Stripe functions deprecated with documentation

---

## 🔄 IN PROGRESS

| Feature | Status | Notes |
|---------|--------|-------|
| Send Agreement button | Works but needs email on lead | Test lead missing email |
| NotebookLM MCP | Installed, needs authentication | Run "Log me in to NotebookLM" |
| Inbound SMS webhook | Endpoint exists, needs Twilio config | /api/twilio/inbound-sms |
| Button audit | Some buttons fixed, need full audit | Run god-mode audit |

---

## ❌ NOT DONE - PRIORITY ORDER

### 🔴 HIGH PRIORITY (Needed for autonomous operation)

#### 1. Overnight Automation Schedule
Add these cron jobs to vercel.json:
```json
{
  "crons": [
    {"path": "/api/cron/alex-notebook-sync", "schedule": "0 6 * * 1-6"},
    {"path": "/api/cron/alex-skip-trace", "schedule": "0 8 * * 1-6"},
    {"path": "/api/cron/eleanor-score-all", "schedule": "0 11 * * 1-6"},
    {"path": "/api/cron/flag-golden-leads", "schedule": "0 12 * * 1-6"},
    {"path": "/api/cron/morning-brief", "schedule": "0 14 * * 1-6"},
    {"path": "/api/cron/sam-campaign", "schedule": "0 15 * * 1-6"}
  ]
}
```

Schedule (UTC → Central):
- 12:00 AM CT: ALEX queries NotebookLM for new leads
- 2:00 AM CT: ALEX skip traces (finds phone numbers)
- 5:00 AM CT: ELEANOR scores all unscored leads
- 6:00 AM CT: Flag golden leads (score 80+, has phone)
- 8:00 AM CT: Morning Brief → Telegram
- 9:00 AM CT: SAM Campaign → SMS blast

#### 2. Pre-Outreach Approval System
- Nightly prep: Select leads for next day's outreach
- Telegram notification: "Tomorrow's blast: 12 leads. Review?"
- Dashboard page: /dashboard/outreach-queue
- Show each lead + personalized message BEFORE sending
- Approve/Reject buttons
- SAM only contacts approved leads

#### 3. Create Missing Cron Endpoints
- /api/cron/alex-notebook-sync
- /api/cron/alex-skip-trace
- /api/cron/eleanor-score-all
- /api/cron/flag-golden-leads

### 🟡 MEDIUM PRIORITY

#### 4. SAM Message Templates
Rewrite all templates with "NO COST TO CLIENT" messaging:
- Initial Outreach
- Follow Up
- Urgency (deadline approaching)
- Golden Lead (high value)
- Response to "YES"
- Response to "How much do you charge?"
- Response to "Is this a scam?"
- Response to "I'll do it myself"
- Friendly Close

Store in `message_templates` table.

#### 5. Data Integrity Fixes
- Merge duplicate leads (Sharon Denise Wright appears twice)
- Fix invalid phone formats (+1XXXXXXXXXX)
- Clean up test data

#### 6. Two-Way SMS
- Configure Twilio webhook URL: https://maxsam-v4-clean.vercel.app/api/twilio/inbound-sms
- Verify replies appear in dashboard
- Test conversation flow

#### 7. BoldSign/DocuSign Integration
- Wire Send Agreement button to actual e-signature service
- Create excess funds assignment agreement template
- Auto-populate with lead data

### 🟢 LOW PRIORITY

#### 8. UI Improvements
- Match Leads page styling to Golden Leads page
- Add stat cards to Leads page
- More colorful status badges

#### 9. Prevent Worktree Issues
Add to CLAUDE_BOOTSTRAP.md:
- NEVER create git worktrees
- ALWAYS deploy to maxsam-v4-clean only
- ALWAYS work in C:\Users\MrTin\Downloads\MaxSam-V4

#### 10. Stats/Pipeline Pages
- Verify data displays correctly
- Add charts and visualizations

---

## 🗄️ DATABASE SCHEMA (Key Tables)

### maxsam_leads
- id, owner_name, property_address, county
- excess_funds_amount, case_number, expiration_date
- phone, email, is_golden_lead
- eleanor_score, status, contact_attempts
- created_at, updated_at

### messages (or sms_messages)
- id, lead_id, direction (inbound/outbound)
- body, twilio_sid
- created_at

### deals
- id, lead_id, deal_type (excess_funds/wholesale)
- excess_funds_amount, claim_status, county_payout_date
- our_fee_amount, owner_payout_amount
- contract_price, assignment_fee, buyer_info
- title_company, closing_date, status

### outreach_queue (TO BE CREATED)
- id, lead_id, scheduled_date, scheduled_time
- personalized_message, status (pending_approval/approved/rejected/sent)
- approved_at, sent_at

### message_templates (TO BE CREATED)
- id, template_name, template_text, use_case, is_active

---

## 🔧 MCP SERVERS CONFIGURED

```json
{
  "filesystem": "✅ Running - File access",
  "n8n": "✅ Configured - Workflow automation",
  "memory": "✅ Configured - Persistent memory",
  "serpapi": "✅ Configured - Google search for skip trace",
  "alex-knowledge": "✅ Configured - Supabase knowledge base",
  "puppeteer": "✅ Configured - Browser automation",
  "notebooklm": "✅ Added - Needs authentication"
}
```

To authenticate NotebookLM:
1. Open Claude Code
2. Say: "Log me in to NotebookLM"
3. Chrome window opens → Log in with Google
4. Test: "List my NotebookLM notebooks"

---

## 📱 TELEGRAM NOTIFICATIONS

Bot should send notifications for:
- Morning Brief (8 AM)
- Overnight job completions
- Hot lead responses
- Deal stage changes
- System errors

Test: POST /api/telegram/send with { message: "test" }

---

## ⚠️ KNOWN ISSUES

1. **Vercel worktrees** - Claude Code keeps creating worktrees (romantic-robinson, cranky-goldberg, etc.) which create new Vercel projects without env vars. SOLUTION: Always work in main directory.

2. **Duplicate leads** - Sharon Denise Wright appears twice with different data. Need to merge.

3. **Test data** - Logan Toups test lead needs email added for Send Agreement to work.

4. **Message display** - Some messages show as "1", "2" instead of content (may be field name mismatch).

---

## 🚀 QUICK START FOR NEXT SESSION

### Step 1: Verify Current State
```
Check the current state of MaxSam V4:
1. Is https://maxsam-v4-clean.vercel.app working?
2. How many leads in database?
3. Are cron jobs configured in vercel.json?
4. Test /api/stats endpoint
```

### Step 2: Monday Readiness Check
```
VERIFY MONDAY AUTOMATION WILL WORK

1. Test Morning Brief: POST /api/cron/morning-brief
2. Test SAM Campaign: Check lead count for 9 AM blast
3. Verify Twilio is connected
4. Send test Telegram message
5. Report: How many leads will SAM contact Monday?
```

### Step 3: Build Overnight Automation
```
ADD OVERNIGHT AUTOMATION CRONS

Add to vercel.json and create endpoints:
- 12 AM: alex-notebook-sync
- 2 AM: alex-skip-trace  
- 5 AM: eleanor-score-all
- 6 AM: flag-golden-leads

Each job should send Telegram notification when complete.
```

### Step 4: Pre-Outreach Approval
```
BUILD PRE-OUTREACH APPROVAL SYSTEM

1. Create outreach_queue table
2. Create /dashboard/outreach-queue page
3. Nightly job selects tomorrow's leads
4. Show personalized messages for approval
5. SAM only contacts approved leads
```

---

## 📞 CONTACTS & ACCOUNTS

- **Logan's Phone**: (469) 222-9255
- **Logan's Email**: logan.toups.11@gmail.com
- **Company**: MaxSam Recovery Services
- **Location**: Richardson, Texas

---

## 📁 KEY FILES

- `CLAUDE_BOOTSTRAP.md` - Session context for Claude Code
- `.claude/instructions.md` - Auto-read by Claude Code
- `vercel.json` - Cron job configuration
- `.env.local` - Environment variables (don't commit)
- `lib/supabase.ts` - Database client
- `lib/twilio.ts` - SMS functions
- `lib/telegram.ts` - Notification functions

---

## 🎯 SUCCESS CRITERIA

MaxSam V4 is "done" when:
1. ✅ Dashboard shows real leads
2. ✅ Can send SMS from dashboard
3. ⬜ Overnight automation runs without intervention
4. ⬜ Morning brief arrives in Telegram at 8 AM
5. ⬜ SAM contacts leads at 9 AM (with prior approval)
6. ⬜ Two-way SMS conversations work
7. ⬜ Agreements can be sent and signed
8. ⬜ Deal tracking from lead → signed → paid

---

*This handoff document should be updated at the end of each development session.*
