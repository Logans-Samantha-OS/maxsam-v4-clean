# MaxSam V4 Route Truth

This document is the source of truth for all API routes and dashboard pages.

## Dashboard Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/dashboard` | `app/dashboard/page.tsx` | Main dashboard home |
| `/dashboard/stats` | `app/dashboard/stats/page.tsx` | CEO Dashboard - KPIs, funnel, activity |
| `/dashboard/governance` | `app/dashboard/governance/page.tsx` | System Control Center - kill switch, gates |
| `/dashboard/command-center` | `app/dashboard/command-center/page.tsx` | Ralph execution queue |
| `/dashboard/sellers` | `app/dashboard/sellers/page.tsx` | Lead list from database |
| `/dashboard/buyers` | `app/dashboard/buyers/page.tsx` | Buyer network |
| `/dashboard/analytics` | `app/dashboard/analytics/page.tsx` | Revenue analytics |

## API Routes

### Lead Management
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/leads` | List leads (with optional filters) |
| POST | `/api/leads` | Create new lead |
| GET | `/api/leads/[id]` | Get single lead |
| PUT | `/api/leads/[id]` | Update lead |
| POST | `/api/leads/[id]/sms` | Send SMS to lead |
| POST | `/api/leads/[id]/contact` | Log contact attempt |
| POST | `/api/leads/bulk-sms` | Bulk SMS blast |
| POST | `/api/leads/bulk-update` | Bulk status update |
| GET | `/api/leads/status` | Lead status counts |

### Eleanor (Intelligence)
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/eleanor/score` | Score single lead |
| POST | `/api/eleanor/score-all` | Score all unscored leads |
| GET | `/api/eleanor/explain/[id]` | Explain scoring factors |

### Classification
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/classification/summary` | Class A/B/C breakdown |

### Workflow Control
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/workflow-control` | Get workflow state |
| POST | `/api/workflow-control` | Update workflow toggles |
| PUT | `/api/workflow-control` | Emergency stop |

### Governance
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/governance` | Get all gate states |
| POST | `/api/governance` | Update gate (kill/revive/enable/disable) |
| POST | `/api/governance/n8n-sync` | Sync gates to n8n |

### Ralph (Execution)
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/ralph/run` | Execute queued action |
| POST | `/api/ralph/loop` | Run continuous loop |

### SAM (Outreach)
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/sam/run-batch` | Execute outreach batch |

### Contracts
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/contracts` | List contracts |
| POST | `/api/contracts` | Create contract |
| GET | `/api/contracts/[id]` | Get contract |
| POST | `/api/contracts/send` | Send for signing |

### Analytics
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/analytics` | Overview stats |
| GET | `/api/analytics/pipeline` | Pipeline metrics |
| GET | `/api/analytics/revenue` | Revenue breakdown |
| GET | `/api/ceo-dashboard` | CEO dashboard data |
| GET | `/api/stats` | Quick stats |
| GET | `/api/dashboard` | Dashboard data |

### Import
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/import/parse-pdf` | Parse excess funds PDF |
| POST | `/api/import/process` | Process imported data |
| POST | `/api/import/scrape-url` | Scrape URL for data |

### Webhooks
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/docusign/webhook` | DocuSign status updates |
| POST | `/api/twilio/inbound-sms` | Incoming SMS |
| POST | `/api/stripe/webhook` | Payment events |
| POST | `/api/webhooks/boldsign` | BoldSign events |
| POST | `/api/webhooks/stripe` | Stripe events (alt) |

### Notifications
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/telegram/notify` | Send Telegram notification |
| POST | `/api/sms/send` | Send SMS |

### Buyers
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/buyers` | List buyers |
| POST | `/api/buyers` | Create buyer |
| POST | `/api/buyers/send-matches` | Send matching deals |

### Deals
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/deals/[id]/bid` | Submit bid |
| POST | `/api/deals/[id]/blast` | Blast to buyers |
| POST | `/api/deals/[id]/invoice` | Create invoice |

### Cron Jobs
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/cron/import-leads` | Daily import (5:30 AM) |
| POST | `/api/cron/score-leads` | Daily scoring (6:00 AM) |
| POST | `/api/cron/outreach` | Hourly outreach (9 AM - 8 PM) |

### Settings
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/settings` | Get system settings |
| PUT | `/api/settings` | Update settings |

### Activity
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/activity` | Activity log |

### Diagnostics
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/diagnostic` | System diagnostic |
| GET | `/api/diagnostics` | Extended diagnostics |

### Morning Brief
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/morning-brief` | Daily summary |
| POST | `/api/morning-brief` | Generate brief |
