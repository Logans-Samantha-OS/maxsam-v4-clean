# MaxSam V4 — RUNBOOK (Primary)

**Owner:** Logan  
**Repo:** maxsam-v4-clean  
**Stack:** Next.js (App Router) + Supabase + n8n + Telegram + Vercel  
**Goal:** Stable, observable, repeatable operations with clear recovery steps.

---

## 0) Executive Summary (What MaxSam Does)

MaxSam V4 is an automation + analytics platform that captures operational events (deals, costs, outcomes, agent activity), persists them in Supabase, and exposes:
1) **Executive analytics views** (KPIs, outcomes, profit, attribution, loss analysis)
2) **A web dashboard** (Next.js on Vercel) that reads from those views
3) **Automation hooks** (n8n / alerts) to notify and trigger follow-ups (e.g., Telegram)

Core principle: **Log everything → compute KPIs in views → display and alert from the same source of truth.**

---

## 1) System Architecture (Truth Diagram)

### 1.1 Data Flow (Authoritative)

**Event Sources**
- App actions (UI, API routes)
- n8n workflows (scrapes/ingestion/execution)
- Manual entries / admin ops (if applicable)

**→ Supabase Tables**
- Raw events, costs, outcomes, agent attribution events

**→ Supabase Views (Executive Analytics Layer)**
- `v_exec_kpi_snapshot`
- `v_exec_outcome_performance`
- `v_exec_profit_timeseries`
- `v_exec_agent_attribution`
- `v_exec_loss_analysis`

**→ Next.js Dashboard**
- `/Executive` route reads the views and renders

**→ Alerting**
- n8n / API endpoints / Telegram senders read the same KPI layer and trigger notifications

> Invariant: **Dashboard numbers must match alert numbers** because both are derived from the same views.

---

## 2) How to Run Locally (Known-Good Steps)

### 2.1 Preconditions
- Node.js installed (LTS recommended)
- Repo cloned locally at: `C:\Repos\maxsam-v4-clean`
- You have Supabase project URL and keys

### 2.2 Environment File
Create or confirm:

**`C:\Repos\maxsam-v4-clean\.env.local`**

Must include:
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`

(If server-side Supabase is used elsewhere, you may also need):
- `SUPABASE_SERVICE_ROLE_KEY=...` (keep this secret; do not expose in client code)

### 2.3 Install + Run
From repo root (`C:\Repos\maxsam-v4-clean`):

```bash
npm install
npm run dev
