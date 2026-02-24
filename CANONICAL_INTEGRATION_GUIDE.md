# CANONICAL INGESTION - INTEGRATION & ROLLBACK GUIDE

**Version:** 2.0.0  
**Created:** Tuesday, February 25, 2026 at 2:10 AM EST  
**Endpoint:** `/api/canonical/ingest`

---

## 📋 INTEGRATION INSTRUCTIONS

### Phase 1: Environment Setup (15 minutes)

#### Step 1.1: Generate Admin Secret
```bash
# Generate a secure random secret
openssl rand -base64 32
```

**Action:** Add to Vercel environment variables
- Variable: `CANONICAL_ADMIN_SECRET`
- Value: (generated secret)
- Scope: Production, Preview, Development

---

#### Step 1.2: Verify R2 Credentials

**Check Vercel Environment Variables:**
- ✅ `R2_ACCESS_KEY_ID`
- ✅ `R2_SECRET_ACCESS_KEY`
- ✅ `R2_ACCOUNT_ID`
- ✅ `R2_BUCKET_NAME`

**Test R2 Access:**
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest/inspect \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET' \
  -d '{}'
```

**Expected:** List of R2 document keys

---

#### Step 1.3: Verify OpenAI Credentials

**Check Vercel Environment Variables:**
- ✅ `OPENAI_API_KEY`

**Test OpenAI Access:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Expected:** List of available models including `text-embedding-3-small`

---

#### Step 1.4: Verify Supabase Credentials

**Check Vercel Environment Variables:**
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `NEXT_PUBLIC_SUPABASE_URL`

**Test Supabase Access:**
```bash
curl https://YOUR_PROJECT.supabase.co/rest/v1/canonical_documents \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Expected:** Empty array or existing documents

---

### Phase 2: Deployment (10 minutes)

#### Step 2.1: Commit and Push Code
```bash
cd /home/claude/javari-ai
git add app/api/canonical/ingest/route.ts
git commit -m "FEAT: Complete canonical ingestion endpoint

- Full POST handler implementation
- Request/environment validation
- Comprehensive error handling
- Dry-run support
- Progress logging
- GET status endpoint

Closes canonical ingestion implementation"

git push origin main
```

---

#### Step 2.2: Monitor Vercel Deployment

**Watch for:**
1. Build starts (30 seconds after push)
2. Build completes (2-3 minutes)
3. Production deployment (automatic)

**Verify in Vercel Dashboard:**
- ✅ Build status: Success
- ✅ Deployment status: Ready
- ✅ No errors in function logs

---

#### Step 2.3: Verify Deployment

**Test Status Endpoint:**
```bash
curl https://javari-ai.vercel.app/api/canonical/ingest
```

**Expected Response:**
```json
{
  "ok": true,
  "status": "ready",
  "stats": { ... },
  "endpoints": { ... }
}
```

**If 404:** Wait 2 more minutes for deployment propagation

---

### Phase 3: Testing (20 minutes)

#### Step 3.1: Dry Run Test
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET' \
  -d '{
    "mode": "dry-run",
    "source": "r2"
  }'
```

**Expected:**
- `ok: true`
- `summary.docsProcessed: 34`
- `summary.chunksCreated: 0` (dry run)
- Duration: < 60 seconds

**If fails:** Check Vercel function logs for errors

---

#### Step 3.2: Database Backup

**Before first production ingestion, backup database:**

```sql
-- Connect to Supabase SQL Editor
-- Run the following to export current state

CREATE TABLE canonical_documents_backup AS 
SELECT * FROM canonical_documents;

CREATE TABLE canonical_chunks_backup AS 
SELECT * FROM canonical_chunks;

CREATE TABLE canonical_embeddings_backup AS 
SELECT * FROM canonical_embeddings;
```

**Alternative:** Use Supabase dashboard backup feature

---

#### Step 3.3: First Production Ingestion

**CRITICAL:** This will write to production database

```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET' \
  -d '{
    "mode": "full",
    "source": "r2",
    "force": false,
    "maxTokens": 800
  }' | tee ingestion-result.json
