import { supabase } from '@/lib/supabase/client'
import type { Lead } from '@/lib/dashboard-utils'

// ============================================
// TYPES
// ============================================

export interface FetchLeadsOptions {
  minAmount?: number
  minScore?: number
  hasPhone?: boolean
  status?: string | string[]
  sortBy?: 'score_desc' | 'amount_desc' | 'deadline_asc' | 'created_desc'
  limit?: number
  offset?: number
}

export interface DashboardMetrics {
  totalLeads: number
  newLeads: number
  contactedLeads: number
  qualifiedLeads: number
  contractSentLeads: number
  closedLeads: number
  totalPipelineValue: number
  totalPotentialRevenue: number
  avgEleanorScore: number
  hotLeads: number
  warmLeads: number
}

// ============================================
// COLUMN MAPPING
// ============================================

// Maps Supabase columns to Lead interface
function mapSupabaseToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    property_address: (row.property_address as string) || '',
    city: (row.city as string) || '',
    state: (row.state as string) || 'TX',
    owner_name: (row.owner_name as string) || '',
    phone_1: (row.phone_1 as string) || (row.phone as string) || '',
    phone_2: (row.phone_2 as string) || '',
    excess_funds_amount: Number(row.excess_funds_amount) || 0,
    eleanor_score: Number(row.eleanor_score) || 0,
    deal_grade: (row.deal_grade as string) || '',
    contact_priority: (row.contact_priority as string) || 'cold',
    deal_type: (row.deal_type as string) || 'excess_only',
    status: (row.status as string) || 'new',
    call_attempts: Number(row.contact_attempts) || 0,
    last_call_date: (row.last_contact_date as string) || null,
    created_at: (row.created_at as string) || '',
    updated_at: (row.updated_at as string) || undefined,
    notes: (row.notes as string) || '',
    potential_revenue: Number(row.potential_revenue) || 0,
    estimated_equity: Number(row.estimated_equity) || Number(row.estimated_arv) || 0,
    days_until_expiration: Number(row.days_until_expiration) || undefined,
    expiration_date: (row.expiration_date as string) || undefined,
    is_cross_referenced: Boolean(row.is_cross_referenced),
    golden_lead: Boolean(row.golden_lead) || (row.deal_type === 'dual' && Number(row.eleanor_score) >= 70),
    property_type: (row.property_type as string) || undefined,
    arv_calculated: Number(row.estimated_arv) || undefined,
    mao_70: undefined,
    mao_75: undefined,
    estimated_repairs: Number(row.estimated_repair_cost) || undefined,
    case_number: (row.case_number as string) || undefined,
    source_county: (row.source_county as string) || 'Dallas',
    sms_count: Number(row.sms_count) || 0,
    last_contacted_at: (row.last_contact_date as string) || null,
  }
}

// ============================================
// FETCH FUNCTIONS
// ============================================

/**
 * Fetch leads with optional filtering and sorting
 */
export async function fetchLeads(options: FetchLeadsOptions = {}): Promise<{
  data: Lead[]
  error: Error | null
  count: number
}> {
  const {
    minAmount = 0,
    minScore = 0,
    hasPhone = false,
    status,
    sortBy = 'score_desc',
    limit = 100,
    offset = 0,
  } = options

  let query = supabase
    .from('maxsam_leads')
    .select('*', { count: 'exact' })

  // Apply filters
  if (minAmount > 0) {
    query = query.gte('excess_funds_amount', minAmount)
  }

  if (minScore > 0) {
    query = query.gte('eleanor_score', minScore)
  }

  if (hasPhone) {
    query = query.or('phone.neq.null,phone_1.neq.null,phone_2.neq.null')
  }

  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status)
    } else {
      query = query.eq('status', status)
    }
  }

  // Exclude deleted/dead leads by default
  query = query.not('status', 'eq', 'deleted')

  // Apply sorting
  switch (sortBy) {
    case 'score_desc':
      query = query.order('eleanor_score', { ascending: false })
      break
    case 'amount_desc':
      query = query.order('excess_funds_amount', { ascending: false })
      break
    case 'deadline_asc':
      query = query.order('expiration_date', { ascending: true, nullsFirst: false })
      break
    case 'created_desc':
      query = query.order('created_at', { ascending: false })
      break
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('fetchLeads error:', error)
    return { data: [], error: new Error(error.message), count: 0 }
  }

  const leads = (data || []).map(mapSupabaseToLead)

  return { data: leads, error: null, count: count || leads.length }
}

/**
 * Fetch a single lead by ID
 */
export async function fetchLeadById(id: string): Promise<{
  data: Lead | null
  error: Error | null
}> {
  const { data, error } = await supabase
    .from('maxsam_leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('fetchLeadById error:', error)
    return { data: null, error: new Error(error.message) }
  }

  return { data: mapSupabaseToLead(data), error: null }
}

/**
 * Update a lead
 */
export async function updateLead(
  id: string,
  updates: Partial<Lead>
): Promise<{ data: Lead | null; error: Error | null }> {
  // Map Lead interface back to Supabase columns
  const supabaseUpdates: Record<string, unknown> = {}

  if (updates.owner_name !== undefined) supabaseUpdates.owner_name = updates.owner_name
  if (updates.phone_1 !== undefined) supabaseUpdates.phone_1 = updates.phone_1
  if (updates.phone_2 !== undefined) supabaseUpdates.phone_2 = updates.phone_2
  if (updates.excess_funds_amount !== undefined) supabaseUpdates.excess_funds_amount = updates.excess_funds_amount
  if (updates.status !== undefined) supabaseUpdates.status = updates.status
  if (updates.notes !== undefined) supabaseUpdates.notes = updates.notes
  if (updates.eleanor_score !== undefined) supabaseUpdates.eleanor_score = updates.eleanor_score
  if (updates.deal_grade !== undefined) supabaseUpdates.deal_grade = updates.deal_grade
  if (updates.contact_priority !== undefined) supabaseUpdates.contact_priority = updates.contact_priority
  if (updates.sms_count !== undefined) supabaseUpdates.sms_count = updates.sms_count
  if (updates.last_contacted_at !== undefined) supabaseUpdates.last_contact_date = updates.last_contacted_at

  const { data, error } = await supabase
    .from('maxsam_leads')
    .update(supabaseUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('updateLead error:', error)
    return { data: null, error: new Error(error.message) }
  }

  return { data: mapSupabaseToLead(data), error: null }
}

