import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  N8N_BASE_URL,
  N8N_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  TELEGRAM_BOT_TOKEN,
  API_TIMEOUT_MS,
  WEBHOOK_TIMEOUT_MS,
  COMPANY_INFO,
  ARV_MULTIPLIER,
} from '../constants.js';
import type {
  N8NCredential,
  N8NWorkflow,
  N8NExecution,
  N8NExecutionListParams,
  WebhookTestResult,
  AgentAction,
  AgentLogFilter,
  AgentStats,
  LeadMissingARV,
  LeadWithARV,
  Lead,
  LeadFilter,
  TelegramResponse,
  MorningBrief,
  SMSLog,
} from '../types.js';

// ============ N8N API Client ============
class N8NClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${N8N_BASE_URL}/api/v1`,
      timeout: API_TIMEOUT_MS,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
    });
  }

  // List all workflows
  async listWorkflows(active?: boolean): Promise<N8NWorkflow[]> {
    try {
      let url = '/workflows';
      if (active !== undefined) {
        url += `?active=${active}`;
      }
      const response = await this.client.get(url);
      return response.data.data || [];
    } catch (error) {
      throw this.handleError(error, 'Failed to list workflows');
    }
  }

  // Get a single workflow
  async getWorkflow(workflowId: string): Promise<N8NWorkflow> {
    try {
      const response = await this.client.get(`/workflows/${workflowId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to fetch workflow ${workflowId}`);
    }
  }

  // Create a new workflow
  async createWorkflow(workflow: Partial<N8NWorkflow>): Promise<N8NWorkflow> {
    try {
      const response = await this.client.post('/workflows', workflow);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create workflow');
    }
  }

  // Update a workflow
  async updateWorkflow(workflowId: string, updates: Partial<N8NWorkflow>): Promise<N8NWorkflow> {
    try {
      const response = await this.client.patch(`/workflows/${workflowId}`, updates);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to update workflow ${workflowId}`);
    }
  }

  // Delete a workflow
  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      await this.client.delete(`/workflows/${workflowId}`);
    } catch (error) {
      throw this.handleError(error, `Failed to delete workflow ${workflowId}`);
    }
  }

  // Activate/deactivate a workflow
  async activateWorkflow(workflowId: string, active: boolean): Promise<N8NWorkflow> {
    try {
      const response = await this.client.patch(`/workflows/${workflowId}`, { active });
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to ${active ? 'activate' : 'deactivate'} workflow ${workflowId}`);
    }
  }

  // Execute a workflow manually
  async executeWorkflow(workflowId: string, data?: Record<string, unknown>): Promise<N8NExecution> {
    try {
      const response = await this.client.post(`/workflows/${workflowId}/run`, data ? { data } : {});
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to execute workflow ${workflowId}`);
    }
  }

  // Get execution history
  async getExecutions(params?: N8NExecutionListParams): Promise<N8NExecution[]> {
    try {
      let url = '/executions';
      const queryParams: string[] = [];
      
      if (params?.workflowId) queryParams.push(`workflowId=${params.workflowId}`);
      if (params?.status) queryParams.push(`status=${params.status}`);
      if (params?.limit) queryParams.push(`limit=${params.limit}`);
      
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }
      
      const response = await this.client.get(url);
      return response.data.data || [];
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch executions');
    }
  }

  // Get detailed execution data
  async getExecutionData(executionId: string): Promise<N8NExecution> {
    try {
      const response = await this.client.get(`/executions/${executionId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to fetch execution ${executionId}`);
    }
  }

  // Duplicate/clone a workflow
  async duplicateWorkflow(workflowId: string, newName?: string): Promise<N8NWorkflow> {
    try {
      const getResponse = await this.client.get(`/workflows/${workflowId}`);
      const workflow = getResponse.data;
      
      const duplicateData = {
        ...workflow,
        id: undefined,
        name: newName || `${workflow.name} (Copy)`,
        active: false,
      };
      
      const response = await this.client.post('/workflows', duplicateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `Failed to duplicate workflow ${workflowId}`);
    }
  }

  // Get credentials
  async getCredentials(): Promise<N8NCredential[]> {
    try {
      const response = await this.client.get('/credentials');
      return response.data.data || [];
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch credentials');
    }
  }

  // Test a webhook
  async testWebhook(webhookPath: string, payload?: Record<string, unknown>): Promise<WebhookTestResult> {
    const startTime = Date.now();
    try {
      const fullUrl = webhookPath.startsWith('http') ? webhookPath : `${N8N_BASE_URL}${webhookPath}`;
      const response = await axios.post(fullUrl, payload || {}, {
        timeout: WEBHOOK_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      });
      return {
        success: true,
        statusCode: response.status,
        response: response.data,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        statusCode: axiosError.response?.status,
        error: axiosError.message,
        duration: Date.now() - startTime,
      };
    }
  }

  // Get webhook URL for a workflow
  async getWebhookUrl(workflowId: string): Promise<string | null> {
    try {
      const workflow = await this.getWorkflow(workflowId);
      const webhookNode = workflow.nodes?.find(node => 
        node.type === 'n8n-nodes-base.webhook' || node.type.includes('Webhook')
      );
      
      if (webhookNode?.parameters?.path) {
        return `${N8N_BASE_URL}/webhook/${webhookNode.parameters.path}`;
      }
      return null;
    } catch (error) {
      throw this.handleError(error, `Failed to get webhook URL for workflow ${workflowId}`);
    }
  }

  private handleError(error: unknown, context: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      return new Error(`${context}: [${status}] ${message}`);
    }
    return new Error(`${context}: ${String(error)}`);
  }
}

