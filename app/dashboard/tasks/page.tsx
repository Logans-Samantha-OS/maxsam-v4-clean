import { createClient } from '@/lib/supabase/server'

export default async function TasksPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('tasks')
    .select('id, title, status, priority, assigned_agent, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-4 text-white">
      <h1 className="text-2xl font-semibold">Tasks</h1>
      <div className="rounded border border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-300">
            <tr>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Priority</th>
              <th className="text-left p-2">Agent</th>
              <th className="text-left p-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((row) => (
              <tr key={row.id} className="border-t border-zinc-800">
                <td className="p-2">{row.title}</td>
                <td className="p-2">{row.status}</td>
                <td className="p-2">{row.priority}</td>
                <td className="p-2">{row.assigned_agent || '-'}</td>
                <td className="p-2">{row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr><td className="p-3 text-zinc-400" colSpan={5}>No tasks found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
