import { NextResponse } from 'next/server';

type DiagnosticCheck = {
  name: string;
  status: 'ok' | 'error';
  message?: string;
};

type DiagnosticsResponse = {
  status: 'ok' | 'error';
  errors: string[];
  checks: DiagnosticCheck[];
};

export async function GET() {
  const diagnostics: DiagnosticsResponse = {
    status: 'ok',
    errors: [],
    checks: [],
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Supabase is optional — never block deploys
  if (!supabaseUrl || !supabaseKey) {
    diagnostics.status = 'error';
    diagnostics.errors.push('Supabase credentials not configured');
  } else {
    diagnostics.checks.push({
      name: 'Supabase credentials',
      status: 'ok',
    });
  }

  return NextResponse.json(diagnostics);
}
