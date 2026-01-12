import { docusign } from '@/lib/docusign';
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, contractId, envelopeId } = body;

    if (action === 'send') {
      // Fetch contract details with related lead and buyer
      const { data: contract, error } = await supabase
        .from('contracts')
        .select('*, maxsam_leads(*), buyers(*)')
        .eq('id', contractId)
        .single();

      if (error) {
        console.error('Supabase contract fetch error:', error);
        return NextResponse.json({ error: 'Contract fetch error' }, { status: 500 });
      }

      if (!contract) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }

      // Send to DocuSign
      const envelope = await docusign.createEnvelope(
        contract,
        contract.maxsam_leads,
        contract.buyers,
      );

      // Update contract with envelope ID and status
      await supabase
        .from('contracts')
        .update({
          docusign_envelope_id: envelope.envelopeId,
          status: 'sent',
        })
        .eq('id', contractId);

      return NextResponse.json({
        success: true,
        envelopeId: envelope.envelopeId,
      });
    }

    if (action === 'status') {
      if (!envelopeId) {
        return NextResponse.json({ error: 'Missing envelopeId' }, { status: 400 });
      }
      const status = await docusign.getEnvelopeStatus(envelopeId);
      return NextResponse.json(status);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('DocuSign API error:', error);
    return NextResponse.json(
      {
        error: error.message,
        details: 'DocuSign not configured or API error',
      },
      { status: 500 },
    );
  }
}
