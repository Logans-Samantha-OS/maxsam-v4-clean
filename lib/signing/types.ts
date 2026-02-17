/**
 * Provider-Agnostic Signing Types
 * Domain model for agreement signing abstraction
 */

// ============================================================================
// Enums
// ============================================================================

export enum AgreementPacketStatus {
  DRAFT = 'DRAFT',
  READY_TO_SEND = 'READY_TO_SEND',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  PARTIALLY_SIGNED = 'PARTIALLY_SIGNED',
  SIGNED = 'SIGNED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  VOIDED = 'VOIDED',
}

export enum AgreementType {
  EXCESS_FUNDS = 'EXCESS_FUNDS',
  WHOLESALE_ASSIGNMENT = 'WHOLESALE_ASSIGNMENT',
}

export enum AgreementEventType {
  CREATED = 'CREATED',
  READY = 'READY',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  VIEWED = 'VIEWED',
  SIGNED = 'SIGNED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  VOIDED = 'VOIDED',
  REMINDER_SENT = 'REMINDER_SENT',
  PDF_DOWNLOADED = 'PDF_DOWNLOADED',
  PDF_STORED_DROPBOX = 'PDF_STORED_DROPBOX',
  PDF_STORED_GDRIVE = 'PDF_STORED_GDRIVE',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  ERROR = 'ERROR',
}

export enum SigningProvider {
  SELF_HOSTED = 'self_hosted',  // Primary: HMAC-signed tokens at /sign
  GMAIL_LINK = 'gmail_link',
  SIGNWELL = 'signwell',
  DROPBOX_SIGN = 'dropbox_sign',
  DOCUSIGN = 'docusign',
}

// ============================================================================
// Domain Models
// ============================================================================

export interface AgreementPacketDocument {
  id: string;
  packetId: string;
  agreementType: AgreementType;
  providerDocumentId?: string;
  status: 'pending' | 'signed' | 'declined';
  signedAt?: Date;
  signedPdfUrl?: string;
}

export interface AgreementPacket {
  id: string;
  leadId: string;

  // Client info
  clientName: string;
  clientEmail?: string;
  clientPhone: string;
  propertyAddress?: string;
  caseNumber?: string;

  // Selection (1 = Excess, 2 = Wholesale, 3 = Both)
  selectionCode: 1 | 2 | 3;

  // Financial
  excessFundsAmount?: number;
  estimatedEquity?: number;
  calculatedExcessFee?: number;
  calculatedWholesaleFee?: number;
  totalFee?: number;

  // Provider info (abstracted)
  provider: SigningProvider;
  providerPacketId?: string;
  signingLink?: string;
  signingLinkExpiresAt?: Date;

  // Status
  status: AgreementPacketStatus;

  // Timestamps
  createdAt: Date;
  sentAt?: Date;
  firstViewedAt?: Date;
  signedAt?: Date;
  expiredAt?: Date;

  // Reminders
  reminderCount: number;
  lastReminderAt?: Date;
  nextReminderAt?: Date;
  escalatedAt?: Date;

  // Storage
  signedPdfDropboxUrl?: string;
  signedPdfGdriveUrl?: string;
  signedPdfGdriveFileId?: string;

  // Source
  triggeredBy: 'sms' | 'ui' | 'api' | 'workflow';
  sourceMessageSid?: string;

  // Documents in packet
  documents: AgreementPacketDocument[];
}

export interface AgreementEvent {
  id: string;
  packetId: string;
  documentId?: string;
  eventType: AgreementEventType;
  provider?: SigningProvider;
  eventData: Record<string, unknown>;
  source: 'webhook' | 'api' | 'system' | 'user';
  sourceIp?: string;
  userAgent?: string;
  errorMessage?: string;
  errorCode?: string;
  createdAt: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreatePacketRequest {
  leadId: string;
  selectionCode: 1 | 2 | 3;
  clientName: string;
  clientEmail?: string;
  clientPhone: string;
  propertyAddress?: string;
  caseNumber?: string;
  excessFundsAmount?: number;
  estimatedEquity?: number;
  triggeredBy?: 'sms' | 'ui' | 'api' | 'workflow';
  sourceMessageSid?: string;
}

export interface CreatePacketResponse {
  success: boolean;
  packetId?: string;
  status?: AgreementPacketStatus;
  error?: string;
}

export interface SendPacketRequest {
  packetId: string;
  deliveryMethod?: 'sms' | 'email' | 'both';
}

export interface SendPacketResponse {
  success: boolean;
  signingLink?: string;
  smsSent?: boolean;
  emailSent?: boolean;
  error?: string;
}

export interface PacketStatusResponse {
  success: boolean;
  packetId?: string;
  status?: AgreementPacketStatus;
  documents?: AgreementPacketDocument[];
  signingLink?: string;
  signedAt?: Date;
  error?: string;
}

export interface DownloadSignedDocsResponse {
  success: boolean;
  documents?: Array<{
    agreementType: AgreementType;
    pdfBuffer?: Buffer;
    pdfUrl?: string;
  }>;
  error?: string;
}

export interface WebhookPayload {
  provider: SigningProvider;
  rawPayload: Record<string, unknown>;
  headers: Record<string, string>;
}

export interface NormalizedWebhookEvent {
  packetId?: string;
  providerPacketId?: string;
  eventType: AgreementEventType;
  documentId?: string;
  signerEmail?: string;
  signerName?: string;
  signerIp?: string;
  timestamp: Date;
  rawPayload: Record<string, unknown>;
}

export interface WebhookVerifyResult {
  valid: boolean;
  error?: string;
}
