import { redirect } from 'next/navigation';

// Redirect old conversations route to canonical messages location
export default function ConversationsPage() {
  redirect('/dashboard/messages');
}
