// N8N Node: "1.4 Parse Leads" - UPDATED CODE
// Handles CSV + Multi-page PDF

const input = $input.first().json;
const webhookData = $('1.0 Webhook - Import Leads').first().json.body || {};
let content = webhookData.file_content || input.data || input.body || input || '';
const importId = webhookData.import_id || 'manual-' + Date.now();
const listType = webhookData.list_type || 'excess_funds';
const fileType = webhookData.file_type || 'csv';

if (typeof content !== 'string') content = JSON.stringify(content);

const leads = [];

// =====================
// CSV PARSING
// =====================
if (fileType === 'csv' || content.includes(',') && content.includes('\n')) {
  const lines = content.trim().split('\n');
  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
  
  const headerMap = {};
  rawHeaders.forEach((h, idx) => {
    if (h.includes('name') || h.includes('owner')) headerMap.name = idx;
    if (h.includes('first') && h.includes('name')) headerMap.firstName = idx;
    if (h.includes('last') && h.includes('name')) headerMap.lastName = idx;
    if (h.includes('address') || h.includes('property')) headerMap.address = idx;
    if (h.includes('city')) headerMap.city = idx;
    if (h.includes('state')) headerMap.state = idx;
    if (h.includes('zip') || h.includes('postal')) headerMap.zip = idx;
    if (h.includes('amount') || h.includes('excess') || h.includes('funds')) headerMap.amount = idx;
    if (h.includes('date') || h.includes('sale')) headerMap.date = idx;
    if (h.includes('expir')) headerMap.expiration = idx;
    if (h.includes('phone')) headerMap.phone = idx;
    if (h.includes('email')) headerMap.email = idx;
    if (h.includes('case') || h.includes('number')) headerMap.caseNumber = idx;
  });
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Smart CSV split handling quotes
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { 
        values.push(current.trim().replace(/^"|"$/g, '')); 
        current = ''; 
      }
      else current += char;
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    const lead = {
      import_id: importId,
      list_type: listType,
      source: 'csv_import',
      status: 'new',
      created_at: new Date().toISOString()
    };
    
    if (headerMap.name !== undefined) lead.owner_name = values[headerMap.name];
    if (headerMap.firstName !== undefined) lead.first_name = values[headerMap.firstName];
    if (headerMap.lastName !== undefined) lead.last_name = values[headerMap.lastName];
    if (headerMap.address !== undefined) lead.property_address = values[headerMap.address];
    if (headerMap.city !== undefined) lead.city = values[headerMap.city];
    if (headerMap.state !== undefined) lead.state = values[headerMap.state];
    if (headerMap.zip !== undefined) lead.zip = values[headerMap.zip];
    if (headerMap.phone !== undefined) lead.phone = values[headerMap.phone]?.replace(/[^0-9]/g, '');
    if (headerMap.email !== undefined) lead.email = values[headerMap.email];
    if (headerMap.date !== undefined) lead.sale_date = values[headerMap.date];
    if (headerMap.expiration !== undefined) lead.expiration_date = values[headerMap.expiration];
    if (headerMap.caseNumber !== undefined) lead.case_number = values[headerMap.caseNumber];
    if (headerMap.amount !== undefined) {
      const amountStr = values[headerMap.amount]?.replace(/[^0-9.]/g, '') || '0';
      lead.excess_funds_amount = parseFloat(amountStr) || 0;
    }
    
    // Parse name into first/last if needed
    if (lead.owner_name && !lead.first_name) {
      const parts = lead.owner_name.split(/[,\s]+/).filter(Boolean);
      if (lead.owner_name.includes(',')) {
        lead.last_name = parts[0];
        lead.first_name = parts[1] || '';
      } else {
        lead.first_name = parts[0];
        lead.last_name = parts[parts.length - 1];
      }
    }
    
    lead.state = lead.state || 'TX';
    lead.city = lead.city || 'Dallas';
    
    // Calculate timing
    if (lead.sale_date) {
      try {
        const saleDate = new Date(lead.sale_date);
        const now = new Date();
        const daysDiff = Math.floor((now - saleDate) / (1000 * 60 * 60 * 24));
        lead.months_on_list = Math.floor(daysDiff / 30);
        lead.days_until_expiration = Math.max(0, 730 - daysDiff);
      } catch (e) {
        lead.months_on_list = 0;
        lead.days_until_expiration = 730;
      }
    }
    
    // Normalize for matching
    lead.owner_name_normalized = (lead.owner_name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    lead.property_address_normalized = (lead.property_address || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    
    if (lead.owner_name || lead.property_address) leads.push(lead);
  }
}

// =====================
// PDF PARSING (MULTI-PAGE)
// =====================
else if (fileType === 'pdf' || content.includes('%PDF')) {
  // For PDF, we need to parse ALL pages
  // This regex extracts text content from PDF structure
  const textPattern = /\(([^)]+)\)/g;
  const matches = [...content.matchAll(textPattern)];
  
  let fullText = matches.map(m => m[1]).join(' ');
  
  // Look for excess funds data patterns
  const linePattern = /([A-Z\s]+)\s+\$?([\d,]+\.?\d*)\s+(\d{1,2}\/\d{1,2}\/\d{4})/g;
  const dataMatches = [...fullText.matchAll(linePattern)];
  
  dataMatches.forEach((match, idx) => {
    const [_, name, amount, date] = match;
    
    const lead = {
      import_id: importId,
      list_type: listType,
      source: 'pdf_import',
      status: 'new',
      owner_name: name.trim(),
      excess_funds_amount: parseFloat(amount.replace(/,/g, '')) || 0,
      sale_date: date,
      city: 'Dallas',
      state: 'TX',
      created_at: new Date().toISOString()
    };
    
    // Parse name
    const parts = lead.owner_name.split(/\s+/).filter(Boolean);
    lead.first_name = parts[0];
    lead.last_name = parts[parts.length - 1];
    
    // Calculate timing
    if (lead.sale_date) {
      try {
        const saleDate = new Date(lead.sale_date);
        const now = new Date();
        const daysDiff = Math.floor((now - saleDate) / (1000 * 60 * 60 * 24));
        lead.months_on_list = Math.floor(daysDiff / 30);
        lead.days_until_expiration = Math.max(0, 730 - daysDiff);
      } catch (e) {
        lead.months_on_list = 0;
        lead.days_until_expiration = 730;
      }
    }
    
    // Normalize
    lead.owner_name_normalized = (lead.owner_name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    
    if (lead.owner_name && lead.excess_funds_amount > 0) {
      leads.push(lead);
    }
  });
}

console.log(`Parsed ${leads.length} leads from ${fileType}`);
return leads.map(l => ({ json: l }));
