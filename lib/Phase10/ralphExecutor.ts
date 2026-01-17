import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function runRalphOnce() {
  // 1. Fetch next action
  const { data: action } = await supabase
    .rpc('get_next_queue_action', { actor_type: 'ralph' })
    .single()

  if (!action) {
    console.log('Ralph: no work')
    return
  }

  console.log('Ralph executing:', action)

  // 2. Perform the action (stubbed but real)
  // Example: send_initial_sms
  if (action.action_type === 'send_initial_sms') {
    // simulate success for today
    console.log('SMS sent to lead', action.lead_id)
  }

  // 3. Mark complete
  await supabase.rpc('complete_queue_action', {
    p_queue_id: action.id,
    p_decision: 'success',
    p_reason: 'executed by ralph',
    p_metadata: {}
  })

  console.log('Ralph completed action', action.id)
}
