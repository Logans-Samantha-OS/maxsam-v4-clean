import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SEED_SKILLS = [
  { slug: 'skip-trace', name: 'ALEX Skip Trace', description: 'Enriches leads with phone numbers, emails, relatives, and addresses via Apify skip trace API', version: '1.0.0', status: 'active', agent_owner: 'ALEX' },
  { slug: 'eleanor-score', name: 'Eleanor Lead Scoring', description: 'Scores leads A-F based on excess funds amount, property data, heir status, and recovery probability', version: '1.0.0', status: 'active', agent_owner: 'ELEANOR' },
  { slug: 'sam-outreach', name: 'SAM SMS Outreach', description: 'Sends initial compliant SMS to leads with opt-in request, manages two-phase messaging', version: '1.0.0', status: 'active', agent_owner: 'SAM' },
  { slug: 'contract-generate', name: 'Agreement Generator', description: 'Generates PDF contracts from lead data using excess funds or wholesale templates', version: '1.0.0', status: 'active', agent_owner: 'SYSTEM' },
  { slug: 'contract-send', name: 'Agreement Sender', description: 'Sends generated agreement PDF link via SMS to lead', version: '1.0.0', status: 'active', agent_owner: 'SAM' },
  { slug: 'batch-import', name: 'Batch Lead Import', description: 'Imports leads from Dallas County excess funds PDF extractions', version: '1.0.0', status: 'active', agent_owner: 'ALEX' },
  { slug: 'lead-classify', name: 'Lead Classification', description: 'Classifies leads as excess_funds, wholesale, or golden_lead based on data overlap', version: '1.0.0', status: 'active', agent_owner: 'ELEANOR' },
]

export async function POST() {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('skills_registry')
      .upsert(SEED_SKILLS, { onConflict: 'slug' })
      .select()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, seeded: data?.length || 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
