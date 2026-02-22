#!/usr/bin/env bash
# lib/canonical/scripts/verify.sh
# CR AudioViz AI — Canonical Ingest Verification Script
# 2026-02-22 FINAL — Canonical Document Ingestion System
#
# Usage:
#   export BASE_URL=https://javari-xxxx.vercel.app
#   export CANONICAL_ADMIN_SECRET=your_secret
#   export SUPABASE_URL=https://xxxx.supabase.co
#   export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
#   bash lib/canonical/scripts/verify.sh
#
# Checks:
#   C1. GET  /api/canonical/ingest → 200 + enabled=true
#   C2. POST (no auth) → 401
#   C3. POST dryRun=true → 200 + docsProcessed >= 0
#   C4. POST force=true  → 200 + success=true (live ingest)
#   C5. canonical_docs rows > 0 in Supabase
#   C6. canonical_doc_chunks rows > 0 in Supabase
#   C7. Sample embedding dimension = 1536
#   C8. match_canonical_chunks RPC callable

set -euo pipefail

BASE_URL="${BASE_URL:-https://craudiovizai.com}"
SECRET="${CANONICAL_ADMIN_SECRET:-}"
SB_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
SB_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
PASS=0
FAIL=0

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✅ PASS${NC}: $1"; ((PASS++)); }
fail() { echo -e "${RED}❌ FAIL${NC}: $1"; ((FAIL++)); }
info() { echo -e "${YELLOW}ℹ️  INFO${NC}: $1"; }
sep()  { echo "──────────────────────────────────────────────────────"; }

echo ""
echo "══════════════════════════════════════════════════════"
echo " CR AudioViz AI — Canonical Ingest Verification"
echo " $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "══════════════════════════════════════════════════════"
echo ""

# Guard: require env vars
if [[ -z "$SECRET" ]]; then
  fail "CANONICAL_ADMIN_SECRET is not set — export it before running"
  exit 1
fi
if [[ -z "$SB_URL" || -z "$SB_KEY" ]]; then
  fail "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  exit 1
fi

info "Base URL:  $BASE_URL"
info "Supabase:  $SB_URL"
echo ""

# ── C1: Health endpoint ────────────────────────────────────────────────────────
sep
echo "C1: GET /api/canonical/ingest (health)"
RESP=$(curl -s -w "\nHTTP:%{http_code}" --max-time 15 "${BASE_URL}/api/canonical/ingest")
CODE=$(echo "$RESP" | grep "HTTP:" | cut -d: -f2)
BODY=$(echo "$RESP" | grep -v "HTTP:")

if [[ "$CODE" == "200" ]]; then
  ENABLED=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('enabled','?'))" 2>/dev/null)
  R2_OK=$(echo "$BODY"   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('r2',{}).get('ok','?'))" 2>/dev/null)
  R2_MSG=$(echo "$BODY"  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('r2',{}).get('message','?')[:80])" 2>/dev/null)
  info "enabled=$ENABLED  r2.ok=$R2_OK  r2.message=$R2_MSG"
  if [[ "$ENABLED" == "True" ]]; then
    ok "Health endpoint → 200, enabled=true"
  else
    fail "Health endpoint → 200 but enabled=false (check CANONICAL_INGEST_ENABLED)"
  fi
else
  fail "Health endpoint → HTTP $CODE (expected 200)"
  info "Body: ${BODY:0:300}"
fi

# ── C2: Auth guard ─────────────────────────────────────────────────────────────
sep
echo "C2: POST without secret → 401"
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "${BASE_URL}/api/canonical/ingest")
if [[ "$AUTH_CODE" == "401" ]]; then
  ok "Auth guard blocks unauthenticated POST (401)"
else
  fail "Auth guard returned $AUTH_CODE (expected 401)"
fi

