'use client';

type LeadLike = {
  excess_funds_amount?: number | string | null
  status?: string | null
  phone_1?: string | null
  phone_2?: string | null
}

type AnalyticsOverviewProps = {
  leads?: LeadLike[]
}

export default function AnalyticsOverview({ leads = [] }: AnalyticsOverviewProps) {
  const safeLeads = Array.isArray(leads) ? leads : []

  const totalPipeline = safeLeads.reduce((sum, l) => {
    const amt = Number(l?.excess_funds_amount ?? 0)
    return sum + (Number.isFinite(amt) ? amt : 0)
  }, 0)

  const totalFees = totalPipeline * 0.25

  const statusCounts = {
    new: safeLeads.filter((l) => (l?.status ?? "new") === "new").length,
    contacted: safeLeads.filter((l) => l?.status === "contacted").length,
    qualified: safeLeads.filter((l) => l?.status === "qualified").length,
    contract_sent: safeLeads.filter((l) => l?.status === "contract_sent").length,
  }

  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Analytics Overview</h2>

      <div style={{ display: "grid", gap: 8 }}>
        <div>Total Pipeline: {totalPipeline.toLocaleString()}</div>
        <div>Estimated Fees (25%): {totalFees.toLocaleString()}</div>

        <div style={{ marginTop: 8, fontWeight: 600 }}>Status Counts</div>
        <pre style={{ margin: 0 }}>{JSON.stringify(statusCounts, null, 2)}</pre>
      </div>
    </section>
  )
}