```

**Monitor:**
- Check Vercel function logs (real-time)
- Watch for progress in console output
- Duration: 5-10 minutes expected

**Success Indicators:**
- `ok: true`
- `summary.docsUpdated: 34`
- `summary.chunksCreated: 500-1000`
- `stats.delta.documents: 34`

---

#### Step 3.4: Verify Database

```sql
-- Check document count
SELECT COUNT(*) FROM canonical_documents;
-- Expected: 34

-- Check chunk count
SELECT COUNT(*) FROM canonical_chunks;
-- Expected: 500-1000

-- Check embeddings
SELECT COUNT(*) FROM canonical_embeddings;
-- Expected: Same as chunks

-- Sample documents
SELECT r2_key, doc_title, chunk_count 
FROM canonical_documents 
LIMIT 5;
```

---

### Phase 4: Integration Testing (15 minutes)

#### Step 4.1: Test Knowledge Retrieval

**Test Vector Search:**
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "platform architecture",
    "limit": 5
  }'
```

**Expected:** Relevant chunks from canonical documents

---

#### Step 4.2: Test Javari AI Integration

**Access Javari OS:**
```
https://javari-ai.vercel.app/javari
```

**Ask Javari:**
- "What is the CR AudioViz AI platform?"
- "Explain the canonical knowledge system"
- "What are the platform's core modules?"

**Expected:** Javari should reference canonical documents

---

#### Step 4.3: Monitor Autonomy Status

```bash
curl https://javari-ai.vercel.app/api/javari/status
```

**Check Knowledge Base Component:**
- Before: `"degraded"` (empty)
- After: `"operational"` (populated)

---

### Phase 5: Production Handoff (10 minutes)

#### Step 5.1: Document Completion

**Update:**
- ✅ Canonical ingestion completion date
- ✅ Document count: 34
- ✅ Chunk count: (actual)
- ✅ Embedding count: (actual)
- ✅ Ingestion duration: (actual)
- ✅ OpenAI cost: (actual)

---

#### Step 5.2: Monitoring Setup

**Vercel Alerts:**
1. Function errors > 5 in 5 minutes
2. Function duration > 200 seconds
3. Function failures > 3 in hour

**Supabase Monitoring:**
1. Database size alerts
2. Connection pool alerts
3. Query performance

---

#### Step 5.3: Cleanup

**Remove Backup Tables (after 7 days):**
```sql
DROP TABLE IF EXISTS canonical_documents_backup;
DROP TABLE IF EXISTS canonical_chunks_backup;
DROP TABLE IF EXISTS canonical_embeddings_backup;
```

---

## 🔄 ROLLBACK INSTRUCTIONS

### Scenario 1: Failed Ingestion (During Execution)

**If ingestion fails mid-process:**

1. **Check Error Logs**
```bash
# In Vercel dashboard
Functions → canonical/ingest → View Logs
```

2. **Identify Point of Failure**
- R2 connectivity issue?
- OpenAI API error?
- Database write error?

3. **Re-run with Force Flag**
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET' \
  -d '{
    "mode": "full",
    "source": "r2",
    "force": true
  }'
```

**Note:** `force: true` will re-process all documents, even if some succeeded

---

### Scenario 2: Corrupted Data (Post-Ingestion)

**If data appears corrupted:**

1. **Verify Corruption**
```sql
-- Check for null embeddings
SELECT COUNT(*) FROM canonical_embeddings WHERE embedding IS NULL;

-- Check for mismatched counts
SELECT 
  d.r2_key,
  d.chunk_count,
  COUNT(c.id) as actual_chunks
