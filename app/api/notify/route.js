import { notifications } from '@/lib/notifications';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case 'hot-lead':
        await notifications.notifyHotLead(data);
        break;

      case 'new-contract':
        await notifications.notifyNewContract(data.contract, data.lead, data.buyer);
        break;

      case 'daily-summary':
        await notifications.notifyDailySummary(data);
        break;

      case 'system-alert':
        await notifications.notifySystemAlert(data);
        break;

      case 'status-change':
        await notifications.notifyStatusChange(data.lead, data.oldStatus, data.newStatus);
        break;

      default:
        return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
