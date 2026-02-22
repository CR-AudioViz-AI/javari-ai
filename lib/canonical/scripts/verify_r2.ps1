# lib/canonical/scripts/verify_r2.ps1
# CR AudioViz AI — Canonical R2 + Chunker Verification (Windows PowerShell)
# 2026-02-22 PART 2 — No DB writes. Read-only.
#
# Usage:
#   $env:BASE_URL               = "https://javari-xxxx.vercel.app"
#   $env:CANONICAL_ADMIN_SECRET = "your_secret_here"
#   .\lib\canonical\scripts\verify_r2.ps1
#
# What this checks:
#   POST /api/canonical/ingest/inspect
#     → lists R2 keys, fetches first doc, returns sha256 + chunk count
#   (No writes to Supabase in PART 2)

$BASE_URL = if ($env:BASE_URL)               { $env:BASE_URL }               else { "https://craudiovizai.com" }
$SECRET   = if ($env:CANONICAL_ADMIN_SECRET) { $env:CANONICAL_ADMIN_SECRET } else { "REPLACE_ME" }

Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " CR AudioViz AI — Canonical R2 Verify (PART 2)"   -ForegroundColor Cyan
Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"        -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Base URL : $BASE_URL"
Write-Host "Secret   : $(if ($SECRET -eq 'REPLACE_ME') { '⚠  NOT SET — set $env:CANONICAL_ADMIN_SECRET' } else { "set ($($SECRET.Length) chars)" })"
Write-Host ""

if ($SECRET -eq "REPLACE_ME") {
    Write-Host "❌ CANONICAL_ADMIN_SECRET not set. Export it before running." -ForegroundColor Red
    exit 1
}

# ── CHECK 1: PART 1 skeleton still alive ──────────────────────────────────────
Write-Host "CHECK 1: POST /api/canonical/ingest → skeleton still responds"
try {
    $r1 = Invoke-WebRequest `
        -Uri     "$BASE_URL/api/canonical/ingest" `
        -Method  POST `
        -Headers @{ "x-canonical-secret" = $SECRET; "Content-Type" = "application/json" } `
        -Body    "{}" `
        -UseBasicParsing `
        -ErrorAction Stop

    $body1 = $r1.Content | ConvertFrom-Json
    if ($r1.StatusCode -eq 200 -and $body1.ok) {
        Write-Host "  ✅ PASS — $($r1.Content)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ FAIL — unexpected: $($r1.Content)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ FAIL — $($_.Exception.Message)" -ForegroundColor Red
}

# ── CHECK 2: R2 key listing via inspect endpoint ───────────────────────────────
Write-Host ""
Write-Host "CHECK 2: POST /api/canonical/ingest/inspect → list R2 keys"
try {
    $r2 = Invoke-WebRequest `
        -Uri     "$BASE_URL/api/canonical/ingest/inspect" `
        -Method  POST `
        -Headers @{ "x-canonical-secret" = $SECRET; "Content-Type" = "application/json" } `
        -Body    "{}" `
        -UseBasicParsing `
        -ErrorAction Stop

    $body2 = $r2.Content | ConvertFrom-Json

    if ($r2.StatusCode -eq 200) {
        $keyCount = $body2.keyCount
        $firstKey = $body2.firstKey
        $sha256   = $body2.firstDocSha256
        $chunks   = $body2.firstDocChunkCount

        Write-Host "  ✅ PASS" -ForegroundColor Green
        Write-Host "     Key count      : $keyCount"
        Write-Host "     First key      : $firstKey"
        Write-Host "     SHA-256        : $sha256"
        Write-Host "     Chunk count    : $chunks"

        if ($keyCount -eq 0) {
            Write-Host ""
            Write-Host "  ⚠  No keys found under prefix." -ForegroundColor Yellow
            Write-Host "     The R2_CANONICAL_BUCKET / R2_CANONICAL_PREFIX env vars may be" -ForegroundColor Yellow
            Write-Host "     pointing at an empty bucket. Upload docs and re-run." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ FAIL — HTTP $($r2.StatusCode): $($r2.Content)" -ForegroundColor Red
    }
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  ❌ FAIL — HTTP $code — $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  (inspect endpoint only exists from PART 2 onward)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Done. Proceed to PART 3 (embed + store) once"    -ForegroundColor Cyan
Write-Host " CHECK 2 shows keyCount > 0 and sha256 populated." -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
