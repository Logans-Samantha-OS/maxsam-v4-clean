-- ============================================================
-- RALPH EXECUTION QUEUE FUNCTIONS
-- ============================================================

-- 1. Get next queue action (locks row safely)
create or replace function get_next_queue_action()
returns table (
  id uuid,
  lead_id uuid,
  action_type text,
  payload jsonb
)
language plpgsql
as $$
begin
  return query
  update execution_queue
  set status = 'processing'
  where id = (
    select id
    from execution_queue
    where status = 'pending'
    order by priority desc, created_at asc
    limit 1
    for update skip locked
  )
  returning
    execution_queue.id,
    execution_queue.lead_id,
    execution_queue.action_type,
    execution_queue.payload;
end;
$$;

-- ============================================================

-- 2. Mark queue action as completed
create or replace function complete_queue_action(
  p_queue_id uuid
)
returns void
language plpgsql
as $$
begin
  update execution_queue
  set status = 'completed',
      completed_at = now()
  where id = p_queue_id;
end;
$$;

-- ============================================================

-- 3. Enqueue helper (used by Eleanor / system)
create or replace function enqueue_action(
  p_lead_id uuid,
  p_action_type text default 'process_lead',
  p_payload jsonb default '{}'::jsonb,
  p_priority int default 0
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into execution_queue (
    lead_id,
    action_type,
    payload,
    priority,
    status
  )
  values (
    p_lead_id,
    p_action_type,
    p_payload,
    p_priority,
    'pending'
  )
  returning id into new_id;

  return new_id;
end;
$$;
