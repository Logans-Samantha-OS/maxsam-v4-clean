# Provider-Agnostic Signing Abstraction

## Overview

MaxSam V4 implements a **provider-agnostic e-signature abstraction layer** that allows swapping signing providers via a single environment variable, with zero code changes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROVIDER-AGNOSTIC ARCHITECTURE                           │
│                                                                              │
│   /api/signing/create ──┐                                                   │
│   /api/signing/send ────┼──→ SigningAdapter ──→ JotFormSignAdapter          │
│   /api/signing/webhook ─┘        │                SignWellAdapter           │
│                                  │                DropboxSignAdapter (stub) │
│                                  │                DocuSignAdapter (stub)    │
│                                  ▼                                          │
│                          getPrimaryAdapter()                                │
│                          ────────────────                                   │
│                          PRIMARY_SIGN_PROVIDER env var                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start: Switching Providers

### Step 1: Set Environment Variable

```bash
# In .env.local or Vercel environment

# Option A: JotForm Sign (default)
PRIMARY_SIGN_PROVIDER=jotform_sign

# Option B: SignWell
PRIMARY_SIGN_PROVIDER=signwell

# Future options:
# PRIMARY_SIGN_PROVIDER=dropbox_sign
# PRIMARY_SIGN_PROVIDER=docusign
```

### Step 2: Configure Provider-Specific Credentials

**JotForm Sign:**
```bash
JOTFORM_API_KEY=your_api_key
JOTFORM_EXCESS_FUNDS_FORM_ID=form_id_for_excess_funds
JOTFORM_WHOLESALE_FORM_ID=form_id_for_wholesale
JOTFORM_WEBHOOK_SECRET=optional_webhook_secret
```

**SignWell:**
```bash
SIGNWELL_API_KEY=your_api_key
SIGNWELL_EXCESS_FUNDS_TEMPLATE_ID=template_id
SIGNWELL_WHOLESALE_TEMPLATE_ID=template_id
SIGNWELL_WEBHOOK_SECRET=webhook_signing_secret
```

### Step 3: Deploy

No code changes required. The system automatically uses the configured provider.

---

## API Routes

### POST /api/signing/create

Create a new agreement packet. Idempotent - returns existing packet if one is active.

```bash
curl -X POST https://your-domain/api/signing/create \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "uuid-of-lead",
    "selection_code": 3,
    "triggered_by": "sms",
    "source_message_sid": "SMxxx"
  }'
```

**Response:**
```json
{
  "success": true,
  "packetId": "uuid",
  "status": "READY_TO_SEND",
  "signingLink": "https://...",
  "idempotent": false
}
```

### POST /api/signing/send

Send a packet for signing via SMS and/or email.

```bash
curl -X POST https://your-domain/api/signing/send \
  -H "Content-Type: application/json" \
  -d '{
    "packet_id": "uuid",
    "delivery_method": "both"
  }'
```

**delivery_method options:**
- `sms` - SMS only
- `email` - Email only
- `both` - Both SMS and email (default)

**Response:**
```json
{
  "success": true,
  "packet_id": "uuid",
  "signing_link": "https://...",
  "sms_sent": true,
  "email_sent": true
}
```

### POST /api/signing/webhook?provider=jotform_sign

Unified webhook endpoint for all providers.

```bash
# Provider-specific payload from JotForm, SignWell, etc.
POST /api/signing/webhook?provider=jotform_sign
```

**Query params:**
- `provider` - Provider identifier (optional, auto-detected if omitted)

**Response:**
```json
{
  "success": true,
  "event_type": "SIGNED",
  "packet_id": "uuid"
}
```

### GET /api/signing/status/[packetId]

Get current status of a packet.

```bash
curl https://your-domain/api/signing/status/uuid-of-packet
```

**Response:**
```json
{
  "success": true,
  "packetId": "uuid",
  "status": "SENT",
  "documents": [...],
  "signingLink": "https://...",
  "signedAt": null
}
```

---

## Domain Models

### AgreementPacket

```typescript
interface AgreementPacket {
  id: string;
  leadId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone: string;
  propertyAddress?: string;
  caseNumber?: string;

  // Selection: 1=Excess, 2=Wholesale, 3=Both
  selectionCode: 1 | 2 | 3;

  // Financial
  excessFundsAmount?: number;
  estimatedEquity?: number;
  calculatedExcessFee?: number;
  calculatedWholesaleFee?: number;
  totalFee?: number;

  // Provider abstraction
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

  // Documents
  documents: AgreementPacketDocument[];
}
```

### AgreementPacketStatus

```typescript
enum AgreementPacketStatus {
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
```

### AgreementType

```typescript
enum AgreementType {
  EXCESS_FUNDS = 'EXCESS_FUNDS',           // 25% fee
  WHOLESALE_ASSIGNMENT = 'WHOLESALE_ASSIGNMENT', // 10% fee
}
```

---

## SigningAdapter Interface

All providers implement this interface:

```typescript
interface SigningAdapter {
  readonly provider: SigningProvider;

  // Check if provider is configured
  isConfigured(): boolean;

  // Create signing packet with provider
  createPacket(
    packet: AgreementPacket,
    documents: AgreementType[]
  ): Promise<CreatePacketResponse>;

  // Send packet for signing
  sendPacket(packet: AgreementPacket): Promise<SendPacketResponse>;

  // Get current status from provider
  getPacketStatus(providerPacketId: string): Promise<PacketStatusResponse>;

  // Download signed documents
  downloadSignedDocuments(providerPacketId: string): Promise<DownloadSignedDocsResponse>;

  // Verify webhook signature
  verifyWebhook(payload: WebhookPayload): Promise<WebhookVerifyResult>;

  // Normalize provider webhook to canonical event
  normalizeWebhook(payload: WebhookPayload): Promise<NormalizedWebhookEvent>;
}
```

