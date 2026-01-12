# MASTER TASK LIST - MaxSam V4
> **Generated**: January 10, 2026 @ 11:00 AM
> **Status**: 530 leads, $2.2M potential fees

---

## 🔴 CRITICAL (Fix Now - System Broken)

### 1. ~~Zillow Golden Detector Wrong Tables~~ ✅ FIXED
- Was querying `buyers` instead of `maxsam_buyers`
- Was querying `leads` instead of `maxsam_leads`
- Wrong column names (`price_range_min` vs `min_price`)
- **Status**: Fixed, redeployed

### 2. Eleanor Scorer Error Loop
- **Issue**: No empty result handling - errors when 0 leads to score
- **Impact**: Errors every 15 minutes, spamming logs
- **Fix**: Add IF node after query to check for empty results
- **Workflow**: `caLLOlDen0TpRXsy`

### 3. Skip Trace Enricher Error Loop  
- **Issue**: Same empty result problem + webhook chain failure
- **Impact**: Errors every 30 minutes
- **Workflow**: `6WAdYFrQChwkpP3X`

### 4. Dallas PDF Scraper Ghost Triggers
- **Issue**: Inactive workflow still triggering errors
- **Status**: ✅ DEACTIVATED

---

## 🟠 HIGH PRIORITY (This Week)

### 5. 93% of Leads Have No Phone
- **Data**: 491 of 530 leads missing phone numbers
- **Impact**: Can't do SMS outreach
- **Action**: Run skip trace batch on all untraced leads
- **Blocker**: Skip trace workflow currently broken

### 6. 152 Leads Need Scoring
- **Data**: 152 leads with NULL eleanor_score
- **Action**: Once Eleanor fixed, run batch score

### 7. 0 Golden Leads Detected
- **Data**: No leads marked as golden yet
- **Action**: Once detector fixed, run scan
- **Expected**: Should find leads with excess_funds + distressed/zillow

### 8. Twilio A2P 10DLC Approval
- **Status**: Pending
- **Impact**: SMS may be filtered until approved
- **Action**: Wait, check status weekly

### 9. Buyers Table Nearly Empty
- **Data**: Only 4 buyers, all duplicates of "Max @ LowBallOffer.ai"
- **Data**: All have NULL price ranges
- **Action**: Add real buyer data or implement buyer scraping

---

## 🟡 MEDIUM PRIORITY (This Month)

### 10. Webhook Connectivity Map
- **Issue**: No documentation of which workflows trigger which
- **Action**: Create visual flow diagram
- **Current Chain**: Eleanor → Skip Trace → Golden Detector

### 11. alex-knowledge MCP Broken
- **Issue**: 401 Unauthorized on OpenAI embeddings
- **Fix**: Add OPENAI_API_KEY to claude_desktop_config.json

### 12. Prime Agent MCP Installation
- **Status**: Built, not installed
- **Action**: Add to Claude Code config, add missing API keys

### 13. Dashboard Metrics Not Updating
- **Workflow**: `[5.2] Daily Metrics`
- **Check**: Verify it's actually populating `maxsam_daily_stats`

### 14. Voice AI Integration
- **Workflow**: `[3.3] VAPI Voice Handler`
- **Status**: Active but untested
- **Action**: Test with real call

---

## 🟢 LOW PRIORITY (Backlog)

### 15. Multi-County Expansion
- Currently: Dallas only
- Future: Tarrant, Collin, Denton

### 16. Email Outreach Workflows
- `[3.4] Sam Email Initial` - Inactive
- `[3.5] Sam Email Follow-up` - Inactive
- `[3.6] Email Inbound Handler` - Inactive

### 17. WhatsApp Integration
- `[3.7] WhatsApp Handler` - Inactive
- `[2.7] WhatsApp Number Checker` - Inactive

### 18. Property Enrichment Workflows
- `[2.4] Zillow Enrichment` - Inactive
- `[2.6] Realtor.com Comps` - Inactive

### 19. Lead Gen Scrapers
- `[1.3] Dallas Foreclosure Scraper` - Inactive
- `[1.4] Propwire Foreclosures` - Inactive
- `[1.5] Auction.com Properties` - Inactive

---

## 📊 Current Database State

| Metric | Count |
|--------|-------|
| Total leads | 530 |
| Unscored | 152 |
| No phone | 491 (93%) |
| Golden | 0 |
| New status | 146 |
| Scored status | 349 |
| Enriched | 1 |
| Active buyers | 4 (all duplicates) |

---

## 🔗 Webhook Chain (Current)

```
[1.2] PDF Processor
    ↓ (inserts leads)
[2.1] Eleanor Scorer (every 15 min)
    ↓ POST /webhook/skip-trace
[2.2] Skip Trace Enricher
    ↓ (should trigger)
[2.9] Golden Detector (every 2 hours)
    ↓ Telegram alert

[3.0] Sam Initial SMS (manual trigger)
    ↓ POST /webhook/sms-consent
[3.1] Sam SMS Consent
    ↓ POST /webhook/sms-agreement  
[3.2] Sam SMS Agreement
    ↓ POST /webhook/doc-generator
[4.1] Document Generator
```

---

## ✅ Completed Today

1. Created PRIME.md context document
2. Fixed Zillow Golden Detector workflow (wrong tables/columns)
3. Deactivated ghost Dallas PDF Scraper
4. Activated [0.1] Prime Agent workflow
5. Documented abandoned MaxSam-V4-Backend history
6. Generated this master task list

---

## 🎯 Next Actions (In Order)

1. **Fix Eleanor Scorer** - Add empty result check
2. **Fix Skip Trace Enricher** - Add empty result check  
3. **Run Eleanor batch** - Score 152 unscored leads
4. **Run Skip Trace batch** - Get phones for 491 leads
5. **Run Golden Detector** - Find dual-opportunity leads
6. **Add real buyers** - Populate maxsam_buyers with actual data

---

*Last updated: 2026-01-10 11:00 AM*
