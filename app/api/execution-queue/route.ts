import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/execution-queue - Add action to execution queue
 *
 * PHASE 10 INVARIANT:
 * The execution_queue is how the UI (control surface) triggers actions.
 * The UI does NOT execute actions directly - it inserts into execution_queue.
 * Background workers/n8n workflows process the queue.
 *
 * This maintains the separation between:
 * - Control surface (UI) → INSERT into execution_queue
 * - Execution layer (workers) → Process execution_queue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lead_id,
      action_type,
      payload,
      status = 'pending',
      source = 'api',
      priority = 5,
      scheduled_at
    } = body

    // Validate required fields
    if (!lead_id || !action_type) {
      return NextResponse.json(
        { error: 'lead_id and action_type are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Insert into execution_queue
    const { data, error } = await supabase
      .from('execution_queue')
      .insert({
        lead_id,
        action_type,
        payload: payload || {},
        status,
        source,
        priority,
        scheduled_at: scheduled_at || new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Execution Queue API] Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to queue action', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      queue_id: data?.id,
      message: `Action ${action_type} queued for lead ${lead_id}`
    })

  } catch (error) {
    console.error('[Execution Queue API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to queue action' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/execution-queue - Get pending actions for a lead
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('lead_id')
    const status = searchParams.get('status') || 'pending'

    const supabase = await createClient()

    let query = supabase
      .from('execution_queue')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(50)

    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Execution Queue API] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch queue', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      actions: data || []
    })

  } catch (error) {
    console.error('[Execution Queue API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue' },
      { status: 500 }
    )
  }
}