# ── C3: Dry run ────────────────────────────────────────────────────────────────
sep
echo "C3: POST dryRun=true (no writes)"
DRY=$(curl -s -w "\nHTTP:%{http_code}" --max-time 120 \
  -X POST "${BASE_URL}/api/canonical/ingest" \
  -H "x-canonical-secret: ${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}')
DRY_CODE=$(echo "$DRY" | grep "HTTP:" | cut -d: -f2)
DRY_BODY=$(echo "$DRY" | grep -v "HTTP:")

if [[ "$DRY_CODE" == "200" ]]; then
  DOCS_PROC=$(echo "$DRY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('docsProcessed','?'))" 2>/dev/null)
  ok "Dry run → 200, docsProcessed=${DOCS_PROC:-?}"
else
  fail "Dry run → HTTP $DRY_CODE (expected 200)"
  info "Body: ${DRY_BODY:0:300}"
fi

# ── C4: Live ingest ────────────────────────────────────────────────────────────
sep
echo "C4: POST force=true (live ingest — may take several minutes)"
info "Waiting for ingest to complete..."
LIVE=$(curl -s -w "\nHTTP:%{http_code}" --max-time 300 \
  -X POST "${BASE_URL}/api/canonical/ingest" \
  -H "x-canonical-secret: ${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"force": true}')
LIVE_CODE=$(echo "$LIVE" | grep "HTTP:" | cut -d: -f2)
LIVE_BODY=$(echo "$LIVE" | grep -v "HTTP:")

if [[ "$LIVE_CODE" == "200" ]]; then
  DOCS_UP=$(echo "$LIVE_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('docsUpdated','?'))" 2>/dev/null)
  CHUNKS=$(echo "$LIVE_BODY"  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('chunksCreated','?'))" 2>/dev/null)
  DUR=$(echo "$LIVE_BODY"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('durationMs','?'))" 2>/dev/null)
  ok "Live ingest → 200 (docsUpdated=${DOCS_UP} chunksCreated=${CHUNKS} durationMs=${DUR})"
else
  fail "Live ingest → HTTP $LIVE_CODE (expected 200)"
  info "Body: ${LIVE_BODY:0:400}"
fi

# ── C5: canonical_docs rows ────────────────────────────────────────────────────
sep
echo "C5: canonical_docs rows in Supabase"
DOCS_RES=$(curl -s --max-time 10 \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  "${SB_URL}/rest/v1/canonical_docs?select=id,r2_key,sha256&limit=5")
DOC_COUNT=$(echo "$DOCS_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")
if [[ "$DOC_COUNT" != "0" ]]; then
  ok "canonical_docs has rows (sample count: ${DOC_COUNT})"
else
  fail "canonical_docs appears empty"
fi

# ── C6: canonical_doc_chunks rows ─────────────────────────────────────────────
sep
echo "C6: canonical_doc_chunks rows in Supabase"
CHUNK_RES=$(curl -s --max-time 10 \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  "${SB_URL}/rest/v1/canonical_doc_chunks?select=id,chunk_index,token_count&limit=5")
CHUNK_COUNT=$(echo "$CHUNK_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")
if [[ "$CHUNK_COUNT" != "0" ]]; then
  ok "canonical_doc_chunks has rows (sample count: ${CHUNK_COUNT})"
else
  fail "canonical_doc_chunks appears empty"
fi

# ── C7: Embedding dimension = 1536 ────────────────────────────────────────────
sep
echo "C7: Embedding vector dimension = 1536"
VEC_RES=$(curl -s --max-time 10 \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  "${SB_URL}/rest/v1/canonical_doc_chunks?select=embedding&limit=1")
VEC_DIM=$(echo "$VEC_RES" | python3 -c "
import sys, json, ast
try:
  d = json.load(sys.stdin)
  if d and d[0].get('embedding') is not None:
    emb = d[0]['embedding']
    if isinstance(emb, str):
      emb = ast.literal_eval(emb)
    print(len(emb))
  else:
    print('no_embedding')
except Exception as e:
  print(f'error:{e}')
" 2>/dev/null || echo "parse_error")

if [[ "$VEC_DIM" == "1536" ]]; then
  ok "Embedding dimension is exactly 1536 ✓"
elif [[ "$VEC_DIM" == "no_embedding" ]]; then
  fail "No embeddings found in canonical_doc_chunks"
else
  fail "Unexpected embedding dimension: ${VEC_DIM} (expected 1536)"
fi

# ── C8: match_canonical_chunks RPC ────────────────────────────────────────────
sep
echo "C8: match_canonical_chunks RPC (zero-vector smoke test)"
ZERO_VEC=$(python3 -c "print('[' + ','.join(['0.0']*1536) + ']')")
RPC_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "${SB_URL}/rest/v1/rpc/match_canonical_chunks" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query_embedding\": ${ZERO_VEC}, \"match_threshold\": 0.0, \"match_count\": 1}")

if [[ "$RPC_CODE" == "200" ]]; then
  ok "match_canonical_chunks RPC callable (HTTP 200)"
else
  fail "match_canonical_chunks RPC → HTTP $RPC_CODE (expected 200 — check migration ran)"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo " VERIFICATION SUMMARY"
echo "══════════════════════════════════════════════════════"
echo -e " ${GREEN}PASS${NC}: $PASS  /  ${RED}FAIL${NC}: $FAIL  / TOTAL: $((PASS+FAIL))"
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}🎉 ALL $PASS CHECKS PASSED — Canonical ingest system is operational.${NC}"
  exit 0
else
  echo -e "${RED}⚠️  $FAIL CHECK(S) FAILED — review output above.${NC}"
  exit 1
fi
