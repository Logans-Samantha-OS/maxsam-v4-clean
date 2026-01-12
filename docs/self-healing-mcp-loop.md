# SELF-HEALING MCP LOOP

## PURPOSE
Automatically respond to CI failures with retries, diagnostics, or escalation.

## FAILURE CATEGORIES

### TRANSIENT
- Timeouts
- Rate limits
- Network errors
Action: Retry up to 3 times with backoff.

### CONFIGURATION
- Missing env vars
- Invalid credentials
Action: Notify human with exact variable name.

### SCHEMA DRIFT
- Missing columns
- Constraint errors
Action: Notify human to apply migration.

### LOGIC ERROR
- Assertion failures
- Invalid outputs
Action: Block deploy and escalate.

## FLOW
CI Failure → Categorize → Retry or Notify → Re-run tests → Deploy if clean

## LIMITATIONS
This loop does not fix business logic or architecture errors.

## ESCALATION
If auto-healing fails, deployment remains blocked until human fix is committed.
