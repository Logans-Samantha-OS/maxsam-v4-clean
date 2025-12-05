import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateContract, ContractType } from '@/lib/contract-generator';

/**
 * GET /api/contracts - List all contracts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    let query = supabase.from('contracts').select('*, maxsam_leads(owner_name, property_address)');

    // Filters
    const status = searchParams.get('status');
    if (status) {
      query = query.eq('status', status);
    }

    const paymentStatus = searchParams.get('payment_status');
    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus);
    }

    const contractType = searchParams.get('type');
    if (contractType) {
      query = query.eq('contract_type', contractType);
    }

    // Sorting
    query = query.order('created_at', { ascending: false });

    // Pagination
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contracts: data });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/contracts - Create and send a contract
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, contract_type } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    if (!['excess_funds', 'wholesale', 'dual'].includes(contract_type)) {
      return NextResponse.json(
        { error: 'contract_type must be: excess_funds, wholesale, or dual' },
        { status: 400 }
      );
    }

    const result = await generateContract(lead_id, contract_type as ContractType);

    if (result.success) {
      return NextResponse.json({
        success: true,
        contract_id: result.contractId,
        envelope_id: result.envelopeId
      }, { status: 201 });
    }

    return NextResponse.json({ error: result.error }, { status: 500 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
