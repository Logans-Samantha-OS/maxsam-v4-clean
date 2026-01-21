import { createClient } from '@/lib/supabase/server';

export default async function MessagesPage() {
  const supabase = createClient();

  const { data: threads, error } = await supabase.rpc(
    'get_message_threads'
  );

  if (error) {
    console.error('Failed to load message threads', error);
    return <div className="p-6 text-red-500">Failed to load threads</div>;
  }

  if (!threads || threads.length === 0) {
    return <div className="p-6">No message threads found</div>;
  }

  return (
    <div className="p-6 space-y-4">
      {threads.map((t) => (
        <div
          key={t.lead_id}
          className="border border-neutral-700 rounded p-4"
        >
          <div className="text-sm text-neutral-400">
            Lead ID: {t.lead_id}
          </div>

          <div className="mt-2 font-medium">
            {t.last_message}
          </div>

          <div className="mt-1 text-xs text-neutral-500">
            {new Date(t.last_message_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
