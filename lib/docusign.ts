/**
 * DocuSign Integration for MaxSam V4
 * Handles JWT authentication and envelope creation for contracts
 */

interface DocuSignConfig {
  accountId: string;
  userId: string;
  integrationKey: string;
  privateKey: string;
  baseUrl: string;
  authServer: string;
}

interface DocuSignToken {
  access_token: string;
  expires_at: number;
}

// Cache token to avoid repeated auth calls
let cachedToken: DocuSignToken | null = null;

/**
 * Get DocuSign configuration from environment
 */
function getConfig(): DocuSignConfig {
  const config = {
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || '',
    userId: process.env.DOCUSIGN_USER_ID || '',
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || '',
    privateKey: (process.env.DOCUSIGN_RSA_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    baseUrl: process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi',
    authServer: process.env.DOCUSIGN_AUTH_SERVER || 'https://account-d.docusign.com'
  };

  return config;
}

/**
 * Check if DocuSign is configured
 */
export function isDocuSignConfigured(): boolean {
  const config = getConfig();
  return !!(
    config.accountId &&
    config.userId &&
    config.integrationKey &&
    config.privateKey
  );
}

/**
 * Generate JWT assertion for DocuSign auth
 */
async function generateJWTAssertion(config: DocuSignConfig): Promise<string> {
  // In production, you'd use a proper JWT library
  // For now, we'll use the jose library pattern
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.integrationKey,
    sub: config.userId,
    aud: config.authServer.replace('https://', ''),
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation'
  };

  // Base64URL encode
  const base64UrlEncode = (obj: object | string) => {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    const base64 = Buffer.from(json).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // Sign with RSA-SHA256
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();

  const signature = sign.sign(config.privateKey, 'base64');
  const signatureB64 = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signingInput}.${signatureB64}`;
}

/**
 * Get access token using JWT Grant
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && cachedToken.expires_at > Date.now() + 60000) {
    return cachedToken.access_token;
  }

  const config = getConfig();

  if (!isDocuSignConfigured()) {
    throw new Error('DocuSign not configured. Set DOCUSIGN_* environment variables.');
  }

  try {
    const assertion = await generateJWTAssertion(config);

    const response = await fetch(`${config.authServer}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      })
    });

    if (!response.ok) {
      const error = await response.json();

      if (error.error === 'consent_required') {
        const consentUrl = `${config.authServer}/oauth/auth?` +
          `response_type=code&` +
          `scope=signature%20impersonation&` +
          `client_id=${config.integrationKey}&` +
          `redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL + '/api/docusign/callback')}`;

        throw new Error(`CONSENT_REQUIRED:${consentUrl}`);
      }

      throw new Error(`DocuSign auth failed: ${error.error || response.statusText}`);
    }

    const data = await response.json();

    cachedToken = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };

    return data.access_token;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('DocuSign auth error:', errorMessage);
    throw error;
  }
}

/**
 * Create and send an envelope
 */
export async function createEnvelope(options: {
  templateHtml: string;
  emailSubject: string;
  signers: Array<{
    email: string;
    name: string;
    recipientId: string;
    routingOrder: string;
    anchorStrings?: { signHere?: string; dateSigned?: string };
  }>;
  status?: 'created' | 'sent';
}): Promise<{ envelopeId: string; status: string }> {
  const config = getConfig();
  const accessToken = await getAccessToken();

  const envelope = {
    emailSubject: options.emailSubject,
    documents: [{
      documentBase64: Buffer.from(options.templateHtml).toString('base64'),
      name: 'Agreement.html',
      fileExtension: 'html',
      documentId: '1'
    }],
    recipients: {
      signers: options.signers.map(signer => ({
        email: signer.email,
        name: signer.name,
        recipientId: signer.recipientId,
        routingOrder: signer.routingOrder,
        tabs: {
          signHereTabs: signer.anchorStrings?.signHere ? [{
            anchorString: signer.anchorStrings.signHere,
            anchorUnits: 'pixels',
            anchorXOffset: '0',
            anchorYOffset: '0'
          }] : [],
          dateSignedTabs: signer.anchorStrings?.dateSigned ? [{
            anchorString: signer.anchorStrings.dateSigned,
            anchorUnits: 'pixels',
            anchorXOffset: '0',
            anchorYOffset: '0'
          }] : []
        }
      }))
    },
    status: options.status || 'sent'
  };

  const response = await fetch(
    `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(envelope)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`DocuSign envelope creation failed: ${error.message || response.statusText}`);
  }

  const result = await response.json();

  return {
    envelopeId: result.envelopeId,
    status: result.status
  };
}

/**
 * Get envelope status
 */
export async function getEnvelopeStatus(envelopeId: string): Promise<{
  status: string;
  statusDateTime: string;
  sentDateTime?: string;
  deliveredDateTime?: string;
  completedDateTime?: string;
}> {
  const config = getConfig();
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get envelope status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get signed document
 */
export async function getSignedDocument(envelopeId: string): Promise<Buffer> {
  const config = getConfig();
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/combined`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get signed document: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Void an envelope (cancel it)
 */
export async function voidEnvelope(envelopeId: string, voidReason: string): Promise<void> {
  const config = getConfig();
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'voided',
        voidedReason: voidReason
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to void envelope: ${error.message || response.statusText}`);
  }
}
