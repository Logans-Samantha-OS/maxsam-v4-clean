# MaxSam V4 — FULL SYSTEMS INTEGRITY & HEADLESS OPERATIONS AUDIT (READ-ONLY)

SYSTEM ROLE
You are acting as a Senior Systems Auditor, Validation Engineer, and Autonomous Systems Reviewer.
This is a STRICTLY READ-ONLY verification pass.
Do NOT refactor, redesign, optimize, rename, or delete code unless explicitly instructed in a separate task.

OBJECTIVE
Perform a complete end-to-end systems integrity audit of MaxSam V4 after UI consolidation.
Validate that the system is:
- Correctly wired
- Deterministically executable
- Safe to run autonomously
- Capable of headless (“god-mode”) operation without UI interaction

The audit must cover UI, API, database, orchestration, workflows, configuration, and autonomous execution paths.

SCOPE OF VALIDATION
You must audit and report on ALL layers listed below.

────────────────────────
A. FILE & ROUTE STRUCTURE
────────────────────────
1) Enumerate all `app/**/page.tsx` routes.
2) Confirm there is exactly ONE CEO-facing dashboard UI.
3) Identify:
   - Orphaned routes
   - Dead pages
   - Duplicate dashboards
   - Client/server boundary violations
4) Validate imports, dynamic imports, and component usage.

Output:
- Complete route inventory
- Structural risks
- Dead or unreachable code

────────────────────────
B. UI → DATASET TRACE (AUTHORITATIVE DATA PATHS)
────────────────────────
For EACH major page:
- Command Center
- Golden Leads
- All Leads
- Messages
- Agreements
- Skip Trace
- Workflow Control
- Activity Feed
- Import Data
- Settings

Produce an explicit trace:
UI Component
→ Hook / fetch
→ API Route
→ Supabase table / view / function
→ Fields consumed

Flag:
- Missing fields
- Mismatched field names
- Silent failures (e.g., defaulting to 0/null)
- Client-side access to server secrets

────────────────────────
C. BUILD & RUNTIME SANITY
────────────────────────
1) Run or simulate:
   - `npm run build`
2) Identify:
   - Hydration risks
   - Edge vs Node runtime mismatches
   - Suspicious or excessive `use client` usage
   - Dynamic imports that may break SSR

────────────────────────
D. API ROUTE VALIDATION
────────────────────────
1) Enumerate all `/app/api/**/route.ts` handlers.
2) For each handler:
   - Expected input
   - Output shape
   - Supabase queries used
   - Tables/functions referenced
3) Verify:
   - Table/column existence (from repo migrations)
   - Server-only environment variable usage
   - Error handling and failure paths

Flag:
- Broken routes
- Incomplete handlers
- Unused or unreachable routes

────────────────────────
E. SUPABASE SCHEMA & RLS CONSISTENCY
────────────────────────
Based on migrations and SQL files in repo:
- Enumerate expected tables, views, functions, triggers.
- Cross-check against all queries in UI and API layers.
- Evaluate RLS assumptions.

Flag:
- Queries against non-existent tables or columns
- Views assumed but not defined
- RLS rules that will silently block reads/writes

────────────────────────
F. N8N WORKFLOW EXECUTABILITY (STATIC)
────────────────────────
1) Identify all n8n webhook URLs referenced in code.
2) Normalize all against `N8N_WEBHOOK_BASE_URL`.
3) For each workflow:
   - Expected payload shape
   - Trigger type (webhook/manual/scheduled)
   - Assumed side effects

Flag:
- Missing workflows
- Unused workflows
- Payload mismatches
- Idempotency or retry hazards

IMPORTANT:
Do NOT call n8n. This is a static executability audit only.

────────────────────────
G. ORCHESTRATION SAFETY (RALPH / ORION)
────────────────────────
1) Trace execution queue usage end-to-end:
   - Enqueue locations
   - Processing locations
   - Completion/escalation paths
2) Verify:
   - No UI bypass of orchestration rules
   - “Run Ralph” or equivalent triggers are server-only
3) Flag:
   - Direct client-side mutation risks
   - Missing gating or validation logic

────────────────────────
H. FILESYSTEM & SERVERLESS ASSUMPTIONS
────────────────────────
1) Identify usage of:
   - fs / fs.promises
   - path
   - os.tmpdir
   - Any file writes outside `/tmp`
2) Verify:
   - All file operations are serverless-safe (Vercel-compatible)
   - No reliance on persistent local disk
