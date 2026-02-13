# MaxSamV4 Doctor — Production Wiring Verification
# Run: powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1
# From: C:\Users\MrTin\Downloads\MaxSam-V4\
# Auto-reads .env.local — no manual config needed

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = "Continue"
$script:totalPass = 0
$script:totalFail = 0
$script:totalWarn = 0

# ============================================
# LOAD .env.local AUTOMATICALLY
# ============================================
function Load-EnvFile {
    $envPaths = @(
        (Join-Path $PSScriptRoot "..\.env.local"),
        (Join-Path (Get-Location) ".env.local"),
        (Join-Path (Get-Location) ".env"),
        "C:\Users\MrTin\Downloads\MaxSam-V4\.env.local"
    )
    $loaded = $false
    foreach ($p in $envPaths) {
        $resolved = if (Test-Path $p) { (Resolve-Path $p).Path } else { $null }
        if ($resolved -and (Test-Path $resolved)) {
            Write-Host "  Loading env from: $resolved" -ForegroundColor DarkGray
            Get-Content $resolved | ForEach-Object {
                $line = $_.Trim()
                if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                    $eqIdx = $line.IndexOf("=")
                    $key = $line.Substring(0, $eqIdx).Trim()
                    $val = $line.Substring($eqIdx + 1).Trim()
                    $val = $val.Trim('"').Trim("'")
                    if ($val.Length -gt 0) {
                        [Environment]::SetEnvironmentVariable($key, $val, "Process")
                    }
                }
            }
            $loaded = $true
            break
        }
    }
    if (-not $loaded) {
        Write-Host "  WARNING: No .env.local found." -ForegroundColor Yellow
    }
    return $loaded
}

# ============================================
# NORMALIZE ENV VAR ALIASES
# Your .env.local uses different names than
# what Next.js/doctor expects. Map them.
# ============================================
function Normalize-EnvAliases {
    $aliases = @{
        "NEXT_PUBLIC_SUPABASE_URL" = "SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY" = "SUPABASE_ANON_KEY"
        "NEXT_PUBLIC_N8N_BASE_URL" = "N8N_WEBHOOK_BASE_URL"
        "BROWSERLESS_API_KEY" = "BROWSERLESS_TOKEN"
        "GOOGLE_GEMINI_API_KEY" = "GEMINI_API_KEY"
    }
    foreach ($target in $aliases.Keys) {
        $existing = [Environment]::GetEnvironmentVariable($target)
        if (-not $existing -or $existing.Trim().Length -eq 0) {
            $fallback = [Environment]::GetEnvironmentVariable($aliases[$target])
            if ($fallback -and $fallback.Trim().Length -gt 0) {
                [Environment]::SetEnvironmentVariable($target, $fallback, "Process")
            }
        }
    }
}

# ============================================
# HELPER FUNCTIONS
# ============================================
function Check-Env {
    param([string]$name)
    $val = [Environment]::GetEnvironmentVariable($name)
    if ($val -and $val.Trim().Length -gt 0 -and $val -ne "N/A") {
        $masked = $val.Substring(0, [Math]::Min(8, $val.Length)) + "..." + $val.Substring([Math]::Max(0, $val.Length - 4))
        Write-Host "  OK    $name = $masked" -ForegroundColor Green
        $script:totalPass++
        return $true
    } else {
        Write-Host "  MISS  $name" -ForegroundColor Red
        $script:totalFail++
        return $false
    }
}

function Check-Url {
    param([string]$label, [string]$url, [hashtable]$headers = @{})
    Write-Host "  $label"
    Write-Host "    => $url" -ForegroundColor DarkGray
    try {
        $params = @{ Uri = $url; Method = "GET"; TimeoutSec = 15; UseBasicParsing = $true }
        if ($headers.Count -gt 0) { $params["Headers"] = $headers }
        $resp = Invoke-WebRequest @params
        Write-Host "    OK ($($resp.StatusCode))" -ForegroundColor Green
        $script:totalPass++
        return $true
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        if ($code -eq 401 -or $code -eq 403) {
            Write-Host "    WARN ($code) — auth required but reachable" -ForegroundColor Yellow
            $script:totalWarn++; return $true
        } elseif ($code -eq 404) {
            Write-Host "    FAIL (404)" -ForegroundColor Red
            $script:totalFail++; return $false
        } elseif ($code) {
            Write-Host "    WARN ($code)" -ForegroundColor Yellow
            $script:totalWarn++; return $true
        } else {
            Write-Host "    FAIL — $($_.Exception.Message)" -ForegroundColor Red
            $script:totalFail++; return $false
        }
    }
}

