import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern))
}

function classifyIntent(text: string): string {
  if (includesAny(text, ['wrong number', 'wrong people', "don't own", 'not me', 'not mine', 'never owned'])) return 'wrong_person'
  if (includesAny(text, ['not interested', 'no thanks', 'no thank you', 'pass', "don't want"])) return 'not_interested'
  if (includesAny(text, ['stop', 'unsubscribe', 'optout', 'cancel', 'end', 'quit'])) return 'opt_out'
  if (text.trim() === '3' || includesAny(text, [' both '])) return 'both'
  if (text.trim() === '2' || includesAny(text, ['sell', 'cash offer', 'wholesale'])) return 'distressed_property'
  if (text.trim() === '1' || includesAny(text, ['excess', 'funds', 'recover', 'claim'])) return 'excess_funds'
  if (includesAny(text, ['yes', 'interested', 'agree', 'sign', 'ready', 'ok', 'sure'])) return 'interested'
  if (text.includes('?') || includesAny(text, ['how', 'what', 'who', 'tell me', 'more info'])) return 'question'
  return 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const message = String(body?.message || '').trim()
    const leadId = body?.lead_id as string | undefined

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    let amount = 0
    if (leadId) {
      const leadLookup = await supabase.from('leads').select('excess_funds_amount').eq('id', leadId).single()
      if (!leadLookup.error) {
        amount = Number(leadLookup.data?.excess_funds_amount || 0)
      } else {
        const fallback = await supabase.from('maxsam_leads').select('excess_funds_amount').eq('id', leadId).single()
        amount = Number(fallback.data?.excess_funds_amount || 0)
      }
    }

    const normalized = ` ${message.toLowerCase()} `
    const intent = classifyIntent(normalized)

    let responseMessage = 'Thanks for your message. A team member will follow up shortly. - MaxSam Recovery'
    let shouldOptOut = false

    if (intent === 'wrong_person') {
      responseMessage = 'We apologize for the confusion and have removed you from our contact list. If this was an error, call (844) 963-2549. - MaxSam Recovery'
      shouldOptOut = true
    } else if (intent === 'not_interested') {
      responseMessage = `Understood, we've noted your preference. If you change your mind about recovering your $${amount.toLocaleString()}, text us anytime. - MaxSam Recovery`
    } else if (intent === 'opt_out') {
      responseMessage = 'You have been opted out and will no longer receive messages from MaxSam Recovery. Reply START to opt back in.'
      shouldOptOut = true
    }

    return NextResponse.json({
      intent,
      agreement_type: intent === 'distressed_property' ? 'property' : intent === 'excess_funds' ? 'excess_funds' : intent === 'both' ? 'both' : null,
      response_message: responseMessage,
      signing_needed: ['interested', 'excess_funds', 'distressed_property', 'both'].includes(intent),
      should_opt_out: shouldOptOut,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to classify message'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
