import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useCallQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQueue()

    const subscription = supabase
      .channel('call-queue-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maxsam_leads' },
        () => fetchQueue()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function fetchQueue() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('maxsam_sam_call_queue')
        .select('*')
        .limit(50)

      if (error) throw error
      setQueue(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function updateLeadStatus(leadId, newStatus) {
    const { error } = await supabase
      .from('maxsam_leads')
      .update({
        sam_status: newStatus,
        sam_last_attempt: new Date().toISOString(),
      })
      .eq('id', leadId)

    if (!error) {
      fetchQueue()
    }

    return { error }
  }

  return { queue, loading, refresh: fetchQueue, updateLeadStatus }
}
