// MaxSam N8N MCP Server Types - Complete v2.1

// ============ N8N Types ============
export interface N8NCredential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes?: N8NNode[];
  connections?: Record<string, unknown>;
  tags?: { id: string; name: string }[];
  settings?: Record<string, unknown>;
}

export interface N8NNode {
  name: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, unknown>;
}

export interface N8NExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  status: 'success' | 'error' | 'waiting' | 'running' | 'canceled';
  data?: {
    resultData?: {
      runData?: Record<string, unknown>;
      lastNodeExecuted?: string;
      error?: {
        message: string;
        stack?: string;
      };
    };
  };
  retryOf?: string;
  retrySuccessId?: string;
}

export interface N8NExecutionListParams {
  workflowId?: string;
  status?: 'success' | 'error' | 'waiting' | 'running' | 'canceled';
  limit?: number;
}

export interface WebhookTestResult {
  success: boolean;
  statusCode?: number;
  response?: unknown;
  error?: string;
  duration?: number;
}

// ============ Property/Zillow Types ============
export interface OfferCalculation {
  arv: number;
  repairs: number;
  maxOffer: number;
  formula: string;
  profitMargin: number;
  breakdownPercent: number;
}

export interface BuyBoxCalculation {
  purchasePrice: number;
  arv: number;
  recommendedListMin: number;
  recommendedListMax: number;
  wholesaleFee: number;
  expectedProfit: number;
  spreadPercent: number;
}

export interface LeadMissingARV {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  excessFundsAmount?: number;
  createdAt: string;
}

export interface LeadWithARV {
  id: string;
  arv: number;
  offerPrice?: number;
  repairEstimate?: number;
  updatedAt: string;
}

// ============ Agreement Types ============
export interface AgreementData {
  leadId: string;
  sellerName: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerAddress: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  legalDescription?: string;
  purchasePrice: number;
  earnestMoney: number;
  closingDate: string;
  closingDays: number;
  contingencies?: string[];
  additionalTerms?: string;
  generatedAt: string;
  buyerInfo: {
    name: string;
    company: string;
    address: string;
    phone: string;
    email: string;
  };
}

export interface AgreementStatus {
  leadId: string;
  agreementId: string;
  agreementUrl?: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'declined';
  sentVia: 'email' | 'sms' | 'docusign';
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
}

// ============ Telegram Types ============
export interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableNotification?: boolean;
}

export interface TelegramResponse {
  ok: boolean;
  messageId?: number;
  error?: string;
}

// ============ Agent Memory Types ============
export interface AgentAction {
  id?: string;
  agentName: 'ALEX' | 'ELEANOR' | 'SAM';
  actionType: string;
  actionDetails: Record<string, unknown>;
  leadId?: string;
  success: boolean;
  errorMessage?: string;
  timestamp: string;
  duration?: number;
}

export interface AgentLogFilter {
  agentName?: 'ALEX' | 'ELEANOR' | 'SAM';
  actionType?: string;
  leadId?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface AgentStats {
  agentName: string;
  totalActions: number;
  successCount: number;
  errorCount: number;
  averageDuration: number;
  lastActionAt: string;
}

// ============ Lead Types ============
export interface Lead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  status: string;
  priority?: string;
  source?: string;
  excessFundsAmount?: number;
  arv?: number;
  offerPrice?: number;
  repairEstimate?: number;
  zestimate?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  lotSize?: number;
  propertyType?: string;
  eleanorScore?: number;
  eleanorReason?: string;
  isGoldenLead?: boolean;
  saleDate?: string;
  expirationDate?: string;
  caseNumber?: string;
  agreementStatus?: string;
  agreementId?: string;
  agreementSentAt?: string;
  lastContactAt?: string;
  nextFollowupAt?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFilter {
  status?: string;
  priority?: string;
  isGoldenLead?: boolean;
  county?: string;
  minExcessFunds?: number;
  maxExcessFunds?: number;
  hasArv?: boolean;
  hasPhone?: boolean;
  limit?: number;
  offset?: number;
}

// ============ Morning Brief Types ============
export interface MorningBrief {
  date: string;
  totalLeads: number;
  newLeadsToday: number;
  goldenLeads: number;
  expiringIn7Days: number;
  needsFollowUp: number;
  agreementsPending: number;
  agreementsSigned: number;
  agentActivity: AgentStats[];
  topPriorityLeads: Lead[];
  pipelineValue: number;
  expectedRevenue: number;
}

// ============ SMS Types ============
export interface SMSLog {
  id?: string;
  leadId: string;
  direction: 'inbound' | 'outbound';
  message: string;
  fromNumber?: string;
  toNumber?: string;
  status?: string;
  twilioSid?: string;
  timestamp: string;
}

// ============ Config Types ============
export interface N8NConfig {
  baseUrl: string;
  apiKey: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface TelegramConfig {
  botToken: string;
  defaultChatId: string;
}

export interface MaxSamConfig {
  n8n: N8NConfig;
  supabase: SupabaseConfig;
  telegram: TelegramConfig;
}

// ============ Validation Types ============
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}
