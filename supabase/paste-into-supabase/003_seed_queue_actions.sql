INSERT INTO execution_queue (
  lead_id,
  entity_type,
  entity_id,
  action_type,
  actor_type,
  status,
  priority,
  payload,
  source,
  auto
)
SELECT
  l.id AS lead_id,
  'lead' AS entity_type,
  l.id AS entity_id,
  'process_lead' AS action_type,
  'system' AS actor_type,
  'pending' AS status,
  3 AS priority,
  jsonb_build_object(
    'source', 'seed',
    'auto', true
  ) AS payload,
  'system' AS source,
  true AS auto
FROM maxsam_leads l
WHERE l.status IN ('new', 'contacted')
  AND l.eleanor_score >= 70
ON CONFLICT DO NOTHING;
