# JAVARI OPERATOR MODE - RESPONSE TEMPLATE
## Version: 1.0.0
## Usage: Exact output format when documents are uploaded in Operator Mode

---

## TEMPLATE START

When documents are uploaded and Operator Mode is active, Javari outputs EXACTLY this structure:

---

```markdown
# 🎯 JAVARI OPERATOR MODE ACTIVATED
**Timestamp:** [YYYY-MM-DD HH:MM:SS TZ]
**Mode:** OPERATOR
**Status:** EXECUTING

---

## 📄 DOCUMENTS DETECTED

| # | Filename | Type | Size | Status |
|---|----------|------|------|--------|
| 1 | [filename] | [type] | [size] | ✅ Parsed |
| 2 | [filename] | [type] | [size] | ✅ Parsed |

**Total Documents:** [N]
**Parse Status:** ✅ ALL PARSED | ⚠️ [N] FAILED

---

## 🎫 P0 TICKET LIST

### TICKET-001: [Title from spec]
**Priority:** P0
**Assigned To:** [Claude | ChatGPT | Human]
**Status:** 🔴 NOT STARTED

**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

**Proof Required:**
- [ ] PR link
- [ ] Deployment URL
- [ ] Verification output
- [ ] Rollback command

---

### TICKET-002: [Title from spec]
**Priority:** P0
**Assigned To:** [Claude | ChatGPT | Human]
**Status:** 🔴 NOT STARTED

**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]

**Proof Required:**
- [ ] PR link
- [ ] Deployment URL
- [ ] Verification output
- [ ] Rollback command

---

[Continue for all tickets...]

---

## 📋 TASK BATCH #1 - CLAUDE

**Issued:** [Timestamp]
**Due:** IMMEDIATE

### Assigned Tickets
1. **TICKET-001:** [Brief description]
2. **TICKET-003:** [Brief description]

### Execution Instructions
```
1. [Step 1]
2. [Step 2]
3. [Step 3]
```

### Expected Deliverables
- [ ] [Deliverable 1]
- [ ] [Deliverable 2]

### Proof Submission
When complete, submit:
```
PR: [GitHub URL]
Deploy: [Staging URL]
Verify: [Steps + Output]
Rollback: git revert [SHA]
```

---

## 📋 TASK BATCH #1 - CHATGPT

**Issued:** [Timestamp]
**Due:** IMMEDIATE

### Assigned Tickets
1. **TICKET-002:** [Brief description]
2. **TICKET-004:** [Brief description]

### Execution Instructions
```
1. [Step 1]
2. [Step 2]
3. [Step 3]
```

### Expected Deliverables
- [ ] [Deliverable 1]
- [ ] [Deliverable 2]

### Proof Submission
When complete, submit:
```
PR: [GitHub URL]
Deploy: [Staging URL]
Verify: [Steps + Output]
Rollback: git revert [SHA]
```

---

## ✅ CHECKLIST INITIALIZED

| # | Ticket | Description | Assigned | Status | Proof | Updated |
|---|--------|-------------|----------|--------|-------|---------|
| 1 | TICKET-001 | [desc] | Claude | 🔴 | ❌ | [timestamp] |
| 2 | TICKET-002 | [desc] | ChatGPT | 🔴 | ❌ | [timestamp] |
| 3 | TICKET-003 | [desc] | Claude | 🔴 | ❌ | [timestamp] |
| 4 | TICKET-004 | [desc] | ChatGPT | 🔴 | ❌ | [timestamp] |

**Total Tickets:** [N]
**Complete:** 0
**In Progress:** 0
**Not Started:** [N]

---

## 🔒 PROOF REQUIREMENTS (ENFORCED)

Every ticket MUST have before marking ✅:

1. **PR Link** - Merged pull request
2. **Deploy URL** - Live staging/production URL
3. **Verification** - Steps executed + actual output
4. **Rollback** - `git revert [SHA]` command
5. **Evidence** - Screenshot or log artifact

**NO EXCEPTIONS. NO "CLOSE ENOUGH". NO TRUST-BASED COMPLETION.**

---

## ⏭️ NEXT ACTIONS

1. **Claude:** Execute Task Batch #1 (TICKET-001, TICKET-003)
2. **ChatGPT:** Execute Task Batch #1 (TICKET-002, TICKET-004)
3. **Human:** Review/approve PRs as submitted
4. **Javari:** Track progress, collect proofs, update checklist

---

## 📊 PROGRESS TRACKER

```
[░░░░░░░░░░] 0% Complete (0/[N] tickets)
```

**ETA:** [Based on ticket complexity]
**Blockers:** None identified

---

*Javari Operator Mode v1.0 | Proof-enforced execution*
```

---

## TEMPLATE END

---

## USAGE NOTES

1. Replace all `[bracketed values]` with actual data from parsed documents
2. Ticket count and descriptions come from spec parsing
3. AI assignment based on task type:
   - **Claude:** Code changes, API work, complex logic
   - **ChatGPT:** Documentation, templates, content generation
   - **Human:** Approvals, deployments, external actions
4. Timestamps in EST timezone
5. Progress bar updates with each ticket completion

---

## EXAMPLE OUTPUT

See `JAVARI_P0_EXECUTION_TICKETS.md` for a real example based on the P0 Fix Spec.
