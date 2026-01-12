import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Lead {
  id: string;
  case_number?: string;
  owner_name: string;
  property_address?: string;
  property_city?: string;
  source_county?: string;
  phone_1?: string;
  phone_2?: string;
  excess_amount: number;
  status: 'new' | 'contacted' | 'contract' | 'closed' | 'do_not_contact' | 'opted_out';
  priority: 'low' | 'medium' | 'high' | 'critical';
  expiration_date?: string;
  golden_lead: boolean;
  eleanor_score?: number;
  created_at: string;
  updated_at: string;
  last_contacted_at?: string;
  first_contacted_at?: string;
  contact_count?: number;
}

export interface LeadFilters {
  search?: string;
  status?: string;
  priority?: string;
  leadType?: 'all' | 'excess_funds' | 'wholesale' | 'golden';
  county?: string;
  hasPhone?: boolean;
  minAmount?: number;
  maxAmount?: number;
  expiringDays?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useLeads(filters?: LeadFilters) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('leads')
        .select('*')
        .eq('do_not_contact', false)
        .eq('opted_out', false);

      // Apply filters
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      if (filters?.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }
      
      if (filters?.county && filters.county !== 'all') {
        query = query.eq('source_county', filters.county);
      }
      
      if (filters?.hasPhone === true) {
        query = query.not('phone_1', 'is', null);
      } else if (filters?.hasPhone === false) {
        query = query.is('phone_1', null);
      }
      
      if (filters?.minAmount) {
        query = query.gte('excess_amount', filters.minAmount);
      }
      
      if (filters?.maxAmount) {
        query = query.lte('excess_amount', filters.maxAmount);
      }
      
      if (filters?.expiringDays) {
        const days = parseInt(String(filters.expiringDays) || '30');
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        query = query.lte('expiration_date', futureDate.toISOString());
      }
      
      // Lead type filter
      if (filters?.leadType === 'golden') {
        query = query.eq('golden_lead', true);
      } else if (filters?.leadType === 'excess_funds') {
        query = query.in('lead_type', ['excess_funds', 'both']);
      } else if (filters?.leadType === 'wholesale') {
        query = query.in('lead_type', ['wholesale', 'both']);
      }
      
      // Search
      if (filters?.search) {
        query = query.or(`
          owner_name.ilike.%${filters.search}%, 
          case_number.ilike.%${filters.search}%, 
          property_address.ilike.%${filters.search}%, 
          phone_1.ilike.%${filters.search}%, 
          phone_2.ilike.%${filters.search}%
        `);
      }
      
      // Sorting
      const sortBy = filters?.sortBy || 'excess_amount';
      const sortOrder = filters?.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();

    // Set up real-time subscription
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'leads'
        }, 
        () => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [JSON.stringify(filters)]);

  return { leads, loading, error, refetch: fetchLeads };
}
