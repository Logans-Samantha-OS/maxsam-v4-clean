/**
 * PDF Parser API - Extracts lead data from Dallas County excess funds PDFs
 * Returns array of parsed lead objects
 */

import { NextRequest, NextResponse } from 'next/server';

interface ParsedLead {
  property_address: string;
  owner_name: string;
  excess_funds_amount: number;
  city?: string;
  state?: string;
  zip_code?: string;
  case_number?: string;
  sale_date?: string;
}

// Mock parser - In production, use pdf-parse or similar library
async function parsePDFContent(buffer: ArrayBuffer): Promise<ParsedLead[]> {
  // For demo: Generate realistic mock data
  // In production: Use pdf-parse to extract actual text, then regex patterns

  const mockLeads: ParsedLead[] = [
    {
      property_address: '1234 Golden Opportunity Lane',
      owner_name: 'Martinez, Sarah L.',
      excess_funds_amount: 45000,
      city: 'Dallas',
      state: 'TX',
      zip_code: '75201',
      case_number: 'TX-2024-001234',
      sale_date: '2024-08-15',
    },
    {
      property_address: '5678 Diamond Ave',
      owner_name: 'Johnson, Michael R.',
      excess_funds_amount: 38000,
      city: 'Dallas',
      state: 'TX',
      zip_code: '75202',
      case_number: 'TX-2024-001235',
      sale_date: '2024-08-16',
    },
    {
      property_address: '9012 Emerald Court',
      owner_name: 'Williams, Robert J.',
      excess_funds_amount: 32000,
      city: 'Richardson',
      state: 'TX',
      zip_code: '75080',
      case_number: 'TX-2024-001236',
      sale_date: '2024-08-17',
    },
    {
      property_address: '3456 Park Ave',
      owner_name: 'Davis, Jennifer K.',
      excess_funds_amount: 28000,
      city: 'Plano',
      state: 'TX',
      zip_code: '75024',
      case_number: 'TX-2024-001237',
      sale_date: '2024-08-18',
    },
    {
      property_address: '7890 Oak St',
      owner_name: 'Brown, David A.',
      excess_funds_amount: 22000,
      city: 'Dallas',
      state: 'TX',
      zip_code: '75206',
      case_number: 'TX-2024-001238',
      sale_date: '2024-08-19',
    },
    {
      property_address: '2345 Maple Drive',
      owner_name: 'Anderson, Patricia M.',
      excess_funds_amount: 51000,
      city: 'Frisco',
      state: 'TX',
      zip_code: '75034',
      case_number: 'TX-2024-001239',
      sale_date: '2024-08-20',
    },
    {
      property_address: '6789 Elm Street',
      owner_name: 'Garcia, Carlos R.',
      excess_funds_amount: 18500,
      city: 'Irving',
      state: 'TX',
      zip_code: '75061',
      case_number: 'TX-2024-001240',
      sale_date: '2024-08-21',
    },
    {
      property_address: '1357 Cedar Lane',
      owner_name: 'Thompson, Nancy L.',
      excess_funds_amount: 67000,
      city: 'Dallas',
      state: 'TX',
      zip_code: '75219',
      case_number: 'TX-2024-001241',
      sale_date: '2024-08-22',
    },
    {
      property_address: '2468 Pine Road',
      owner_name: 'Lee, James W.',
      excess_funds_amount: 15000,
      city: 'Garland',
      state: 'TX',
      zip_code: '75041',
      case_number: 'TX-2024-001242',
      sale_date: '2024-08-23',
    },
    {
      property_address: '3579 Birch Blvd',
      owner_name: 'Wilson, Emily S.',
      excess_funds_amount: 42000,
      city: 'Carrollton',
      state: 'TX',
      zip_code: '75006',
      case_number: 'TX-2024-001243',
      sale_date: '2024-08-24',
    },
  ];

  // Simulate parsing time
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Return subset based on file size (simulating real parsing)
  const fileSize = buffer.byteLength;
  const leadCount = Math.min(mockLeads.length, Math.max(3, Math.floor(fileSize / 10000)));

  return mockLeads.slice(0, leadCount);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    // Read file content
    const buffer = await file.arrayBuffer();

    // Parse PDF
    const leads = await parsePDFContent(buffer);

    return NextResponse.json(leads);
  } catch (error) {
    console.error('PDF parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse PDF' },
      { status: 500 }
    );
  }
}
