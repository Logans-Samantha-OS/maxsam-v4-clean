/**
 * AGENT LOOP API
 *
 * POST /api/agent-loop - Run one iteration of the agent loop
 * GET /api/agent-loop - Get current status of all agents
 *
 * Called by:
 * - Vercel Cron every 15 minutes
 * - Dashboard "Run Agent Loop Now" button
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runAgentLoop,
  getAgentLoopStatus,
  setAgentPaused,
  setAllAgentsPaused,
  AgentName
} from '@/lib/agent-loop';

/**
 * POST - Run one iteration of the agent loop
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, agent, paused } = body;

    // Handle pause/resume commands
    if (action === 'pause' && agent) {
      await setAgentPaused(agent as AgentName, true);
      return NextResponse.json({
        success: true,
        message: `${agent} paused`
      });
    }

    if (action === 'resume' && agent) {
      await setAgentPaused(agent as AgentName, false);
      return NextResponse.json({
        success: true,
        message: `${agent} resumed`
      });
    }

    if (action === 'pause-all') {
      await setAllAgentsPaused(true);
      return NextResponse.json({
        success: true,
        message: 'All agents paused'
      });
    }

    if (action === 'resume-all') {
      await setAllAgentsPaused(false);
      return NextResponse.json({
        success: true,
        message: 'All agents resumed'
      });
    }

    // Default: run the agent loop
    const result = await runAgentLoop();

    // Send Telegram notification for important actions
    if (result.status === 'completed' && result.action) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId && result.action.priority <= 2) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🤖 <b>AGENT LOOP</b>\n\n` +
              `Agent: ${result.action.agent}\n` +
              `Action: ${result.action.action}\n` +
              `Reason: ${result.action.reason}\n` +
              `Outcome: ${result.message}`,
            parse_mode: 'HTML'
          })
        }).catch(() => { /* ignore telegram errors */ });
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Agent loop error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: 'error',
      message: 'Agent loop failed',
      error: message
    }, { status: 500 });
  }
}

/**
 * GET - Get current agent loop status
 */
export async function GET() {
  try {
    const status = await getAgentLoopStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Agent status error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
