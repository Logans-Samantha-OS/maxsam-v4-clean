# SKILL_repo_patch_generator

Generate minimal, reviewable patches for MaxSam V4.

## Principles
- Keep business behavior stable unless correctness bug
- Prefer explicit schemas and constrained statuses
- Include migration + API + UI verification notes

## Procedure
1. Create plan and identify touched files.
2. Apply smallest viable patch.
3. Run `npx tsc --noEmit` and `npm run lint`.
4. Prepare commit and PR notes with testing output.
