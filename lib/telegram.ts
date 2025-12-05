/**
 * Telegram Integration for MaxSam V4
 * Sends notifications to Logan for important events
 */

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/**
 * Check if Telegram is configured
 */
export function isTelegramConfigured(): boolean {
  return !!(
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_CHAT_ID
  );
}

/**
 * Get Telegram configuration
 */
function getConfig(): TelegramConfig | null {
  if (!isTelegramConfigured()) {
    return null;
  }

  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    chatId: process.env.TELEGRAM_CHAT_ID!
  };
}

/**
 * Send a Telegram message
 */
export async function sendTelegramMessage(
  message: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<{ success: boolean; error?: string }> {
  const config = getConfig();

  if (!config) {
    console.warn('Telegram not configured');
    return { success: false, error: 'Telegram not configured' };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: message,
          parse_mode: parseMode
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || 'Telegram API error');
    }

    return { success: true };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Telegram send error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Format currency for display
 */
function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

// ============================================
// NOTIFICATION TEMPLATES
// ============================================

/**
 * Hot lead notification - Someone responded YES
 */
export async function notifyHotLead(lead: {
  owner_name?: string;
  property_address?: string;
  excess_funds_amount?: number;
  phone?: string;
  response?: string;
}): Promise<void> {
  const message = `🔥 <b>HOT LEAD RESPONDED!</b>

${lead.owner_name || 'Unknown'} replied YES!

📍 <b>Property:</b> ${lead.property_address || 'N/A'}
💰 <b>Excess Funds:</b> ${formatMoney(lead.excess_funds_amount || 0)}
📞 <b>Phone:</b> ${lead.phone || 'N/A'}

${lead.response ? `💬 <i>"${lead.response}"</i>` : ''}

<b>Send contract NOW!</b>`;

  await sendTelegramMessage(message);
}

/**
 * Contract signed notification - MONEY TIME
 */
export async function notifyContractSigned(contract: {
  seller_name?: string;
  property_address?: string;
  total_fee?: number;
  contract_type?: string;
}): Promise<void> {
  const nextStep = contract.contract_type === 'wholesale' || contract.contract_type === 'dual'
    ? 'Find buyer & close deal'
    : 'Submit claim to Dallas County';

  const message = `🎉💰 <b>CONTRACT SIGNED!</b> 💰🎉

${contract.seller_name || 'Unknown'} signed the ${contract.contract_type} agreement!

📍 <b>Property:</b> ${contract.property_address || 'N/A'}
💵 <b>Fee:</b> ${formatMoney(contract.total_fee || 0)}

<b>Next:</b> ${nextStep}

Money is coming, Logan! 🚀`;

  await sendTelegramMessage(message);
}

/**
 * Payment received notification - JACKPOT
 */
export async function notifyPaymentReceived(payment: {
  amount: number;
  property_address?: string;
  seller_name?: string;
  contract_type?: string;
}): Promise<void> {
  const message = `💰💰💰 <b>PAYMENT RECEIVED!</b> 💰💰💰

${formatMoney(payment.amount)} deposited!

📍 <b>Property:</b> ${payment.property_address || 'N/A'}
👤 <b>Client:</b> ${payment.seller_name || 'N/A'}
📋 <b>Deal Type:</b> ${payment.contract_type || 'N/A'}

Another check for Logan Toups! 🎉`;

  await sendTelegramMessage(message);
}

/**
 * Morning brief notification
 */
export async function notifyMorningBrief(brief: {
  date: string;
  newLeads: number;
  hotLeads: number;
  followUpsToday: number;
  pendingContracts: number;
  pendingInvoices: number;
  totalPipeline: number;
}): Promise<void> {
  const message = `☀️ <b>Good Morning, Logan!</b>
${brief.date}

📊 <b>TODAY'S DASHBOARD:</b>

🆕 New Leads: <b>${brief.newLeads}</b>
🔥 Hot Leads Ready: <b>${brief.hotLeads}</b>
📞 Follow-ups Due: <b>${brief.followUpsToday}</b>
📝 Contracts Pending: <b>${brief.pendingContracts}</b>
💳 Invoices Pending: <b>${brief.pendingInvoices}</b>

💰 <b>Pipeline Value:</b> ${formatMoney(brief.totalPipeline)}

Time to make money! 🚀`;

  await sendTelegramMessage(message);
}

/**
 * Error/alert notification
 */
export async function notifyError(error: {
  type: string;
  message: string;
  details?: string;
}): Promise<void> {
  const message = `⚠️ <b>ALERT: ${error.type}</b>

${error.message}

${error.details ? `<i>${error.details}</i>` : ''}

Check dashboard for details.`;

  await sendTelegramMessage(message);
}

/**
 * New leads imported notification
 */
export async function notifyLeadsImported(count: number, source: string): Promise<void> {
  const message = `📥 <b>NEW LEADS IMPORTED</b>

<b>${count}</b> leads from ${source}

Dashboard updated. Check hot leads!`;

  await sendTelegramMessage(message);
}

/**
 * Weekly summary notification
 */
export async function notifyWeeklySummary(summary: {
  leadsAdded: number;
  leadsClosed: number;
  contractsSent: number;
  contractsSigned: number;
  revenueCollected: number;
  pipelineValue: number;
}): Promise<void> {
  const message = `📊 <b>WEEKLY SUMMARY</b>

📥 Leads Added: <b>${summary.leadsAdded}</b>
✅ Leads Closed: <b>${summary.leadsClosed}</b>
📝 Contracts Sent: <b>${summary.contractsSent}</b>
✍️ Contracts Signed: <b>${summary.contractsSigned}</b>

💵 <b>Revenue Collected:</b> ${formatMoney(summary.revenueCollected)}
💰 <b>Pipeline Value:</b> ${formatMoney(summary.pipelineValue)}

Keep grinding! 💪`;

  await sendTelegramMessage(message);
}
