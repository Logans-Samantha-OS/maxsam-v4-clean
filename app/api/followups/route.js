import { followups } from '@/lib/followups';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'check') {
      const actions = await followups.checkFollowUps();
      return NextResponse.json({ actions });
    }

    if (action === 'notify') {
      const actions = await followups.sendFollowUpNotifications();
      return NextResponse.json({ success: true, count: actions.length });
    }

    if (action === 'update-statuses') {
      const staleLeads = await followups.autoUpdateLeadStatuses();
      return NextResponse.json({ staleLeads });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Follow-up API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
