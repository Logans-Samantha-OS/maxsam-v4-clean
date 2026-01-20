/**
 * CSV Import API - Direct import of leads from CSV files
 * Parses CSV data and inserts leads into maxsam_leads table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateEleanorScore } from '@/lib/eleanor';

interface CSVLead {
  owner_name?: string;
  property_address?: string;
  address?: string;
  excess_funds_amount?: string | number;
  amount?: string | number;
  excess_amount?: string | number;
  city?: string;
  state?: string;
  zip_code?: string;
  zip?: string;
  case_number?: string;
  cause_number?: string;
  sale_date?: string;
  phone?: string;
  phone_1?: string;
  email?: string;
  [key: string]: string | number | undefined;
}

function parseAmount(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  // Remove $, commas, and spaces
  const cleaned = value.replace(/[$,\s]/g, '');
  return parseFloat(cleaned) || 0;
}

function normalizeLeadData(row: CSVLead, source: string): Record<string, unknown> {
  return {
    owner_name: row.owner_name || row['Owner Name'] || row['OWNER NAME'] || row['Name'] || '',
    property_address: row.property_address || row.address || row['Property Address'] || row['ADDRESS'] || row['Address'] || '',
    excess_funds_amount: parseAmount(row.excess_funds_amount || row.amount || row.excess_amount || row['Excess Amount'] || row['Amount'] || row['AMOUNT']),
    city: row.city || row['City'] || row['CITY'] || '',
    state: row.state || row['State'] || row['STATE'] || 'TX',
    zip_code: row.zip_code || row.zip || row['Zip'] || row['ZIP'] || row['Zip Code'] || '',
    case_number: row.case_number || row.cause_number || row['Case Number'] || row['Cause Number'] || row['CASE NUMBER'] || '',
    sale_date: row.sale_date || row['Sale Date'] || row['SALE DATE'] || null,
    phone: row.phone || row.phone_1 || row['Phone'] || row['PHONE'] || null,
    email: row.email || row['Email'] || row['EMAIL'] || null,
    source,
    status: 'new',
  };
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { leads, county, source: customSource } = body as {
      leads: CSVLead[];
      county?: string;
      source?: string;
    };

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'No leads provided', success: false },
        { status: 400 }
      );
    }

    const source = customSource || `csv_import_${county || 'unknown'}`;
    const results = {
      total: leads.length,
      imported: 0,
      skipped: 0,
      errors: [] as string[],
      grades: { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'CRITICAL': 0 } as Record<string, number>,
    };

    const leadsToInsert = [];

    for (let i = 0; i < leads.length; i++) {
      const row = leads[i];

      try {
        const normalized = normalizeLeadData(row, source);

        // Skip rows without required fields
        if (!normalized.owner_name || !normalized.property_address) {
          results.skipped++;
          continue;
        }

        // Score with Eleanor
        const scoringResult = calculateEleanorScore({
          id: `csv-import-${i}`,
          excess_funds_amount: normalized.excess_funds_amount as number,
          owner_name: normalized.owner_name as string,
          zip_code: normalized.zip_code as string,
          city: normalized.city as string,
          property_address: normalized.property_address as string,
        });

        // Track grade stats
        if (results.grades[scoringResult.deal_grade] !== undefined) {
          results.grades[scoringResult.deal_grade]++;
        }

        // Prepare lead for insert
        leadsToInsert.push({
          ...normalized,
          county: county || null,
          eleanor_score: scoringResult.eleanor_score,
          deal_grade: scoringResult.deal_grade,
          contact_priority: scoringResult.contact_priority,
          deal_type: scoringResult.deal_type,
          potential_revenue: scoringResult.potential_revenue,
          excess_fee: scoringResult.excess_fee,
          wholesale_fee: scoringResult.wholesale_fee,
          estimated_equity: scoringResult.estimated_equity,
          created_at: new Date().toISOString(),
        });

        results.imported++;
      } catch (err) {
        results.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        results.skipped++;
      }
    }

    // Batch insert leads
    if (leadsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('maxsam_leads')
        .insert(leadsToInsert);

      if (insertError) {
        console.error('Batch insert error:', insertError);
        return NextResponse.json(
          { error: `Database error: ${insertError.message}`, success: false },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Imported ${results.imported} leads, skipped ${results.skipped}`,
    });
  } catch (error) {
    console.error('CSV import error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
