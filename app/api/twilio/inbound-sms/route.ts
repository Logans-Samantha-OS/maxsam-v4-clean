import { NextRequest, NextResponse } from 'next/server';
import { processInboundSMS } from '@/lib/sam-outreach';

/**
 * POST /api/twilio/inbound-sms - Handle incoming SMS from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    // Twilio sends form data
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;

    if (!from || !body) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    console.log(`Inbound SMS from ${from}: ${body}`);

    // Process the message
    const result = await processInboundSMS(from, body);

    // Return TwiML response
    if (result.response) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${escapeXml(result.response)}</Message>
        </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Empty response for unknown messages
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (error: unknown) {
    console.error('Twilio inbound SMS error:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
