import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getContractStatus, resendContract } from '@/lib/contract-generator';
import { createContractInvoice } from '@/lib/stripe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/contracts/[id] - Get contract details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('contracts')
      .select('*, maxsam_leads(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Get revenue record
    const { data: revenue } = await supabase
      .from('revenue')
      .select('*')
      .eq('contract_id', id)
      .single();

    return NextResponse.json({
      contract: data,
      lead: data.maxsam_leads,
      revenue
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/contracts/[id] - Perform action on contract
 * Actions: resend, create-invoice, void
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'resend': {
        const result = await resendContract(id);
        return NextResponse.json(result);
      }

      case 'create-invoice': {
        const result = await createContractInvoice(id);
        return NextResponse.json(result);
      }

      case 'void': {
        const supabase = createClient();

        // Get contract to check status
        const { data: contract } = await supabase
          .from('contracts')
          .select('status, docusign_envelope_id')
          .eq('id', id)
          .single();

        if (!contract) {
          return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        if (contract.status === 'signed' || contract.status === 'paid') {
          return NextResponse.json(
            { error: 'Cannot void a signed or paid contract' },
            { status: 400 }
          );
        }

        // Update contract status
        await supabase
          .from('contracts')
          .update({ status: 'rejected' })
          .eq('id', id);

        // Update lead status
        const { data: updatedContract } = await supabase
          .from('contracts')
          .select('lead_id')
          .eq('id', id)
          .single();

        if (updatedContract) {
          await supabase
            .from('maxsam_leads')
            .update({ status: 'contacted' })
            .eq('id', updatedContract.lead_id);
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: resend, create-invoice, void' },
          { status: 400 }
        );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
