import { supabase } from './supabase';
import { notifications } from './notifications';

export class FollowUpService {
  async checkFollowUps() {
    const today = new Date().toISOString().split('T')[0];

    // Get leads that need follow-up today
    const { data: leads } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('next_follow_up_date', today)
      .or('status.eq.new,status.eq.contacted');

    // Get activity logs to check last contact
    const { data: activities } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false });

    const followUpActions = [];

    for (const lead of leads || []) {
      // Find last activity for this lead
      const lastActivity = activities?.find((a) => a.lead_id === lead.id);
      const daysSinceContact = lastActivity
        ? Math.floor(
            (Date.now() - new Date(lastActivity.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 999;

      // Determine follow-up action
      if (!lastActivity) {
        // Never contacted - initial outreach
        followUpActions.push({
          lead,
          action: 'initial-call',
          priority: lead.eleanor_score >= 85 ? 'high' : 'medium',
          reason: 'Never contacted',
        });
      } else if (lastActivity.outcome === 'voicemail' && daysSinceContact >= 2) {
        // Follow up voicemail after 2 days
        followUpActions.push({
          lead,
          action: 'follow-up-call',
          priority: 'medium',
          reason: 'Voicemail follow-up',
        });
      } else if (lastActivity.outcome === 'no-answer' && daysSinceContact >= 1) {
        // Try again after no answer
        followUpActions.push({
          lead,
          action: 'retry-call',
          priority: 'low',
          reason: 'No answer - retry',
        });
      } else if (
        lastActivity.disposition === 'think-about-it' &&
        daysSinceContact >= 3
      ) {
        // Follow up on "thinking about it"
        followUpActions.push({
          lead,
          action: 'decision-check',
          priority: 'high',
          reason: 'Decision follow-up',
        });
      } else if (lastActivity.disposition === 'callback' && daysSinceContact >= 0) {
        // Scheduled callback
        followUpActions.push({
          lead,
          action: 'scheduled-callback',
          priority: 'high',
          reason: 'Scheduled callback',
        });
      }
    }

    return followUpActions;
  }

  async sendFollowUpNotifications() {
    const actions = await this.checkFollowUps();

    if (actions.length === 0) return actions;

    // Group by priority
    const high = actions.filter((a) => a.priority === 'high');
    const medium = actions.filter((a) => a.priority === 'medium');
    const low = actions.filter((a) => a.priority === 'low');

    // Build notification message
    const message = `
📋 <b>FOLLOW-UP TASKS - ${new Date().toLocaleDateString()}</b>

${
      high.length > 0
        ? `
🔴 <b>HIGH PRIORITY (${high.length})</b>
${high.map((a) => `• ${a.lead.owner_name} - ${a.reason}`).join('\n')}
`
        : ''
    }

${
      medium.length > 0
        ? `
🟡 <b>MEDIUM PRIORITY (${medium.length})</b>
${medium
  .slice(0, 3)
  .map((a) => `• ${a.lead.owner_name} - ${a.reason}`)
  .join('\n')}
${medium.length > 3 ? `• ...and ${medium.length - 3} more` : ''}
`
        : ''
    }

${low.length > 0 ? `
🟢 <b>LOW PRIORITY (${low.length})</b>
` : ''}

<b>Total Tasks:</b> ${actions.length}
`;

    await notifications.sendTelegram(message);

    return actions;
  }

  async autoUpdateLeadStatuses() {
    // Auto-mark stale leads
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: staleLeads } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name')
      .eq('status', 'contacted')
      .lt('updated_at', thirtyDaysAgo.toISOString());

    if (staleLeads && staleLeads.length > 0) {
      await supabase
        .from('maxsam_leads')
        .update({ status: 'cold' })
        .in('id', staleLeads.map((l) => l.id));

      await notifications.sendTelegram(`
⚠️ <b>STALE LEADS ALERT</b>

${staleLeads.length} leads marked as COLD (no activity in 30 days)

Consider running re-engagement campaign.
`);
    }

    return staleLeads || [];
  }
}

export const followups = new FollowUpService();