FROM canonical_documents d
LEFT JOIN canonical_chunks c ON c.document_id = d.id
GROUP BY d.id, d.r2_key, d.chunk_count
HAVING d.chunk_count != COUNT(c.id);
```

2. **Delete Corrupted Data**
```sql
-- Delete all canonical data
TRUNCATE TABLE canonical_embeddings;
TRUNCATE TABLE canonical_chunks;
TRUNCATE TABLE canonical_documents CASCADE;
```

3. **Re-ingest**
```bash
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET' \
  -d '{"mode": "full", "source": "r2"}'
```

---

### Scenario 3: Restore from Backup

**If backup tables were created:**

```sql
-- Clear current tables
TRUNCATE TABLE canonical_embeddings;
TRUNCATE TABLE canonical_chunks;
TRUNCATE TABLE canonical_documents CASCADE;

-- Restore from backup
INSERT INTO canonical_documents SELECT * FROM canonical_documents_backup;
INSERT INTO canonical_chunks SELECT * FROM canonical_chunks_backup;
INSERT INTO canonical_embeddings SELECT * FROM canonical_embeddings_backup;

-- Verify restoration
SELECT COUNT(*) FROM canonical_documents;
SELECT COUNT(*) FROM canonical_chunks;
SELECT COUNT(*) FROM canonical_embeddings;
```

---

### Scenario 4: Complete Rollback (Remove Endpoint)

**If endpoint must be removed entirely:**

1. **Revert Code**
```bash
git revert HEAD
git push origin main
```

2. **Wait for Deployment**
- Vercel auto-deploys
- Endpoint returns 404

3. **Clean Database (Optional)**
```sql
DROP TABLE IF EXISTS canonical_embeddings;
DROP TABLE IF EXISTS canonical_chunks;
DROP TABLE IF EXISTS canonical_documents CASCADE;
DROP TABLE IF EXISTS canonical_graph_nodes;
DROP TABLE IF EXISTS canonical_graph_edges;
DROP TABLE IF EXISTS canonical_metadata;
DROP TABLE IF EXISTS canonical_chunk_index;
```

---

### Scenario 5: OpenAI Cost Exceeded

**If OpenAI costs are too high:**

1. **Check Current Usage**
```bash
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

2. **Options:**
   - **A) Use Dry Run** for testing
   - **B) Use `force: false`** to skip unchanged documents
   - **C) Reduce `maxTokens`** to create smaller chunks
   - **D) Process in batches** (manually limit documents)

3. **Set Spending Limits**
- OpenAI Dashboard → Billing → Set spending limits

---

## 📊 HEALTH CHECKS

### Daily Health Check
```bash
curl https://javari-ai.vercel.app/api/canonical/ingest | jq '.stats'
```

**Expected:**
- Documents: 34
- Chunks: 500-1000
- Embeddings: Same as chunks

---

### Weekly Validation
```bash
# Re-run ingestion with force=false
curl -X POST https://javari-ai.vercel.app/api/canonical/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-canonical-secret: YOUR_SECRET' \
  -d '{"mode": "full", "force": false}'
```

**Expected:**
- All documents unchanged
- Duration < 2 minutes (no embeddings needed)
- Zero new chunks created

---

## 🚨 EMERGENCY CONTACTS

**Deployment Issues:**
- Vercel Dashboard → Support
- Check #vercel-deployments Slack

**Database Issues:**
- Supabase Dashboard → Support
- Check database connection pool

**OpenAI Issues:**
- OpenAI Status Page
- Check API rate limits

**Rollback Authority:**
- CEO: Roy Henderson
- CTO: (if applicable)

---

## ✅ POST-INTEGRATION CHECKLIST

- [ ] Environment variables configured
- [ ] Dry run successful
- [ ] Database backed up
- [ ] Production ingestion successful
- [ ] Document count: 34
- [ ] Chunk count verified
- [ ] Embedding count verified
- [ ] Knowledge retrieval working
- [ ] Javari AI integration working
- [ ] Monitoring configured
- [ ] Backup tables created
- [ ] Rollback procedures tested
- [ ] Team notified of completion

**Integration Date:** ______________  
**Completed By:** ______________  
**Final Status:** [ ] SUCCESS  [ ] ROLLBACK REQUIRED
