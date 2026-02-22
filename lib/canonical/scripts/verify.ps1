# lib/canonical/scripts/verify.ps1
# CR AudioViz AI — Canonical Ingest Verification (Windows PowerShell)
# 2026-02-22 PART 1
#
# Usage:
#   $env:BASE_URL               = "https://javari-xxxx.vercel.app"
#   $env:CANONICAL_ADMIN_SECRET = "your_secret_here"
#   .\lib\canonical\scripts\verify.ps1

$BASE_URL = if ($env:BASE_URL)               { $env:BASE_URL }               else { "https://craudiovizai.com" }
$SECRET   = if ($env:CANONICAL_ADMIN_SECRET) { $env:CANONICAL_ADMIN_SECRET } else { "REPLACE_ME" }

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " CR AudioViz AI — Canonical Ingest Verify"     -ForegroundColor Cyan
Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"    -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Base URL : $BASE_URL"
Write-Host "Secret   : $(if ($SECRET -eq 'REPLACE_ME') { '⚠  NOT SET' } else { 'set (' + $SECRET.Length + ' chars)' })"
Write-Host ""

# ── CHECK 1: no auth → 401 ────────────────────────────────────────────────────
Write-Host "CHECK 1: POST without secret → expect 401"
try {
    $r1 = Invoke-WebRequest `
        -Uri    "$BASE_URL/api/canonical/ingest" `
        -Method POST `
        -UseBasicParsing `
        -ErrorAction Stop
    Write-Host "  ❌ FAIL — expected 401, got $($r1.StatusCode)" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) {
        Write-Host "  ✅ PASS — auth guard returned 401" -ForegroundColor Green
    } else {
        Write-Host "  ❌ FAIL — expected 401, got $code" -ForegroundColor Red
    }
}

# ── CHECK 2: with correct secret → 200 skeleton_ready ─────────────────────────
Write-Host ""
Write-Host "CHECK 2: POST with secret → expect 200 + skeleton_ready"
try {
    $r2 = Invoke-WebRequest `
        -Uri     "$BASE_URL/api/canonical/ingest" `
        -Method  POST `
        -Headers @{ "x-canonical-secret" = $SECRET; "Content-Type" = "application/json" } `
        -Body    "{}" `
        -UseBasicParsing `
        -ErrorAction Stop

    $body = $r2.Content | ConvertFrom-Json

    if ($r2.StatusCode -eq 200 -and $body.ok -eq $true -and $body.status -eq "skeleton_ready") {
        Write-Host "  ✅ PASS — $($r2.Content)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ FAIL — unexpected response: $($r2.Content)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ FAIL — $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.Exception.Response)" -ForegroundColor Red
}

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Done. Fix any ❌ before proceeding to PART 2." -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
