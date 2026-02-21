/**
 * Contract Generator for MaxSam V4
 *
 * Two contract templates:
 *   1. EXCESS FUNDS RECOVERY SERVICES AGREEMENT (25% contingency)
 *   2. REAL ESTATE ASSIGNMENT / FINDER SERVICES AGREEMENT (10% wholesale)
 *
 * Flow:
 *   1. Resolve lead data from Supabase (leads + maxsam_leads)
 *   2. Fill {{mustache}} variables into the template text
 *   3. Generate multi-page PDF via pdf-lib
 *   4. Upload PDF to Supabase Storage bucket "agreements"
 *   5. Return public URL
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from './supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgreementType = 'excess_funds' | 'wholesale';

export interface GenerateResult {
  success: boolean;
  pdfUrl?: string;
  storagePath?: string;
  agreementId?: string;
  error?: string;
}

interface LeadData {
  id: string;
  owner_name: string;
  phone: string;
  email: string | null;
  property_address: string;
  city: string;
  state: string;
  zip_code: string;
  case_number: string;
  county: string;
  excess_funds_amount: number;
  expiry_date: string | null;
}

// ---------------------------------------------------------------------------
// Company constants
// ---------------------------------------------------------------------------

const COMPANY = {
  legalName: 'MaxSam Recovery Services',
  address: 'Richardson, TX 75080',
  phone: '(844) 963-2549',
  email: 'logan@maxsamrecovery.com',
};

// ---------------------------------------------------------------------------
// Contract templates — full legal text with {{mustache}} variables
// ---------------------------------------------------------------------------

const EXCESS_FUNDS_TEMPLATE = `EXCESS FUNDS RECOVERY SERVICES AGREEMENT

This Excess Funds Recovery Services Agreement ("Agreement") is entered into as of {{Agreement.Date}} ("Effective Date") by and between:

CLIENT:
{{Client.FullName}}
{{Client.Address}}
Phone: {{Client.Phone}}

("Client" or "Property Owner")

AND

RECOVERY AGENT:
{{Company.LegalName}}
{{Company.Address}}
Phone: {{Company.Phone}}
Email: {{Company.Email}}

("Agent" or "Recovery Firm")

RECITALS

WHEREAS, the Client is the former owner or legal successor-in-interest of the real property located at {{Property.Address}}, {{Property.City}}, {{Property.State}} {{Property.Zip}} ("Property");

WHEREAS, the Property was subject to a tax foreclosure sale conducted by {{County.Name}} County, Texas, under Case No. {{Case.Number}};

WHEREAS, following such sale, excess proceeds in the estimated amount of \${{ExcessFunds.Amount}} ("Excess Funds") may be held by {{County.Name}} County or the applicable taxing authority;

WHEREAS, the Client desires to retain the Agent to investigate, identify, and recover said Excess Funds on the Client's behalf, and the Agent desires to provide such services under the terms and conditions set forth herein;

NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:

1. SCOPE OF SERVICES

1.1 The Agent shall perform the following services on behalf of the Client:
(a) Investigate and confirm the existence and amount of Excess Funds held by {{County.Name}} County or the applicable taxing authority arising from the tax sale of the Property;
(b) Prepare, file, and prosecute all claims, applications, motions, or petitions necessary to recover the Excess Funds;
(c) Communicate and negotiate with {{County.Name}} County, taxing authorities, courts, and any other relevant parties;
(d) Provide all documentation, legal research, and administrative support necessary to effect the recovery;
(e) Coordinate with legal counsel as needed to represent the Client's interests.

1.2 The Client acknowledges that the Agent is not a licensed attorney and does not provide legal advice. The Agent may engage licensed attorneys as necessary at the Agent's expense.

2. CONTINGENCY FEE

2.1 The Client agrees to pay the Agent a contingency fee equal to {{Fee.Percent}}% of the gross Excess Funds actually recovered and disbursed ("Recovery Fee").

2.2 The Recovery Fee shall be calculated on the total amount recovered before any deductions for taxes, liens, or other obligations.

2.3 If no Excess Funds are recovered, the Client owes no fee to the Agent. The Client shall not be responsible for any costs, expenses, or fees unless and until Excess Funds are successfully recovered and disbursed.

2.4 Upon recovery, the Agent is authorized to receive the Excess Funds directly from the disbursing authority, deduct the Recovery Fee, and remit the remaining balance to the Client within ten (10) business days.

3. CLIENT REPRESENTATIONS AND WARRANTIES

3.1 The Client represents and warrants that:
(a) The Client is the rightful owner or legal successor-in-interest entitled to claim the Excess Funds;
(b) The Client has not previously assigned, transferred, or encumbered the right to the Excess Funds to any other party;
(c) The Client has full legal authority to enter into this Agreement;
(d) All information provided by the Client to the Agent is true, accurate, and complete to the best of the Client's knowledge;
(e) The Client will cooperate fully with the Agent, including providing identification, affidavits, and any other documentation reasonably required.

4. AGENT REPRESENTATIONS AND WARRANTIES

4.1 The Agent represents and warrants that:
(a) The Agent has the expertise and resources necessary to perform the services described herein;
(b) The Agent will perform all services in a professional and diligent manner;
(c) The Agent will comply with all applicable federal, state, and local laws and regulations;
(d) The Agent will maintain the confidentiality of all Client information.

5. TERM AND TERMINATION

5.1 This Agreement shall remain in effect until the earlier of: (a) the successful recovery and distribution of the Excess Funds; (b) a determination that the Excess Funds are not recoverable; or (c) termination by either party as provided herein.

5.2 Either party may terminate this Agreement upon thirty (30) days' written notice to the other party.

5.3 If the Client terminates this Agreement after the Agent has commenced recovery efforts, and Excess Funds are subsequently recovered within twelve (12) months of termination as a result of the Agent's prior work, the Client shall pay the Agent the full Recovery Fee.

5.4 Upon termination, the Agent shall provide the Client with all documents and work product related to the recovery effort.

6. LIMITATION OF LIABILITY

6.1 The Agent's total liability under this Agreement shall not exceed the amount of the Recovery Fee actually received by the Agent.

6.2 The Agent shall not be liable for any indirect, incidental, consequential, or punitive damages.

6.3 The Agent does not guarantee that Excess Funds will be recovered, as recovery is subject to governmental processes, legal requirements, and other factors beyond the Agent's control.

7. GOVERNING LAW AND DISPUTE RESOLUTION

7.1 This Agreement shall be governed by and construed in accordance with the laws of the State of Texas.

7.2 Any disputes arising under this Agreement shall first be submitted to mediation in Dallas County, Texas. If mediation fails, either party may pursue binding arbitration under the rules of the American Arbitration Association.

8. MISCELLANEOUS

8.1 This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, understandings, and agreements.

8.2 This Agreement may not be amended except by a written instrument signed by both parties.

8.3 If any provision of this Agreement is found to be unenforceable, the remaining provisions shall continue in full force and effect.

8.4 This Agreement may be executed electronically and in counterparts, each of which shall be deemed an original.

8.5 The Client acknowledges that the Excess Funds expiration deadline, if applicable, is {{ExcessFunds.ExpiryDate}}.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

CLIENT:

Signature: ____________________________
Name: {{Client.FullName}}
Date: _______________


RECOVERY AGENT:

Signature: ____________________________
Name: {{Company.LegalName}}
Date: _______________

Lead Reference: {{Lead.UUID}}`;


const WHOLESALE_TEMPLATE = `REAL ESTATE ASSIGNMENT / FINDER SERVICES AGREEMENT

This Real Estate Assignment / Finder Services Agreement ("Agreement") is entered into as of {{Agreement.Date}} ("Effective Date") by and between:

CLIENT:
{{Client.FullName}}
{{Client.Address}}
Phone: {{Client.Phone}}

("Client" or "Property Owner")

AND

AGENT:
{{Company.LegalName}}
{{Company.Address}}
Phone: {{Company.Phone}}
Email: {{Company.Email}}

("Agent" or "Finder")

RECITALS

WHEREAS, the Client is the owner of the real property located at {{Property.Address}}, {{Property.City}}, {{Property.State}} {{Property.Zip}} ("Property");

WHEREAS, the Property was subject to or affected by tax foreclosure proceedings in {{County.Name}} County, Texas, under Case No. {{Case.Number}};

WHEREAS, the Client desires to sell, assign, or otherwise dispose of the Property or the Client's interest therein;

WHEREAS, the Agent has access to a network of qualified real estate investors and buyers and is willing to locate a purchaser for the Property or the Client's interest;

NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein, the parties agree as follows:

1. SCOPE OF SERVICES

1.1 The Agent shall perform the following services on behalf of the Client:
(a) Market the Property to qualified investors and buyers within the Agent's network;
(b) Negotiate terms of sale or assignment on the Client's behalf, subject to the Client's approval;
(c) Coordinate due diligence activities including title searches, property inspections, and appraisals;
(d) Facilitate the closing process, including coordination with title companies, attorneys, and other professionals;
(e) Provide the Client with regular updates on marketing activities and buyer interest.

1.2 The Client grants the Agent an exclusive right to market and find a buyer for the Property for the term of this Agreement.

2. ASSIGNMENT FEE

2.1 Upon the successful closing or assignment of the Property, the Client agrees to pay the Agent an assignment fee equal to {{Fee.Percent}}% of the gross sale price or assigned contract value ("Assignment Fee").

2.2 The Assignment Fee shall be paid at closing from the sale proceeds through the title company or closing agent.

2.3 If no sale or assignment is completed, the Client owes no fee to the Agent.

2.4 The Agent shall not charge any upfront fees, marketing costs, or other expenses to the Client.

3. CLIENT REPRESENTATIONS AND WARRANTIES

3.1 The Client represents and warrants that:
(a) The Client has legal ownership of or marketable interest in the Property;
(b) The Client has the legal authority to sell, assign, or transfer the Property;
(c) The Client will disclose all known material defects, liens, encumbrances, or other issues affecting the Property;
(d) The Client has not entered into any other exclusive listing or sales agreement for the Property;
(e) All information provided by the Client to the Agent is true and accurate.

4. AGENT REPRESENTATIONS AND WARRANTIES

4.1 The Agent represents and warrants that:
(a) The Agent has experience in real estate transactions and access to qualified buyers;
(b) The Agent will perform all services in a professional and ethical manner;
(c) The Agent will comply with all applicable real estate laws and regulations;
(d) The Agent will maintain the confidentiality of all Client information and Property details except as necessary to market the Property.

5. TERM AND TERMINATION

5.1 This Agreement shall be effective for a period of one hundred eighty (180) days from the Effective Date, unless extended by mutual written agreement.

5.2 Either party may terminate this Agreement upon thirty (30) days' written notice.

5.3 If a sale or assignment closes within ninety (90) days after termination with a buyer introduced by the Agent during the term, the Client shall pay the full Assignment Fee.

6. LIMITATION OF LIABILITY

6.1 The Agent's total liability shall not exceed the Assignment Fee received.

6.2 The Agent does not guarantee the sale of the Property or any particular sale price.

6.3 The Agent shall not be liable for any indirect, incidental, or consequential damages.

7. GOVERNING LAW AND DISPUTE RESOLUTION

7.1 This Agreement shall be governed by the laws of the State of Texas.

7.2 Disputes shall first be submitted to mediation in Dallas County, Texas. If unresolved, binding arbitration under the American Arbitration Association rules shall apply.

8. MISCELLANEOUS

8.1 This Agreement constitutes the entire agreement between the parties.

8.2 Amendments require written agreement signed by both parties.

8.3 If any provision is unenforceable, the remaining provisions remain in effect.

8.4 This Agreement may be executed electronically and in counterparts.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

CLIENT:

Signature: ____________________________
Name: {{Client.FullName}}
Date: _______________


AGENT:

Signature: ____________________________
Name: {{Company.LegalName}}
Date: _______________

Lead Reference: {{Lead.UUID}}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAddress(address: string): { city: string; state: string; zip: string } {
  // Try to parse "123 Main St, Dallas, TX 75201" format
  const parts = (address || '').split(',').map(s => s.trim());
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1].trim().split(/\s+/);
    return {
      city: parts[parts.length - 2] || '',
      state: stateZip[0] || 'TX',
      zip: stateZip[1] || '',
    };
  }
  if (parts.length === 2) {
    const stateZip = parts[1].trim().split(/\s+/);
    return {
      city: '',
      state: stateZip[0] || 'TX',
      zip: stateZip[1] || '',
    };
  }
  return { city: '', state: 'TX', zip: '' };
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Resolve lead data from leads table (canonical) then fallback to maxsam_leads
 */
