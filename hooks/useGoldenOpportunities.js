import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useGoldenOpportunities(limit = 20) {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOpportunities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  async function fetchOpportunities() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('maxsam_golden_opportunities')
        .select('*')
        .limit(limit)

      if (error) throw error
      setOpportunities(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return { opportunities, loading, refresh: fetchOpportunities }
}
