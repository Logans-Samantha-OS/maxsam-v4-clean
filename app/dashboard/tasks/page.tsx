'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Task {
  id: string
  title: string
  description: string | null
  assigned_to: string | null
  status: string
  priority: string
  result: string | null
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-zinc-700 text-zinc-300',
  in_progress: 'bg-blue-500/20 text-blue-400',
  blocked:     'bg-red-500/20 text-red-400',
  done:        'bg-emerald-500/20 text-emerald-400',
  cancelled:   'bg-zinc-600 text-zinc-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  low:      'text-zinc-500',
  normal:   'text-zinc-300',
  high:     'text-amber-400',
  critical: 'text-red-400',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, description, assigned_to, status, priority, result, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100)
      setTasks(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const active = tasks.filter((t) => t.status === 'in_progress' || t.status === 'pending')
  const completed = tasks.filter((t) => t.status === 'done' || t.status === 'cancelled' || t.status === 'blocked')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        <p className="text-gray-400 text-sm mt-1">
          Agent and operator work items — tracked in Supabase.
        </p>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="pharaoh-card-mini text-zinc-400 text-sm">
          No tasks yet. Tasks are created by agents or operators via the API.
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">Active</h2>
              <div className="space-y-2">
                {active.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Completed / Closed</h2>
              <div className="space-y-2">
                {completed.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="pharaoh-card-mini flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-zinc-100 truncate">{task.title}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[task.status] || 'bg-zinc-800'}`}>
            {task.status.replace('_', ' ')}
          </span>
          <span className={`text-xs ${PRIORITY_COLORS[task.priority] || 'text-zinc-400'}`}>
            {task.priority}
          </span>
        </div>
        {task.description && (
          <p className="text-zinc-500 text-xs truncate">{task.description}</p>
        )}
        {task.result && (
          <p className="text-emerald-400/70 text-xs mt-1 truncate">Result: {task.result}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-zinc-500">{task.assigned_to || 'unassigned'}</div>
        <div className="text-[10px] text-zinc-600 mt-0.5">
          {new Date(task.updated_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  )
}
