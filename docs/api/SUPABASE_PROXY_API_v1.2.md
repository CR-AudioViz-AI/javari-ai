# JAVARI Supabase Proxy API Documentation v1.2

**Canonical Reference for Database Access**

- **Version:** 1.2
- **Last Updated:** January 12, 2026, 8:45 PM ET
- **Status:** OPERATIONAL

---

## Overview

JAVARI uses two serverless API routes to provide secure, controlled access to the Supabase PostgreSQL database. These proxies enforce table whitelisting, operation restrictions, and comprehensive validation.

**Architecture:**
```
JAVARI System
    ↓
Supabase Proxies (Next.js API Routes)
    ↓
Supabase PostgreSQL (via Service Role Key)
```

---

## WRITE Proxy

### Endpoint
```
POST https://javariai.com/api/javari/supabase/write
```

### Status
✅ **OPERATIONAL** (verified 2026-01-12 20:00 ET)

### Feature Flag
```bash
FEATURE_SUPABASE_WRITE=1
```

### Allowed Tables
- `projects`
- `milestones`

### Allowed Operations
- `insert` - Create new records
- `update` - Modify existing records
- ❌ NO `delete` operations allowed

### Request Schema
```typescript
{
  table: "projects" | "milestones";
  operation: "insert" | "update";
  data: Record<string, any> | Record<string, any>[];
  match?: Record<string, any>; // Required for updates
}
```

### Response Schema
```typescript
{
  success: boolean;
  recordIds?: string[];
  error?: string;
  timestamp: string; // ISO 8601
}
```

### Examples

#### Insert Single Project
```bash
curl -X POST "https://javariai.com/api/javari/supabase/write" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "projects",
    "operation": "insert",
    "data": {
      "name": "Build Auth System",
      "status": "planned",
      "metadata": {
        "priority": 1,
        "owner": "Roy",
        "phase": "PHASE_2",
        "blockers": ["Choose auth provider"]
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "recordIds": ["uuid-here"],
  "timestamp": "2026-01-12T20:00:00.000Z"
}
```

#### Update Project Metadata
```bash
curl -X POST "https://javariai.com/api/javari/supabase/write" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "projects",
    "operation": "update",
    "match": { "id": "uuid-here" },
    "data": {
      "status": "in_progress",
      "metadata": {
        "priority": 1,
        "owner": "Roy",
        "phase": "PHASE_2",
        "blockers": [],
        "started_at": "2026-01-12"
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "recordIds": ["uuid-here"],
  "timestamp": "2026-01-12T20:01:00.000Z"
}
```

### Error Responses

#### Feature Disabled
```json
{
  "success": false,
  "error": "Supabase write proxy is disabled (FEATURE_SUPABASE_WRITE=0)",
  "timestamp": "2026-01-12T20:00:00.000Z"
}
```
**Status:** 403 Forbidden

#### Table Not Whitelisted
```json
{
  "success": false,
  "error": "Table 'users' not in whitelist. Allowed: projects, milestones",
  "timestamp": "2026-01-12T20:00:00.000Z"
}
```
**Status:** 403 Forbidden

#### Database Error
```json
{
  "success": false,
  "error": "Insert failed: duplicate key value violates unique constraint",
  "timestamp": "2026-01-12T20:00:00.000Z"
}
```
**Status:** 500 Internal Server Error

---

## READ Proxy

### Endpoint
```
POST https://javariai.com/api/javari/supabase/read
```

### Status
✅ **OPERATIONAL** (verified 2026-01-12 20:36 ET)

### Feature Flag
```bash
FEATURE_SUPABASE_READ=1
```

### Allowed Tables
- `projects`
- `milestones`
- `tasks`

### Allowed Operations
- `select` - Query records with filters, sorting, pagination

### Request Schema
```typescript
{
  table: "projects" | "milestones" | "tasks";
  columns?: string[];           // Optional: specific columns
  filters?: Array<{             // Optional: filter conditions
    column: string;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | 
              "like" | "ilike" | "in" | "is";
    value: any;
  }>;
  orderBy?: Array<{             // Optional: sort order
    column: string;
    direction?: "asc" | "desc";
  }>;
  limit?: number;               // Optional: 1-1000
  offset?: number;              // Optional: pagination
  count?: boolean;              // Optional: include total count
}
```

### Response Schema
```typescript
{
  success: boolean;
  data?: any[];
  count?: number;
  error?: string;
  timestamp: string; // ISO 8601
}
```

### Examples

#### Get All Projects
```bash
curl -X POST "https://javariai.com/api/javari/supabase/read" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "projects",
    "orderBy": [
      { "column": "created_at", "direction": "desc" }
    ]
  }'
```

#### Get Top 5 Highest Priority Projects
```bash
curl -X POST "https://javariai.com/api/javari/supabase/read" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "projects",
    "filters": [
      {
        "column": "status",
        "operator": "neq",
        "value": "complete"
      }
    ],
    "orderBy": [
      { "column": "created_at", "direction": "desc" }
    ],
    "limit": 5,
    "count": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "Build Auth System",
      "status": "in_progress",
      "metadata": {
        "priority": 1,
        "owner": "Roy",
        "phase": "PHASE_2"
      },
      "created_at": "2026-01-12T20:00:00.000Z"
    }
  ],
  "count": 12,
  "timestamp": "2026-01-12T20:05:00.000Z"
}
```

