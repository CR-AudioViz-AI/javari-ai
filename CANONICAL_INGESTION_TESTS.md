# CANONICAL INGESTION ENDPOINT - VALIDATION TESTS

**Endpoint:** `/api/canonical/ingest`  
**Created:** Tuesday, February 25, 2026 at 2:05 AM EST  
**Version:** 2.0.0

---

## TEST SUITE V1

### Prerequisites
- Vercel project deployed
- All environment variables configured
- CANONICAL_ADMIN_SECRET generated
- R2 credentials valid
- OpenAI API key valid
- Supabase database accessible

---

## TEST 1: Authentication

### Test 1.1: Missing Authorization Header
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Unauthorized",
  "message": "Missing or invalid x-canonical-secret header"
}
```
**Expected Status:** 401

---

### Test 1.2: Invalid Secret
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: wrong-secret' \
  -d '{}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Unauthorized",
  "message": "Missing or invalid x-canonical-secret header"
}
```
**Expected Status:** 401

---

### Test 1.3: Valid Secret
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{}'
```

**Expected:** Proceeds to validation (not 401)

✅ **PASS** if status is NOT 401

---

## TEST 2: Request Validation

### Test 2.1: Invalid JSON
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d 'invalid json{'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Invalid JSON",
  "message": "Request body must be valid JSON"
}
```
**Expected Status:** 400

---

### Test 2.2: Invalid Mode
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{"mode":"invalid"}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Validation error",
  "message": "mode must be 'full', 'incremental', or 'dry-run'"
}
```
**Expected Status:** 400

---

### Test 2.3: Invalid Source
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{"source":"s3"}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Validation error",
  "message": "source must be 'r2'"
}
```
**Expected Status:** 400

---

### Test 2.4: Invalid maxTokens (too low)
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{"maxTokens":50}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Validation error",
  "message": "maxTokens must be a number between 100 and 2000"
}
```
**Expected Status:** 400

---

### Test 2.5: Valid Request (Dry Run)
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{"mode":"dry-run"}'
```

**Expected:** Successful dry run (no database writes)

✅ **PASS** if `ok: true` and `summary.dryRun: true`

---

## TEST 3: Environment Validation

### Test 3.1: Missing Environment Variables

**Setup:** Temporarily remove R2_ACCESS_KEY_ID from Vercel

**Request:**
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{"mode":"dry-run"}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Configuration error",
  "message": "Missing required environment variables",
  "missing": ["R2_ACCESS_KEY_ID"]
}
```
**Expected Status:** 500

**Cleanup:** Restore R2_ACCESS_KEY_ID

---

## TEST 4: Dry Run Execution

### Test 4.1: Full Dry Run
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{
    "mode": "dry-run",
    "source": "r2",
    "force": false,
    "maxTokens": 800
  }'
```

**Expected Response Structure:**
```json
{
  "ok": true,
  "message": "Dry run completed successfully (no writes performed)",
  "mode": "dry-run",
  "source": "r2",
  "summary": {
    "docsProcessed": 34,
    "docsUpdated": 0,
    "docsUnchanged": 0,
    "docsFailed": 0,
    "chunksCreated": 0,
    "chunksSkipped": 0,
    "ingestionDurationMs": "<duration>",
    "totalDurationMs": "<duration>"
  },
  "stats": {
    "before": { ... },
    "after": { ... },
    "delta": null
  },
  "details": {
    "force": false,
    "dryRun": true,
    "maxTokens": 800
  },
  "timestamp": "<ISO timestamp>"
}
```

**Validation Checks:**
- ✅ `ok` is `true`
- ✅ `mode` is `"dry-run"`
- ✅ `summary.docsProcessed` > 0
- ✅ `summary.chunksCreated` is 0 (dry run = no writes)
- ✅ `stats.delta` is `null` (no database changes)
- ✅ Response time < 60 seconds

---

## TEST 5: Full Ingestion (Production)

### Test 5.1: First Full Ingestion
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{
    "mode": "full",
    "source": "r2",
    "force": false,
    "maxTokens": 800
  }'
```

**Expected Response Structure:**
```json
{
  "ok": true,
  "message": "Canonical ingestion completed successfully",
  "mode": "full",
  "source": "r2",
  "summary": {
    "docsProcessed": 34,
    "docsUpdated": 34,
    "docsUnchanged": 0,
    "docsFailed": 0,
    "chunksCreated": 500-1000,
    "chunksSkipped": 0,
    "ingestionDurationMs": "<duration>",
    "totalDurationMs": "<duration>"
  },
  "stats": {
    "before": {
      "documentCount": 0,
      "chunkCount": 0,
      "embeddingCount": 0
    },
    "after": {
      "documentCount": 34,
      "chunkCount": 500-1000,
      "embeddingCount": 500-1000
    },
    "delta": {
      "documents": 34,
      "chunks": 500-1000,
      "embeddings": 500-1000
    }
  },
  "details": {
    "force": false,
    "dryRun": false,
    "maxTokens": 800
  },
  "timestamp": "<ISO timestamp>"
}
```

**Validation Checks:**
- ✅ `ok` is `true`
- ✅ `summary.docsProcessed` === 34 (expected document count)
- ✅ `summary.docsUpdated` === 34 (all new)
- ✅ `summary.chunksCreated` > 0
- ✅ `stats.delta.documents` === 34
- ✅ `stats.delta.chunks` > 0
- ✅ `stats.delta.embeddings` > 0
- ✅ Response time < 600 seconds (10 minutes)

---

### Test 5.2: Second Full Ingestion (Unchanged)
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{
    "mode": "full",
    "source": "r2",
    "force": false,
    "maxTokens": 800
  }'
```

