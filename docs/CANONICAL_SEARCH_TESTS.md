# Canonical Search Endpoint - Integration Tests

## Test Suite: POST /api/canonical/search

### Prerequisites
1. Canonical ingestion completed (34 documents, 257 chunks)
2. Supabase RPC function deployed: `search_canonical_chunks`
3. Endpoint deployed: https://javari-ai.vercel.app/api/canonical/search

---

## Test 1: Basic Search - Architecture Query

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "Javari AI architecture and system design"}'
```

**Expected Response:**
```json
{
  "ok": true,
  "query": "Javari AI architecture and system design",
  "count": 8,
  "durationMs": < 2000,
  "results": [
    {
      "doc_key": "consolidation-docs/..._System_Architecture_...",
      "chunk_text": "...",
      "similarity": > 0.5
    }
  ]
}
```

**Validation:**
- ✅ Status 200
- ✅ Returns 8 results (default topK)
- ✅ Similarity scores descending order
- ✅ Duration under 2 seconds
- ✅ All results contain chunk_text

---

## Test 2: Custom topK Parameter

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "security access control", "topK": 3}'
```

**Expected Response:**
```json
{
  "ok": true,
  "query": "security access control",
  "count": 3,
  "durationMs": < 2000,
  "results": [ /* exactly 3 results */ ]
}
```

**Validation:**
- ✅ Returns exactly 3 results
- ✅ Security-related documents ranked highest

---

## Test 3: Maximum topK Limit

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "deployment guide", "topK": 25}'
```

**Expected Response:**
```json
{
  "ok": true,
  "count": 25,
  "results": [ /* up to 25 results */ ]
}
```

**Validation:**
- ✅ Returns up to 25 results
- ✅ No error for max topK

---

## Test 4: Validation Error - Missing Query

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Validation failed",
  "message": "Field 'query' is required and must be a string"
}
```

**Validation:**
- ✅ Status 400
- ✅ Clear error message

---

## Test 5: Validation Error - Empty Query

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "   "}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Validation failed",
  "message": "Field 'query' cannot be empty"
}
```

**Validation:**
- ✅ Status 400
- ✅ Rejects empty/whitespace queries

---

## Test 6: Validation Error - topK Exceeds Max

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "topK": 50}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Validation failed",
  "message": "Field 'topK' cannot exceed 25"
}
```

**Validation:**
- ✅ Status 400
- ✅ Enforces topK <= 25

---

## Test 7: Validation Error - topK Below Min

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "topK": 0}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Validation failed",
  "message": "Field 'topK' must be at least 1"
}
```

**Validation:**
- ✅ Status 400
- ✅ Enforces topK >= 1

---

## Test 8: Method Not Allowed - GET Request

```bash
curl -X GET "https://javari-ai.vercel.app/api/canonical/search"
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Method not allowed",
  "message": "Use POST with JSON body: { query: string, topK?: number }"
}
```

**Validation:**
- ✅ Status 405
- ✅ Helpful error message

---

## Test 9: Invalid JSON Body

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d 'not valid json'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Invalid JSON",
  "message": "Request body must be valid JSON"
}
```

**Validation:**
- ✅ Status 400
- ✅ Handles malformed JSON

---

## Test 10: Semantic Search Quality

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I deploy to production?"}'
```

**Validation:**
- ✅ Top results should include deployment/environment documentation
- ✅ Similarity scores > 0.4 for relevant matches
- ✅ Semantically related chunks ranked higher

---

## Test 11: Long Query Handling

```bash
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "I need comprehensive documentation about the entire system architecture including database schema entity relationships API endpoints authentication flows deployment procedures and monitoring setup"}'
```

**Validation:**
- ✅ Handles long queries (under 1000 chars)
- ✅ Returns relevant results
- ✅ No timeout errors

---

## Test 12: Query Length Limit

```bash
# Generate 1100 character query
LONG_QUERY=$(python3 -c "print('a' * 1100)")
curl -X POST "https://javari-ai.vercel.app/api/canonical/search" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$LONG_QUERY\"}"
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "Validation failed",
  "message": "Field 'query' cannot exceed 1000 characters"
}
```

**Validation:**
- ✅ Status 400
- ✅ Enforces 1000 char limit

---

## Performance Benchmarks

**Target Metrics:**
- Average response time: < 1500ms
- P95 response time: < 2500ms
- Embedding generation: < 500ms
- Vector search: < 1000ms

**Run Performance Test:**
```bash
for i in {1..10}; do
  curl -w "\nTime: %{time_total}s\n" -X POST \
    "https://javari-ai.vercel.app/api/canonical/search" \
    -H "Content-Type: application/json" \
    -d '{"query": "system architecture"}' \
    -o /dev/null -s
done
```

---

## Supabase RPC Function Verification

**Check if RPC function exists:**
```sql
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'search_canonical_chunks';
```

**Manual RPC test:**
```sql
SELECT * FROM search_canonical_chunks(
  ARRAY[0.1, 0.2, ...]::vector(1536),  -- test embedding
  5  -- match_count
);
```

---

## Test Summary Checklist

- [ ] All 12 integration tests pass
- [ ] Performance benchmarks meet targets
- [ ] Error handling covers all edge cases
- [ ] Similarity scores are reasonable (> 0.3 for relevant matches)
- [ ] Response times acceptable (< 2s)
- [ ] RPC function deployed and accessible
- [ ] Endpoint returns correct doc_keys
- [ ] Chunk text is properly retrieved
- [ ] Results ordered by similarity descending