async function resolveLeadData(leadId: string): Promise<LeadData | null> {
  const supabase = createClient();

  // Try canonical leads table first
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (lead) {
    const parsed = parseAddress(lead.property_address || '');
    return {
      id: lead.id,
      owner_name: lead.owner_name || 'Property Owner',
      phone: lead.phone || '',
      email: lead.email || null,
      property_address: lead.property_address || '',
      city: lead.city || parsed.city || '',
      state: lead.state || parsed.state || 'TX',
      zip_code: lead.zip_code || parsed.zip || '',
      case_number: lead.case_number || 'N/A',
      county: lead.county || 'Dallas',
      excess_funds_amount: Number(lead.excess_funds_amount || 0),
      expiry_date: lead.expiry_date || lead.expiration_date || null,
    };
  }

  // Fallback to maxsam_leads
  const { data: mLead } = await supabase
    .from('maxsam_leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (!mLead) return null;

  const parsed = parseAddress(mLead.property_address || '');
  return {
    id: mLead.id,
    owner_name: mLead.owner_name || 'Property Owner',
    phone: mLead.phone || mLead.phone_1 || '',
    email: mLead.email || null,
    property_address: mLead.property_address || '',
    city: mLead.city || parsed.city || '',
    state: mLead.state || parsed.state || 'TX',
    zip_code: mLead.zip_code || parsed.zip || '',
    case_number: mLead.case_number || 'N/A',
    county: mLead.county || 'Dallas',
    excess_funds_amount: Number(mLead.excess_funds_amount || mLead.excess_amount || 0),
    expiry_date: mLead.expiry_date || mLead.expiration_date || null,
  };
}

/**
 * Fill template variables with lead data
 */
function fillTemplate(template: string, lead: LeadData, agreementType: AgreementType): string {
  const feePercent = agreementType === 'excess_funds' ? '25' : '10';
  const now = new Date();

  const replacements: Record<string, string> = {
    'Client.FullName': lead.owner_name,
    'Client.Address': lead.property_address || 'Address on file',
    'Client.Phone': lead.phone || 'N/A',
    'Case.Number': lead.case_number,
    'County.Name': lead.county,
    'Property.Address': lead.property_address,
    'Property.City': lead.city,
    'Property.State': lead.state,
    'Property.Zip': lead.zip_code,
    'ExcessFunds.Amount': formatCurrency(lead.excess_funds_amount),
    'ExcessFunds.ExpiryDate': lead.expiry_date
      ? new Date(lead.expiry_date).toLocaleDateString('en-US')
      : 'Not specified',
    'Fee.Percent': feePercent,
    'Lead.UUID': lead.id,
    'Company.LegalName': COMPANY.legalName,
    'Company.Address': COMPANY.address,
    'Company.Phone': COMPANY.phone,
    'Company.Email': COMPANY.email,
    'Agreement.Date': formatDate(now),
  };

  let filled = template;
  for (const [key, value] of Object.entries(replacements)) {
    filled = filled.replace(new RegExp(`\\{\\{${key.replace('.', '\\.')}\\}\\}`, 'g'), value);
  }
  return filled;
}

// ---------------------------------------------------------------------------
// PDF generation with pdf-lib
// ---------------------------------------------------------------------------

/**
 * Render filled text into a multi-page PDF document
 */
async function renderPdf(text: string, title: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const pageWidth = 612;   // US Letter
  const pageHeight = 792;
  const marginLeft = 72;
  const marginRight = 72;
  const marginTop = 72;
  const marginBottom = 72;
  const maxWidth = pageWidth - marginLeft - marginRight;
  const fontSize = 11;
  const lineHeight = 15;
  const titleFontSize = 14;

  // Set PDF metadata
  pdfDoc.setTitle(title);
  pdfDoc.setCreator('MaxSam Recovery Services');
  pdfDoc.setProducer('MaxSam V4 Contract Generator');

  const lines = text.split('\n');
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Detect section headers (all-caps lines or numbered section titles)
    const isTitle = line === line.toUpperCase() && line.length > 3 && /[A-Z]/.test(line);
    const isSectionHead = /^\d+\.\s+[A-Z]/.test(line);
    const activeFont = (isTitle || isSectionHead) ? boldFont : font;
    const activeFontSize = isTitle && lines.indexOf(rawLine) < 3 ? titleFontSize : fontSize;

    // Word-wrap long lines
    const words = line.split(/\s+/);
    const wrappedLines: string[] = [];
    let currentLine = '';

    if (line.trim() === '') {
      wrappedLines.push('');
    } else {
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = activeFont.widthOfTextAtSize(testLine, activeFontSize);
        if (testWidth > maxWidth && currentLine) {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) wrappedLines.push(currentLine);
    }

    for (const wl of wrappedLines) {
      // Check if we need a new page
      if (y - lineHeight < marginBottom) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - marginTop;
      }

      if (wl.trim()) {
        page.drawText(wl, {
          x: marginLeft,
          y,
          size: activeFontSize,
          font: activeFont,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
      y -= lineHeight;
    }

    // Add extra spacing after blank lines (paragraph breaks)
    if (line.trim() === '') {
      y -= 4;
    }
  }

  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// Upload to Supabase Storage
// ---------------------------------------------------------------------------

async function uploadToStorage(
  pdfBytes: Uint8Array,
  fileName: string,
): Promise<{ url: string; path: string } | null> {
  const supabase = createClient();
  const storagePath = `generated/${fileName}`;

  const { error } = await supabase.storage
    .from('agreements')
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    console.error('[contract-generator] Storage upload error:', error.message);
    // Try creating the bucket if it doesn't exist
    if (error.message.includes('not found') || error.message.includes('Bucket')) {
      await supabase.storage.createBucket('agreements', { public: true });
      const { error: retryError } = await supabase.storage
        .from('agreements')
        .upload(storagePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (retryError) {
        console.error('[contract-generator] Storage retry failed:', retryError.message);
        return null;
      }
    } else {
      return null;
    }
  }

  const { data: urlData } = supabase.storage
    .from('agreements')
    .getPublicUrl(storagePath);

  return { url: urlData.publicUrl, path: storagePath };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a filled agreement PDF and upload it to storage.
 *
 * @param leadId       - The lead UUID
 * @param agreementType - 'excess_funds' or 'wholesale'
 * @returns             GenerateResult with pdfUrl on success
 */
export async function generateAgreementPdf(
  leadId: string,
  agreementType: AgreementType,
): Promise<GenerateResult> {
  // 1. Resolve lead data
  const lead = await resolveLeadData(leadId);
  if (!lead) {
    return { success: false, error: `Lead not found: ${leadId}` };
  }

  // 2. Select template and fill variables
  const template = agreementType === 'excess_funds'
    ? EXCESS_FUNDS_TEMPLATE
    : WHOLESALE_TEMPLATE;

  const filledText = fillTemplate(template, lead, agreementType);

  // 3. Generate PDF
  const title = agreementType === 'excess_funds'
    ? 'Excess Funds Recovery Services Agreement'
    : 'Real Estate Assignment / Finder Services Agreement';

  const pdfBytes = await renderPdf(filledText, title);

  // 4. Upload to Supabase Storage
  const timestamp = Date.now();
  const safeName = (lead.owner_name || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const fileName = `${agreementType}_${safeName}_${timestamp}.pdf`;

  const uploadResult = await uploadToStorage(pdfBytes, fileName);
  if (!uploadResult) {
    return { success: false, error: 'Failed to upload PDF to storage' };
  }

  // 5. Insert agreement record
  const supabase = createClient();
  const { data: agreement, error: insertError } = await supabase
    .from('agreements')
    .insert({
      lead_id: leadId,
      agreement_type: agreementType,
      status: 'draft',
      pdf_url: uploadResult.url,
      storage_path: uploadResult.path,
      client_name: lead.owner_name,
      client_phone: lead.phone,
      client_email: lead.email,
      excess_funds_amount: lead.excess_funds_amount,
      fee_percent: agreementType === 'excess_funds' ? 25 : 10,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[contract-generator] Agreement insert error:', insertError.message);
    // PDF was generated and uploaded — return URL even if DB insert fails
    return {
      success: true,
      pdfUrl: uploadResult.url,
      storagePath: uploadResult.path,
      error: `PDF generated but DB insert failed: ${insertError.message}`,
    };
  }

  return {
    success: true,
    pdfUrl: uploadResult.url,
    storagePath: uploadResult.path,
    agreementId: agreement?.id,
  };
}

/**
 * Legacy compatibility — re-export old function names
 */
export { generateAgreementPdf as generateContract };
export type ContractType = AgreementType | 'dual';

/**
 * Get agreement status
 */
export async function getContractStatus(agreementId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('agreements')
    .select('*')
    .eq('id', agreementId)
    .single();

  if (!data) return { error: 'Agreement not found' };
  return {
    id: data.id,
    status: data.status,
    pdfUrl: data.pdf_url,
    sentAt: data.sent_at,
    signedAt: data.signed_at,
    agreementType: data.agreement_type,
    feePercent: data.fee_percent,
  };
}
