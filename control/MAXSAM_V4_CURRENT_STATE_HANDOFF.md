# MaxSam V4 – Current State Handoff

## What Works
- Next.js 16 app deployed to Vercel
- /dashboard live with real lead data
- Pipeline, fees, status counts computed
- Lead actions visible (Skip Trace, Eleanor Score, Generate Contract)

## Data Sources
- Leads: Supabase (excess funds + county ingestion)
- Scores: Eleanor logic (internal)
- Contracts: Drafted but provider not live

## Known Limitations
- Skip trace API not connected (expected)
- UI still raw (text-heavy, not card-based)
- No auth / billing enforced yet

## Current Goal
- Convert internal ops dashboard → sellable SaaS UI
- Feature-gate integrations
- Make demo-ready for investors / customers

## Tech Stack
- Next.js 16 (App Router)
- Supabase
- Vercel
- Stripe (installed, not enforced)
- No Twilio live yet

## What I Want Next
- SaaS-grade layout
- Clear monetization framing
- Role-based UI (buyer / operator)
