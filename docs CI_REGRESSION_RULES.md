# CI / REGRESSION RULES

All structural changes must pass regression testing.

---

## WHAT IS TESTED

- Node presence
- Node connectivity
- Input/output schema
- Branch logic
- Safety guards (DRY_RUN)
- External API response shapes

---

## FAILURE RULES

- Any blocker failure stops deployment
- Failures must be logged
- No partial deployment

---

## SUCCESS RULE

Only workflows that pass ALL tests may be promoted to production.
