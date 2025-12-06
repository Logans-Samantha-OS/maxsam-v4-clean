/**
 * Lead Processing API with Server-Sent Events
 * Scores leads with Eleanor AI and streams results back
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateEleanorScore } from '@/lib/eleanor';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface ImportLead {
  property_address: string;
  owner_name: string;
  excess_funds_amount: number;
  city?: string;
  state?: string;
  zip_code?: string;
  case_number?: string;
  sale_date?: string;
}

interface ProcessOptions {
  skipTrace?: boolean;
  addToOutreach?: boolean;
}

export async function POST(request: NextRequest) {
  const { leads, options } = await request.json() as {
    leads: ImportLead[];
    options: ProcessOptions;
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const supabase = getSupabase();
      const grades = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
      let totalPotential = 0;
      let hotLeads = 0;

      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];

        // Simulate processing delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 300));

        // Score with Eleanor
        const scoringResult = calculateEleanorScore({
          id: `import-${i}`,
          excess_funds_amount: lead.excess_funds_amount,
          owner_name: lead.owner_name,
          zip_code: lead.zip_code,
          city: lead.city,
          property_address: lead.property_address,
        });

        // Track stats
        grades[scoringResult.deal_grade]++;
        totalPotential += scoringResult.potential_revenue;
        if (scoringResult.deal_grade === 'A+' || scoringResult.deal_grade === 'A') {
          hotLeads++;
        }

        // Prepare lead data for database
        const leadData = {
          property_address: lead.property_address,
          owner_name: lead.owner_name,
          excess_funds_amount: lead.excess_funds_amount,
          city: lead.city,
          state: lead.state || 'TX',
          zip_code: lead.zip_code,
          case_number: lead.case_number,
          sale_date: lead.sale_date,
          eleanor_score: scoringResult.eleanor_score,
          deal_grade: scoringResult.deal_grade,
          contact_priority: scoringResult.contact_priority,
          deal_type: scoringResult.deal_type,
          potential_revenue: scoringResult.potential_revenue,
          excess_fee: scoringResult.excess_fee,
          wholesale_fee: scoringResult.wholesale_fee,
          estimated_equity: scoringResult.estimated_equity,
          status: 'new',
          source: 'import',
          created_at: new Date().toISOString(),
        };

        // Save to database
        try {
          await supabase.from('maxsam_leads').insert([leadData]);
        } catch (err) {
          console.error('Failed to save lead:', err);
        }

        // Send scored lead update
        const update = {
          type: 'scored',
          lead: {
            ...lead,
            eleanor_score: scoringResult.eleanor_score,
            deal_grade: scoringResult.deal_grade,
            deal_type: scoringResult.deal_type,
            potential_revenue: scoringResult.potential_revenue,
          },
          progress: Math.round(((i + 1) / leads.length) * 100),
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
      }

      // Send completion summary
      const summary = {
        type: 'complete',
        summary: {
          total: leads.length,
          scored: leads.length,
          hotLeads,
          grades,
          totalPotential,
          projectedRevenue: totalPotential,
        },
      };

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(summary)}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
