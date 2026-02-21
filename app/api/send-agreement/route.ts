import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET_NAME = 'agreements'

/**
 * Ensures the agreements storage bucket exists in Supabase Storage.
 * Creates it if missing.
 */
async function ensureBucket(supabase: ReturnType<typeof createClient>) {
  const { data: bucket } = await supabase.storage.getBucket(BUCKET_NAME)
  if (!bucket) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    })
    if (error && !error.message?.includes('already exists')) {
      console.error('[Storage] Failed to create bucket:', error.message)
    }
  }
}

/**
 * POST /api/send-agreement
 * Actions: generate, send, generate_and_send
 *
 * Body:
 * - action: 'generate' | 'send' | 'generate_and_send'
 * - lead_id: UUID (required)
 * - agreement_type: 'excess_funds' | 'wholesale' (default: 'excess_funds')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action = 'generate_and_send', lead_id, agreement_type = 'excess_funds' } = body

    if (!lead_id) {
      return NextResponse.json({ success: false, error: 'lead_id is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: `Lead not found: ${lead_id}` },
        { status: 404 }
      )
    }

    let pdfUrl: string | null = null

    // Generate PDF
    if (action === 'generate' || action === 'generate_and_send') {
      await ensureBucket(supabase)

      // Try to generate PDF with pdf-lib
      try {
        const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

        const pdfDoc = await PDFDocument.create()
        const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman)
        const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
        const fontSize = 11
        const titleFontSize = 16

        const page = pdfDoc.addPage([612, 792]) // US Letter
        const { height } = page.getSize()
        let y = height - 72

        const ownerName = lead.owner_name || 'Property Owner'
        const excessAmount = Number(lead.excess_funds_amount || 0)
        const feePercent = agreement_type === 'wholesale' ? 10 : 25
        const feeAmount = excessAmount * (feePercent / 100)
        const propertyAddress = lead.property_address || 'N/A'
        const caseNumber = lead.case_number || 'N/A'
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

        const title = agreement_type === 'wholesale'
          ? 'REAL ESTATE ASSIGNMENT / FINDER SERVICES AGREEMENT'
          : 'EXCESS FUNDS RECOVERY SERVICES AGREEMENT'

        // Title
        page.drawText(title, { x: 72, y, font: timesRomanBold, size: titleFontSize, color: rgb(0, 0, 0) })
        y -= 30

        // Date
        page.drawText(`Date: ${today}`, { x: 72, y, font: timesRoman, size: fontSize })
        y -= 20

        // Parties
        page.drawText(`Client: ${ownerName}`, { x: 72, y, font: timesRoman, size: fontSize })
        y -= 16
        page.drawText(`Property: ${propertyAddress}`, { x: 72, y, font: timesRoman, size: fontSize })
        y -= 16
        page.drawText(`Case Number: ${caseNumber}`, { x: 72, y, font: timesRoman, size: fontSize })
        y -= 16
        page.drawText(`Recovery Amount: $${excessAmount.toLocaleString()}`, { x: 72, y, font: timesRomanBold, size: fontSize })
        y -= 16
        page.drawText(`Service Fee: ${feePercent}% ($${feeAmount.toLocaleString()})`, { x: 72, y, font: timesRoman, size: fontSize })
        y -= 30

        // Agreement body
        const lines = [
          `This agreement is entered into between ${ownerName} ("Client") and Logan Toups ("Service Provider").`,
          '',
          `The Service Provider agrees to assist in the recovery of excess funds totaling $${excessAmount.toLocaleString()}`,
          `from the property at ${propertyAddress}, case ${caseNumber}.`,
          '',
          `In consideration for these services, the Client agrees to pay the Service Provider a fee of ${feePercent}%`,
          `of the recovered amount ($${feeAmount.toLocaleString()}).`,
          '',
          'The fee is contingent upon successful recovery. No upfront payment is required.',
          '',
          '___________________________________          ___________________________________',
          `${ownerName}                                              Logan Toups`,
          'Client Signature                                          Service Provider',
        ]

        for (const line of lines) {
          if (y < 72) {
            const newPage = pdfDoc.addPage([612, 792])
            y = newPage.getSize().height - 72
            newPage.drawText(line, { x: 72, y, font: timesRoman, size: fontSize })
          } else {
            page.drawText(line, { x: 72, y, font: timesRoman, size: fontSize })
          }
          y -= 16
        }

        const pdfBytes = await pdfDoc.save()

        // Upload to Supabase Storage
        const filename = `${lead_id}/${agreement_type}_${Date.now()}.pdf`
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filename, pdfBytes, { contentType: 'application/pdf', upsert: true })

        if (uploadError) {
          console.error('[Storage] Upload error:', uploadError.message)
          // Fallback: store as base64 in metadata
        } else {
          const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename)
          pdfUrl = urlData?.publicUrl || null
        }
      } catch (pdfError) {
        console.error('[PDF] Generation error:', pdfError)
        // Non-fatal — continue with signing link flow
      }
    }

    // Send via SMS
    if (action === 'send' || action === 'generate_and_send') {
      const phone = lead.phone || lead.phone_1 || lead.phone_2
      if (phone && pdfUrl) {
        const { sendSMS } = await import('@/lib/twilio')
        const firstName = (lead.owner_name || 'there').split(/[,\s]+/)[0]
        const msg = `${firstName}, your agreement is ready to review and sign: ${pdfUrl}\n\nNo upfront cost. -Sam, MaxSam Recovery`
        const smsResult = await sendSMS(phone, msg, lead_id)

        // Log to sms_messages so Messaging Center sees this
        if (smsResult.success) {
          try {
            await supabase.from('sms_messages').insert({
              lead_id,
              direction: 'outbound',
              message: msg,
              to_number: phone,
              from_number: process.env.TWILIO_PHONE_NUMBER || '+18449632549',
              status: 'sent',
              created_at: new Date().toISOString(),
              twilio_sid: (smsResult as Record<string, unknown>).sid || (smsResult as Record<string, unknown>).messageSid || null,
            })
          } catch {
            console.warn('[SendAgreement] Could not log SMS to sms_messages')
          }
        }
      }
    }

    // Update agreements table
    try {
      await supabase.from('agreements').insert({
        lead_id,
        type: agreement_type,
        status: pdfUrl ? 'sent' : 'draft',
        fee_percent: agreement_type === 'wholesale' ? 10 : 25,
        metadata: pdfUrl ? { pdf_url: pdfUrl } : null,
        sent_at: pdfUrl ? new Date().toISOString() : null,
      })
    } catch {
      // agreements table may not exist yet
    }

    return NextResponse.json({
      success: true,
      pdf_url: pdfUrl,
      lead_id,
      agreement_type,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send agreement'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
