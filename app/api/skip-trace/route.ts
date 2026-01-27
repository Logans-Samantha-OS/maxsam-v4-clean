import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const { leadId, name, address, cityStateZip } = await request.json();

    if (!leadId || (!name && !address)) {
      return NextResponse.json({ error: 'Need leadId and name or address' }, { status: 400 });
    }

    // Build Apify input
    const apifyInput: any = { max_results: 1 };
    if (name) {
      apifyInput.name = cityStateZip ? [`${name}; ${cityStateZip}`] : [name];
    }
    if (address && cityStateZip) {
      apifyInput.street_citystatezip = [`${address}; ${cityStateZip}`];
    }

    // Call Apify Skip Trace Actor
    const response = await fetch(
      `https://api.apify.com/v2/acts/one-api~skip-trace/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyInput)
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Apify API failed' }, { status: 503 });
    }

    const runData = await response.json();
    const runId = runData.data.id;

    // Wait for completion (max 30 seconds)
    let status = 'RUNNING';
    let attempts = 0;
    while (status === 'RUNNING' && attempts < 30) {
      await new Promise(r => setTimeout(r, 1000));
      const check = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      status = (await check.json()).data.status;
      attempts++;
    }

    if (status !== 'SUCCEEDED') {
      return NextResponse.json({ error: 'Skip trace timed out' }, { status: 504 });
    }

    // Get results
    const datasetId = runData.data.defaultDatasetId;
    const results = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
    const data = await results.json();

    if (!data || data.length === 0) {
      return NextResponse.json({ success: true, message: 'No results found', data: null });
    }

    const person = data[0];

    // Extract phones
    const allPhones = [];
    let bestPhone = null;
    for (let i = 1; i <= 5; i++) {
      const phone = person[`Phone-${i}`];
      const type = person[`Phone-${i} Type`];
      if (phone) {
        allPhones.push({ number: phone, type });
        if (!bestPhone || type === 'Wireless') bestPhone = phone;
      }
    }

    // Extract emails
    const allEmails = [];
    for (let i = 1; i <= 5; i++) {
      if (person[`Email-${i}`]) allEmails.push(person[`Email-${i}`]);
    }

    // Update lead in Supabase
    await supabase.from('leads').update({
      phone: bestPhone,
      all_phones: allPhones,
      email: allEmails[0] || null,
      all_emails: allEmails,
      current_address: person['Lives in'],
      age: person['Age'] ? parseInt(person['Age']) : null,
      skip_trace_completed_at: new Date().toISOString(),
      skip_trace_raw: person
    }).eq('id', leadId);

    return NextResponse.json({
      success: true,
      data: { phone: bestPhone, allPhones, email: allEmails[0], allEmails, address: person['Lives in'] }
    });

  } catch (error) {
    console.error('Skip trace error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}