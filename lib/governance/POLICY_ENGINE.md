# Javari Policy Engine

Enterprise-grade governance for autonomous AI execution.

## What It Does

Enforces security, compliance, and architectural policies **before** tasks enter the execution queue.

## Policy Categories

### 🛡️ Security
- **No Plaintext Secrets** - Blocker
- **Require Encryption** - Blocker (user credentials)
- **Require Rate Limiting** - Warning (public APIs)
- **Require Input Validation** - Warning

### 📋 Compliance
- **GDPR Compliance** - Blocker (user data)
- **Audit Logging** - Warning (critical operations)
- **Data Retention** - Warning

### 🏗️ Architecture
- **Require Testing** - Warning (new features)
- **Require Documentation** - Info (complex logic)
- **No Hardcoded URLs** - Warning

### 💰 Cost Control
- **Max Cost Per Task** - Blocker ($5.00 limit)
- **External API Approval** - Warning (approved providers)

## Severity Levels

| Level | Effect | Examples |
|-------|--------|----------|
| **blocker** | Task rejected | Plaintext secrets, GDPR violations |
| **warning** | Task approved with warning | Missing tests, no docs |
| **info** | Informational only | Best practices |

## API Usage

### Evaluate Tasks
```bash
curl -X POST /api/javari/policy-check \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {
        "id": "task-1",
        "title": "Store user passwords",
        "description": "Save passwords to database in plaintext",
        "priority": 10
      }
    ]
  }'
```

### Get Policy Summary
```bash
curl /api/javari/policy-check
```

## Response Format

```json
{
  "ok": true,
  "success": false,
  "approvedTasks": [],
  "blockedTasks": [
    {
      "id": "task-1",
      "title": "Store user passwords",
      "description": "Save passwords to database in plaintext",
      "priority": 10
    }
  ],
  "warnings": [],
  "policyViolations": [
    {
      "taskId": "task-1",
      "taskTitle": "Store user passwords",
      "category": "security",
      "severity": "blocker",
      "rule": "noPlaintextSecrets",
      "description": "Tasks must not store secrets in plaintext",
      "recommendation": "Remove blocked pattern or restructure task"
    }
  ],
  "summary": {
    "totalTasks": 1,
    "approved": 0,
    "blocked": 1,
    "warnings": 0,
    "violations": 1
  }
}
```

## Integration Pattern

```typescript
// Before loading into queue
const evaluation = await evaluateTasks(roadmap);

if (!evaluation.success) {
  console.log("Blocked tasks:", evaluation.blockedTasks);
  console.log("Violations:", evaluation.policyViolations);
  
  // Only load approved tasks
  await loadRoadmap(evaluation.approvedTasks);
} else {
  // All tasks approved
  await loadRoadmap(roadmap);
}
```

## Example Violations

### ❌ BLOCKER: Plaintext Secrets
```
Task: "Store API keys in config file"
Violation: Contains 'plaintext' pattern with 'api key' keyword
Action: BLOCKED
```

### ❌ BLOCKER: Missing Encryption
```
Task: "Save user passwords to database"
Violation: Contains 'password' but no 'encrypt/hash/bcrypt'
Action: BLOCKED
Recommendation: Add bcrypt or argon2
```

### ⚠️ WARNING: Missing Tests
```
Task: "Add new payment endpoint"
Violation: Contains 'endpoint' but no 'test'
Action: APPROVED with warning
Recommendation: Add integration tests
```

## Benefits

✅ **Security by Default** - Blocks dangerous practices  
✅ **Compliance Enforcement** - GDPR, SOC2, etc.  
✅ **Cost Control** - Prevents expensive tasks  
✅ **Quality Standards** - Enforces best practices  
✅ **Pre-Execution** - Catches issues before execution  
✅ **Transparent** - Clear violations and recommendations  

## Policy Configuration

Policies are defined in `lib/governance/policy-engine.ts` and can be customized per organization.
