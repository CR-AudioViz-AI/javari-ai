# JAVARI KNOWLEDGE POLICY

**Version:** 1.0.0  
**Created:** January 8, 2026  
**Status:** ENFORCED  
**Compliance:** Required for all knowledge ingestion

---

## 1. PURPOSE

This document defines:
- What data sources Javari may ingest
- What sources are explicitly prohibited
- Required metadata for every ingested item
- Legal and ethical compliance requirements

**Violation of this policy is a blocking issue.**

---

## 2. ALLOWED SOURCES

### 2.1 Internal Sources (Tier 1 - Immediate Use)

| Source | Type | Auth Method | Retention | Status |
|--------|------|-------------|-----------|--------|
| CR AudioViz AI GitHub Repos | repo | GitHub Token | Permanent | ✅ Active |
| Vercel Deployments/Logs | api | Vercel Token | 90 days | ✅ Active |
| Supabase Database | api | Service Role Key | Permanent | ✅ Active |
| User Chat Transcripts | chat | Session Auth | Per user setting | ✅ Active |
| Uploaded Documents | doc | Upload consent | Session or saved | ✅ Active |

### 2.2 Official Documentation (Tier 2 - High Value)

| Source | ToS/License | Rate Limit | Status |
|--------|-------------|------------|--------|
| MDN Web Docs | CC-BY-SA 2.5 | Respect robots.txt | ✅ Approved |
| React Documentation | MIT | Public API | ✅ Approved |
| Next.js Documentation | MIT | Public API | ✅ Approved |
| TypeScript Documentation | Apache 2.0 | Public API | ✅ Approved |
| Tailwind CSS Docs | MIT | Public API | ✅ Approved |
| Supabase Documentation | Apache 2.0 | Public API | ✅ Approved |
| Vercel Documentation | Public | Public API | ✅ Approved |
| Node.js Documentation | MIT | Public API | ✅ Approved |

### 2.3 Security & Advisory Sources (Tier 2)

| Source | Purpose | License | Status |
|--------|---------|---------|--------|
| GitHub Security Advisories | Vulnerability awareness | Public API | ✅ Approved |
| npm Advisory Database | Package security | Public API | ✅ Approved |
| CVE Database | Security tracking | Public | ✅ Approved |

### 2.4 Model Outputs (Tier 3 - Captured)

| Source | Method | Required Metadata | Status |
|--------|--------|-------------------|--------|
| Claude Conversations | JSONL Export | timestamp, prompt_hash | ✅ Approved |
| ChatGPT Conversations | JSONL Export | timestamp, prompt_hash | ✅ Approved |
| Copilot Suggestions | Git Diff Notes | commit_sha, file_path | ✅ Approved |

---

## 3. PROHIBITED SOURCES

**These sources are NEVER allowed, regardless of perceived value:**

| Source Type | Reason | Enforcement |
|-------------|--------|-------------|
| ToS-violating scrapers | Legal liability | Block at ingestion |
| Copyrighted content dumps | Copyright infringement | Block at ingestion |
| Private datasets without rights | Privacy/legal | Block at ingestion |
| Competitor proprietary data | Ethics/legal | Block at ingestion |
| User data without consent | Privacy | Block at ingestion |
| Paywalled content | Copyright | Block at ingestion |
| Social media scraping | ToS violation | Block at ingestion |
| Dark web sources | Legal/ethical | Block at ingestion |

---

## 4. REQUIRED METADATA

Every item ingested into `javari_knowledge_items` MUST include:

```typescript
interface RequiredMetadata {
  // Identity
  source_type: 'chat' | 'doc' | 'repo' | 'api' | 'web';
  source_name: string;        // e.g., "MDN Web Docs"
  
  // Provenance
  source_url: string | null;  // Original URL
  license_or_tos_url: string | null;  // Legal basis
  
  // Content
  content_type: string;       // e.g., "text/markdown", "application/json"
  content_hash: string;       // SHA-256 for deduplication
  
  // Tracking
  created_at: string;         // ISO timestamp of ingestion
  ingested_by: string;        // System/user that ingested
  
  // Classification
  tags: string[];             // Searchable categories
}
```

### Validation Rules

