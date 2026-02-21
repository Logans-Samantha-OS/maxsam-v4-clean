import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/county-filing?county=Dallas County
 * Returns the filing template for a given county.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const county = req.nextUrl.searchParams.get('county') || 'Dallas County'

    const { data, error } = await supabase
      .from('county_filing_templates')
      .select('*')
      .eq('county_name', county)
      .single()

    if (error || !data) {
      return NextResponse.json({
        success: false,
        error: `No filing template found for ${county}`,
      }, { status: 404 })
    }

    return NextResponse.json({ success: true, template: data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch filing template'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/county-filing
 * Seeds or updates a county filing template.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const action = body.action || 'seed_dallas'

    if (action === 'seed_dallas') {
      const { error } = await supabase.from('county_filing_templates').upsert({
        county_name: 'Dallas County',
        state: 'TX',
        filing_method: 'mail',
        filing_address: 'Dallas County Tax Office, 500 Elm Street, Suite 3300, Dallas, TX 75202',
        filing_phone: '(214) 653-7811',
        filing_url: 'https://www.dallascounty.org/departments/tax/',
        department_name: 'Dallas County Tax Office - Excess Funds',
        required_documents: [
          'Signed Assignment Agreement (original)',
          'Notarized Affidavit of Identity',
          'Copy of government-issued photo ID (front and back)',
          'Proof of ownership at time of sale (deed or tax records)',
          'Copy of the tax sale order / judgment',
          'W-9 form for payee',
          'Power of Attorney (if filing on behalf of owner)',
          'Certified copy of Letters Testamentary (if deceased owner)',
          'Cover letter with case number and property address',
        ],
        filing_fee: 0,
        fee_notes: 'No filing fee for excess funds claims',
        estimated_processing_days: 90,
        processing_notes: 'County typically processes within 60-90 days. May request additional documentation.',
        notes: 'Mail original signed documents. Keep copies of everything. Include a self-addressed stamped envelope for return correspondence. Reference the cause number on all documents.',
      }, { onConflict: 'county_name,state' })

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Dallas County filing template seeded' })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to seed filing template'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
