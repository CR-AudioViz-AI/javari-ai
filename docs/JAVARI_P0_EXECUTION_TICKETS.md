# JAVARI P0 EXECUTION TICKETS
## Parsed from: JAVARI_P0_FIX_SPEC_2026-01-05.md
## Generated: 2026-01-05 17:05 EST
## Status: READY FOR EXECUTION

---

# 🎯 JAVARI OPERATOR MODE ACTIVATED
**Timestamp:** 2026-01-05 17:05:00 EST
**Mode:** OPERATOR
**Spec:** JavariAI Immediate Fix Spec (P0)

---

## 📄 DOCUMENTS DETECTED

| # | Filename | Type | Status |
|---|----------|------|--------|
| 1 | JAVARI_P0_FIX_SPEC_2026-01-05.md | Spec | ✅ Parsed |
| 2 | JAVARI_CONTROL_PLANE_MASTER_PROOF_V1.md | Proof | ✅ Parsed |
| 3 | JAVARI_OPERATOR_KICKOFF_PROMPT.md | Prompt | ✅ Parsed |

---

## 🎫 P0 TICKET LIST

---

### TICKET-P0-001: Wire Upload Panel to /javari Page
**Priority:** P0
**Assigned To:** Claude
**Status:** 🟢 COMPLETE
**Completed:** 2026-01-05 14:51 EST

**Acceptance Criteria:**
- [x] Upload panel visible on /javari page
- [x] Drag/drop zone functional
- [x] Click to browse functional
- [x] Multiple file selection supported
- [x] Works on mobile (tap to upload)

**Proof:**
- PR: `ec67d44` (MainJavariInterface restored)
- Deploy: https://craudiovizai.com/javari
- Verify: Upload zone present, drag/drop works
- Rollback: `git revert ec67d44`

---

### TICKET-P0-002: File Type Support (PDF, DOCX, TXT, MD, CSV, XLSX, PPTX, HTML, JSON)
**Priority:** P0
**Assigned To:** Claude
**Status:** 🟡 PARTIAL

**Acceptance Criteria:**
- [x] TXT files readable
- [x] MD files readable
- [x] CSV files readable
- [x] JSON files readable
- [x] HTML files readable
- [ ] PDF text extraction (server-side)
- [ ] DOCX text extraction (server-side)
- [ ] XLSX text extraction (server-side)
- [ ] PPTX text extraction (server-side)

**Proof Required:**
- [ ] PR link with extraction code
- [ ] Test upload of each file type
- [ ] Verification output showing extracted text
- [ ] Rollback command

**Blocker:** Requires server-side libraries (pdf-parse, mammoth, xlsx)

---

### TICKET-P0-003: Document Set ID Generation
**Priority:** P0
**Assigned To:** Claude
**Status:** 🔴 NOT STARTED

**Acceptance Criteria:**
- [ ] Each upload session gets unique `doc_set_id`
- [ ] `doc_set_id` stored in session storage
- [ ] `doc_set_id` persisted across page refresh (within session)
- [ ] API returns `doc_set_id` on upload

**Proof Required:**
- [ ] PR link
- [ ] Console log showing doc_set_id generation
- [ ] Session storage inspection
- [ ] Rollback command

---

### TICKET-P0-004: Wire UI to /api/docs/upload
**Priority:** P0
**Assigned To:** Claude
**Status:** 🔴 NOT STARTED

**Acceptance Criteria:**
- [ ] Upload button calls `/api/docs/upload`
- [ ] Progress indicator shows upload status
- [ ] Response includes `doc_set_id` and file list
- [ ] Errors displayed to user

**Proof Required:**
- [ ] PR link
- [ ] Network tab showing API call
- [ ] Response body with doc_set_id
- [ ] Error handling screenshot
- [ ] Rollback command

---

### TICKET-P0-005: Wire Chat to /api/docs/ask
**Priority:** P0
**Assigned To:** Claude
**Status:** 🔴 NOT STARTED

**Acceptance Criteria:**
- [ ] Chat messages call `/api/docs/ask`
- [ ] Request includes `doc_set_id`, `question`, `chat_history`
- [ ] Response includes `answer` and `citations[]`
- [ ] Citations displayed in UI

**Proof Required:**
- [ ] PR link
- [ ] Network tab showing API call with payload
- [ ] Response body with citations
- [ ] UI screenshot showing citations
- [ ] Rollback command

---

### TICKET-P0-006: Citations Display
**Priority:** P0
**Assigned To:** Claude
**Status:** 🟢 COMPLETE (Client-side)

**Acceptance Criteria:**
- [x] Citations show filename
- [x] Citations show snippet
- [ ] Citations show page number (PDF)
- [ ] Citations show section (DOCX)
- [x] Citations visually distinct from answer

**Proof:**
- Current: Client-side citation display working
- Missing: Page/section info requires server-side extraction

---

### TICKET-P0-007: Hard Limits Communication
**Priority:** P0
**Assigned To:** Claude
**Status:** 🔴 NOT STARTED

**Acceptance Criteria:**
- [ ] Max file size displayed (50MB/file)
- [ ] Max total size displayed (1GB/session)
- [ ] Max file count displayed
- [ ] Limits configurable via env vars
- [ ] User warned before exceeding limits

