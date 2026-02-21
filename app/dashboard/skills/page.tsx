'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Skill {
  id: string
  slug: string
  name: string
  description: string | null
  version: string
  status: string
  agent_owner: string | null
  n8n_workflow_id: string | null
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  draft:      'bg-zinc-700 text-zinc-300',
  active:     'bg-emerald-500/20 text-emerald-400',
  deprecated: 'bg-amber-500/20 text-amber-400',
  disabled:   'bg-red-500/20 text-red-400',
}

const AGENT_COLORS: Record<string, string> = {
  ALEX: '#3b82f6',
  ELEANOR: '#a855f7',
  SAM: '#10b981',
  SYSTEM: '#ffd700',
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const loadSkills = useCallback(async () => {
    const { data } = await supabase
      .from('skills_registry')
      .select('id, slug, name, description, version, status, agent_owner, n8n_workflow_id, updated_at')
      .order('agent_owner', { ascending: true })
    setSkills(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  const seedSkills = async () => {
    setSeeding(true)
    try {
      const response = await fetch('/api/skills/seed', { method: 'POST' })
      const body = await response.json()
      if (body.success) {
        await loadSkills()
      }
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Skills Registry</h1>
          <p className="text-gray-400 text-sm mt-1">
            Registered agent skills — versioned, auditable capabilities.
          </p>
        </div>
        {skills.length === 0 && !loading && (
          <button
            onClick={seedSkills}
            disabled={seeding}
            className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{ background: '#ffd700', color: '#0a0c10' }}
          >
            {seeding ? 'Seeding...' : 'Seed Default Skills'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading skills...</div>
      ) : skills.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <p className="text-zinc-400 text-sm mb-3">No skills registered yet.</p>
          <button
            onClick={seedSkills}
            disabled={seeding}
            className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{ background: '#ffd700', color: '#0a0c10' }}
          >
            {seeding ? 'Seeding...' : 'Seed Default Skills'}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider">
                <th className="py-3 px-4">Skill</th>
                <th className="py-3 px-4">Slug</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Agent</th>
                <th className="py-3 px-4">n8n</th>
                <th className="py-3 px-4">Updated</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr key={skill.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                  <td className="py-3 px-4">
                    <div className="font-medium text-zinc-100">{skill.name}</div>
                    {skill.description && (
                      <div className="text-zinc-500 text-xs mt-0.5 max-w-[300px]">{skill.description}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-zinc-400">{skill.slug}</td>
                  <td className="py-3 px-4 font-mono text-xs text-zinc-400">{skill.version}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[skill.status] || 'bg-zinc-800 text-zinc-400'}`}>
                      {skill.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: (AGENT_COLORS[skill.agent_owner || ''] || '#6b7280') + '20',
                        color: AGENT_COLORS[skill.agent_owner || ''] || '#6b7280',
                      }}
                    >
                      {skill.agent_owner || '\u2014'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-zinc-500">{skill.n8n_workflow_id || '\u2014'}</td>
                  <td className="py-3 px-4 text-xs text-zinc-500">
                    {new Date(skill.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
