/**
 * DEPRECATED: BoldSign has been replaced by self-hosted e-signature system.
 * Use POST /api/agreements instead.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'BoldSign integration has been removed. Use POST /api/agreements to send agreements via the self-hosted signing system.',
      migration: 'POST /api/agreements with { lead_id, selection_code }',
    },
    { status: 410 }
  );
}
