import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json()

    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message are required' }, { status: 400 })
    }

    // Normalize phone
    const digits = phone.replace(/\D/g, '')
    let toPhone: string
    if (digits.length === 10) {
      toPhone = `+1${digits}`
    } else if (digits.length === 11 && digits.startsWith('1')) {
      toPhone = `+${digits}`
    } else {
      toPhone = `+${digits}`
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = '+18449632549'

    if (!accountSid || !authToken) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toPhone,
        From: fromNumber,
        Body: message,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Twilio API error', code: data.code },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, sid: data.sid, status: data.status })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
