/**
 * Distressed Properties Import API
 * N8N webhook endpoint for importing distressed properties from Zillow/Redfin
 *
 * POST /api/distressed/import
 * Body: { properties: Array<DistressedProperty>, source: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface DistressedPropertyData {
  property_address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  owner_name?: string;
  list_price?: number;
  zestimate?: number;
  listing_status?: string;
  days_on_market?: number;
  listing_url?: string;
}

interface DistressedImportRequest {
  properties: DistressedPropertyData[];
  source: string; // 'zillow', 'redfin', 'auction.com', 'foreclosure.com'
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body: DistressedImportRequest = await request.json();
    const { properties, source } = body;

    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      return NextResponse.json(
        { error: 'properties array is required and must not be empty', success: false },
        { status: 400 }
      );
    }

    if (!source) {
      return NextResponse.json(
        { error: 'source is required (e.g., "zillow", "redfin")', success: false },
        { status: 400 }
      );
    }

    // Prepare properties for insert
    const propertiesToInsert = properties.map((prop) => ({
      source,
      property_address: prop.property_address,
      city: prop.city || null,
      state: prop.state || 'TX',
      zip_code: prop.zip_code || null,
      owner_name: prop.owner_name || null,
      list_price: prop.list_price || null,
      zestimate: prop.zestimate || null,
      listing_status: prop.listing_status || null,
      days_on_market: prop.days_on_market || null,
      listing_url: prop.listing_url || null,
      scraped_at: new Date().toISOString(),
    }));

    // Insert properties
    const { data: insertedProps, error } = await supabase
      .from('distressed_properties')
      .insert(propertiesToInsert)
      .select('id');

    if (error) {
      console.error('[Distressed Import] Insert error:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imported: insertedProps?.length || 0,
      total_submitted: properties.length,
      source,
      message: `Successfully imported ${insertedProps?.length || 0} distressed properties from ${source}`,
    });
  } catch (error) {
    console.error('[Distressed Import] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
