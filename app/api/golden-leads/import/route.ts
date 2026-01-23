/**
 * Golden Leads Import API
 * Accepts Google Drive file ID or direct CSV upload
 * Parses and upserts into maxsam_leads with scoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateEleanorScore } from '@/lib/eleanor';

interface ImportLead {
  owner_name?: string;
  property_address?: string;
  address?: string;
  excess_funds_amount?: string | number;
  amount?: string | number;
  city?: string;
  state?: string;
  zip_code?: string;
  zip?: string;
  case_number?: string;
  phone?: string;
  [key: string]: string | number | undefined;
}

function parseAmount(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  const cleaned = value.replace(/[$,\s]/g, '');
  return parseFloat(cleaned) || 0;
}

function normalizeLeadData(row: ImportLead): Record<string, unknown> {
  return {
    owner_name: row.owner_name || row['Owner Name'] || row['OWNER NAME'] || row['Name'] || '',
    property_address: row.property_address || row.address || row['Property Address'] || row['ADDRESS'] || '',
    excess_funds_amount: parseAmount(row.excess_funds_amount || row.amount || row['Excess Amount'] || row['Amount']),
    city: row.city || row['City'] || row['CITY'] || '',
    state: row.state || row['State'] || row['STATE'] || 'TX',
    zip_code: row.zip_code || row.zip || row['Zip'] || row['ZIP'] || row['Zip Code'] || '',
    case_number: row.case_number || row['Case Number'] || row['Cause Number'] || '',
    phone: row.phone || row['Phone'] || row['PHONE'] || null,
  };
}

// Parse CSV from Google Drive
async function fetchFromGoogleDrive(fileId: string): Promise<string> {
  // Google Drive export URL for CSV
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch from Google Drive: ${response.status}`);
  }

  return response.text();
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });

    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { drive_file_id, leads, source_name } = body as {
      drive_file_id?: string;
      leads?: ImportLead[];
      source_name?: string;
    };

    let leadsToImport: ImportLead[] = [];

    // Option 1: Fetch from Google Drive
    if (drive_file_id) {
      const csvText = await fetchFromGoogleDrive(drive_file_id);
      leadsToImport = parseCSV(csvText) as ImportLead[];
    }
    // Option 2: Direct leads array
    else if (leads && Array.isArray(leads)) {
      leadsToImport = leads;
    }
    else {
      return NextResponse.json(
        { error: 'Provide either drive_file_id or leads array', success: false },
        { status: 400 }
      );
    }

    if (leadsToImport.length === 0) {
      return NextResponse.json(
        { error: 'No leads found in data', success: false },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const source = source_name || `drive_import_${today}`;

    const results = {
      total: leadsToImport.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < leadsToImport.length; i++) {
      const row = leadsToImport[i];

      try {
        const normalized = normalizeLeadData(row);

        if (!normalized.owner_name || !normalized.property_address) {
          results.skipped++;
          continue;
        }

        // Score with Eleanor
        const scoringResult = calculateEleanorScore({
          id: `import-${i}`,
          excess_funds_amount: normalized.excess_funds_amount as number,
          owner_name: normalized.owner_name as string,
          zip_code: normalized.zip_code as string,
          city: normalized.city as string,
          property_address: normalized.property_address as string,
        });

        // Check if lead already exists (by address)
        const { data: existing } = await supabase
          .from('maxsam_leads')
          .select('id')
          .eq('property_address', normalized.property_address)
          .maybeSingle();

        const leadData = {
          ...normalized,
          source,
          eleanor_score: scoringResult.eleanor_score,
          deal_grade: scoringResult.deal_grade,
          contact_priority: scoringResult.contact_priority,
          deal_type: scoringResult.deal_type,
          potential_revenue: scoringResult.potential_revenue,
          excess_fee: scoringResult.excess_fee,
          wholesale_fee: scoringResult.wholesale_fee,
          estimated_equity: scoringResult.estimated_equity,
          golden_lead: false, // Will be updated by hunt
          status: 'new',
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          // Update existing lead
          await supabase
            .from('maxsam_leads')
            .update(leadData)
            .eq('id', existing.id);
          results.updated++;
        } else {
          // Insert new lead
          await supabase
            .from('maxsam_leads')
            .insert({
              ...leadData,
              created_at: new Date().toISOString(),
            });
          results.imported++;
        }
      } catch (err) {
        results.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        results.skipped++;
      }
    }

    // Log import activity
    await supabase.from('activity_feed').insert({
      activity_type: 'golden_import',
      description: `Imported ${results.imported} leads, updated ${results.updated} from ${source}`,
      metadata: { results, source },
    });

    return NextResponse.json({
      success: true,
      ...results,
      message: `Imported ${results.imported} new leads, updated ${results.updated} existing`,
    });
  } catch (error) {
    console.error('Golden leads import error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
