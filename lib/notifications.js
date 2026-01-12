// Notification system for MaxSam V4
export class NotificationService {
  constructor() {
    this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
  }

  async sendTelegram(message) {
    if (!this.telegramBotToken || !this.telegramChatId) {
      console.warn('Telegram not configured');
      return;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.telegramChatId,
            text: message,
            parse_mode: 'HTML',
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Telegram API error');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send Telegram:', error);
    }
  }

  // High-priority lead notification
  async notifyHotLead(lead) {
    const message = `
🔥 <b>HOT LEAD ALERT</b>

<b>Grade:</b> ${lead.deal_grade}
<b>Owner:</b> ${lead.owner_name}
<b>Property:</b> ${lead.property_address}
<b>Excess Funds:</b> $${lead.excess_funds_amount?.toLocaleString() || '0'}
<b>Eleanor Score:</b> ${lead.eleanor_score}/100

<b>Priority:</b> ${lead.contact_priority?.toUpperCase()}
<b>Phone:</b> ${lead.phone || 'MISSING - RUN ENRICHMENT'}

🎯 <b>Action:</b> Call this lead NOW!
`;

    await this.sendTelegram(message);
  }

  // Contract created notification
  async notifyNewContract(contract, lead, buyer) {
    const message = `
💰 <b>NEW CONTRACT CREATED</b>

<b>Deal Type:</b> ${contract.deal_type.replace('_', ' ').toUpperCase()}
<b>Property:</b> ${contract.property_address}
<b>Seller:</b> ${contract.seller_name}
<b>Buyer:</b> ${buyer?.name || 'TBD'}

<b>Total Fee:</b> $${contract.total_fee?.toLocaleString() || '0'}
<b>Your Cut:</b> $${contract.logan_cut?.toLocaleString() || '0'} (${contract.deal_type === 'excess_only' ? '80%' : '65%'})

📊 <b>Status:</b> ${contract.status.toUpperCase()}
`;

    await this.sendTelegram(message);
  }

  // Daily summary notification
  async notifyDailySummary(stats) {
    const message = `
📈 <b>DAILY SUMMARY - MaxSam V4</b>

<b>Leads Added:</b> ${stats.leadsAdded}
<b>Calls Made:</b> ${stats.callsMade}
<b>Hot Qualified:</b> ${stats.hotQualified}
<b>Contracts Created:</b> ${stats.contractsCreated}

<b>Pipeline Value:</b> $${(stats.pipelineValue / 1000).toFixed(0)}K
<b>Revenue Closed:</b> $${(stats.revenueClosed / 1000).toFixed(0)}K

<b>A+ Leads Waiting:</b> ${stats.aPlusWaiting}
<b>Missing Phone Numbers:</b> ${stats.missingPhones}

${stats.missingPhones > 5 ? '⚠️ <b>Action Required:</b> Run Dallas CAD enrichment!' : '✅ All systems green!'}
`;

    await this.sendTelegram(message);
  }

  // System alert notification
  async notifySystemAlert(alert) {
    const message = `
🚨 <b>SYSTEM ALERT</b>

<b>Type:</b> ${alert.type}
<b>Priority:</b> ${alert.priority?.toUpperCase()}

<b>Message:</b> ${alert.message}

<b>Action Required:</b> ${alert.action || 'Check dashboard'}
`;

    await this.sendTelegram(message);
  }

  // Lead status change notification
  async notifyStatusChange(lead, oldStatus, newStatus) {
    if (newStatus === 'qualified' || newStatus === 'contract') {
      const message = `
✅ <b>LEAD STATUS UPDATE</b>

<b>Owner:</b> ${lead.owner_name}
<b>Property:</b> ${lead.property_address}

<b>Status:</b> ${oldStatus?.toUpperCase()} → ${newStatus?.toUpperCase()}

${newStatus === 'qualified' ? '🎯 Ready for contract!' : '📄 Contract stage!'}
`;

      await this.sendTelegram(message);
    }
  }
}

export const notifications = new NotificationService();
