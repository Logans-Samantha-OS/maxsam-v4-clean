/**
 * OS Types - Operator System (Trusted)
 *
 * These types are for the OS layer only.
 * Contains execution payloads, internal states, and full lead data.
 */

import { ActionType, LeadStatus, ApprovalStatus } from './shared';

/**
 * Full lead data - includes all internal fields
 * Only accessible via OS authority
 */
export interface LeadInternal {
  id: string;
  owner_name: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  excess_funds_amount: number | null;
  eleanor_score: number | null;
  eleanor_reasoning: string[] | null;
  deal_grade: string | null;
  deal_type: string | null;
  contact_priority: string | null;
  status: LeadStatus | string | null;
  contact_attempts: number | null;
  last_contact_date: string | null;
  phone: string | null;
  phone_1: string | null;
  phone_2: string | null;
  email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * OS Execute Request - Direct execution command
 */
export interface OSExecuteRequest {
  leadId: string;
  actionType: ActionType;
}

/**
 * OS Execute Response - Result of execution
 */
export interface OSExecuteResponse {
  ok: boolean;
  updatedLead?: LeadInternal;
  eventId?: string;
  error?: string;
}

/**
 * OS Approval Decision Request
 */
export interface OSApprovalDecisionRequest {
  note?: string;
  createQueuedAction?: boolean;
}

/**
 * OS Approval Response
 */
export interface OSApprovalResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: ApprovalStatus;
    decided_at: string;
  };
  queuedActionId?: string;
  error?: string;
}

/**
 * Activity Event - Logged for all OS executions
 */
export interface ActivityEvent {
  id: string;
  lead_id: string;
  action_type: ActionType;
  actor: 'os' | 'ralph' | 'sam';
  result: 'success' | 'failed' | 'pending';
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Map of action types to resulting lead status
 */
export const ACTION_STATUS_MAP: Partial<Record<ActionType, LeadStatus>> = {
  send_sms: 'contacted',
  send_followup: 'contacted',
  call_now: 'contacted',
  score_lead: 'new',
  generate_contract: 'contract_sent',
  send_contract: 'contract_sent',
  escalate_human: 'negotiating',
};
