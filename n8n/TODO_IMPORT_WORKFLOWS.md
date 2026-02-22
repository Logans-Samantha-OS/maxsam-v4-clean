# TODO: Import/Link Outbound SMS n8n Workflow JSON

While implementing deterministic outbound `lead_id` resolution, no n8n workflow JSON in-repo was found that directly inserts into `sms_messages` (search across `/n8n` and `/n8n/workflows`).

## Required follow-up
1. Export the production n8n outbound SMS workflow JSON that performs the `sms_messages` insert.
2. Add deterministic lead resolution logic before insert:
   - If payload has `lead_id`, use it.
   - Else normalize outbound phone and resolve against `leads.phone`.
3. Ensure outbound inserts always set `sms_messages.lead_id`.
4. Commit the JSON update under `/n8n/workflows` with change notes.

## Search evidence used
- `rg -n "insert into sms_messages|sms_messages\).*insert|to_phone|to_number.*sms_messages" n8n/workflows n8n`