function Check-Post {
    param([string]$label, [string]$url, [string]$body)
    Write-Host "  $label"
    Write-Host "    => POST $url" -ForegroundColor DarkGray
    try {
        $resp = Invoke-WebRequest -Uri $url -Method POST -TimeoutSec 20 -UseBasicParsing `
            -ContentType "application/json" -Body $body
        Write-Host "    OK ($($resp.StatusCode))" -ForegroundColor Green
        $script:totalPass++; return $true
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        if ($code -eq 404) {
            Write-Host "    WARN (404) — webhook not registered" -ForegroundColor Yellow
            $script:totalWarn++
        } elseif ($code -eq 500) {
            Write-Host "    WARN (500) — reached but errored (expected with dry_run)" -ForegroundColor Yellow
            $script:totalWarn++
        } elseif ($code) {
            Write-Host "    WARN ($code)" -ForegroundColor Yellow
            $script:totalWarn++
        } else {
            Write-Host "    FAIL — $($_.Exception.Message)" -ForegroundColor Red
            $script:totalFail++
        }
        return $false
    }
}

# ============================================
# HEADER
# ============================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  MaxSam V4 Doctor — Production Wiring Verification" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')" -ForegroundColor Cyan
Write-Host "  Host: $($env:COMPUTERNAME) | User: $($env:USERNAME)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Loading environment..." -ForegroundColor Cyan
Load-EnvFile | Out-Null
Normalize-EnvAliases
Write-Host ""

# ============================================
# [1/6] ENV VAR CHECKS
# ============================================
Write-Host "[1/6] ENV VAR CHECKS" -ForegroundColor Cyan
Write-Host "---------------------"

$envVars = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_N8N_BASE_URL",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_GEMINI_API_KEY",
    # "BROWSERLESS_API_KEY",  # Removed — skip trace migrated to Apify
    "TELEGRAM_BOT_TOKEN"
)

foreach ($v in $envVars) { Check-Env $v }
Write-Host ""

# ============================================
# [2/6] URL REACHABILITY
# ============================================
Write-Host "[2/6] URL REACHABILITY" -ForegroundColor Cyan
Write-Host "-----------------------"

$supaUrl = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL")
$supaKey = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if ($supaUrl) {
    $supaHeaders = @{}
    if ($supaKey) { $supaHeaders = @{ "apikey" = $supaKey; "Authorization" = "Bearer $supaKey" } }
    Check-Url "Supabase REST API" "$supaUrl/rest/v1/" $supaHeaders
} else {
    Write-Host "  SKIP Supabase — URL not set" -ForegroundColor Yellow
    $script:totalWarn++
}

Check-Url "N8N Cloud" "https://skooki.app.n8n.cloud"
Check-Url "Vercel App" "https://maxsam-v4-clean.vercel.app"
# Browserless check removed — skip trace migrated to Apify ($0.007/lead)
# Check-Url "Browserless" "https://production-sfo.browserless.io"
Write-Host "  SKIP  Browserless — migrated to Apify (skip trace working)" -ForegroundColor DarkGray
Write-Host ""

# ============================================
# [3/6] SUPABASE TABLE CHECKS
# ============================================
Write-Host "[3/6] SUPABASE TABLE CHECKS" -ForegroundColor Cyan
Write-Host "----------------------------"

$srvKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
$tables = @("leads", "messages", "buyers", "deals", "agent_memories", "workflow_logs")

if (-not $supaUrl -or -not $srvKey) {
    Write-Host "  SKIP — missing Supabase credentials" -ForegroundColor Yellow
    $script:totalWarn++
} else {
    foreach ($table in $tables) {
        Write-Host "  Table: $table"
        try {
            $headers = @{ "apikey" = $srvKey; "Authorization" = "Bearer $srvKey" }
            $resp = Invoke-WebRequest -Uri "$supaUrl/rest/v1/$($table)?select=id&limit=1" `
                -Method GET -TimeoutSec 10 -UseBasicParsing -Headers $headers
            Write-Host "    OK ($($resp.StatusCode))" -ForegroundColor Green
            $script:totalPass++
        } catch {
            $code = $null
            if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
            if ($code -eq 404) {
                Write-Host "    FAIL — table not found" -ForegroundColor Red
                $script:totalFail++
            } else {
                Write-Host "    FAIL ($code) — $($_.Exception.Message)" -ForegroundColor Red
                $script:totalFail++
            }
        }
    }
}
Write-Host ""

