/**
 * SaaS Types - Projection Layer (Untrusted)
 *
 * These types are for the SaaS layer only.
 * Read-only views and request payloads - no execution authority.
 */

import { LeadPublic, SaaSRequest, RequestType, ApprovalStatus } from './shared';

/**
 * SaaS Leads Response - Curated lead list
 */
export interface SaaSLeadsResponse {
  leads: LeadPublic[];
  total: number;
  page: number;
  limit: number;
}

/**
 * SaaS Create Request Payload
 */
export interface SaaSCreateRequestPayload {
  leadId: string;
  requestType: RequestType;
  note?: string;
}

/**
 * SaaS Create Request Response
 */
export interface SaaSCreateRequestResponse {
  ok: boolean;
  request?: SaaSRequest;
  error?: string;
}

/**
 * SaaS Requests List Response
 */
export interface SaaSRequestsResponse {
  requests: SaaSRequest[];
  total: number;
}

/**
 * SaaS Request Status - For tracking request lifecycle
 */
export interface SaaSRequestStatus {
  id: string;
  status: ApprovalStatus;
  created_at: string;
  resolved_at: string | null;
  lead_id: string;
  request_type: RequestType;
}
