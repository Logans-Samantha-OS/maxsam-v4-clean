# CLAUDE CODE BOOTSTRAP - MAXSAM V4

**CRITICAL: READ THIS ENTIRE FILE BEFORE ANY ACTION**

## PROJECT IDENTITY

- **Project:** MaxSam V4
- **Owner:** Logan Toups (@mr.tings)
- **Production URL:** https://maxsam-v4-clean.vercel.app
- **Vercel Project ID:** prj_j995qw1vseFKgQlygLsbAEyLZ4VK
- **Team ID:** team_8ZF5lpi9IISysvcHjmKvr5FV
- **Repository:** https://github.com/Logans-Samantha-OS/maxsam-v4-clean

---

## 🚨 ABSOLUTE RULES - NEVER VIOLATE

### RULE 1: NO WORKTREES
```
❌ NEVER run: git worktree add
❌ NEVER run: git worktree prune
❌ NEVER create branches like: romantic-robinson, cranky-goldberg, trusting-chaum
✅ ALWAYS work directly on main branch
✅ ALWAYS in directory: C:\Users\MrTin\Downloads\MaxSam-V4
```

### RULE 2: NO NEW VERCEL PROJECTS
```
❌ NEVER run: vercel (without specifying existing project)
❌ NEVER run: vercel link (to new project)
❌ NEVER accept "Create new project" prompts
✅ ALWAYS verify .vercel/project.json first
✅ ALWAYS deploy to existing maxsam-v4-clean project
```

### RULE 3: VERIFY BEFORE DEPLOY
Before ANY deployment:
1. Check current directory: `pwd` must be `C:\Users\MrTin\Downloads\MaxSam-V4`
2. Check .vercel/project.json contains: `"projectId": "prj_j995qw1vseFKgQlygLsbAEyLZ4VK"`
3. Run `npm run build` locally - must succeed
4. Run `git status` - no uncommitted changes
5. Run `git pull origin main` - no conflicts

### RULE 4: ENV VARS ARE SACRED
These must exist in Vercel (Production + Preview + Development):
```
NEXT_PUBLIC_SUPABASE_URL=https://avdmijeoqxzkdgfxizik.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://avdmijeoqxzkdgfxizik.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

---

## DEPLOYMENT WORKFLOW

### Standard Deploy Process
```bash
# 1. Verify location
cd C:\Users\MrTin\Downloads\MaxSam-V4

# 2. Pull latest
git pull origin main

# 3. Make changes
# ... your edits ...

# 4. Build locally
npm run build

# 5. If build succeeds, commit
git add .
git commit -m "description of changes"

# 6. Push to GitHub (Vercel auto-deploys)
git push origin main

# 7. Verify deployment
# Check https://maxsam-v4-clean.vercel.app
```

### If Build Fails
1. Read the error message
2. Fix the issue locally
3. Run `npm run build` again
4. Do NOT create worktrees to "isolate" the fix
5. Do NOT create new Vercel projects

### If Merge Conflicts
```bash
# 1. See what's conflicting
git status

# 2. Open conflicting files, look for:
<<<<<<< HEAD
  your code
=======
  their code
>>>>>>> branch

# 3. Manually resolve by keeping correct code
# 4. Remove conflict markers
# 5. git add the resolved files
# 6. git commit
```

---

## RESOURCE BUDGETS

### N8N: 2,500 executions/month
- Daily budget: 83 executions
- Current ORION (15min): 96/day ❌ TOO HIGH
- **ACTION:** Change ORION to hourly = 24/day ✅

### SerpAPI: 250/month
- Weekly budget: 62 skip traces
- **ACTION:** Run skip trace only Mondays 6AM CST

### Twilio SMS: Pay-per-use
- Cost: $0.0079/segment
- Budget: ~$2/month for 250 messages

---

## CURRENT SYSTEM STATE

### Working ✅
- Dashboard at maxsam-v4-clean.vercel.app
- Supabase connection (227 leads)
- Twilio outbound SMS
- ELEANOR scoring
- Lead/Golden Leads pages

### Needs Fix ⚠️
- Merge conflict: app/api/cron/alex-skip-trace/route.ts
- ALEX stuck in error state
- NotebookLM authentication
- Some dashboard buttons

### Not Started ❌
- Overnight autonomy (midnight-9AM loop)
- Pre-outreach approval queue
- Two-way SMS in dashboard

---

## AGENT SCHEDULE (CST)

| Time | Agent | Action |
|------|-------|--------|
| 2 AM | ALEX | Skip trace (Mondays only) |
| 5 AM | ELEANOR | Score new leads |
| 6 AM | ELEANOR | Flag golden leads |
| 8 AM | ORION | Morning Brief → Telegram |
| 9 AM | SAM | Initial outreach |
| 2 PM | SAM | Follow-up |

---

## BEFORE STARTING ANY SESSION

```bash
# Run these commands first:
cd C:\Users\MrTin\Downloads\MaxSam-V4
git status
git pull origin main
cat .vercel/project.json  # Verify projectId

# If you see worktrees or wrong project:
# STOP and alert Logan
```

---

## CONTACT

If something seems wrong:
1. Do NOT try to "fix" by creating worktrees
2. Do NOT create new Vercel projects
3. STOP and report the issue
4. Wait for Logan's direction

---

*This file prevents the chaos of random Vercel projects and git worktrees.*
*Last updated: January 25, 2026*
