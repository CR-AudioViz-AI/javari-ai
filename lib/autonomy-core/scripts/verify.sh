#!/usr/bin/env bash
# lib/autonomy-core/scripts/verify.sh
# CR AudioViz AI — STEP 11 Autonomy Core Verification Script
# Usage: BASE_URL=https://your-deploy.vercel.app ADMIN_SECRET=xxx bash verify.sh

set -euo pipefail

BASE="${BASE_URL:-https://craudiovizai.com}"
SECRET="${ADMIN_SECRET:-}"
PASS=0; FAIL=0

check() {
  local name="$1"; local url="$2"; local expected="$3"
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url")
  if [[ "$actual" == "$expected" ]]; then
    echo "✅ $name → HTTP $actual"
    ((PASS++))
  else
    echo "❌ $name → HTTP $actual (expected $expected)"
    ((FAIL++))
  fi
}

check_json() {
  local name="$1"; local url="$2"; local jq_expr="$3"; local expected="$4"
  local actual
  actual=$(curl -s --max-time 15 "$url" | jq -r "$jq_expr" 2>/dev/null || echo "PARSE_ERROR")
  if [[ "$actual" == "$expected" ]]; then
    echo "✅ $name → $actual"
    ((PASS++))
  else
    echo "❌ $name → $actual (expected $expected)"
    ((FAIL++))
  fi
}

echo "═══════════════════════════════════════════"
echo "STEP 11 Autonomy Core Verification"
echo "BASE: $BASE"
echo "═══════════════════════════════════════════"

# HTTP checks
check "Dashboard page"        "$BASE/autonomy-core"                "200"
check "Run endpoint GET"       "$BASE/api/autonomy-core/run"        "200"
check "Status endpoint GET"    "$BASE/api/autonomy-core/status"     "200"
check "Rollback no auth"       "$BASE/api/autonomy-core/rollback"   "405"

# JSON content checks
check_json "Run: status field" "$BASE/api/autonomy-core/run" ".status" "autonomy-core"
check_json "Run: enabled=false" "$BASE/api/autonomy-core/run" ".enabled" "false"
check_json "Run: ring=2"       "$BASE/api/autonomy-core/run" ".ring" "2"
check_json "Run: killSwitch"   "$BASE/api/autonomy-core/run" ".killSwitch" "false"
check_json "Run: scope"        "$BASE/api/autonomy-core/run" ".scope" "core_only"
check_json "Status: config.enabled" "$BASE/api/autonomy-core/status" ".config.enabled" "false"
check_json "Status: config.mode" "$BASE/api/autonomy-core/status" ".config.mode" "continuous"

# Test dry run with admin secret (if secret provided)
if [[ -n "$SECRET" ]]; then
  DR=$(curl -s -X POST --max-time 60 \
    -H "x-autonomy-secret: $SECRET" \
    "$BASE/api/autonomy-core/run?dry=1&force=1")
  DRY_STATUS=$(echo "$DR" | jq -r ".status" 2>/dev/null || echo "PARSE_ERROR")
  if [[ "$DRY_STATUS" == "completed" || "$DRY_STATUS" == "halted" ]]; then
    echo "✅ Dry run triggered → status=$DRY_STATUS"
    ((PASS++))
  else
    echo "❌ Dry run failed → $DRY_STATUS"
    ((FAIL++))
  fi
else
  echo "⏭️  Dry run skipped (no ADMIN_SECRET provided)"
fi

# Regression checks
check "Health live"    "$BASE/api/health/live"       "200"
check "Health ready"   "$BASE/api/health/ready"      "200"
check "Factory status" "$BASE/api/factory"           "200"
check "Autonomy status" "$BASE/api/autonomy"         "200"
check "Beta checklist" "$BASE/api/beta/checklist"    "200"

echo ""
echo "═══════════════════════════════════════════"
echo "Results: ✅ $PASS passed | ❌ $FAIL failed"
echo "═══════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
