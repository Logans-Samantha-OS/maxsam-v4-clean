import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

/**
 * GET /api/sign/validate?token=xxx
 *
 * Called by the /sign page on mount.
 * Verifies HMAC token, checks 30-day expiry, checks for duplicate signature,
 * fetches lead data from the leads table, returns everything the page needs.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const secret = process.env.SIGNING_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Signing not configured' }, { status: 500 })
    }

    // Decode base64url token
    let decoded: string
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf-8')
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    // Parse lead_id:agreement_type:expires:hmac
    const parts = decoded.split(':')
    if (parts.length !== 4) {
      return NextResponse.json({ error: 'Malformed token' }, { status: 400 })
    }

    const [leadId, agreementType, expiresStr, providedHmac] = parts
    const expires = parseInt(expiresStr, 10)

    // Verify HMAC
    const payload = `${leadId}:${agreementType}:${expiresStr}`
    const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    try {
      if (!crypto.timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    // Check expiry
    if (Date.now() > expires) {
      return NextResponse.json({
        error: 'expired',
        message: 'This signing link has expired. Please request a new one via text.',
      }, { status: 410 })
    }

    const supabase = createClient()

    // Check if already signed
    const { data: existingSig } = await supabase
      .from('signed_agreements')
      .select('id, signed_at')
      .eq('lead_id', leadId)
      .eq('agreement_type', agreementType)
      .limit(1)

    if (existingSig && existingSig.length > 0) {
      return NextResponse.json({
        error: 'already_signed',
        message: 'This agreement has already been signed.',
        signed_at: existingSig[0].signed_at,
      }, { status: 409 })
    }

    // Fetch lead data — select all available fields for maximum agreement specificity
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select(`
        id, owner_name, property_address, property_city, property_zip, zip_code,
        excess_amount, excess_funds_amount, case_number, cause_number,
        excess_funds_case_number,
        county, county_name, phone, primary_phone, email, primary_email,
        state, status, expiry_date, expiration_date, days_until_expiration,
        sale_date, deal_type, city,
        estimated_arv, estimated_equity, estimated_repair_cost
      `)
      .eq('id', leadId)
      .single()

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const excessAmount = lead.excess_amount || lead.excess_funds_amount || 0
    const caseNumber = lead.case_number || lead.cause_number || lead.excess_funds_case_number || ''
    const countyName = lead.county || lead.county_name || 'Dallas'
    const phone = lead.phone || lead.primary_phone || ''
    const email = lead.email || lead.primary_email || ''
    const city = lead.property_city || lead.city || 'Dallas'
    const state = lead.state || 'TX'
    const zip = lead.property_zip || lead.zip_code || ''
    const expiryDate = lead.expiry_date || lead.expiration_date || null
    const saleDate = lead.sale_date || null

    // Compute days until expiration if not stored
    let daysUntilExpiration = lead.days_until_expiration ?? null
    if (daysUntilExpiration == null && expiryDate) {
      const expDate = new Date(expiryDate)
      daysUntilExpiration = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    }

    // Fee calculation
    let feePercent = 25
    let calculatedFee = excessAmount * 0.25
    if (agreementType === 'wholesale') {
      feePercent = 10
      calculatedFee = (lead.estimated_equity || excessAmount) * 0.10
    }

    return NextResponse.json({
      success: true,
      agreement_type: agreementType,
      lead: {
        id: lead.id,
        owner_name: lead.owner_name,
        property_address: lead.property_address,
        city,
        state,
        zip,
        excess_amount: excessAmount,
        case_number: caseNumber,
        county: countyName,
        phone,
        email,
        expiry_date: expiryDate,
        sale_date: saleDate,
        days_until_expiration: daysUntilExpiration,
        deal_type: lead.deal_type || null,
        estimated_arv: lead.estimated_arv || null,
        estimated_equity: lead.estimated_equity || null,
        estimated_repair_cost: lead.estimated_repair_cost || null,
      },
      fee_percent: feePercent,
      calculated_fee: calculatedFee,
      expires_at: new Date(expires).toISOString(),
    })
  } catch (error) {
    console.error('[Sign Validate] Error:', error)
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 })
  }
}
