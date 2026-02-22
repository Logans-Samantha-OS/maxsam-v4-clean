import { createClient } from '@/lib/supabase/server'

export default async function SkillsPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('skills_registry')
    .select('id, skill_key, name, version, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-4 text-white">
      <h1 className="text-2xl font-semibold">Skills Registry</h1>
      <div className="rounded border border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-300">
            <tr>
              <th className="text-left p-2">Skill</th>
              <th className="text-left p-2">Version</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((row) => (
              <tr key={row.id} className="border-t border-zinc-800">
                <td className="p-2">{row.name || row.skill_key}</td>
                <td className="p-2">{row.version}</td>
                <td className="p-2">{row.status}</td>
                <td className="p-2">{row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr><td className="p-3 text-zinc-400" colSpan={4}>No skills registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
