/**
 * Stripe Integration for MaxSam V4
 * Handles invoice creation and payment collection
 */

import { createClient } from './supabase/server';

interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PUBLISHABLE_KEY
  );
}

/**
 * Get Stripe configuration
 */
function getConfig(): StripeConfig | null {
  if (!isStripeConfigured()) {
    console.warn('Stripe not configured. Set STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY');
    return null;
  }

  return {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
  };
}

/**
 * Make Stripe API request
 */
async function stripeRequest(
  endpoint: string,
  method: string = 'GET',
  body?: Record<string, string | number>
): Promise<{ data?: unknown; error?: string }> {
  const config = getConfig();
  if (!config) {
    return { error: 'Stripe not configured' };
  }

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    if (body && method !== 'GET') {
      options.body = new URLSearchParams(
        Object.entries(body).map(([k, v]) => [k, String(v)])
      ).toString();
    }

    const response = await fetch(`https://api.stripe.com/v1${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      return { error: data.error?.message || 'Stripe API error' };
    }

    return { data };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}

/**
 * Find or create a Stripe customer
 */
export async function findOrCreateCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<{ customerId?: string; error?: string }> {
  // Search for existing customer
  const searchResult = await stripeRequest(
    `/customers/search?query=email:'${encodeURIComponent(email)}'`
  );

  if (searchResult.error) {
    return { error: searchResult.error };
  }

  interface StripeCustomersResult {
    data?: Array<{ id: string }>;
  }

  const customers = searchResult.data as StripeCustomersResult;
  if (customers?.data && customers.data.length > 0) {
    return { customerId: customers.data[0].id };
  }

  // Create new customer
  const createResult = await stripeRequest('/customers', 'POST', {
    email,
    name,
    ...(metadata ? Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])
    ) : {})
  });

  if (createResult.error) {
    return { error: createResult.error };
  }

  const newCustomer = createResult.data as { id: string };
  return { customerId: newCustomer.id };
}

/**
 * Create and send an invoice
 */
export async function createInvoice(
  customerEmail: string,
  customerName: string,
  amount: number,
  description: string,
  metadata: Record<string, string>
): Promise<{
  success: boolean;
  invoiceId?: string;
  invoiceUrl?: string;
  error?: string;
}> {
  // Find or create customer
  const customerResult = await findOrCreateCustomer(customerEmail, customerName, metadata);
  if (customerResult.error) {
    return { success: false, error: customerResult.error };
  }

  const customerId = customerResult.customerId!;

  // Create invoice
  const invoiceResult = await stripeRequest('/invoices', 'POST', {
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: 15,
    ...Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])
    )
  });

  if (invoiceResult.error) {
    return { success: false, error: invoiceResult.error };
  }

  const invoice = invoiceResult.data as { id: string };

  // Add invoice item
  const itemResult = await stripeRequest('/invoiceitems', 'POST', {
    customer: customerId,
    invoice: invoice.id,
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    description
  });

  if (itemResult.error) {
    return { success: false, error: itemResult.error };
  }

  // Finalize invoice
  const finalizeResult = await stripeRequest(`/invoices/${invoice.id}/finalize`, 'POST');
  if (finalizeResult.error) {
    return { success: false, error: finalizeResult.error };
  }

  // Send invoice
  const sendResult = await stripeRequest(`/invoices/${invoice.id}/send`, 'POST');
  if (sendResult.error) {
    // Still return success since invoice was created
    console.warn('Invoice created but failed to send:', sendResult.error);
  }

  const finalInvoice = (finalizeResult.data || sendResult.data) as {
    id: string;
    hosted_invoice_url: string;
  };

  return {
    success: true,
    invoiceId: invoice.id,
    invoiceUrl: finalInvoice.hosted_invoice_url
  };
}

/**
 * Create invoice for a contract
 */
export async function createContractInvoice(
  contractId: string
): Promise<{
  success: boolean;
  invoiceUrl?: string;
  error?: string;
}> {
  const supabase = createClient();

  // Get contract with lead details
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('*, maxsam_leads(*)')
    .eq('id', contractId)
    .single();

  if (contractError || !contract) {
    return { success: false, error: 'Contract not found' };
  }

  const lead = contract.maxsam_leads;
  if (!lead?.email) {
    return { success: false, error: 'No email address for client' };
  }

  // Build description based on contract type
  let description = '';
  switch (contract.contract_type) {
    case 'excess_funds':
      description = `Excess Funds Recovery Fee (25% of $${(contract.excess_funds_amount || 0).toLocaleString()}) - Property: ${contract.property_address}`;
      break;
    case 'wholesale':
      description = `Wholesale Assignment Fee - Property: ${contract.property_address}`;
      break;
    case 'dual':
      description = `Combined Real Estate Services Fee - Property: ${contract.property_address}`;
      break;
  }

  // Create invoice
  const result = await createInvoice(
    lead.email,
    contract.seller_name,
    contract.total_fee,
    description,
    {
      contract_id: contractId,
      lead_id: contract.lead_id,
      contract_type: contract.contract_type
    }
  );

  if (result.success) {
    // Update contract with invoice URL
    await supabase.from('contracts').update({
      stripe_invoice_id: result.invoiceId,
      stripe_invoice_url: result.invoiceUrl,
      payment_status: 'invoiced'
    }).eq('id', contractId);

    // Update revenue record
    await supabase.from('revenue').update({
      status: 'invoiced',
      stripe_invoice_id: result.invoiceId
    }).eq('contract_id', contractId);

    return { success: true, invoiceUrl: result.invoiceUrl };
  }

  return result;
}

/**
 * Get invoice status
 */
export async function getInvoiceStatus(
  invoiceId: string
): Promise<{
  status: string;
  amountDue: number;
  amountPaid: number;
  hostedInvoiceUrl?: string;
  error?: string;
}> {
  const result = await stripeRequest(`/invoices/${invoiceId}`);

  if (result.error) {
    return { status: 'unknown', amountDue: 0, amountPaid: 0, error: result.error };
  }

  const invoice = result.data as {
    status: string;
    amount_due: number;
    amount_paid: number;
    hosted_invoice_url: string;
  };

  return {
    status: invoice.status,
    amountDue: invoice.amount_due / 100,
    amountPaid: invoice.amount_paid / 100,
    hostedInvoiceUrl: invoice.hosted_invoice_url
  };
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const config = getConfig();
  if (!config || !config.webhookSecret) {
    console.warn('Stripe webhook secret not configured');
    return false;
  }

  try {
    const crypto = require('crypto');
    const timestamp = signature.split(',').find((s: string) => s.startsWith('t='))?.split('=')[1];
    const sig = signature.split(',').find((s: string) => s.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !sig) {
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    return sig === expectedSig;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

/**
 * Get revenue statistics
 */
export async function getRevenueStats(): Promise<{
  totalRevenue: number;
  pendingRevenue: number;
  thisMonthRevenue: number;
  invoicedAmount: number;
}> {
  const supabase = createClient();

  const { data: revenue } = await supabase.from('revenue').select('*');

  if (!revenue) {
    return {
      totalRevenue: 0,
      pendingRevenue: 0,
      thisMonthRevenue: 0,
      invoicedAmount: 0
    };
  }

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalRevenue = revenue
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const pendingRevenue = revenue
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const thisMonthRevenue = revenue
    .filter(r => r.status === 'paid' && r.paid_at?.startsWith(thisMonth))
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const invoicedAmount = revenue
    .filter(r => r.status === 'invoiced')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  return {
    totalRevenue,
    pendingRevenue,
    thisMonthRevenue,
    invoicedAmount
  };
}
