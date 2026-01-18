export type CeoDashboardMetrics = {
  totalLeads: number
  pipelineCents: number
  signedCents: number
  responseRate: number

  conversion: {
    new: number
    contacted: number
    responded: number
    signed: number
  }

  activitySummary: {
    sent: number
    received: number
  }

  alerts: {
    id: string
    severity: 'low' | 'medium' | 'high'
    message: string
  }[]
}
