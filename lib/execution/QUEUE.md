# Javari Execution Queue

Sequential task execution with dependency resolution and comprehensive logging.

## Features

- **Dependency Resolution**: Only executes tasks when prerequisites are complete
- **Sequential Execution**: Processes tasks in dependency order
- **Status Tracking**: pending → in_progress → completed/retry/failed
- **Execution Logging**: Complete telemetry for every task execution
- **Cost Tracking**: Monitor execution costs and token usage

## Usage

### Process the Queue

```typescript
import { processQueue } from "@/lib/execution/queue";

const result = await processQueue(5, "user-id");

console.log(`Executed: ${result.executed}`);
console.log(`Succeeded: ${result.succeeded}`);
console.log(`Failed: ${result.failed}`);
```

### Get Queue Statistics

```typescript
import { getQueueStats } from "@/lib/execution/queue";

const stats = await getQueueStats();

console.log(`Total: ${stats.total}`);
console.log(`Pending: ${stats.pending}`);
console.log(`Completed: ${stats.completed}`);
```

## API Endpoints

### POST /api/javari/queue

Process execution queue.

**Request:**
```json
{
  "maxTasks": 5,
  "userId": "user-id"
}
```

**Response:**
```json
{
  "ok": true,
  "executed": 3,
  "succeeded": 2,
  "failed": 1,
  "logs": [...]
}
```

### GET /api/javari/queue

Get queue statistics.

**Response:**
```json
{
  "ok": true,
  "stats": {
    "total": 10,
    "pending": 3,
    "inProgress": 1,
    "completed": 5,
    "failed": 1,
    "retry": 0
  }
}
```

## Database Schema

### execution_logs
```sql
CREATE TABLE execution_logs (
  execution_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  model_used TEXT NOT NULL,
  cost DECIMAL(10, 6),
  tokens_in INTEGER,
  tokens_out INTEGER,
  execution_time INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  timestamp TIMESTAMPTZ
);
```

### roadmap_tasks
```sql
CREATE TABLE roadmap_tasks (
  task_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  dependencies TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Task Lifecycle

```
pending → in_progress → completed
                     ↓
                   retry → (back to pending)
                     ↓
                   failed (terminal)
```

## Dependency Resolution

Tasks execute only when ALL dependencies are completed:

```typescript
Task A (no deps) → executes first
Task B (depends on A) → executes after A completes
Task C (depends on A, B) → executes after both complete
```

## Execution Flow

1. Query tasks with `status = pending` or `status = retry`
2. Filter for tasks where all dependencies are `completed`
3. Mark selected task as `in_progress`
4. Execute task via builder agent
5. Parse result and determine final status
6. Update task status (completed/retry/failed)
7. Log execution details to execution_logs
8. Repeat for next task

## Benefits

✅ Automatic dependency resolution  
✅ Sequential execution with proper ordering  
✅ Comprehensive execution logging  
✅ Cost and performance tracking  
✅ Retry logic for failed tasks  
✅ Real-time queue statistics  
