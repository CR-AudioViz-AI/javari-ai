# FORCE VERCEL REBUILD - INSTRUCTIONS

**Target Commit:** `a4db8942`  
**Branch:** main  
**Date:** Tuesday, February 25, 2026 at 4:10 AM EST

---

## 🚀 OPTION 1: MANUAL VERCEL DASHBOARD (FASTEST - 30 seconds)

### Step 1: Access Vercel Dashboard
```
https://vercel.com/roy-hendersons-projects-1d3d5e94/javari-ai
```

### Step 2: Find Latest Deployment
- Look for deployment with commit `a4db8942`
- Check its status (Building/Ready/Error)

### Step 3A: If Deployment Exists and Ready
1. Click the three dots (···) next to the deployment
2. Select "Redeploy"
3. Check "Use existing Build Cache" = **OFF** (force fresh build)
4. Click "Redeploy"

### Step 3B: If Deployment Failed
1. Click on the failed deployment
2. Check build logs for errors
3. Click "Redeploy" button
4. Uncheck "Use existing Build Cache"

### Step 3C: If No Recent Deployment
Vercel may not have picked up the push. Use Option 2.

---

## 🔧 OPTION 2: EMPTY COMMIT (AUTOMATED - 2 minutes)

This triggers a new deployment automatically:

```bash
cd /home/claude/javari-ai

# Create empty commit
git commit --allow-empty -m "REBUILD: Force Vercel redeploy for canonical ingest endpoint

Reason: Previous deployment may not have picked up fix
Commit: a4db8942
Fix: R2 client compatibility exports
Expected: GET /api/canonical/ingest returns 200"

# Push to main
git push origin main
```

**This will:**
1. ✅ Trigger immediate Vercel build
2. ✅ Use latest code (a4db8942 + this commit)
3. ✅ Clear build cache automatically
4. ✅ Deploy to production on success

---

## ⚡ OPTION 3: VERCEL CLI (IF INSTALLED)

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# Force redeploy from main
vercel --prod --force
```

---

## 🎯 RECOMMENDED: OPTION 2 (AUTOMATED)

**Why:**
- ✅ Guaranteed to trigger new build
- ✅ No manual dashboard interaction
- ✅ Creates audit trail
- ✅ Will use fresh build cache
- ✅ Most reliable

**Execute now:**
