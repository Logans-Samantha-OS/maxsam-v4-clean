import AnalyticsOverview from "@/components/dashboard/AnalyticsOverview"
import LeadTable from "@/components/dashboard/LeadTable"
import QuickStatsHeader from "@/components/dashboard/QuickStatsHeader"
import LiveActivityFeed from "@/components/LiveActivityFeed"
import CriticalAlertsPanel from "@/components/CriticalAlertsPanel"

export default function DashboardPage() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <QuickStatsHeader />

      <AnalyticsOverview />

      <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        <LeadTable />
        <LiveActivityFeed />
      </section>

      <CriticalAlertsPanel />
    </main>
  )
}
