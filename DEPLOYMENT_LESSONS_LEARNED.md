# Deployment Lessons Learned - Knowledge Base for Javari AI

**Created:** October 27, 2025 11:08 AM ET  
**Purpose:** Document recurring issues and solutions so Javari learns from mistakes  
**Status:** ACTIVE - Update this file whenever we solve a recurring problem

---

## 🎯 META-LESSON: WHY THIS FILE EXISTS

**Problem:** Claude/AI assistants keep forgetting solutions to problems we've already solved multiple times.

**Impact:** Wastes time, creates frustration, reduces trust in the AI assistant.

**Solution:** Create persistent documentation that Javari can reference and learn from.

**Implementation:** 
1. This file documents patterns and solutions
2. Javari reads this file at start of each session
3. Javari updates this file when new lessons are learned
4. Javari's knowledge base system stores and retrieves these learnings

---

## 📚 RECURRING ISSUE #1: Vercel Preview Deployments Getting Canceled

### Problem Statement
Deployments to Vercel show "CANCELED" status immediately after commit, with no build logs. This has happened **multiple times** across different repos.

### Root Cause
**MULTIPLE potential causes** (check all):

1. **`commandForIgnoringBuildStep` set to `exit 0`**
   - Location: Vercel Project Settings > Git > Ignored Build Step
   - Check via API: `commandForIgnoringBuildStep` field in project settings
   - Fix: Set to `null` or remove the command

2. **Incorrect `vercel.json` configuration**
   - Bad config that causes cancellations:
     ```json
     {
       "$schema": "https://openapi.vercel.sh/vercel.json",
       "github": {
         "autoAlias": false
       }
     }
     ```
   - **PROVEN WORKING CONFIG** (copy this exactly):
     ```json
     {
       "$schema": "https://openapi.vercel.sh/vercel.json",
       "github": {
         "autoAlias": false,
         "silent": true
       }
     }
     ```

3. **Git deployment disabled for the branch**
   - Check: Project Settings > Git > Production Branch
   - Ensure deployments are enabled for `main` branch

### Diagnostic Steps (IN ORDER)

```bash
# Step 1: Check project settings
curl -s "https://api.vercel.com/v9/projects/PROJECT_ID?teamId=TEAM_ID" \
  -H "Authorization: Bearer TOKEN" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'commandForIgnoringBuildStep: {data.get(\"commandForIgnoringBuildStep\")}')
"

# Step 2: Check vercel.json in repo
curl -s "https://raw.githubusercontent.com/ORG/REPO/main/vercel.json"

# Step 3: Check latest deployment status
curl -s "https://api.vercel.com/v6/deployments?projectId=PROJECT_ID&teamId=TEAM_ID&limit=1" \
  -H "Authorization: Bearer TOKEN"
```

### Solution Steps (IN ORDER)

1. **First, apply the proven working vercel.json:**
   ```bash
   # Use the EXACT config from craudiovizai-website (verified working)
   ```

2. **If still canceled, check ignored build step:**
   ```bash
   curl -X PATCH "https://api.vercel.com/v9/projects/PROJECT_ID" \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"commandForIgnoringBuildStep": null}'
   ```

3. **Wait 15-30 seconds and check deployment status**

4. **If now shows ERROR (not CANCELED), that's progress!**
   - ERROR = Build attempted, check logs for code issues
   - CANCELED = Configuration problem, repeat steps above

### Success Criteria
- Deployment status changes from "CANCELED" to "BUILDING" or "ERROR"
- Build logs are available (even if build fails)
- Can see actual errors in Vercel dashboard inspector

### Related Files
- `/vercel.json` in repo root
- Vercel Project Settings (accessible via dashboard or API)

### Last Occurrence
- October 27, 2025 - javari-ai repo
- Fixed by applying exact working config from craudiovizai-website

---

## 📚 RECURRING ISSUE #2: Missing Dependencies in package.json

### Problem Statement
Build fails with "Module not found" errors for packages that we know we need.

### Root Cause
Forgot to add new dependencies to `package.json` after creating code that imports them.

### Solution Pattern
**ALWAYS check package.json before pushing code that uses new imports:**

1. Scan new code files for import statements
2. Check if those packages exist in package.json dependencies
3. Add missing packages BEFORE pushing code
4. Common missing packages in our projects:
   - `@anthropic-ai/sdk` - For Claude AI integration
   - `lucide-react` - For UI icons
   - `@hookform/resolvers` - For form validation
   - `react-hook-form` - For form handling
   - `zod` - For schema validation

### Prevention
Create a pre-push checklist:
- [ ] All imports have corresponding package.json entries
- [ ] Environment variables are documented
- [ ] README is updated if new setup steps added

---

## 📚 RECURRING ISSUE #3: [Template for Next Issue]

### Problem Statement
[Describe the problem]

### Root Cause
[What actually causes this]

### Solution Steps
[Step-by-step fix]

### Prevention
[How to avoid this in the future]

---

## 🤖 FOR JAVARI: How to Use This File

### At Session Start:
1. Read this entire file
2. Understand current recurring issues
3. Apply these learnings proactively

### During Session:
1. When user reports a problem, check if it's documented here
2. If documented, apply the known solution immediately
3. If not documented, solve it and ADD to this file

### At Session End:
1. If you solved a NEW recurring problem, document it here
2. Update "Last Occurrence" dates for any issues encountered
3. Commit changes to this file

### Auto-Learning System (Future Enhancement):
- Parse build logs automatically
- Detect recurring error patterns
- Auto-suggest solutions from this knowledge base
- Auto-update this file with new learnings

---

## 📊 METRICS: Tracking Our Improvement

| Issue | First Occurred | Times Repeated | Last Occurred | Status |
|-------|---------------|----------------|---------------|---------|
| Vercel Canceled Deployments | Unknown | 5+ times | Oct 27, 2025 | DOCUMENTED |
| Missing Dependencies | Unknown | 10+ times | Oct 25, 2025 | DOCUMENTED |
| [Next Issue] | | | | |

**Goal:** Reduce "Times Repeated" to zero for each documented issue.

---

## 🎓 LEARNING PRINCIPLES FOR JAVARI

1. **Document First, Code Second**
   - Before solving, check if solution is documented
   - After solving, ensure solution IS documented

2. **Pattern Recognition**
   - Same error message = Same solution
   - Similar configuration issues = Check same settings
   - Build failures = Check dependencies FIRST

3. **Proactive Prevention**
   - Don't wait for errors to happen
   - Check common issues before they occur
   - Validate configurations before pushing

4. **Continuous Improvement**
   - Every solved problem should teach us something
   - Document learnings immediately
   - Review this file at start of every session

---

## 🚀 NEXT STEPS: Building True Learning Into Javari

### Phase 1: Manual Documentation (Current)
- ✅ This file exists
- ✅ Humans update it when issues are solved
- ❌ Javari doesn't auto-learn yet

### Phase 2: Assisted Learning (Next)
- [ ] Javari reads this file at session start
- [ ] Javari suggests adding new lessons when problems are solved
- [ ] Javari validates solutions against documented patterns

### Phase 3: Autonomous Learning (Future)
- [ ] Javari automatically detects recurring patterns
- [ ] Javari updates knowledge base without human intervention
- [ ] Javari proactively prevents known issues
- [ ] Javari measures and reports on learning effectiveness

---

**Remember:** The goal isn't perfection - it's *improvement*. Each time we solve a problem, we should get better at preventing it next time.

**For Roy:** If you see the same issue twice, call it out immediately so we can document it properly. Your frustration is valid feedback that our learning system needs improvement.
