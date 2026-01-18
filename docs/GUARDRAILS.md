# Guardrails - DO NOT BREAK AUTOMATIONS

This document explains how the MaxSam V4 automation guardrails work to prevent broken code from reaching production.

## What It Does

The guardrails system prevents commits, pushes, and deployments when the code fails:
- **Lint** - ESLint checks for code quality issues
- **Typecheck** - TypeScript compiler verifies type safety
- **Build** - Next.js production build catches runtime errors

## How to Ship Safely

### Before Every Commit

Run the fast guardrails check:

```bash
npm run guardrails:fast
```

This runs TypeScript typechecking only (~3-5 seconds).

### Before Every Push

Run the full guardrails check:

```bash
npm run guardrails
```

This runs lint + typecheck + build (~30-60 seconds).

### Manual Verification

```bash
# Individual checks
npm run lint          # Run ESLint
npm run typecheck     # Run TypeScript compiler
npm run build         # Run Next.js build

# Full guardrails (all three)
npm run guardrails
```

## What Happens Automatically

### On Commit (pre-commit hook)

The `guardrails:fast` script runs automatically before each commit:
- If typecheck fails → commit is blocked
- If typecheck passes → commit proceeds

### On Push (pre-push hook)

The full `guardrails` script runs automatically before each push:
- If lint/typecheck/build fails → push is blocked
- If all pass → push proceeds

### On GitHub (CI/CD)

GitHub Actions runs the full `guardrails` script on:
- Every push to any branch
- Every pull request to `main`

### On Vercel (Deployment)

Vercel runs `npm run build` which will fail if:
- TypeScript errors exist
- Next.js build errors occur

## Emergency Bypass (USE WITH EXTREME CAUTION)

If you absolutely must bypass guardrails (e.g., critical hotfix):

```bash
# Bypass pre-commit hook
git commit --no-verify -m "EMERGENCY: your message"

# Bypass pre-push hook
git push --no-verify
```

**WARNING**: This is strongly discouraged. If you bypass guardrails:
1. You risk breaking production
2. GitHub Actions will still run and may fail
3. Vercel deployment will fail if code is broken
4. Document WHY you bypassed in your commit message

## Troubleshooting

### "npm run guardrails fails but I think my code is fine"

1. Check the exact error message
2. Run individual commands to isolate the issue:
   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```
3. Fix the specific error before committing

### "Husky hooks not running"

Run the prepare script to reinstall hooks:
```bash
npm run prepare
```

Or reinstall husky:
```bash
rm -rf .husky
npx husky init
```

Then recreate the hooks as documented in this repo.

### "Build fails due to missing env vars"

The build is designed to work WITHOUT env vars. If you're seeing env-related build failures:
1. Check that you're not calling `createClient()` at module scope
2. Use lazy initialization patterns for Supabase clients
3. Runtime code should handle missing env vars gracefully

## Files Involved

```
package.json          # Scripts: lint, typecheck, build, guardrails
.husky/
  pre-commit          # Runs guardrails:fast on commit
  pre-push            # Runs guardrails on push
.github/workflows/
  guardrails.yml      # CI/CD pipeline for GitHub Actions
```

## Philosophy

> "It's easier to prevent a bug than to fix it in production."

The guardrails exist to:
1. Catch errors early (during development)
2. Prevent broken code from reaching `main`
3. Ensure deployments always succeed
4. Maintain trust in the automation pipeline
