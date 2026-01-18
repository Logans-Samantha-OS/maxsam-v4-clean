/**
 * Shared Types - Used by both OS and SaaS layers
 *
 * These types represent the public contract between layers.
 * Keep minimal and stable.
 */

export type Authority = 'os' | 'saas';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'awaiting_response'
  | 'qualified'
  | 'interested'
  | 'negotiating'
  | 'contract_sent'
  | 'contract_signed'
  | 'closed'
  | 'rejected'
  | 'dead'
  | 'opted_out';

export type ActionType =
  | 'send_sms'
  | 'send_followup'
  | 'call_now'
  | 'skip_trace'
  | 'score_lead'
  | 'generate_contract'
  | 'send_contract'
  | 'escalate_human';

export type RequestType =
  | 'contact_request'
  | 'contract_request'
  | 'info_request'
  | 'escalation_request';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * LeadPublic - Safe for SaaS consumption
 * No internal scoring details, agent reasoning, or autonomy metadata
 */
export interface LeadPublic {
  id: string;
  owner_name: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  excess_funds_amount: number | null;
  eleanor_score: number | null;
  status: LeadStatus | string | null;
  updated_at: string | null;
}

/**
 * SaaSRequest - A request from SaaS layer awaiting OS approval
 */
export interface SaaSRequest {
  id: string;
  lead_id: string;
  request_type: RequestType;
  note: string | null;
  status: ApprovalStatus;
  created_at: string;
  resolved_at: string | null;
}

/**
 * Approval - OS decision on a SaaS request
 */
export interface Approval {
  id: string;
  lead_id: string;
  request_id: string;
  status: ApprovalStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}
