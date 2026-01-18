'use client'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: Props) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100">
      <h2 className="text-xl font-semibold">Leads page error</h2>

      <pre className="max-w-xl overflow-auto rounded bg-zinc-900 p-4 text-sm text-red-400">
        {error.message}
      </pre>

      <button
        onClick={reset}
        className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
      >
        Retry
      </button>
    </div>
  )
}
