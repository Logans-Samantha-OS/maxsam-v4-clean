# MaxSam V4 - Master Task List
> Generated: January 10, 2026
> Status: ACTIVE WORK IN PROGRESS

---

## 🔴 CRITICAL - Data Integrity

### TASK-001: Unify Database Tables ⚠️ BLOCKING
**Status**: IN PROGRESS
**Problem**: Two separate lead tables exist:
- `leads` (154 rows) - Used by PDF Processor [1.2], Eleanor [2.1]
- `maxsam_leads` (393 rows) - Used by Golden Detector [2.9], API routes, dashboard

**Impact**: Data split = Eleanor scores never reach Sam, Golden detection fails
**Solution**: 
1. Migrate `leads` data → `maxsam_leads`
2. Update all N8N workflows to use `maxsam_leads`
3. Drop legacy `leads` table

---

## 🟡 WORKFLOW FIXES

### TASK-002: Fix Table References in All Workflows
**Status**: PENDING (blocked by TASK-001)
**Workflows to update**:
- [x] [2.9] Golden Lead Detector - FIXED (now uses maxsam_leads)
- [ ] [1.2] PDF Processor - Uses `leads`, needs update
- [ ] [2.1] Eleanor Scorer - Uses `leads`, needs update
- [ ] [2.2] Skip Trace Enricher - Needs verification
- [ ] [3.0] Sam Initial SMS - Needs verification

### TASK-003: Fix Buyers Table Reference
**Status**: PENDING
**Problem**: Workflows query `buyers` but table is `maxsam_buyers`
**Affected**: [2.9] Golden Lead Detector (FIXED), [3.1] Buyer Outreach

---

## 🟢 WORKFLOW CONNECTION MAP

```
INGESTION
[1.2] PDF Processor ──webhook──> [2.1] Eleanor

PROCESSING  
[2.1] Eleanor ──webhook──> [2.2] Skip Trace
[2.9] Golden Detector (schedule: every 2hr)
[2.8] Full Enrichment Pipeline (manual/schedule)

OUTREACH
[3.0] Sam Initial SMS ──webhook──> [3.1] Consent
[3.1] Consent ──webhook──> [3.2] Agreement
[3.2] Agreement ──webhook──> [4.1] Document Generator

TRACKING
[5.1] Claim Status (schedule: daily)
[5.2] Daily Metrics (schedule: daily)

PAYMENTS
[6.1] Fee Invoice (webhook from contract signed)
[6.2] Stripe Webhook (external)
```

**Webhook Endpoints (skooki.app.n8n.cloud/webhook/...)**:
| Path | Triggers | From |
|------|----------|------|
| `ingest-pdf` | [1.2] PDF Processor | External/Manual |
| `eleanor-score` | [2.1] Eleanor | [1.2] |
| `skip-trace` | [2.2] Skip Trace | [2.1] |
| `zillow-scan` | [2.9] Golden | Manual |
| `sam-outreach` | [3.0] Sam SMS | Manual/[2.2] |
| `prime/gather` | [0.1] Prime | Claude |

---

## 🟡 KNOWN BUGS

### TASK-004: Buyers API 505 Error
**Status**: PENDING
**Location**: `MaxSam-V4/app/api/buyers/route.ts`
**Error**: 505 HTTP Version Not Supported
**Likely cause**: Supabase client config or table name mismatch

### TASK-005: Skip Trace Telegram Spam
**Status**: MITIGATED (workflow active but may spam)
**Solution**: Add rate limiting (max 10 notifications per run)

### TASK-006: Eleanor Not Using Claude API
**Status**: NEEDS REVIEW
**Current**: Simple code-based scoring (50 base + bonuses)
**Expected**: Claude Sonnet 4 API call for intelligent scoring
**Impact**: Missing talking points, opening lines, reasoning

---

## 🔵 ENHANCEMENTS

### TASK-007: Add Real Zillow Integration
**Status**: INACTIVE
**Current**: [2.4] Property Enrichment - Zillow is deactivated
**Need**: Activate and connect to Golden Detector

### TASK-008: Voice AI Setup
**Status**: INACTIVE  
**Current**: [3.3] VAPI Voice Handler exists but untested
**Need**: Connect to outreach flow after SMS fails

### TASK-009: Multi-County Expansion
**Status**: FUTURE
**Current**: Dallas County only
**Target**: Tarrant, Collin, Denton counties

---

## ✅ COMPLETED

### TASK-C01: Fix Golden Lead Detector SQL
**Completed**: 2026-01-10
**Changes**:
- Fixed table names (`leads` → `maxsam_leads`, `buyers` → `maxsam_buyers`)
- Fixed column names (`price_range_min` → `min_price`)
- Added proper golden detection logic (excess + distressed + zillow)
- Added ultra_golden for 3+ list matches

### TASK-C02: Create PRIME.md
**Completed**: 2026-01-10
**Location**: `C:\Users\MrTin\Downloads\MaxSam-V4\PRIME.md`

### TASK-C03: Activate Prime Agent Workflow
**Completed**: 2026-01-10
**Workflow**: [0.1] Prime Agent - Context Gatherer

---

## 📋 EXECUTION ORDER

1. **TASK-001** - Migrate leads → maxsam_leads (DOING NOW)
2. **TASK-002** - Update workflow SQL queries
3. **TASK-004** - Fix Buyers API
4. **TASK-006** - Upgrade Eleanor to use Claude
5. **TASK-007** - Activate Zillow enrichment
6. **TASK-005** - Add skip trace rate limiting

---

*This file auto-updates as tasks are completed. Check git commits for history.*