# ============================================
# [4/6] N8N WEBHOOK SMOKE TESTS
# ============================================
Write-Host "[4/6] N8N WEBHOOK SMOKE TESTS" -ForegroundColor Cyan
Write-Host "-------------------------------"

$n8nBase = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_N8N_BASE_URL")
if (-not $n8nBase) { $n8nBase = "https://skooki.app.n8n.cloud/webhook" }
$n8nBase = $n8nBase.TrimEnd("/")
$nullUuid = "00000000-0000-0000-0000-000000000000"

# Only test webhooks that map to ACTIVE workflows (confirmed via n8n API 2026-02-12)
Check-Post "Skip Trace (ALEX)"     "$n8nBase/skip-trace-now"     "{`"dry_run`": true}"   # Workflow QBYwGc5M1x8T12ax — ACTIVE
Check-Post "SAM Auto Outreach"      "$n8nBase/sam-test-outreach"  "{`"dry_run`": true}"   # Workflow t3cgqw7BvswrKIfu — ACTIVE
Check-Post "Eleanor Score"          "$n8nBase/eleanor-score"      "{`"lead_id`": `"$nullUuid`", `"dry_run`": true}"  # Workflow caLLOlDen0TpRXsy — ACTIVE
# Inactive webhook paths removed to prevent false 404 failures:
#   /send-agreement  — SAM Agreement Sender is active but uses different trigger
#   /process-pdf     — INGEST PDF Processor is active but uses different trigger
#   /gemini-extract  — INGEST Gemini Extractor is active but uses different trigger
Write-Host ""

# ============================================
# [5/6] DATA HEALTH CHECK
# ============================================
Write-Host "[5/6] DATA HEALTH CHECK" -ForegroundColor Cyan
Write-Host "------------------------"

