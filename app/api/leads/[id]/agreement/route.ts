import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// JotForm IDs
const JOTFORM_IDS = {
  excess_funds: '260227337890056',
  distressed_property: '260227208476053',
}

/**
 * POST /api/leads/[id]/agreement - Send agreement link to lead
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { type = 'excess_funds' } = body

    const supabase = getSupabase()

    // Get lead info
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const phone = lead.phone || lead.phone_1 || lead.phone_2
    if (!phone) {
      return NextResponse.json({ error: 'No phone number for this lead' }, { status: 400 })
    }

    // Build JotForm pre-fill URL(s)
    const buildJotFormUrl = (formId: string) => {
      const params = new URLSearchParams({
        'ownerName': lead.owner_name || '',
        'propertyAddress': lead.property_address || '',
        'city': lead.city || '',
        'county': lead.county || '',
        'state': lead.state || 'TX',
        'excessFundsAmount': String(lead.excess_funds_amount || 0),
        'caseNumber': lead.excess_funds_case_number || lead.case_number || '',
      })
      return `https://form.jotform.com/${formId}?${params.toString()}`
    }

    let message = ''
    const links: string[] = []

    if (type === 'excess_funds' || type === 'both') {
      const excessFundsUrl = buildJotFormUrl(JOTFORM_IDS.excess_funds)
      links.push(excessFundsUrl)
      message = `Hi ${lead.owner_name?.split(' ')[0] || 'there'}! Here's your Excess Funds Recovery Agreement. It only takes a minute to complete: ${excessFundsUrl}`
    }

    if (type === 'distressed_property' || type === 'both') {
      const distressedPropertyUrl = buildJotFormUrl(JOTFORM_IDS.distressed_property)
      links.push(distressedPropertyUrl)
      if (type === 'both') {
        message += `\n\nAnd here's the Real Estate Purchase Agreement: ${distressedPropertyUrl}`
      } else {
        message = `Hi ${lead.owner_name?.split(' ')[0] || 'there'}! Here's your Real Estate Purchase & Assignment Agreement: ${distressedPropertyUrl}`
      }
    }

    // Format phone number
    const formattedPhone = phone.startsWith('+')
      ? phone
      : phone.startsWith('1')
        ? `+${phone}`
        : `+1${phone.replace(/\D/g, '')}`

    // Send via N8N webhook
    const webhookUrl = 'https://skooki.app.n8n.cloud/webhook/sam-initial-outreach'

    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: id,
          owner_name: lead.owner_name,
          phone: formattedPhone,
          message,
          source: 'agreement_sender',
        }),
      })

      if (!webhookResponse.ok) {
        console.warn('N8N webhook failed, continuing anyway')
      }
    } catch (webhookError) {
      console.error('N8N webhook error:', webhookError)
    }

    // Log the outbound message
    await supabase
      .from('sms_messages')
      .insert({
        lead_id: id,
        direction: 'outbound',
        message,
        from_number: process.env.TWILIO_PHONE_NUMBER || '+18449632549',
        to_number: formattedPhone,
        status: 'sent',
        intent: 'agreement_sent',
        created_at: new Date().toISOString(),
      })

    // Update lead status
    await supabase
      .from('maxsam_leads')
      .update({
        status: 'agreement_sent',
        agreement_type: type,
        last_contact_at: new Date().toISOString(),
        contact_attempts: (lead.contact_attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      message: `Agreement link(s) sent to ${lead.owner_name}`,
      links,
      type,
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send agreement'
    console.error('Agreement send error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
