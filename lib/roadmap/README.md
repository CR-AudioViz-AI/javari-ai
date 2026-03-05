# Javari Roadmap Execution Engine

Automated task execution using Javari's 4-role multi-agent system.

## Architecture

### Roles
1. **Architect** - Analyzes task and creates execution plan
2. **Builder** - Implements the solution
3. **Validator** - Verifies quality and correctness
4. **Documenter** - Creates comprehensive documentation

## Usage

### Via API

```bash
curl -X POST https://javari-ai.vercel.app/api/javari/execute-roadmap-task \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-001",
    "title": "Create user authentication system",
    "description": "Build a secure JWT-based authentication system with email/password login",
    "userId": "roy_test_user"
  }'
```

### Programmatic Usage

```typescript
import { executeRoadmapTask, RoadmapTask } from "@/lib/roadmap/roadmap-executor";

const task: RoadmapTask = {
  id: "task-001",
  title: "Build API endpoint",
  description: "Create REST API endpoint for user registration",
  status: "pending"
};

const result = await executeRoadmapTask(task, "user-id");

if (result.success) {
  console.log("Output:", result.output);
  console.log("Cost:", result.estimatedCost);
}
```

## Features

- ✅ Sequential 4-role execution
- ✅ Context passing between agents
- ✅ Cost tracking per task
- ✅ Error handling and retry capability
- ✅ Structured output with role-based sections
- ✅ Task status management

## Response Format

```json
{
  "ok": true,
  "task": {
    "id": "task-001",
    "title": "...",
    "status": "completed",
    "estimatedCost": 0.XX,
    "rolesExecuted": ["architect", "builder", "validator", "documenter"]
  },
  "output": "=== ARCHITECT ===\n...\n=== BUILDER ===\n..."
}
```