if (-not $supaUrl -or -not $srvKey) {
    Write-Host "  SKIP — missing Supabase credentials" -ForegroundColor Yellow
    $script:totalWarn++
} else {
    $headers = @{ "apikey" = $srvKey; "Authorization" = "Bearer $srvKey" }

    try {
        $resp = Invoke-WebRequest -Uri "$supaUrl/rest/v1/leads?select=id&limit=10000" -Method GET -TimeoutSec 15 -UseBasicParsing -Headers $headers
        $totalLeads = ($resp.Content | ConvertFrom-Json).Count
        Write-Host "  Total leads:           $totalLeads" -ForegroundColor Green
    } catch { Write-Host "  Total leads:           ERROR" -ForegroundColor Red; $totalLeads = 0 }

    try {
        $resp = Invoke-WebRequest -Uri "$supaUrl/rest/v1/leads?select=id&or=(phone.is.null,phone.eq.,phone.eq.null)&limit=10000" -Method GET -TimeoutSec 15 -UseBasicParsing -Headers $headers
        $noPhone = ($resp.Content | ConvertFrom-Json).Count
        $pColor = if ($noPhone -gt ($totalLeads * 0.7)) { "Red" } elseif ($noPhone -gt ($totalLeads * 0.3)) { "Yellow" } else { "Green" }
        Write-Host "  Leads missing phone:   $noPhone" -ForegroundColor $pColor
    } catch { Write-Host "  Leads missing phone:   ERROR" -ForegroundColor Red }

    try {
        $resp = Invoke-WebRequest -Uri "$supaUrl/rest/v1/leads?select=id&phone=not.is.null&phone=not.eq.&phone=not.eq.null&limit=10000" -Method GET -TimeoutSec 15 -UseBasicParsing -Headers $headers
        $withPhone = ($resp.Content | ConvertFrom-Json).Count
        Write-Host "  Leads with phone:      $withPhone" -ForegroundColor $(if ($withPhone -lt 10) { "Yellow" } else { "Green" })
    } catch { Write-Host "  Leads with phone:      ERROR" -ForegroundColor Red }

    # Statuses aligned to actual leads.status constraint (updated 2026-02-12)
    $statuses = @("pending", "enriched", "skip_trace_failed", "contacted", "responded", "qualified", "closed", "dead")
    Write-Host "  --- Status Breakdown ---" -ForegroundColor DarkGray
    foreach ($st in $statuses) {
        try {
            $resp = Invoke-WebRequest -Uri "$supaUrl/rest/v1/leads?select=id&status=eq.$st&limit=10000" -Method GET -TimeoutSec 15 -UseBasicParsing -Headers $headers
            $cnt = ($resp.Content | ConvertFrom-Json).Count
            if ($cnt -gt 0) { Write-Host "    $($st.PadRight(20)) $cnt" -ForegroundColor White }
        } catch {}
    }

    try {
        $resp = Invoke-WebRequest -Uri "$supaUrl/rest/v1/messages?select=id&limit=10000" -Method GET -TimeoutSec 15 -UseBasicParsing -Headers $headers
        $msgCount = ($resp.Content | ConvertFrom-Json).Count
        Write-Host "  Total messages:        $msgCount" -ForegroundColor $(if ($msgCount -eq 0) { "Yellow" } else { "Green" })
    } catch { Write-Host "  Total messages:        ERROR" -ForegroundColor Red }

    try {
        $resp = Invoke-WebRequest -Uri "$supaUrl/rest/v1/deals?select=id&limit=10000" -Method GET -TimeoutSec 15 -UseBasicParsing -Headers $headers
        $dealCount = ($resp.Content | ConvertFrom-Json).Count
        Write-Host "  Total deals:           $dealCount" -ForegroundColor $(if ($dealCount -eq 0) { "Yellow" } else { "Green" })
    } catch { Write-Host "  Total deals:           ERROR" -ForegroundColor Red }

    try {
        $resp = Invoke-WebRequest -Uri "$supaUrl/rest/v1/leads?select=excess_funds_amount&excess_funds_amount=not.is.null&limit=10000" -Method GET -TimeoutSec 15 -UseBasicParsing -Headers $headers
        $leads = $resp.Content | ConvertFrom-Json
        $totalValue = 0; foreach ($l in $leads) { $totalValue += [double]($l.excess_funds_amount) }
        Write-Host "  Pipeline value:        $($totalValue.ToString('C0'))" -ForegroundColor Cyan
    } catch { Write-Host "  Pipeline value:        ERROR" -ForegroundColor Red }

    $script:totalPass++
}
Write-Host ""

# ============================================
# [6/6] N8N MCP SERVER
# ============================================
Write-Host "[6/6] N8N MCP SERVER" -ForegroundColor Cyan
Write-Host "---------------------"
Check-Url "N8N MCP Endpoint" "https://skooki.app.n8n.cloud/mcp-server/http"
Write-Host ""

# ============================================
# SUMMARY
# ============================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  DOCTOR COMPLETE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Passed:   $($script:totalPass)" -ForegroundColor Green
Write-Host "  Warnings: $($script:totalWarn)" -ForegroundColor Yellow
Write-Host "  Failed:   $($script:totalFail)" -ForegroundColor Red
Write-Host ""
if ($script:totalFail -eq 0 -and $script:totalWarn -eq 0) {
    Write-Host "  ALL SYSTEMS GREEN" -ForegroundColor Green
} elseif ($script:totalFail -eq 0) {
    Write-Host "  SYSTEM OPERATIONAL — review warnings above" -ForegroundColor Yellow
} else {
    Write-Host "  FAILURES DETECTED — review red items above" -ForegroundColor Red
    Write-Host "    ENV missing?    -> Check .env.local" -ForegroundColor DarkGray
    Write-Host "    URL failed?     -> Check DNS/VPN/service" -ForegroundColor DarkGray
    Write-Host "    Table missing?  -> Run Supabase migrations" -ForegroundColor DarkGray
    Write-Host "    Webhook 404?    -> Activate workflow in N8N" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""