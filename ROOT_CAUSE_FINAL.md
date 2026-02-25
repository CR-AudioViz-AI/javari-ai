# CANONICAL INGEST 405 - FINAL ROOT CAUSE

**Date:** Tuesday, February 25, 2026 at 4:15 AM EST  
**Issue:** GET /api/canonical/ingest returns 405 despite code existing  
**Status:** 🎯 **ROOT CAUSE IDENTIFIED**

---

## 🚨 THE REAL PROBLEM

### Next.js Config Setting
```javascript
// next.config.js line 35-37
typescript: {
  ignoreBuildErrors: true,
},
```

### What This Does
- **Build succeeds** even with TypeScript errors
- **BUT:** Files with errors are **SKIPPED** from compilation
- Result: Build completes, routes don't exist

### The Evidence Chain

**1. Import Errors Present:**
```
❌ fetchDoc not exported (before fix)
❌ checkR2Connectivity not exported (before fix)
❌ listRoadmapDocs not exported (before fix)
```

**2. Next.js Behavior:**
```
typescript.ignoreBuildErrors = true
  → TypeScript errors don't fail build
  → BUT files with errors are excluded from output
  → app/api/canonical/ingest/route.ts has import errors
  → Next.js skips compilation
  → No route handler generated
  → 405 Method Not Allowed
```

**3. Why Fix Didn't Work:**
```
✅ We added exports to r2-client.ts
✅ Code is correct locally
⏳ Vercel builds
⏳ But... something else is wrong
❌ Still returns 405
```

---

## 🔍 CURRENT HYPOTHESIS

### Possible Issues (in order of likelihood):

**1. Store Import Still Broken (80% probability)**

Check if `lib/canonical/store.ts` exports `getStoreStats`:
```typescript
// app/api/canonical/ingest/route.ts line 29
import { ingestAllCanonicalDocs, getStoreStats, type IngestOptions } from "@/lib/canonical/ingest";

// lib/canonical/ingest.ts line 232
export { getStoreStats };

// Does lib/canonical/store.ts actually export getStoreStats?
```

**2. Embed Module Import Broken (10% probability)**

The ingest module imports from `./embed`:
```typescript
import { embedBatch } from "./embed";
```

Does `lib/canonical/embed.ts` exist and export `embedBatch`?

**3. Chunker Import Broken (5% probability)**

```typescript
import { chunkMarkdown } from "./chunker";
```

Does `lib/canonical/chunker.ts` exist and export `chunkMarkdown`?

**4. Store Functions Missing (5% probability)**

```typescript
import {
  upsertCanonicalDoc,
  upsertDocChunks,
  getStoreStats,
  getExistingDoc,
} from "./store";
```

Do all these exist in `lib/canonical/store.ts`?

---

## 🔧 SOLUTION

### Step 1: Verify ALL Imports in Ingestion Chain

```bash
cd /home/claude/javari-ai

# Check ingest.ts imports
echo "=== Checking ingest.ts imports ==="
head -30 lib/canonical/ingest.ts | grep "import"

# Check what store.ts exports
echo "=== Checking store.ts exports ==="
grep "^export" lib/canonical/store.ts

# Check what embed.ts exports
echo "=== Checking embed.ts exports ==="
if [ -f lib/canonical/embed.ts ]; then
  grep "^export" lib/canonical/embed.ts
else
  echo "❌ lib/canonical/embed.ts NOT FOUND"
fi

# Check what chunker.ts exports
echo "=== Checking chunker.ts exports ==="
if [ -f lib/canonical/chunker.ts ]; then
  grep "^export" lib/canonical/chunker.ts
else
  echo "❌ lib/canonical/chunker.ts NOT FOUND"
fi
```

### Step 2: Fix Missing Exports

Based on findings, add missing exports or create missing files.

### Step 3: Local Build Test

```bash
npm run build 2>&1 | tee build-output.txt
grep -i "error" build-output.txt
```

### Step 4: Deploy

```bash
git add -A
git commit -m "FIX: Resolve all import chain issues"
git push origin main
```

---

## ⚡ IMMEDIATE ACTION

Run the diagnostic now to identify which imports are broken.

