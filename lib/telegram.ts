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
 * NOTE: MaxSam does NOT invoice clients
 * - Excess Funds: Money comes from COUNTY payout (we take 25%)
 * - Wholesale: Money comes from TITLE COMPANY at closing (we take 10%)
 */
export async function notifyContractSigned(contract: {
  seller_name?: string;
  property_address?: string;
  total_fee?: number;
  contract_type?: string;
  next_step?: string;
}): Promise<void> {
  const defaultNextStep = contract.contract_type === 'wholesale' || contract.contract_type === 'dual'
    ? 'Find buyer & schedule closing with title company'
    : 'File claim with county for excess funds';

  const nextStep = contract.next_step || defaultNextStep;

  const paymentSource = contract.contract_type === 'wholesale' || contract.contract_type === 'dual'
    ? 'Title company will pay at closing'
    : 'County will disburse funds after claim approval';

  const message = `🎉💰 <b>CONTRACT SIGNED!</b> 💰🎉

${contract.seller_name || 'Unknown'} signed the ${contract.contract_type} agreement!

📍 <b>Property:</b> ${contract.property_address || 'N/A'}
💵 <b>Our Fee:</b> ${formatMoney(contract.total_fee || 0)}

<b>Next Step:</b> ${nextStep}
<b>Payment:</b> ${paymentSource}

Money is coming, Logan! 🚀`;

  await sendTelegramMessage(message);
}

/**
 * Payment received notification - JACKPOT
 * NOTE: Payment comes from county (excess funds) or title company (wholesale)
 * NOT from client invoices
 */
export async function notifyPaymentReceived(payment: {
  amount: number;
  property_address?: string;
  seller_name?: string;
  contract_type?: string;
  source?: 'county_payout' | 'title_company' | 'direct';
}): Promise<void> {
  const sourceText = payment.source === 'county_payout'
    ? 'County Payout'
    : payment.source === 'title_company'
      ? 'Title Company'
      : 'Direct';

  const message = `💰💰💰 <b>PAYMENT RECEIVED!</b> 💰💰💰

${formatMoney(payment.amount)} deposited!

📍 <b>Property:</b> ${payment.property_address || 'N/A'}
👤 <b>Seller:</b> ${payment.seller_name || 'N/A'}
📋 <b>Deal Type:</b> ${payment.contract_type || 'N/A'}
🏦 <b>Source:</b> ${sourceText}

Another check for Logan Toups! 🎉`;

  await sendTelegramMessage(message);
}

/**
 * Excess funds claim filed notification
 */
export async function notifyClaimFiled(deal: {
  seller_name?: string;
  property_address?: string;
  county_name?: string;
  excess_funds_amount?: number;
  our_fee?: number;
}): Promise<void> {
  const message = `📋 <b>CLAIM FILED WITH COUNTY</b>

Filed claim for ${deal.seller_name || 'Unknown'}

🏛️ <b>County:</b> ${deal.county_name || 'Dallas'}
📍 <b>Property:</b> ${deal.property_address || 'N/A'}
💰 <b>Excess Funds:</b> ${formatMoney(deal.excess_funds_amount || 0)}
💵 <b>Our 25% Fee:</b> ${formatMoney(deal.our_fee || 0)}

Now we wait for county approval...`;

  await sendTelegramMessage(message);
}

/**
 * Excess funds claim approved notification
 */
export async function notifyClaimApproved(deal: {
  seller_name?: string;
  property_address?: string;
  county_name?: string;
  payout_amount?: number;
  our_fee?: number;
}): Promise<void> {
  const message = `✅ <b>CLAIM APPROVED!</b>

${deal.county_name || 'County'} approved claim for ${deal.seller_name || 'Unknown'}!

📍 <b>Property:</b> ${deal.property_address || 'N/A'}
💰 <b>Payout Coming:</b> ${formatMoney(deal.payout_amount || 0)}
💵 <b>Our 25% Fee:</b> ${formatMoney(deal.our_fee || 0)}

Money coming soon! 🚀`;

  await sendTelegramMessage(message);
}

/**
 * Wholesale closing scheduled notification
 */
export async function notifyClosingScheduled(deal: {
  seller_name?: string;
  property_address?: string;
  buyer_name?: string;
  title_company?: string;
  closing_date?: string;
  assignment_fee?: number;
}): Promise<void> {
  const message = `📅 <b>CLOSING SCHEDULED!</b>

Wholesale deal closing set!

📍 <b>Property:</b> ${deal.property_address || 'N/A'}
👤 <b>Seller:</b> ${deal.seller_name || 'N/A'}
🏢 <b>Buyer:</b> ${deal.buyer_name || 'N/A'}
🏛️ <b>Title Co:</b> ${deal.title_company || 'N/A'}
📆 <b>Date:</b> ${deal.closing_date || 'TBD'}
💵 <b>Assignment Fee:</b> ${formatMoney(deal.assignment_fee || 0)}

Get ready for payday! 💰`;

  await sendTelegramMessage(message);
}

/**
 * Deal closed notification
 */
export async function notifyDealClosed(deal: {
  deal_type: 'excess_funds' | 'wholesale';
  seller_name?: string;
  property_address?: string;
  total_revenue?: number;
  owner_payout?: number;
}): Promise<void> {
  const dealTypeText = deal.deal_type === 'excess_funds' ? 'Excess Funds' : 'Wholesale';

  const message = `🎉🎉🎉 <b>DEAL CLOSED!</b> 🎉🎉🎉

${dealTypeText} deal complete!

📍 <b>Property:</b> ${deal.property_address || 'N/A'}
👤 <b>Seller:</b> ${deal.seller_name || 'N/A'}
💰 <b>Our Revenue:</b> ${formatMoney(deal.total_revenue || 0)}
${deal.deal_type === 'excess_funds' ? `💸 <b>Seller Gets:</b> ${formatMoney(deal.owner_payout || 0)}` : ''}

MONEY IN THE BANK! 🏦💵`;

  await sendTelegramMessage(message);
}

