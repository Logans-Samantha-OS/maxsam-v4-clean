// MaxSam N8N MCP Server Constants - Complete v2.1

// N8N Configuration
export const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://skooki.app.n8n.cloud';
export const N8N_API_KEY = process.env.N8N_API_KEY || '';

// Supabase Configuration
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Telegram Configuration
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_DEFAULT_CHAT_ID = process.env.TELEGRAM_DEFAULT_CHAT_ID || '';

// Webhook Endpoints
export const WEBHOOK_ENDPOINTS = {
  skipTrace: '/webhook/skip-trace',
  samInitialOutreach: '/webhook/sam-initial-outreach',
  eleanorScore: '/webhook/eleanor-score',
  sendAgreement: '/webhook/send-agreement',
  dealBlast: '/webhook/deal-blast',
  alexCore: '/webhook/alex',
  morningBrief: '/webhook/morning-brief',
  pdfIngestion: '/webhook/pdf-ingestion',
} as const;

// Property Calculation Constants
export const ARV_MULTIPLIER = 0.70;  // 70% of ARV for max offer
export const DEFAULT_WHOLESALE_FEE_PERCENT = 0.10;  // 10% wholesale fee
export const BUYBOX_LIST_MIN_MULTIPLIER = 0.75;  // 75% of ARV for min list
export const BUYBOX_LIST_MAX_MULTIPLIER = 0.82;  // 82% of ARV for max list
export const DEFAULT_REPAIR_ESTIMATE = 0;  // Default repair estimate

// MaxSam Recovery Services Company Info
export const COMPANY_INFO = {
  name: 'MaxSam Recovery Services',
  address: '123 Main St, Richardson, TX 75080',
  phone: '+1-555-MAXSAM',
  email: 'deals@maxsamrecovery.com',
  excessFundsFeePercent: 0.25,  // 25% of excess funds recovered
  wholesaleFeePercent: 0.10,    // 10% wholesale assignment fee
} as const;

// Agent Names
export const AGENT_NAMES = ['ALEX', 'ELEANOR', 'SAM'] as const;

// Lead Statuses
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'interested',
  'negotiating',
  'under_contract',
  'closed',
  'dead',
  'not_interested',
  'no_answer',
  'wrong_number',
] as const;

// Lead Priorities
export const LEAD_PRIORITIES = [
  'critical',
  'high',
  'medium',
  'low',
] as const;

// Character limit for responses
export const CHARACTER_LIMIT = 50000;

// API Timeouts
export const API_TIMEOUT_MS = 30000;
export const WEBHOOK_TIMEOUT_MS = 10000;

// N8N Workflow IDs (update these with your actual workflow IDs)
export const WORKFLOW_IDS = {
  coreAlex: process.env.N8N_WORKFLOW_CORE_ALEX || 'wzMFvhMdrXy2yj8W',
  skipTrace: process.env.N8N_WORKFLOW_SKIP_TRACE || '',
  samOutreach: process.env.N8N_WORKFLOW_SAM_OUTREACH || '',
  eleanorScore: process.env.N8N_WORKFLOW_ELEANOR_SCORE || '',
  morningBrief: process.env.N8N_WORKFLOW_MORNING_BRIEF || '',
} as const;
