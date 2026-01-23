/**
 * Signing Adapter Interface
 * Provider-agnostic abstraction for e-signature services
 *
 * Providers are swappable via env var: PRIMARY_SIGN_PROVIDER
 */

import {
  AgreementPacket,
  AgreementType,
  CreatePacketRequest,
  CreatePacketResponse,
  SendPacketResponse,
  PacketStatusResponse,
  DownloadSignedDocsResponse,
  WebhookPayload,
  NormalizedWebhookEvent,
  WebhookVerifyResult,
  SigningProvider,
} from './types';

// ============================================================================
// Adapter Interface
// ============================================================================

export interface SigningAdapter {
  /**
   * Provider identifier
   */
  readonly provider: SigningProvider;

  /**
   * Check if this adapter is properly configured
   */
  isConfigured(): boolean;

  /**
   * Create a signing packet with the provider
   * Returns provider-specific packet/document IDs
   */
  createPacket(
    packet: AgreementPacket,
    documents: AgreementType[]
  ): Promise<CreatePacketResponse & { providerPacketId?: string; signingLink?: string }>;

  /**
   * Send the packet for signing (generates signing link, sends notifications)
   */
  sendPacket(
    packet: AgreementPacket
  ): Promise<SendPacketResponse>;

  /**
   * Get current status from the provider
   */
  getPacketStatus(
    providerPacketId: string
  ): Promise<PacketStatusResponse>;

  /**
   * Download signed documents from the provider
   */
  downloadSignedDocuments(
    providerPacketId: string
  ): Promise<DownloadSignedDocsResponse>;

  /**
   * Verify webhook signature/authenticity
   */
  verifyWebhook(
    payload: WebhookPayload
  ): Promise<WebhookVerifyResult>;

  /**
   * Normalize provider-specific webhook to canonical event
   */
  normalizeWebhook(
    payload: WebhookPayload
  ): Promise<NormalizedWebhookEvent>;
}

// ============================================================================
// Adapter Registry
// ============================================================================

const adapters = new Map<SigningProvider, SigningAdapter>();

export function registerAdapter(adapter: SigningAdapter): void {
  adapters.set(adapter.provider, adapter);
}

export function getAdapter(provider: SigningProvider): SigningAdapter | null {
  return adapters.get(provider) || null;
}

export function getPrimaryAdapter(): SigningAdapter | null {
  const primaryProvider = (process.env.PRIMARY_SIGN_PROVIDER || 'jotform_sign') as SigningProvider;
  return getAdapter(primaryProvider);
}

export function listAdapters(): SigningProvider[] {
  return Array.from(adapters.keys());
}

export function getConfiguredAdapters(): SigningAdapter[] {
  return Array.from(adapters.values()).filter(a => a.isConfigured());
}

// ============================================================================
// Helper: Select documents based on selection code
// ============================================================================

export function getDocumentTypes(selectionCode: 1 | 2 | 3): AgreementType[] {
  switch (selectionCode) {
    case 1:
      return [AgreementType.EXCESS_FUNDS];
    case 2:
      return [AgreementType.WHOLESALE_ASSIGNMENT];
    case 3:
      return [AgreementType.EXCESS_FUNDS, AgreementType.WHOLESALE_ASSIGNMENT];
    default:
      return [];
  }
}

// ============================================================================
// Helper: Calculate fees
// ============================================================================

export function calculateFees(
  selectionCode: 1 | 2 | 3,
  excessFundsAmount: number = 0,
  estimatedEquity: number = 0,
  excessFeePercent: number = 25,
  wholesaleFeePercent: number = 10
): { excessFee: number; wholesaleFee: number; totalFee: number } {
  let excessFee = 0;
  let wholesaleFee = 0;

  if (selectionCode === 1 || selectionCode === 3) {
    excessFee = excessFundsAmount * (excessFeePercent / 100);
  }

  if (selectionCode === 2 || selectionCode === 3) {
    const equity = estimatedEquity || excessFundsAmount * 0.5;
    wholesaleFee = equity * (wholesaleFeePercent / 100);
  }

  return {
    excessFee,
    wholesaleFee,
    totalFee: excessFee + wholesaleFee,
  };
}