**Expected Response:**
- ✅ `summary.docsUnchanged` === 34
- ✅ `summary.docsUpdated` === 0
- ✅ `summary.chunksCreated` === 0
- ✅ `stats.delta.documents` === 0
- ✅ Faster execution (no embeddings needed)

---

### Test 5.3: Force Re-ingestion
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET_HERE' \
  -d '{
    "mode": "full",
    "source": "r2",
    "force": true,
    "maxTokens": 800
  }'
```

**Expected Response:**
- ✅ `summary.docsUpdated` === 34 (all re-ingested despite no changes)
- ✅ `summary.chunksCreated` > 0 (embeddings regenerated)
- ✅ Similar duration to first ingestion

---

## TEST 6: GET Status Check

### Test 6.1: Status Endpoint
```bash
curl -X GET https://javari-ai.vercel.app/api/canonical/ingest
```

**Expected Response:**
```json
{
  "ok": true,
  "status": "ready",
  "stats": {
    "documentCount": 34,
    "chunkCount": 500-1000,
    "embeddingCount": 500-1000
  },
  "endpoints": {
    "ingest": "POST /api/canonical/ingest",
    "inspect": "POST /api/canonical/ingest/inspect"
  },
  "timestamp": "<ISO timestamp>"
}
```

**Validation Checks:**
- ✅ `ok` is `true`
- ✅ `status` is `"ready"`
- ✅ `stats` contains document counts
- ✅ Response time < 5 seconds

---

## TEST 7: Database Verification

### Test 7.1: Verify Documents Table
```sql
SELECT COUNT(*) FROM canonical_documents;
```
**Expected:** 34 rows

### Test 7.2: Verify Chunks Table
```sql
SELECT COUNT(*) FROM canonical_chunks;
```
**Expected:** 500-1000 rows

### Test 7.3: Verify Embeddings Table
```sql
SELECT COUNT(*) FROM canonical_embeddings;
```
**Expected:** 500-1000 rows (same as chunks)

### Test 7.4: Verify Embedding Dimensions
```sql
SELECT 
  array_length(embedding, 1) as dimension,
  COUNT(*) as count
FROM canonical_embeddings
GROUP BY dimension;
```
**Expected:** All embeddings have dimension 1536

### Test 7.5: Sample Document Content
```sql
SELECT r2_key, doc_title, char_count, chunk_count
FROM canonical_documents
LIMIT 5;
```
**Expected:** Valid titles, reasonable character counts

---

## TEST 8: Error Handling

### Test 8.1: Invalid R2 Credentials

**Setup:** Temporarily set incorrect R2_ACCESS_KEY_ID

**Request:** Execute dry-run

**Expected:**
- Status: 500
- Error message containing "R2 unreachable"

**Cleanup:** Restore correct credentials

---

### Test 8.2: Invalid OpenAI API Key

**Setup:** Temporarily set incorrect OPENAI_API_KEY

**Request:** Execute full ingestion

**Expected:**
- Status: 500
- Error message containing OpenAI error
- Some documents may succeed before failure

**Cleanup:** Restore correct API key

---

## TEST 9: Performance & Timeout

### Test 9.1: Large Ingestion Performance
**Measure:**
- Time to complete full ingestion
- Memory usage (Vercel logs)
- Error rate

**Expected:**
- Duration: 5-10 minutes for 34 documents
- Memory: < 512MB
- Error rate: 0%

---

## TEST 10: Rollback & Recovery

### Test 10.1: Partial Failure Recovery

**Scenario:** Ingestion fails mid-process

**Verification:**
1. Check database for partial writes
2. Re-run ingestion with `force: false`
3. Verify only missing documents are processed

**Expected:**
- Existing documents skipped (unchanged)
- Missing documents processed
- No duplicates created

---

## AUTOMATED TEST SCRIPT

```bash
#!/bin/bash

SECRET="YOUR_SECRET_HERE"
BASE_URL="https://javari-ai.vercel.app"

echo "Running Canonical Ingestion Tests..."

# Test 1: Authentication
echo "[TEST 1] Authentication - No Header"
curl -s -X POST "$BASE_URL/api/canonical/ingest" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq '.ok, .error'

# Test 2: Dry Run
echo "[TEST 2] Dry Run"
curl -s -X POST "$BASE_URL/api/canonical/ingest" \
  -H 'Content-Type: application/json' \
  -H "x-canonical-secret: $SECRET" \
  -d '{"mode":"dry-run"}' | jq '.ok, .mode, .summary.docsProcessed'

# Test 3: Status Check
echo "[TEST 3] Status Check"
curl -s -X GET "$BASE_URL/api/canonical/ingest" | jq '.ok, .status, .stats'

echo "Tests complete!"
```

---

## SUCCESS CRITERIA

**All tests must pass for production approval:**

- ✅ Authentication working correctly
- ✅ Request validation functioning
- ✅ Environment validation working
- ✅ Dry run executes without errors
- ✅ Full ingestion completes successfully
- ✅ Database populated correctly
- ✅ GET status endpoint responding
- ✅ Error handling working as expected
- ✅ Performance within acceptable limits
- ✅ Rollback capability verified

**Test Execution Date:** ______________  
**Test Executor:** ______________  
**Pass Rate:** ____/10  
**Approved for Production:** [ ] YES  [ ] NO