**Proof Required:**
- [ ] PR link
- [ ] UI screenshot showing limits
- [ ] .env.example with limit vars
- [ ] Error message when limit exceeded
- [ ] Rollback command

---

### TICKET-P0-008: Provider Selector Shows All Providers
**Priority:** P0
**Assigned To:** Claude
**Status:** 🟢 COMPLETE

**Acceptance Criteria:**
- [x] Auto provider option
- [x] GPT-4 provider option
- [x] Claude provider option
- [x] Gemini provider option
- [x] Perplexity provider option
- [x] Mistral provider option
- [x] Llama provider option
- [x] Cohere provider option
- [x] Disabled state for unavailable providers

**Proof:**
- PR: `ec67d44`
- Deploy: https://craudiovizai.com/javari
- Verify: All 8 providers visible under chat input
- Rollback: `git revert ec67d44`

---

### TICKET-P0-009: Verification Script
**Priority:** P0
**Assigned To:** Claude
**Status:** 🟡 PARTIAL

**Acceptance Criteria:**
- [x] Script exists: `npm run verify:javari-upload`
- [ ] Uploads sample PDF
- [ ] Uploads sample DOCX
- [ ] Asks test question
- [ ] Asserts citations returned
- [ ] Outputs pass/fail

**Proof Required:**
- [ ] PR link with complete script
- [ ] Script execution output
- [ ] Sample files included
- [ ] Rollback command

---

### TICKET-P0-010: Operator Mode Implementation
**Priority:** P0
**Assigned To:** Claude
**Status:** 🟡 IN PROGRESS

**Acceptance Criteria:**
- [x] System prompt created
- [x] Response template created
- [x] Ticket list generated
- [ ] Code changes to detect spec uploads
- [ ] Code changes to output tickets instead of summary
- [ ] UI toggle for Operator Mode
- [ ] Default ON for Roy Henderson

**Proof Required:**
- [ ] PR link with all files
- [ ] Screenshot of Operator Mode toggle
- [ ] Upload test showing ticket output
- [ ] Rollback command

---

## 📋 TASK BATCH #1 - CLAUDE

**Issued:** 2026-01-05 17:05 EST
**Due:** IMMEDIATE

### Assigned Tickets
1. **TICKET-P0-002:** Complete server-side file extraction (PDF, DOCX, XLSX)
2. **TICKET-P0-003:** Implement doc_set_id generation
3. **TICKET-P0-004:** Wire UI to /api/docs/upload
4. **TICKET-P0-005:** Wire chat to /api/docs/ask

### Execution Instructions
```
1. Add pdf-parse, mammoth, xlsx dependencies
2. Create /api/docs/upload route with extraction
3. Create /api/docs/ask route with RAG search
4. Update MainJavariInterface to call APIs
5. Generate and store doc_set_id per session
```

### Expected Deliverables
- [ ] Working PDF upload + extraction
- [ ] Working DOCX upload + extraction
- [ ] doc_set_id in session storage
- [ ] Chat using RAG API

---

## 📋 TASK BATCH #1 - CHATGPT

**Issued:** 2026-01-05 17:05 EST
**Due:** IMMEDIATE

### Assigned Tickets
1. **TICKET-P0-007:** Design hard limits UI component
2. **TICKET-P0-009:** Create sample test files for verification

### Execution Instructions
```
1. Design upload limits display component
2. Create sample.pdf with known content
3. Create sample.docx with known content
4. Define expected citation output
```

### Expected Deliverables
- [ ] Limits UI mockup/component
- [ ] sample.pdf test file
- [ ] sample.docx test file
- [ ] Expected output documentation

---

## ✅ CHECKLIST

| # | Ticket | Description | Assigned | Status | Proof |
|---|--------|-------------|----------|--------|-------|
| 1 | P0-001 | Upload Panel | Claude | 🟢 | ✅ |
| 2 | P0-002 | File Types | Claude | 🟡 | ❌ |
| 3 | P0-003 | Doc Set ID | Claude | 🔴 | ❌ |
| 4 | P0-004 | Wire Upload API | Claude | 🔴 | ❌ |
| 5 | P0-005 | Wire Ask API | Claude | 🔴 | ❌ |
| 6 | P0-006 | Citations | Claude | 🟢 | ✅ |
| 7 | P0-007 | Hard Limits | ChatGPT | 🔴 | ❌ |
| 8 | P0-008 | Providers | Claude | 🟢 | ✅ |
| 9 | P0-009 | Verify Script | Claude | 🟡 | ❌ |
| 10 | P0-010 | Operator Mode | Claude | 🟡 | ❌ |

**Complete:** 3/10 (30%)
**In Progress:** 3/10
**Not Started:** 4/10

---

## 📊 PROGRESS

```
[███░░░░░░░] 30% Complete (3/10 tickets)
```

---

## ⏭️ NEXT ACTIONS

1. **Claude:** Execute Task Batch #1 (P0-002, P0-003, P0-004, P0-005)
2. **ChatGPT:** Execute Task Batch #1 (P0-007, P0-009)
3. **Javari:** Collect proofs, update checklist
4. **Roy:** Review/approve PRs

---

*Javari Operator Mode | Proof-enforced execution | No completion without verification*