#### Filter by Phase
```bash
curl -X POST "https://javariai.com/api/javari/supabase/read" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "projects",
    "columns": ["id", "name", "status", "metadata"],
    "limit": 100
  }'
```

Note: To filter by `metadata.phase`, you need to retrieve all records and filter client-side, OR add JSONB operator support to the proxy.

#### Pagination Example
```bash
# Page 1
curl -X POST "https://javariai.com/api/javari/supabase/read" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "projects",
    "limit": 20,
    "offset": 0,
    "orderBy": [
      { "column": "created_at", "direction": "desc" }
    ]
  }'

# Page 2
curl -X POST "https://javariai.com/api/javari/supabase/read" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "projects",
    "limit": 20,
    "offset": 20,
    "orderBy": [
      { "column": "created_at", "direction": "desc" }
    ]
  }'
```

### Error Responses

#### Invalid Column Name
```json
{
  "success": false,
  "error": "Invalid column name: user_id'; DROP TABLE projects;--",
  "timestamp": "2026-01-12T20:00:00.000Z"
}
```
**Status:** 400 Bad Request

#### Query Failed
```json
{
  "success": false,
  "error": "Query failed: column projects.priority does not exist",
  "timestamp": "2026-01-12T20:00:00.000Z"
}
```
**Status:** 500 Internal Server Error

---

## Security

### Authentication
- Both proxies use **server-side Service Role Key**
- No client-side authentication required (endpoints are public)
- Consider adding API key authentication for production

### Table Whitelisting
- WRITE: `projects`, `milestones` only
- READ: `projects`, `milestones`, `tasks` only
- Requests for other tables return 403 Forbidden

### Operation Restrictions
- WRITE: `insert`, `update` only (NO deletes)
- READ: `select` only

### SQL Injection Prevention
- No raw SQL accepted
- Column names validated with regex: `/^[a-zA-Z0-9_]+$/`
- All queries use Supabase query builder (parameterized)

### Rate Limiting
- Inherits Vercel edge function rate limits
- Consider adding application-level rate limiting

### Data Validation
- Strict schema validation on all requests
- Type checking for all parameters
- Payload size limits enforced

---

## Database Schema

### Projects Table
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT,
  goal TEXT,
  current_task TEXT,
  progress_percent INTEGER DEFAULT 0,
  credentials_vault JSONB DEFAULT '{}',
  context_summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Metadata Structure (Recommended):**
```json
{
  "priority": 1,
  "owner": "Roy",
  "phase": "PHASE_1",
  "source": "master-blueprint-v1.2",
  "blockers": ["Define storage schema"],
  "dependencies": ["uuid-of-dependent-project"],
  "pr_number": 123,
  "completion_date": "2026-01-12"
}
```

### Milestones Table
```sql
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT,
  due_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES milestones(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Best Practices

### 1. Use Metadata for Flexible Schema
Store dynamic fields in `metadata` JSONB column to avoid schema migrations:
```json
{
  "metadata": {
    "priority": 1,
    "tags": ["urgent", "backend"],
    "custom_field": "any value"
  }
}
```

### 2. Always Include Source
Track where data came from:
```json
{
  "metadata": {
    "source": "master-blueprint-v1.2",
    "ingested_at": "2026-01-12T20:00:00Z"
  }
}
```

### 3. Use Filters for Complex Queries
Combine multiple filters for precise queries:
```json
{
  "filters": [
    { "column": "status", "operator": "eq", "value": "in_progress" },
    { "column": "progress_percent", "operator": "gte", "value": 50 }
  ]
}
```

### 4. Request Count for Pagination
Always use `count: true` when paginating:
```json
{
  "limit": 20,
  "offset": 0,
  "count": true
}
```

### 5. Error Handling
Always check `success` field:
```python
response = requests.post(endpoint, json=payload)
data = response.json()

if not data.get("success"):
    print(f"Error: {data.get('error')}")
    return

# Process data
for record in data.get("data", []):
    process(record)
```

---

## Troubleshooting

### Issue: 403 Forbidden
**Cause:** Feature flag disabled or table not whitelisted
**Solution:** 
1. Check Vercel env vars for `FEATURE_SUPABASE_READ=1` / `FEATURE_SUPABASE_WRITE=1`
2. Verify table name is in allowed list

### Issue: 500 Internal Server Error
**Cause:** Database query failed or invalid data
**Solution:**
1. Check error message for SQL error details
2. Verify column names exist in table
3. Check data types match schema

### Issue: Empty Data Array
**Cause:** No records match filters
**Solution:**
1. Remove filters to see all records
2. Check filter operators and values
3. Verify data exists in table

---

## Version History

- **v1.0** - Initial proxy implementation (2026-01-12)
- **v1.1** - Added comprehensive validation (2026-01-12)
- **v1.2** - Added documentation and examples (2026-01-12)

---

**END OF PROXY API DOCUMENTATION v1.2**
