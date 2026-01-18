import BuyerIntakeForm from './BuyerIntakeForm';

export const metadata = {
  title: 'Buyer Application | MaxSam',
  description: 'Join our buyer list to receive wholesale deal notifications',
};

export default function BuyerIntakePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <BuyerIntakeForm />
    </div>
  );
}
