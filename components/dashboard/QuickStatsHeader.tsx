type LeadLike = {
  status?: string | null
  phone_1?: string | null
  phone_2?: string | null
}

type QuickStatsHeaderProps = {
  leads?: LeadLike[]
}

export default function QuickStatsHeader({ leads = [] }: QuickStatsHeaderProps) {
  const safeLeads = Array.isArray(leads) ? leads : []

  const readyToBlast = safeLeads.filter(
    (l) => ((l?.status ?? "new") === "new") && (l?.phone_1 || l?.phone_2)
  ).length

  const awaitingResponse = safeLeads.filter((l) => l?.status === "contacted").length
  const hotResponses = safeLeads.filter((l) => l?.status === "qualified").length
  const agreementsSent = safeLeads.filter((l) => l?.status === "contract_sent").length

  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Quick Stats</h2>
      <pre style={{ margin: 0 }}>
        {JSON.stringify(
          { readyToBlast, awaitingResponse, hotResponses, agreementsSent },
          null,
          2
        )}
      </pre>
    </section>
  )
}
