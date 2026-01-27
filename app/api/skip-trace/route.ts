import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, name, address, cityStateZip } = body

    if (!leadId || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: leadId and name' },
        { status: 400 }
      )
    }

    const apiToken = process.env.APIFY_API_TOKEN
    if (!apiToken) {
      console.error('APIFY_API_TOKEN not configured')
      return NextResponse.json(
        { success: false, error: 'Apify API not configured' },
        { status: 500 }
      )
    }

    // Format the search query for Apify one-api/skip-trace
    // Format: "Full Name; City, State Zip" or just "Full Name"
    const searchQuery = cityStateZip ? `${name}; ${cityStateZip}` : name

    // Call Apify Actor with CORRECT input format
    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/one-api~skip-trace/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: [searchQuery],
          max_results: 1
        }),
      }
    )

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text()
      console.error('Apify API error:', apifyResponse.status, errorText)
      return NextResponse.json(
        { success: false, error: `Apify API failed: ${apifyResponse.status}` },
        { status: 502 }
      )
    }

    const runData = await apifyResponse.json()
    const runId = runData.data?.id

    if (!runId) {
      return NextResponse.json(
        { success: false, error: 'No run ID returned from Apify' },
        { status: 500 }
      )
    }

    // Wait for the run to complete (poll for up to 60 seconds)
    let results = null
    const maxWaitTime = 60000
    const pollInterval = 2000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`
      )
      const statusData = await statusResponse.json()
      const status = statusData.data?.status

      if (status === 'SUCCEEDED') {
        // Get the dataset items
        const datasetId = statusData.data?.defaultDatasetId
        if (datasetId) {
          const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
          )
          results = await datasetResponse.json()
        }
        break
      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        return NextResponse.json(
          { success: false, error: `Apify run ${status}` },
          { status: 500 }
        )
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    if (!results || results.length === 0) {
      // Update lead status even if no results found
      await supabase
        .from('leads')
        .update({ 
          status: 'skip_traced',
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      return NextResponse.json({
        success: true,
        message: 'Skip trace completed but no results found',
        phone: null
      })
    }

    // Extract phone from first result
    const firstResult = results[0]
    const phone = firstResult['Phone-1'] || firstResult['Phone-2'] || null
    const email = firstResult['Email-1'] || null

    // Update lead in database
    const updateData: Record<string, unknown> = {
      status: 'skip_traced',
      updated_at: new Date().toISOString()
    }

    if (phone) {
      updateData.primary_phone = phone
      updateData.phone = phone
    }
    if (email) {
      updateData.primary_email = email
    }

    // Store full result in notes or a JSON field if available
    updateData.notes = `Skip trace result: ${JSON.stringify(firstResult).slice(0, 500)}`

    const { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)

    if (updateError) {
      console.error('Database update error:', updateError)
    }

    return NextResponse.json({
      success: true,
      phone,
      email,
      fullName: `${firstResult['First Name'] || ''} ${firstResult['Last Name'] || ''}`.trim(),
      address: firstResult['Lives in'] || null,
      message: phone ? `Found phone: ${phone}` : 'Skip trace completed'
    })

  } catch (error) {
    console.error('Skip trace error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Skip trace failed' },
      { status: 500 }
    )
  }
}