/**
 * Deterministic lead_id resolution for outbound SMS.
 *
 * Strategy:
 *  1. If lead_id is already present in the payload, return it.
 *  2. Otherwise, normalize the phone number and match against
 *     leads.phone (then maxsam_leads.phone as fallback).
 *  3. Returns null only if no match is found.
 */

import { createClient } from '@/lib/supabase/server'

/** Normalize to bare 10-digit US number for comparison */
function bareDigits(phone: unknown): string {
  const digits = String(phone || '').replace(/\D/g, '')
  // Strip leading US country code
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

export async function resolveLeadId(
  existingLeadId: string | null | undefined,
  phone: string | null | undefined
): Promise<string | null> {
  if (existingLeadId) return existingLeadId
  if (!phone) return null

  const normalized = bareDigits(phone)
  if (normalized.length < 10) return null

  const supabase = createClient()

  // Try `leads` table first (canonical)
  const { data: leadsRows } = await supabase
    .from('leads')
    .select('id, phone')
    .limit(500)

  if (leadsRows && leadsRows.length > 0) {
    const match = leadsRows.find(
      (row) => bareDigits(row.phone) === normalized
    )
    if (match) return match.id
  }

  // Fallback to `maxsam_leads`
  const { data: mLeadsRows } = await supabase
    .from('maxsam_leads')
    .select('id, phone, phone_1, phone_2, owner_phone')
    .limit(1000)

  if (mLeadsRows && mLeadsRows.length > 0) {
    const match = mLeadsRows.find((row) => {
      const phones = [row.phone, row.phone_1, row.phone_2, row.owner_phone]
      return phones.some((p) => bareDigits(p) === normalized)
    })
    if (match) return match.id
  }

  return null
}
