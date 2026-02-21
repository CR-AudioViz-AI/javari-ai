#!/usr/bin/env bash
# lib/canonical/scripts/verify.sh
# CR AudioViz AI — Canonical Ingest Verification Script
# 2026-02-22 — Canonical Document Ingestion System
#
# Usage:
#   export BASE_URL=https://javari-xxxx.vercel.app
#   export CANONICAL_ADMIN_SECRET=your_secret
#   export SUPABASE_URL=https://xxxx.supabase.co
#   export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
#   bash lib/canonical/scripts/verify.sh
#
# What this checks:
#   1. GET /api/canonical/ingest — health check
#   2. POST /api/canonical/ingest?dryRun=true — dry run (no writes)
#   3. POST /api/canonical/ingest?force=true — live ingest
#   4. canonical_docs rows exist in Supabase
#   5. canonical_doc_chunks rows exist
#   6. Sample embedding is exactly 1536 dimensions
#   7. match_canonical_chunks RPC works

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
BASE_URL="${BASE_URL:-https://craudiovizai.com}"
SECRET="${CANONICAL_ADMIN_SECRET:-}"
SB_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
SB_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
PASS=0
FAIL=0

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✅ PASS${NC}: $1"; ((PASS++)); }
fail() { echo -e "${RED}❌ FAIL${NC}: $1"; ((FAIL++)); }
info() { echo -e "${YELLOW}ℹ️  INFO${NC}: $1"; }

echo ""
echo "══════════════════════════════════════════════════════"
echo " CR AudioViz AI — Canonical Ingest Verification"
echo " $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "══════════════════════════════════════════════════════"
echo ""

# ── Guard: require env vars ────────────────────────────────────────────────────
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

# ── CHECK 1: Health endpoint ───────────────────────────────────────────────────
echo "CHECK 1: GET /api/canonical/ingest (health)"
HEALTH=$(curl -s -w "\nHTTP:%{http_code}" --max-time 15 \
  "${BASE_URL}/api/canonical/ingest")
HTTP_CODE=$(echo "$HEALTH" | grep "HTTP:" | cut -d: -f2)
BODY=$(echo "$HEALTH" | grep -v "HTTP:")

if [[ "$HTTP_CODE" == "200" ]]; then
  ENABLED=$(echo "$BODY" | grep -o '"enabled":true' | head -1)
  if [[ -n "$ENABLED" ]]; then
    ok "Health endpoint returns 200, enabled=true"
  else
    fail "Health endpoint returns 200 but enabled=false — set CANONICAL_INGEST_ENABLED=true"
  fi
else
  fail "Health endpoint returned HTTP $HTTP_CODE (expected 200)"
fi

# ── CHECK 2: Auth guard ────────────────────────────────────────────────────────
echo ""
echo "CHECK 2: Auth guard (POST without secret → 401)"
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "${BASE_URL}/api/canonical/ingest")
if [[ "$AUTH_CODE" == "401" ]]; then
  ok "Auth guard blocks unauthenticated POST (401)"
else
  fail "Auth guard returned HTTP $AUTH_CODE (expected 401)"
fi

