/**
 * URL Scraper API - Scrapes Dallas County excess funds pages
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

// Mock scraper - In production, use puppeteer or cheerio
async function scrapeUrl(url: string): Promise<ParsedLead[]> {
  // Validate URL
  if (!url.includes('county') && !url.includes('gov') && !url.includes('localhost')) {
    throw new Error('Invalid URL - must be a county or government website');
  }

  // Simulate scraping delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock data (in production: actual scraping)
  const mockLeads: ParsedLead[] = [
    {
      property_address: '4521 Prosperity Way',
      owner_name: 'Rodriguez, Maria E.',
      excess_funds_amount: 55000,
      city: 'Dallas',
      state: 'TX',
      zip_code: '75214',
      case_number: 'TX-2024-002001',
      sale_date: '2024-09-01',
    },
    {
      property_address: '8765 Success Blvd',
      owner_name: 'Smith, Thomas J.',
      excess_funds_amount: 39500,
      city: 'Dallas',
      state: 'TX',
      zip_code: '75204',
      case_number: 'TX-2024-002002',
      sale_date: '2024-09-02',
    },
    {
      property_address: '3210 Fortune Lane',
      owner_name: 'Kim, Susan H.',
      excess_funds_amount: 72000,
      city: 'Plano',
      state: 'TX',
      zip_code: '75093',
      case_number: 'TX-2024-002003',
      sale_date: '2024-09-03',
    },
    {
      property_address: '6543 Wealth Circle',
      owner_name: 'Patel, Raj K.',
      excess_funds_amount: 29000,
      city: 'McKinney',
      state: 'TX',
      zip_code: '75070',
      case_number: 'TX-2024-002004',
      sale_date: '2024-09-04',
    },
    {
      property_address: '9876 Treasure Ave',
      owner_name: 'Nguyen, Linda T.',
      excess_funds_amount: 48000,
      city: 'Dallas',
      state: 'TX',
      zip_code: '75226',
      case_number: 'TX-2024-002005',
      sale_date: '2024-09-05',
    },
    {
      property_address: '1111 Opportunity Dr',
      owner_name: 'Miller, Kevin W.',
      excess_funds_amount: 33000,
      city: 'Richardson',
      state: 'TX',
      zip_code: '75081',
      case_number: 'TX-2024-002006',
      sale_date: '2024-09-06',
    },
    {
      property_address: '2222 Victory Lane',
      owner_name: 'Taylor, Angela M.',
      excess_funds_amount: 61000,
      city: 'Allen',
      state: 'TX',
      zip_code: '75013',
      case_number: 'TX-2024-002007',
      sale_date: '2024-09-07',
    },
    {
      property_address: '3333 Champion Court',
      owner_name: 'White, Christopher R.',
      excess_funds_amount: 27500,
      city: 'Carrollton',
      state: 'TX',
      zip_code: '75007',
      case_number: 'TX-2024-002008',
      sale_date: '2024-09-08',
    },
  ];

  return mockLeads;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'No URL provided' },
        { status: 400 }
      );
    }

    const leads = await scrapeUrl(url);

    return NextResponse.json(leads);
  } catch (error) {
    console.error('URL scrape error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scrape URL' },
      { status: 500 }
    );
  }
}
