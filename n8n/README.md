# MaxSam n8n Workflows

## Golden Lead Execution Pipeline

**File:** `golden_lead_execution_workflow.json`

### Overview

This workflow implements the n8n portion of the Golden Lead execution pipeline:

```
Golden Lead Declared (Supabase)
        ↓
    Poll Events (every 1 minute)
        ↓
    Send Telegram Alert to Logan
        ↓
    Check Sam Hours
        ↓
    Create Sam Call Task (if within hours)
        ↓
    Mark Event Processed
```

### Setup Instructions

1. **Import Workflow**
   - Open n8n
   - Go to Workflows → Import
   - Select `golden_lead_execution_workflow.json`

2. **Configure PostgreSQL Credential**
   - Create a new PostgreSQL credential named "Supabase PostgreSQL"
   - Host: `<your-project>.supabase.co`
   - Database: `postgres`
   - User: `postgres`
   - Password: Your Supabase database password
   - Port: `5432`
   - SSL: Enable

3. **Configure Environment Variables**
   Set these in n8n Settings → Variables:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
   - `TELEGRAM_CHAT_ID`: Logan's Telegram chat ID

4. **Activate Workflow**
   - Open the workflow
   - Toggle "Active" to ON

### Workflow Nodes

| Node | Purpose |
|------|---------|
| Poll Every Minute | Trigger node - runs every 60 seconds |
| Fetch Unprocessed Events | Calls `get_unprocessed_golden_events(10)` |
| Has Events? | Checks if any events were returned |
| Is Declaration? | Filters for `declared` event type |
| Send Telegram Alert | Sends formatted notification to Logan |
| Update Status | Updates golden lead to `telegram_sent` |
| Check Sam Hours | Calls `is_within_sam_hours()` function |
| Within Sam Hours? | Routes based on availability |
| Create Sam Call Task | Calls `create_sam_call_task()` if available |
| Mark Event Processed | Calls `mark_event_processed()` |

### Event Types Handled

- `declared` - New golden lead declaration → Full pipeline
- Other events - Marked as processed without action

### Safety Features

1. **Deduplication**: Events are marked as processed to prevent duplicate handling
2. **Sam Hours Guard**: Call tasks only created during operating hours
3. **Rate Limiting**: Respects `sam_daily_rate_limit` in system_controls
4. **Kill Switch**: Respects `sam_enabled` flag

### Testing

To test the workflow manually:

1. Insert a test candidate and declare it:

```sql
-- Insert test candidate
INSERT INTO golden_lead_candidates (
    owner_name, jurisdiction, excess_funds_amount,
    priority_score, evaluation_status, recommended_deal_type
)
VALUES (
    'Test User', 'Dallas County, TX', 50000.00,
    75, 'approved', 'excess_only'
)
RETURNING id;

-- Declare as golden lead (use returned ID)
SELECT * FROM declare_golden_lead(
    '<candidate_id>',
    'excess_only',
    'manual_test',
    'Testing golden lead pipeline'
);
```

2. Check for unprocessed events:

```sql
SELECT * FROM v_pending_golden_events;
```

3. Manually trigger the workflow or wait for next poll cycle.

4. Verify Telegram notification received.

### Troubleshooting

**Events not being picked up:**
- Check that `processed = FALSE` in golden_lead_events
- Verify PostgreSQL connection credentials

**Telegram not sending:**
- Verify bot token and chat ID
- Check n8n execution logs

**Sam tasks not being created:**
- Check `sam_enabled` is `true` in system_controls
- Verify current time is within sam_hours_start and sam_hours_end
- Check `sam_daily_rate_limit` hasn't been reached

### Maintenance

- Events are kept in `golden_lead_events` for audit purposes
- Clean up old processed events periodically if needed:

```sql
DELETE FROM golden_lead_events
WHERE processed = TRUE
  AND created_at < NOW() - INTERVAL '30 days';
```