/**
 * Fetch dashboard metrics (aggregated stats)
 */
export async function fetchDashboardMetrics(): Promise<{
  data: DashboardMetrics | null
  error: Error | null
}> {
  // Try to use the pre-built view first
  const { data: viewData, error: viewError } = await supabase
    .from('maxsam_dashboard_metrics')
    .select('*')
    .single()

  if (!viewError && viewData) {
    return {
      data: {
        totalLeads: Number(viewData.total_leads) || 0,
        newLeads: Number(viewData.new_leads) || 0,
        contactedLeads: Number(viewData.contacted_leads) || 0,
        qualifiedLeads: Number(viewData.qualified_leads) || 0,
        contractSentLeads: Number(viewData.contract_sent_leads) || 0,
        closedLeads: Number(viewData.closed_leads) || 0,
        totalPipelineValue: Number(viewData.total_pipeline_value) || 0,
        totalPotentialRevenue: Number(viewData.total_potential_revenue) || 0,
        avgEleanorScore: Number(viewData.avg_eleanor_score) || 0,
        hotLeads: Number(viewData.hot_leads) || 0,
        warmLeads: Number(viewData.warm_leads) || 0,
      },
      error: null,
    }
  }

  // Fallback: compute metrics from leads
  const { data: leads, error } = await supabase
    .from('maxsam_leads')
    .select('status, excess_funds_amount, potential_revenue, eleanor_score, contact_priority')

  if (error) {
    console.error('fetchDashboardMetrics error:', error)
    return { data: null, error: new Error(error.message) }
  }

  const metrics: DashboardMetrics = {
    totalLeads: leads?.length || 0,
    newLeads: leads?.filter(l => l.status === 'new').length || 0,
    contactedLeads: leads?.filter(l => l.status === 'contacted').length || 0,
    qualifiedLeads: leads?.filter(l => l.status === 'qualified').length || 0,
    contractSentLeads: leads?.filter(l => l.status === 'contract_sent').length || 0,
    closedLeads: leads?.filter(l => l.status === 'closed').length || 0,
    totalPipelineValue: leads?.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0) || 0,
    totalPotentialRevenue: leads?.reduce((sum, l) => sum + (Number(l.potential_revenue) || 0), 0) || 0,
    avgEleanorScore: leads?.length
      ? leads.reduce((sum, l) => sum + (Number(l.eleanor_score) || 0), 0) / leads.length
      : 0,
    hotLeads: leads?.filter(l => l.contact_priority === 'hot').length || 0,
    warmLeads: leads?.filter(l => l.contact_priority === 'warm').length || 0,
  }

  return { data: metrics, error: null }
}

/**
 * Bulk update leads
 */
export async function bulkUpdateLeads(
  ids: string[],
  updates: Partial<Lead>
): Promise<{ success: boolean; error: Error | null }> {
  const supabaseUpdates: Record<string, unknown> = {}

  if (updates.status !== undefined) supabaseUpdates.status = updates.status
  if (updates.notes !== undefined) supabaseUpdates.notes = updates.notes

  const { error } = await supabase
    .from('maxsam_leads')
    .update(supabaseUpdates)
    .in('id', ids)

  if (error) {
    console.error('bulkUpdateLeads error:', error)
    return { success: false, error: new Error(error.message) }
  }

  return { success: true, error: null }
}

/**
 * Fetch leads for quick stats (minimal data)
 */
export async function fetchQuickStatsData(): Promise<{
  readyToBlast: number
  awaitingResponse: number
  hotResponses: number
  agreementsSent: number
  error: Error | null
}> {
  const { data, error } = await supabase
    .from('maxsam_leads')
    .select('status, phone_1, phone_2, phone')

  if (error) {
    console.error('fetchQuickStatsData error:', error)
    return {
      readyToBlast: 0,
      awaitingResponse: 0,
      hotResponses: 0,
      agreementsSent: 0,
      error: new Error(error.message),
    }
  }

  const leads = data || []

  return {
    readyToBlast: leads.filter(
      l => (l.status === 'new' || !l.status) && (l.phone_1 || l.phone_2 || l.phone)
    ).length,
    awaitingResponse: leads.filter(l => l.status === 'contacted').length,
    hotResponses: leads.filter(l => l.status === 'qualified').length,
    agreementsSent: leads.filter(l => l.status === 'contract_sent').length,
    error: null,
  }
}

/**
 * Subscribe to real-time lead updates
 */
export function subscribeToLeads(
  callback: (payload: { eventType: string; new: Lead | null; old: Lead | null }) => void
) {
  const channel = supabase
    .channel('leads-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'maxsam_leads' },
      (payload) => {
        callback({
          eventType: payload.eventType,
          new: payload.new ? mapSupabaseToLead(payload.new as Record<string, unknown>) : null,
          old: payload.old ? mapSupabaseToLead(payload.old as Record<string, unknown>) : null,
        })
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