// ============ Supabase Client ============
class SupabaseClient {
  private client: AxiosInstance;
  private serviceClient: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${SUPABASE_URL}/rest/v1`,
      timeout: API_TIMEOUT_MS,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    });
    
    // Service role client for admin operations
    this.serviceClient = axios.create({
      baseURL: `${SUPABASE_URL}/rest/v1`,
      timeout: API_TIMEOUT_MS,
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    });
  }

  // ============ Lead Operations ============
  
  async getLeads(filter?: LeadFilter): Promise<Lead[]> {
    try {
      let query = '/leads?select=*';
      
      if (filter?.status) query += `&status=eq.${filter.status}`;
      if (filter?.priority) query += `&priority=eq.${filter.priority}`;
      if (filter?.isGoldenLead !== undefined) query += `&is_golden_lead=eq.${filter.isGoldenLead}`;
      if (filter?.county) query += `&county=ilike.*${filter.county}*`;
      if (filter?.minExcessFunds) query += `&excess_funds_amount=gte.${filter.minExcessFunds}`;
      if (filter?.maxExcessFunds) query += `&excess_funds_amount=lte.${filter.maxExcessFunds}`;
      if (filter?.hasArv !== undefined) {
        query += filter.hasArv ? '&arv=not.is.null' : '&arv=is.null';
      }
      if (filter?.hasPhone !== undefined) {
        query += filter.hasPhone ? '&phone=not.is.null' : '&phone=is.null';
      }
      
      query += `&order=created_at.desc`;
      if (filter?.limit) query += `&limit=${filter.limit}`;
      if (filter?.offset) query += `&offset=${filter.offset}`;
      
      const response = await this.client.get(query);
      return this.mapLeads(response.data);
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch leads');
    }
  }

  async getLead(leadId: string): Promise<Lead | null> {
    try {
      const response = await this.client.get(`/leads?id=eq.${leadId}&select=*`);
      const leads = this.mapLeads(response.data);
      return leads[0] || null;
    } catch (error) {
      throw this.handleError(error, `Failed to fetch lead ${leadId}`);
    }
  }

  async getGoldenLeads(limit: number = 20): Promise<Lead[]> {
    try {
      const response = await this.client.get(
        `/leads?select=*&is_golden_lead=eq.true&order=excess_funds_amount.desc&limit=${limit}`
      );
      return this.mapLeads(response.data);
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch golden leads');
    }
  }

  async searchLeads(query: string): Promise<Lead[]> {
    try {
      // Search across name, address, phone, and case_number
      const response = await this.client.get(
        `/leads?select=*&or=(name.ilike.*${query}*,address.ilike.*${query}*,phone.ilike.*${query}*,case_number.ilike.*${query}*)&order=created_at.desc&limit=50`
      );
      return this.mapLeads(response.data);
    } catch (error) {
      throw this.handleError(error, 'Failed to search leads');
    }
  }

  async updateLeadStatus(leadId: string, status: string, notes?: string): Promise<Lead> {
    try {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (notes) updates.notes = notes;
      
      const response = await this.client.patch(`/leads?id=eq.${leadId}`, updates);
      const leads = this.mapLeads(response.data);
      return leads[0];
    } catch (error) {
      throw this.handleError(error, `Failed to update lead ${leadId} status`);
    }
  }

  async addLead(lead: Partial<Lead>): Promise<Lead> {
    try {
      const leadData = {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        county: lead.county,
        excess_funds_amount: lead.excessFundsAmount,
        source: lead.source,
        status: lead.status || 'new',
        priority: lead.priority || 'medium',
        case_number: lead.caseNumber,
        sale_date: lead.saleDate,
        expiration_date: lead.expirationDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const response = await this.client.post('/leads', leadData);
      const leads = this.mapLeads(response.data);
      return leads[0];
    } catch (error) {
      throw this.handleError(error, 'Failed to add lead');
    }
  }

  async getLeadsMissingARV(limit: number = 50): Promise<LeadMissingARV[]> {
    try {
      const response = await this.client.get(
        `/leads?select=id,name,address,city,state,zip,excess_funds_amount,created_at&arv=is.null&order=created_at.desc&limit=${limit}`
      );
      return response.data.map((lead: Record<string, unknown>) => ({
        id: lead.id as string,
        name: lead.name as string,
        address: lead.address as string,
        city: lead.city as string | undefined,
        state: lead.state as string | undefined,
        zip: lead.zip as string | undefined,
        excessFundsAmount: lead.excess_funds_amount as number | undefined,
        createdAt: lead.created_at as string,
      }));
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch leads missing ARV');
    }
  }

  async updateLeadARV(leadId: string, arv: number, repairEstimate?: number): Promise<LeadWithARV> {
    try {
      const maxOffer = arv * ARV_MULTIPLIER - (repairEstimate || 0);
      
      const updates = {
        arv,
        repair_estimate: repairEstimate || 0,
        offer_price: maxOffer,
        updated_at: new Date().toISOString(),
      };
      
      const response = await this.client.patch(`/leads?id=eq.${leadId}`, updates);
      return {
        id: leadId,
        arv,
        offerPrice: maxOffer,
        repairEstimate: repairEstimate || 0,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw this.handleError(error, `Failed to update ARV for lead ${leadId}`);
    }
  }

  async getLeadsReadyForAgreement(limit: number = 20): Promise<Lead[]> {
    try {
      const response = await this.client.get(
        `/leads?select=*&status=in.(interested,negotiating)&agreement_status=is.null&phone=not.is.null&order=eleanor_score.desc&limit=${limit}`
      );
      return this.mapLeads(response.data);
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch leads ready for agreement');
    }
  }

  async getExpiringLeads(days: number = 7): Promise<Lead[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const response = await this.client.get(
        `/leads?select=*&expiration_date=lte.${futureDateStr}&status=not.in.(closed,dead)&order=expiration_date.asc&limit=50`
      );
      return this.mapLeads(response.data);
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch expiring leads');
    }
  }

  // ============ Agreement Operations ============

  async updateAgreementStatus(
    leadId: string,
    agreementId: string,
    status: string,
    sentVia?: string,
    agreementUrl?: string
  ): Promise<void> {
    try {
      await this.client.patch(`/leads?id=eq.${leadId}`, {
        agreement_id: agreementId,
        agreement_status: status,
        agreement_sent_at: new Date().toISOString(),
        agreement_url: agreementUrl,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to update agreement status');
    }
  }

  async markAgreementSigned(leadId: string): Promise<void> {
    try {
      await this.client.patch(`/leads?id=eq.${leadId}`, {
        agreement_status: 'signed',
        status: 'under_contract',
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      throw this.handleError(error, `Failed to mark agreement signed for lead ${leadId}`);
    }
  }

  // ============ Agent Memory Operations ============

  async logAgentAction(action: AgentAction): Promise<AgentAction> {
    try {
      const response = await this.client.post('/agent_memories', {
        agent_name: action.agentName,
        action_type: action.actionType,
        action_details: action.actionDetails,
        lead_id: action.leadId,
        success: action.success,
        error_message: action.errorMessage,
        timestamp: action.timestamp || new Date().toISOString(),
        duration: action.duration,
      });
      return response.data[0];
    } catch (error) {
      throw this.handleError(error, 'Failed to log agent action');
    }
  }

  async getAgentLogs(filter: AgentLogFilter): Promise<AgentAction[]> {
    try {
      let query = '/agent_memories?select=*';
      
      if (filter.agentName) query += `&agent_name=eq.${filter.agentName}`;
      if (filter.actionType) query += `&action_type=eq.${filter.actionType}`;
      if (filter.leadId) query += `&lead_id=eq.${filter.leadId}`;
      if (filter.success !== undefined) query += `&success=eq.${filter.success}`;
      if (filter.startDate) query += `&timestamp=gte.${filter.startDate}`;
      if (filter.endDate) query += `&timestamp=lte.${filter.endDate}`;
      
      query += `&order=timestamp.desc&limit=${filter.limit || 50}`;
      
      const response = await this.client.get(query);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch agent logs');
    }
  }

  // ============ Stats Operations ============

  async getStats(): Promise<Record<string, number>> {
    try {
      // Get counts for different statuses
      const [totalRes, newRes, goldenRes, contractRes, closedRes] = await Promise.all([
        this.client.get('/leads?select=id', { headers: { 'Prefer': 'count=exact' } }),
        this.client.get('/leads?select=id&status=eq.new', { headers: { 'Prefer': 'count=exact' } }),
        this.client.get('/leads?select=id&is_golden_lead=eq.true', { headers: { 'Prefer': 'count=exact' } }),
        this.client.get('/leads?select=id&status=eq.under_contract', { headers: { 'Prefer': 'count=exact' } }),
        this.client.get('/leads?select=id&status=eq.closed', { headers: { 'Prefer': 'count=exact' } }),
      ]);
      
      // Extract counts from content-range header
      const extractCount = (res: { headers: { 'content-range'?: string } }): number => {
        const range = res.headers['content-range'];
        if (range) {
          const match = range.match(/\/(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        }
        return 0;
      };
      
      return {
        totalLeads: extractCount(totalRes),
        newLeads: extractCount(newRes),
        goldenLeads: extractCount(goldenRes),
        underContract: extractCount(contractRes),
        closed: extractCount(closedRes),
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch stats');
    }
  }

  async getMorningBrief(): Promise<MorningBrief> {
    try {
      const [stats, golden, expiring, agentLogs] = await Promise.all([
        this.getStats(),
        this.getGoldenLeads(5),
        this.getExpiringLeads(7),
        this.getAgentLogs({ limit: 100 }),
      ]);
      
      // Calculate agent activity stats
      const agentActivity = this.calculateAgentStats(agentLogs);
      
      // Calculate pipeline value
      const pipelineValue = golden.reduce((sum, lead) => sum + (lead.excessFundsAmount || 0), 0);
      const expectedRevenue = pipelineValue * COMPANY_INFO.excessFundsFeePercent;
      
      return {
        date: new Date().toISOString().split('T')[0],
        totalLeads: stats.totalLeads,
        newLeadsToday: stats.newLeads,
        goldenLeads: stats.goldenLeads,
        expiringIn7Days: expiring.length,
        needsFollowUp: 0, // Would need additional query
        agreementsPending: 0, // Would need additional query
        agreementsSigned: stats.underContract,
        agentActivity,
        topPriorityLeads: golden,
        pipelineValue,
        expectedRevenue,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to generate morning brief');
    }
  }

  // ============ SMS Logging ============

  async logSMS(sms: SMSLog): Promise<SMSLog> {
    try {
      const response = await this.client.post('/sms_logs', {
        lead_id: sms.leadId,
        direction: sms.direction,
        message: sms.message,
        from_number: sms.fromNumber,
        to_number: sms.toNumber,
        status: sms.status,
        twilio_sid: sms.twilioSid,
        timestamp: sms.timestamp || new Date().toISOString(),
      });
      return response.data[0];
    } catch (error) {
      throw this.handleError(error, 'Failed to log SMS');
    }
  }

  // ============ Helper Methods ============

  private mapLeads(data: Record<string, unknown>[]): Lead[] {
    return data.map(lead => ({
      id: lead.id as string,
      name: lead.name as string,
      phone: lead.phone as string | undefined,
      email: lead.email as string | undefined,
      address: lead.address as string,
      city: lead.city as string | undefined,
      state: lead.state as string | undefined,
      zip: lead.zip as string | undefined,
      county: lead.county as string | undefined,
      status: lead.status as string,
      priority: lead.priority as string | undefined,
      source: lead.source as string | undefined,
      excessFundsAmount: lead.excess_funds_amount as number | undefined,
      arv: lead.arv as number | undefined,
      offerPrice: lead.offer_price as number | undefined,
      repairEstimate: lead.repair_estimate as number | undefined,
      zestimate: lead.zestimate as number | undefined,
      beds: lead.beds as number | undefined,
      baths: lead.baths as number | undefined,
      sqft: lead.sqft as number | undefined,
      yearBuilt: lead.year_built as number | undefined,
      lotSize: lead.lot_size as number | undefined,
      propertyType: lead.property_type as string | undefined,
      eleanorScore: lead.eleanor_score as number | undefined,
      eleanorReason: lead.eleanor_reason as string | undefined,
      isGoldenLead: lead.is_golden_lead as boolean | undefined,
      saleDate: lead.sale_date as string | undefined,
      expirationDate: lead.expiration_date as string | undefined,
      caseNumber: lead.case_number as string | undefined,
      agreementStatus: lead.agreement_status as string | undefined,
      agreementId: lead.agreement_id as string | undefined,
      agreementSentAt: lead.agreement_sent_at as string | undefined,
      lastContactAt: lead.last_contact_at as string | undefined,
      nextFollowupAt: lead.next_followup_at as string | undefined,
      notes: lead.notes as string | undefined,
      metadata: lead.metadata as Record<string, unknown> | undefined,
      createdAt: lead.created_at as string,
      updatedAt: lead.updated_at as string,
    }));
  }

  private calculateAgentStats(logs: AgentAction[]): AgentStats[] {
    const agentMap = new Map<string, { total: number; success: number; error: number; durations: number[]; lastAction: string }>();
    
    for (const log of logs) {
      const stats = agentMap.get(log.agentName) || { total: 0, success: 0, error: 0, durations: [], lastAction: '' };
      stats.total++;
      if (log.success) stats.success++;
      else stats.error++;
      if (log.duration) stats.durations.push(log.duration);
      if (!stats.lastAction || log.timestamp > stats.lastAction) stats.lastAction = log.timestamp;
      agentMap.set(log.agentName, stats);
    }
    
    return Array.from(agentMap.entries()).map(([name, stats]) => ({
      agentName: name,
      totalActions: stats.total,
      successCount: stats.success,
      errorCount: stats.error,
      averageDuration: stats.durations.length > 0 
        ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
        : 0,
      lastActionAt: stats.lastAction,
    }));
  }

  private handleError(error: unknown, context: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      return new Error(`${context}: [${status}] ${message}`);
    }
    return new Error(`${context}: ${String(error)}`);
  }
}

// ============ Telegram Client ============
class TelegramClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  }

  async sendMessage(
    chatId: string,
    text: string,
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2',
    disableNotification?: boolean
  ): Promise<TelegramResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/sendMessage`,
        {
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_notification: disableNotification,
        },
        { timeout: API_TIMEOUT_MS }
      );
      
      return {
        ok: response.data.ok,
        messageId: response.data.result?.message_id,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          ok: false,
          error: error.response?.data?.description || error.message,
        };
      }
      return {
        ok: false,
        error: String(error),
      };
    }
  }

  async sendMorningBrief(chatId: string, brief: MorningBrief): Promise<TelegramResponse> {
    const message = `
🌅 <b>MaxSam Morning Brief - ${brief.date}</b>

📊 <b>PIPELINE OVERVIEW</b>
• Total Leads: ${brief.totalLeads}
• New Today: ${brief.newLeadsToday}
• Golden Leads: ${brief.goldenLeads} 🏆
• Expiring in 7 Days: ${brief.expiringIn7Days} ⚠️

💰 <b>REVENUE POTENTIAL</b>
• Pipeline Value: $${brief.pipelineValue.toLocaleString()}
• Expected Revenue: $${brief.expectedRevenue.toLocaleString()}

🤖 <b>AGENT ACTIVITY</b>
${brief.agentActivity.map(a => `• ${a.agentName}: ${a.totalActions} actions (${a.successCount} ✅)`).join('\n')}

🔥 <b>TOP PRIORITY LEADS</b>
${brief.topPriorityLeads.slice(0, 5).map(l => 
  `• ${l.name} - $${(l.excessFundsAmount || 0).toLocaleString()}`
).join('\n')}

<i>Ready to close deals! 🚀</i>
    `.trim();

    return this.sendMessage(chatId, message, 'HTML');
  }
}

// Export singleton instances
export const n8nClient = new N8NClient();
export const supabaseClient = new SupabaseClient();
export const telegramClient = new TelegramClient();
