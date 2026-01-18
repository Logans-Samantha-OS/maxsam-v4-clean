// ADD: components/dashboard/RecentActivity.tsx
export default function RecentActivity({ activity }: { activity: any[] }) {
  if (!activity.length) {
    return <p className="text-muted">No recent activity</p>
  }

  return (
    <ul className="space-y-2">
      {activity.map(a => (
        <li key={a.id} className="text-sm">
          <span className="opacity-70">
            {new Date(a.created_at).toLocaleTimeString()}
          </span>{' '}
          — {a.type}
        </li>
      ))}
    </ul>
  )
}
