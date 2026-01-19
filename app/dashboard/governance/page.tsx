import GovernanceCommandCenter from '@/components/governance/CommandCenter';

export default function GovernancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">System Control Center</h1>
        <p className="text-gray-400 text-sm mt-1">
          Master kill switch and agent gate controls. Buttons grant/revoke authority - RALPH enforces execution.
        </p>
      </div>
      <GovernanceCommandCenter />
    </div>
  );
}
