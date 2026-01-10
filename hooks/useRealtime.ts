import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useRealtimeTable(tableName: string, orderBy = 'created_at') {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: rows } = await supabase
        .from(tableName)
        .select('*')
        .order(orderBy, { ascending: false })
        .limit(500)
      setData(rows || [])
      setLoading(false)
    }
    fetchData()

    const channel = supabase
      .channel(`${tableName}-realtime`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: tableName },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setData(prev => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setData(prev => prev.map(item => 
              item.id === payload.new.id ? payload.new : item
            ))
          } else if (payload.eventType === 'DELETE') {
            setData(prev => prev.filter(item => item.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tableName])

  return { data, loading }
}