# ── CHECK 3: Dry run ───────────────────────────────────────────────────────────
echo ""
echo "CHECK 3: POST dry run (no writes)"
DRY=$(curl -s -w "\nHTTP:%{http_code}" --max-time 60 \
  -X POST "${BASE_URL}/api/canonical/ingest" \
  -H "x-canonical-secret: ${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}')
DRY_CODE=$(echo "$DRY" | grep "HTTP:" | cut -d: -f2)
DRY_BODY=$(echo "$DRY" | grep -v "HTTP:")

if [[ "$DRY_CODE" == "200" ]]; then
  DRY_RUN_VAL=$(echo "$DRY_BODY" | grep -o '"dryRun":true' | head -1)
  DOCS_PROC=$(echo "$DRY_BODY" | grep -o '"docsProcessed":[0-9]*' | cut -d: -f2)
  if [[ -n "$DRY_RUN_VAL" ]]; then
    ok "Dry run returned 200, dryRun=true, docsProcessed=${DOCS_PROC:-unknown}"
  else
    fail "Dry run returned 200 but dryRun flag missing from response"
  fi
else
  fail "Dry run returned HTTP $DRY_CODE (expected 200)"
  info "Body: $(echo "$DRY_BODY" | head -c 300)"
fi

# ── CHECK 4: Live ingest ───────────────────────────────────────────────────────
echo ""
echo "CHECK 4: POST live ingest (force=true)"
info "This may take several minutes for large doc sets..."
LIVE=$(curl -s -w "\nHTTP:%{http_code}" --max-time 300 \
  -X POST "${BASE_URL}/api/canonical/ingest" \
  -H "x-canonical-secret: ${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"force": true}')
LIVE_CODE=$(echo "$LIVE" | grep "HTTP:" | cut -d: -f2)
LIVE_BODY=$(echo "$LIVE" | grep -v "HTTP:")

if [[ "$LIVE_CODE" == "200" ]]; then
  DOCS_UPDATED=$(echo "$LIVE_BODY" | grep -o '"docsUpdated":[0-9]*' | cut -d: -f2)
  CHUNKS=$(echo "$LIVE_BODY" | grep -o '"chunksCreated":[0-9]*' | cut -d: -f2)
  ok "Live ingest returned 200 (docsUpdated=${DOCS_UPDATED:-0}, chunksCreated=${CHUNKS:-0})"
else
  fail "Live ingest returned HTTP $LIVE_CODE (expected 200)"
  info "Body: $(echo "$LIVE_BODY" | head -c 400)"
fi

# ── CHECK 5: canonical_docs rows ──────────────────────────────────────────────
echo ""
echo "CHECK 5: canonical_docs rows in Supabase"
DOCS_RES=$(curl -s -w "\nHTTP:%{http_code}" --max-time 10 \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  -H "Prefer: count=exact" \
  "${SB_URL}/rest/v1/canonical_docs?select=count")
DOCS_CODE=$(echo "$DOCS_RES" | grep "HTTP:" | cut -d: -f2)
DOCS_BODY=$(echo "$DOCS_RES" | grep -v "HTTP:")

if [[ "$DOCS_CODE" == "200" ]]; then
  DOC_COUNT=$(echo "$DOCS_BODY" | grep -o '"count":[0-9]*' | head -1 | cut -d: -f2)
  if [[ -z "$DOC_COUNT" ]]; then
    # Try counting array length
    DOC_COUNT=$(echo "$DOCS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "?")
  fi
  if [[ "$DOC_COUNT" != "0" && "$DOC_COUNT" != "" && "$DOC_COUNT" != "?" ]]; then
    ok "canonical_docs has ${DOC_COUNT} row(s)"
  else
    fail "canonical_docs appears empty (count=${DOC_COUNT:-unknown})"
  fi
else
  fail "canonical_docs query returned HTTP $DOCS_CODE"
fi

# ── CHECK 6: canonical_doc_chunks rows ────────────────────────────────────────
echo ""
echo "CHECK 6: canonical_doc_chunks rows in Supabase"
CHUNKS_RES=$(curl -s -w "\nHTTP:%{http_code}" --max-time 10 \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  "${SB_URL}/rest/v1/canonical_doc_chunks?select=id,chunk_index,token_count&limit=5")
CHUNKS_CODE=$(echo "$CHUNKS_RES" | grep "HTTP:" | cut -d: -f2)
CHUNKS_BODY=$(echo "$CHUNKS_RES" | grep -v "HTTP:")

if [[ "$CHUNKS_CODE" == "200" ]]; then
  CHUNK_COUNT=$(echo "$CHUNKS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "?")
  if [[ "$CHUNK_COUNT" != "0" && "$CHUNK_COUNT" != "" && "$CHUNK_COUNT" != "?" ]]; then
    ok "canonical_doc_chunks has rows (sample size: ${CHUNK_COUNT})"
  else
    fail "canonical_doc_chunks appears empty"
  fi
else
  fail "canonical_doc_chunks query returned HTTP $CHUNKS_CODE"
fi

# ── CHECK 7: Embedding dimension = 1536 ──────────────────────────────────────
echo ""
echo "CHECK 7: Embedding vector dimension = 1536"
VEC_RES=$(curl -s --max-time 10 \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  "${SB_URL}/rest/v1/canonical_doc_chunks?select=embedding&limit=1")
VEC_DIM=$(echo "$VEC_RES" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if d and d[0].get('embedding'):
        emb = d[0]['embedding']
        # embedding may be a string '[...]' or a list
        if isinstance(emb, str):
            import ast
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

# ── CHECK 8: match_canonical_chunks RPC ──────────────────────────────────────
echo ""
echo "CHECK 8: match_canonical_chunks RPC (zero-vector smoke test)"
# Use a zero vector just to test the function exists and returns valid JSON
ZERO_VEC=$(python3 -c "print('[' + ','.join(['0.0']*1536) + ']')")
RPC_RES=$(curl -s -w "\nHTTP:%{http_code}" --max-time 15 \
  -X POST "${SB_URL}/rest/v1/rpc/match_canonical_chunks" \
  -H "apikey: ${SB_KEY}" \
  -H "Authorization: Bearer ${SB_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query_embedding\": ${ZERO_VEC}, \"match_threshold\": 0.0, \"match_count\": 1}")
RPC_CODE=$(echo "$RPC_RES" | grep "HTTP:" | cut -d: -f2)
RPC_BODY=$(echo "$RPC_RES" | grep -v "HTTP:")

if [[ "$RPC_CODE" == "200" ]]; then
  ok "match_canonical_chunks RPC callable (HTTP 200)"
else
  fail "match_canonical_chunks RPC returned HTTP $RPC_CODE"
  info "Body: $(echo "$RPC_BODY" | head -c 300)"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo " VERIFICATION SUMMARY"
echo "══════════════════════════════════════════════════════"
echo -e " ${GREEN}PASS${NC}: $PASS"
echo -e " ${RED}FAIL${NC}: $FAIL"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}🎉 ALL CHECKS PASSED — Canonical ingest system is operational.${NC}"
  exit 0
else
  echo -e "${RED}⚠️  $FAIL CHECK(S) FAILED — review output above.${NC}"
  exit 1
fi