3) For uploads (PDF/CSV):
   - Confirm streaming or object storage usage
   - Confirm cleanup after processing

Flag:
- Serverless-incompatible filesystem assumptions
- Hidden persistence dependencies

────────────────────────
I. SUPABASE STORAGE & OBJECT LIFECYCLE
────────────────────────
1) Identify Supabase Storage usage (buckets, uploads, downloads).
2) Trace object lifecycle:
   - Upload → processing → retention/deletion
3) Verify:
   - Bucket existence and naming consistency
   - Public vs private access assumptions
   - Signed URL usage where required

Flag:
- Missing buckets
- Public exposure risks
- Orphaned objects

────────────────────────
J. AUTHENTICATION & AUTHORIZATION
────────────────────────
1) Identify authentication model:
   - Supabase Auth usage (if any)
   - Assumed roles and privileges
2) Verify:
   - Admin-only actions are server-protected
   - Service role keys are NEVER used client-side
   - UI expectations align with RLS rules

Flag:
- Privilege escalation risks
- UI actions that will always fail due to RLS
- Missing auth guards

────────────────────────
K. RATE LIMITING & BACKPRESSURE
────────────────────────
1) Identify batch or looped actions:
   - SAM outreach
   - Skip tracing
   - Workflow triggers
2) Verify:
   - Rate limiting, batching, or queue-based control
3) Flag:
   - Unbounded loops
   - Missing throttling
   - Concurrency hazards

────────────────────────
L. OBSERVABILITY & FAILURE VISIBILITY
────────────────────────
1) Identify logging mechanisms:
   - Console logs
   - Activity feed entries
   - Error propagation
2) Verify:
   - Critical failures surface in Activity Feed
   - No silent catch-and-ignore behavior

Flag:
- Unlogged failures
- Missing error escalation

────────────────────────
M. CONFIGURATION & ENVIRONMENT PARITY
────────────────────────
1) Identify:
   - Hardcoded URLs
   - Environment-specific branches
2) Verify:
   - All referenced env vars are declared
   - Correct usage of NEXT_PUBLIC vs server-only vars

Flag:
- Config drift risks
- Missing production variables

────────────────────────
N. SECURITY SURFACE REVIEW
────────────────────────
1) Review webhook and API endpoints:
   - Input validation
   - Secret verification
2) Verify:
   - Replay protection / idempotency where applicable

Flag:
- Spoofable endpoints
- Missing validation

────────────────────────
O. DEPENDENCY & PACKAGE INTEGRITY
────────────────────────
1) Enumerate dependencies from package.json.
2) Identify:
   - Unused dependencies
   - Duplicate or overlapping libraries
   - Server-only packages imported client-side
3) Verify:
   - next / react / react-dom compatibility
   - No deprecated or incompatible packages

────────────────────────
P. CI / DEPLOYMENT ASSUMPTIONS
────────────────────────
1) Inspect package.json scripts:
   - build
   - dev
   - lint
   - typecheck (if present)
2) Verify:
   - No reliance on interactive shells
   - No dev-only assumptions in production builds

────────────────────────
Q. HEADLESS / GOD-MODE OPERATION VALIDATION
────────────────────────
This section is CRITICAL.

1) Identify all system capabilities that MUST function without UI:
   - Lead ingestion
   - Scoring
   - Outreach
   - Orchestration
   - Contract sending
2) Verify:
   - Each can be triggered via API, queue, or workflow
   - No logic requires UI interaction to proceed
3) Flag:
   - UI-coupled logic
   - Manual-only execution dependencies
   - Broken autonomous paths

────────────────────────
FINAL OUTPUT (REQUIRED)
────────────────────────
Produce a structured audit report with:

1) Overall System Health: PASS / WARN / FAIL
2) Route & UI Integrity Summary
3) UI → Data Wiring Map
4) API & Supabase Risk Summary
5) n8n Workflow Risk Summary
6) Orchestration & Headless Safety Notes
7) Dependency & Deployment Risks
8) Actionable Fix List (ranked by severity)
9) Explicit determination:
   - Safe to deploy
   - Safe to scale autonomously
   - Requires fixes before production

IMPORTANT RULES
- Do NOT modify code.
- Do NOT invent schemas or workflows.
- Base all findings strictly on repo contents.
- Be deterministic, explicit, and non-speculative.

BEGIN AUDIT NOW.