/**
 * Morning brief notification
 * NOTE: No invoices - we track claims pending (excess funds) and closings pending (wholesale)
 */
export async function notifyMorningBrief(brief: {
  date: string;
  newLeads: number;
  hotLeads: number;
  followUpsToday: number;
  pendingContracts: number;
  pendingClaims?: number;      // Excess funds claims awaiting county approval
  pendingClosings?: number;    // Wholesale deals awaiting closing
  pendingInvoices?: number;    // DEPRECATED - kept for backwards compat
  totalPipeline: number;
}): Promise<void> {
  const claimsLine = brief.pendingClaims !== undefined
    ? `🏛️ Claims Pending: <b>${brief.pendingClaims}</b>`
    : '';
  const closingsLine = brief.pendingClosings !== undefined
    ? `🏠 Closings Pending: <b>${brief.pendingClosings}</b>`
    : '';

  const message = `☀️ <b>Good Morning, Logan!</b>
${brief.date}

📊 <b>TODAY'S DASHBOARD:</b>

🆕 New Leads: <b>${brief.newLeads}</b>
🔥 Hot Leads Ready: <b>${brief.hotLeads}</b>
📞 Follow-ups Due: <b>${brief.followUpsToday}</b>
📝 Contracts Pending: <b>${brief.pendingContracts}</b>
${claimsLine}
${closingsLine}

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

// ============================================
// GOLDEN LEAD NOTIFICATIONS
// ============================================

export interface GoldenLeadData {
  owner_name: string;
  jurisdiction: string;
  deal_type: 'excess_only' | 'wholesale' | 'dual';
  excess_funds_amount?: number;
  excess_funds_expiration?: string;
  loan_balance?: number;
  estimated_arv?: number;
  priority_score: number;
  estimated_total_upside?: number;
  property_address?: string;
  property_city?: string;
  phone_primary?: string;
  declared_by: string;
  declaration_reason: string;
}

/**
 * Format deal type for display
 */
function formatDealType(dealType: string): string {
  switch (dealType) {
    case 'dual':
      return 'Excess + Wholesale';
    case 'excess_only':
      return 'Excess Funds Recovery';
    case 'wholesale':
      return 'Wholesale';
    default:
      return dealType;
  }
}

/**
 * Golden lead declared notification
 * Sends the formatted golden lead alert to Logan
 */
export async function notifyGoldenLeadDeclared(lead: GoldenLeadData): Promise<void> {
  const expirationText = lead.excess_funds_expiration
    ? ` (expires ${lead.excess_funds_expiration})`
    : '';

  const propertyLocation = [lead.property_address, lead.property_city]
    .filter(Boolean)
    .join(', ') || 'Address on file';

  const loanBalanceText = lead.loan_balance
    ? `\nLoan balance: ${formatMoney(lead.loan_balance)}`
    : '';

  const message = `🚨 <b>GOLDEN LEAD DECLARED</b>

<b>Name:</b> ${lead.owner_name}
<b>Jurisdiction:</b> ${lead.jurisdiction}

💰 <b>Excess Funds Available:</b>
${formatMoney(lead.excess_funds_amount || 0)}${expirationText}

🏠 <b>Property:</b>
${propertyLocation}${loanBalanceText}

📊 <b>Leverage Profile:</b>
• Strategy: ${formatDealType(lead.deal_type)}
• Priority score: ${lead.priority_score}/100
• Est. upside: ~${formatMoney(lead.estimated_total_upside || 0)}

🧠 <b>Decision Rationale:</b>
${lead.declaration_reason}

⚙️ <b>System:</b>
Declared by: ${lead.declared_by}
Status: Locked & ready for outreach`;

  await sendTelegramMessage(message);
}

/**
 * Golden lead qualified notification
 * When a golden lead responds positively
 */
export async function notifyGoldenLeadQualified(lead: {
  owner_name: string;
  property_address?: string;
  excess_funds_amount?: number;
  phone?: string;
  response?: string;
}): Promise<void> {
  const message = `🎯 <b>GOLDEN LEAD QUALIFIED!</b>

${lead.owner_name} is interested!

📍 <b>Property:</b> ${lead.property_address || 'N/A'}
💰 <b>Excess Funds:</b> ${formatMoney(lead.excess_funds_amount || 0)}
📞 <b>Phone:</b> ${lead.phone || 'N/A'}

${lead.response ? `💬 <i>"${lead.response}"</i>` : ''}

<b>Next Step:</b> Send contract via DocuSign!`;

  await sendTelegramMessage(message);
}

/**
 * Sam call task created notification
 */
export async function notifySamCallQueued(lead: {
  owner_name: string;
  phone?: string;
  deal_type: string;
  priority_score: number;
}): Promise<void> {
  const message = `📞 <b>SAM CALL QUEUED</b>

${lead.owner_name} added to Sam's call queue.

📱 <b>Phone:</b> ${lead.phone || 'N/A'}
📋 <b>Deal Type:</b> ${formatDealType(lead.deal_type)}
⭐ <b>Priority:</b> ${lead.priority_score}/100

Sam will call during next available window.`;

  await sendTelegramMessage(message);
}