| Field | Rule | Failure Action |
|-------|------|----------------|
| `source_type` | Must be one of allowed types | Reject ingestion |
| `source_name` | Non-empty string | Reject ingestion |
| `source_url` | Valid URL or explicit null | Reject ingestion |
| `license_or_tos_url` | Required for external sources | Reject ingestion |
| `content_hash` | SHA-256, no duplicates | Skip if exists |
| `created_at` | Valid ISO timestamp | Auto-generate |

---

## 5. INGESTION PROCESS

```
┌─────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE INGESTION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

    Source Data
         │
         ▼
   ┌───────────────┐
   │ Source Check  │ ──── Is source in ALLOWED list? ───► NO → REJECT
   └───────────────┘                                      │
         │ YES                                            │
         ▼                                                │
   ┌───────────────┐                                      │
   │ ToS/License   │ ──── Has valid license/ToS URL? ──► NO → REJECT
   │ Verification  │                                      │
   └───────────────┘                                      │
         │ YES                                            │
         ▼                                                │
   ┌───────────────┐                                      │
   │ Hash Content  │ ──── Already exists (duplicate)? ──► YES → SKIP
   └───────────────┘                                      │
         │ NO (new)                                       │
         ▼                                                │
   ┌───────────────┐                                      │
   │ Extract Text  │                                      │
   │ + Metadata    │                                      │
   └───────────────┘                                      │
         │                                                │
         ▼                                                │
   ┌───────────────┐                                      │
   │ Store in      │                                      │
   │ Supabase      │                                      │
   └───────────────┘                                      │
         │                                                │
         ▼                                                │
   ┌───────────────┐                                      │
   │ Log Ingestion │                                      │
   │ Success       │                                      │
   └───────────────┘                                      │
                                                          │
         ALL REJECTIONS ◄─────────────────────────────────┘
              │
              ▼
         Log with reason
         (for audit trail)
```

---

## 6. SEARCH & RETRIEVAL

When retrieving knowledge for responses:

### Citation Requirements

1. **Always cite source** when using learned information
2. **Include URL** if available
3. **Include timestamp** of when knowledge was acquired
4. **Acknowledge uncertainty** if source is old or confidence is low

### Example Response with Citation

```
Based on the React documentation (https://react.dev/learn, ingested 2026-01-05):

useEffect lets you synchronize a component with an external system...

Note: This information was current as of my last knowledge update on January 5, 2026.
```

---

## 7. DATA RETENTION

| Source Type | Default Retention | Override |
|-------------|-------------------|----------|
| Internal (Tier 1) | Permanent | User deletion request |
| Documentation (Tier 2) | 90 days refresh | Manual refresh |
| Model Outputs (Tier 3) | Permanent | Manual cleanup |
| User uploads | Session or saved | User choice |

---

## 8. COMPLIANCE CHECKLIST

Before ANY new data source is added:

- [ ] Source is in ALLOWED list OR explicitly approved by Roy
- [ ] ToS/License has been reviewed
- [ ] Rate limits are documented and respected
- [ ] robots.txt is respected (if web source)
- [ ] Required metadata schema is supported
- [ ] Ingestion endpoint validates all fields
- [ ] Duplicate detection is active
- [ ] Audit logging is enabled

---

## 9. AUDIT TRAIL

All ingestion attempts (success or failure) are logged:

```typescript
interface IngestionLog {
  timestamp: string;
  source_type: string;
  source_name: string;
  source_url: string | null;
  status: 'success' | 'rejected' | 'duplicate' | 'error';
  reason?: string;
  content_hash?: string;
  ingested_by: string;
}
```

Logs are stored in `javari_ingestion_logs` for 1 year.

---

## 10. AMENDMENT PROCESS

To add a new allowed source:

1. Submit request with:
   - Source name and URL
   - ToS/License link
   - Value proposition
   - Rate limit information
   
2. Review by Roy Henderson

3. If approved:
   - Add to ALLOWED list
   - Update DATA_SOURCES_REGISTRY.md
   - Implement connector with validation

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-08 | Initial policy created |

---

**Policy Owner:** Roy Henderson, CEO  
**Enforcement:** Automatic via ingestion endpoint  
**Review Cycle:** Quarterly
