// DocuSign integration for MaxSam V4
export class DocuSignService {
  constructor() {
    this.accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    this.accessToken = process.env.DOCUSIGN_ACCESS_TOKEN;
    this.baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
  }

  async createEnvelope(contract, lead, buyer) {
    // Generate contract document
    const documentBase64 = await this.generateContractPDF(contract, lead, buyer);

    const envelopeDefinition = {
      emailSubject: `MaxSam Contract - ${contract.property_address}`,
      documents: [
        {
          documentBase64,
          name: 'MaxSam Agreement',
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: lead?.email || 'seller@example.com',
            name: contract.seller_name,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  pageNumber: '1',
                  xPosition: '100',
                  yPosition: '200',
                },
              ],
              dateSignedTabs: [
                {
                  documentId: '1',
                  pageNumber: '1',
                  xPosition: '300',
                  yPosition: '200',
                },
              ],
            },
          },
          {
            email: buyer?.email || 'buyer@example.com',
            name: buyer?.name || 'Buyer',
            recipientId: '2',
            routingOrder: '2',
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  pageNumber: '1',
                  xPosition: '100',
                  yPosition: '300',
                },
              ],
              dateSignedTabs: [
                {
                  documentId: '1',
                  pageNumber: '1',
                  xPosition: '300',
                  yPosition: '300',
                },
              ],
            },
          },
        ],
      },
      status: 'sent',
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(envelopeDefinition),
        },
      );

      if (!response.ok) {
        throw new Error('DocuSign API error');
      }

      return await response.json();
    } catch (error) {
      console.error('DocuSign error:', error);
      throw error;
    }
  }

  async generateContractPDF(contract, lead, buyer) {
    // This would generate the actual contract PDF
    // For now, return a placeholder
    const contractHtml = `
      <html>
        <head>
          <style>
            body { font-family: Arial; padding: 40px; }
            h1 { color: #06b6d4; }
            .section { margin: 20px 0; }
            .signature-line { border-top: 2px solid #000; width: 300px; margin-top: 50px; }
          </style>
        </head>
        <body>
          <h1>MaxSam Real Estate Agreement</h1>
          
          <div class="section">
            <h2>Property Details</h2>
            <p><strong>Address:</strong> ${contract.property_address}</p>
            <p><strong>Seller:</strong> ${contract.seller_name}</p>
            <p><strong>Buyer:</strong> ${buyer?.name || 'TBD'}</p>
          </div>

          <div class="section">
            <h2>Financial Terms</h2>
            <p><strong>Deal Type:</strong> ${contract.deal_type.replace('_', ' ').toUpperCase()}</p>
            ${
              contract.excess_funds_amount > 0
                ? `<p><strong>Excess Funds:</strong> $${contract.excess_funds_amount.toLocaleString()}</p>`
                : ''
            }
            ${
              contract.wholesale_amount > 0
                ? `<p><strong>Wholesale Price:</strong> $${contract.wholesale_amount.toLocaleString()}</p>`
                : ''
            }
            <p><strong>Total Fees:</strong> $${contract.total_fee.toLocaleString()}</p>
          </div>

          <div class="section">
            <h2>Agreement</h2>
            <p>This agreement is entered into on ${new Date().toLocaleDateString()} between:</p>
            <p><strong>Seller:</strong> ${contract.seller_name}</p>
            <p><strong>MaxSam Recovery:</strong> Logan Samantha</p>
            ${buyer ? `<p><strong>Buyer:</strong> ${buyer.name}</p>` : ''}
          </div>

          <div class="section">
            <h3>Seller Signature</h3>
            <div class="signature-line"></div>
            <p>Date: _______________</p>
          </div>

          ${
            buyer
              ? `
          <div class="section">
            <h3>Buyer Signature</h3>
            <div class="signature-line"></div>
            <p>Date: _______________</p>
          </div>
          `
              : ''
          }

          <div class="section">
            <h3>MaxSam Representative</h3>
            <div class="signature-line"></div>
            <p>Date: _______________</p>
          </div>
        </body>
      </html>
    `;

    // Convert HTML to base64 (simplified - in production use a proper PDF library)
    return Buffer.from(contractHtml).toString('base64');
  }

  async getEnvelopeStatus(envelopeId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('DocuSign API error');
      }

      return await response.json();
    } catch (error) {
      console.error('DocuSign status error:', error);
      throw error;
    }
  }
}

export const docusign = new DocuSignService();
