import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMetrics()

    const subscription = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maxsam_leads' },
        () => fetchMetrics()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function fetchMetrics() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('maxsam_dashboard_metrics')
        .select('*')
        .single()

      if (error) throw error
      setMetrics(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { metrics, loading, error, refresh: fetchMetrics }
}