---

## Implementing a New Provider

### Step 1: Create Adapter File

```typescript
// lib/signing/adapters/my-provider-adapter.ts

import { SigningAdapter, registerAdapter } from '../adapter';
import { SigningProvider } from '../types';

class MyProviderAdapter implements SigningAdapter {
  readonly provider = SigningProvider.MY_PROVIDER;

  isConfigured(): boolean {
    return !!process.env.MY_PROVIDER_API_KEY;
  }

  async createPacket(packet, documents) {
    // Provider-specific implementation
  }

  // ... implement all interface methods
}

// Register on module load
export const myProviderAdapter = new MyProviderAdapter();
registerAdapter(myProviderAdapter);
```

### Step 2: Add to Types

```typescript
// lib/signing/types.ts

export enum SigningProvider {
  JOTFORM_SIGN = 'jotform_sign',
  SIGNWELL = 'signwell',
  MY_PROVIDER = 'my_provider', // Add new provider
}
```

### Step 3: Import in Index

```typescript
// lib/signing/index.ts

import './adapters/my-provider-adapter';
```

### Step 4: Configure Environment

```bash
PRIMARY_SIGN_PROVIDER=my_provider
MY_PROVIDER_API_KEY=xxx
```

---

## Webhook Event Flow

```
Provider Webhook → /api/signing/webhook
                        │
                        ▼
              ┌─────────────────┐
              │ verifyWebhook() │  ← Signature validation
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ normalizeWebhook│  ← Map to canonical event
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ handleWebhookEvent│
              └────────┬────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
    Update Supabase          Log Event
    (agreement_packets)    (agreement_events)
```

### Normalized Event Types

```typescript
enum AgreementEventType {
  CREATED = 'CREATED',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  SIGNED = 'SIGNED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  VOIDED = 'VOIDED',
  FAILED = 'FAILED',
  REMINDER_SENT = 'REMINDER_SENT',
  STATUS_CHANGED = 'STATUS_CHANGED',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
}
```

---

## n8n Integration

### V2 Workflows (Recommended)

Use the V2 workflows that delegate to `/api/signing/*` routes:

- `n8n/agreement_dispatch_workflow_v2.json` - Calls `/api/signing/create` + `/api/signing/send`
- `n8n/agreement_completion_workflow_v2.json` - Handles webhook events, downloads PDFs

### Environment Variables for n8n

```bash
# In n8n environment
APP_URL=https://your-domain.vercel.app
JOTFORM_API_KEY=xxx
SIGNWELL_API_KEY=xxx
TELEGRAM_CHAT_ID=xxx
TWILIO_PHONE_NUMBER=+1xxx
```

---

## Database Tables

### agreement_packets
Main tracking table for signing packets.

### agreement_documents
Individual documents within a packet (supports multi-document scenarios).

### agreement_events
**Append-only audit trail**. Updates and deletes are blocked by trigger.

```sql
-- Events cannot be modified
CREATE TRIGGER enforce_append_only_events
BEFORE UPDATE OR DELETE ON agreement_events
FOR EACH ROW
EXECUTE FUNCTION prevent_event_modification();
```

---

## Fee Calculation

```typescript
function calculateFees(selectionCode, excessAmount, equity) {
  let excessFee = 0;
  let wholesaleFee = 0;

  if (selectionCode === 1 || selectionCode === 3) {
    excessFee = excessAmount * 0.25; // 25%
  }

  if (selectionCode === 2 || selectionCode === 3) {
    wholesaleFee = equity * 0.10; // 10%
  }

  return { excessFee, wholesaleFee, totalFee: excessFee + wholesaleFee };
}
```

---

## Testing Provider Switch

1. **Set up test lead** in Supabase
2. **Configure JotForm** and verify it works
3. **Change env var** to `PRIMARY_SIGN_PROVIDER=signwell`
4. **Configure SignWell** credentials
5. **Redeploy** (no code changes)
6. **Test again** - should use SignWell

---

## Troubleshooting

### Provider Not Found
```
Error: No signing provider configured. Set PRIMARY_SIGN_PROVIDER env var.
```
→ Set `PRIMARY_SIGN_PROVIDER` to a valid provider

### Provider Not Configured
```
Error: jotform_sign is not configured. Check environment variables.
```
→ Set provider-specific credentials (`JOTFORM_API_KEY`, etc.)

### Webhook Verification Failed
```
Error: Invalid webhook signature
```
→ Check webhook secret matches provider configuration

### Idempotent Response
```json
{ "success": true, "idempotent": true, "existingPacketId": "..." }
```
→ Normal - active packet already exists for this lead/selection

---

## File Locations

```
lib/signing/
├── types.ts              # Domain models & enums
├── adapter.ts            # SigningAdapter interface & registry
├── index.ts              # Entry point & orchestration
└── adapters/
    ├── jotform-adapter.ts   # JotForm Sign implementation
    └── signwell-adapter.ts  # SignWell implementation (full)

app/api/signing/
├── create/route.ts       # POST /api/signing/create
├── send/route.ts         # POST /api/signing/send
├── webhook/route.ts      # POST /api/signing/webhook
└── status/[packetId]/route.ts  # GET /api/signing/status/:id

supabase/migrations/
├── 20260120150000_agreement_automation.sql      # Base tables
└── 20260120160000_agreement_events_append_only.sql  # Append-only enforcement

n8n/
├── agreement_dispatch_workflow_v2.json    # Provider-agnostic dispatch
└── agreement_completion_workflow_v2.json  # Provider-agnostic completion
```
