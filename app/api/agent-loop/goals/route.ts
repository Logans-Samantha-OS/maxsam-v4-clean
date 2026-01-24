/**
 * AGENT GOALS API
 *
 * GET /api/agent-loop/goals - Get all goals
 * POST /api/agent-loop/goals - Create new goal
 * PATCH /api/agent-loop/goals - Update goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET - Get all goals with progress
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const searchParams = request.nextUrl.searchParams;
    const agent = searchParams.get('agent');

    let query = supabase
      .from('agent_goals')
      .select('*')
      .order('priority', { ascending: true });

    if (agent) {
      query = query.eq('agent', agent);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add completion percentage
    const goalsWithProgress = (data || []).map(goal => ({
      ...goal,
      progress_percent: goal.target_daily
        ? Math.min(100, Math.round((goal.current_daily / goal.target_daily) * 100))
        : null,
      remaining: goal.target_daily
        ? Math.max(0, goal.target_daily - goal.current_daily)
        : null
    }));

    return NextResponse.json(goalsWithProgress);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST - Create new goal
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { agent, goal, goal_key, priority, target_daily } = body;

    if (!agent || !goal || !goal_key) {
      return NextResponse.json(
        { error: 'Missing required fields: agent, goal, goal_key' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('agent_goals')
      .insert({
        agent,
        goal,
        goal_key,
        priority: priority || 5,
        target_daily: target_daily || null,
        active: true
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH - Update goal
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing goal id' },
        { status: 400 }
      );
    }

    // Only allow certain fields to be updated
    const allowedUpdates: Record<string, unknown> = {};
    if ('active' in updates) allowedUpdates.active = updates.active;
    if ('priority' in updates) allowedUpdates.priority = updates.priority;
    if ('target_daily' in updates) allowedUpdates.target_daily = updates.target_daily;
    if ('goal' in updates) allowedUpdates.goal = updates.goal;

    const { data, error } = await supabase
      .from('agent_goals')
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
