import MessagingCenter from '@/components/messaging/MessagingCenter';

export const metadata = {
  title: 'Messages | MaxSam V4',
  description: 'SMS conversation threads with leads',
};

export default function MessagesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Messages</h1>
        <p className="text-zinc-500">SMS conversations with your leads</p>
      </div>
      <MessagingCenter />
    </div>
  );
}
