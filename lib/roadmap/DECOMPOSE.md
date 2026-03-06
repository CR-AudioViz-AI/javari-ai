# Task Decomposition Engine

The Task Decomposition Engine breaks large roadmap items into smaller, executable subtasks while preserving dependency order.

## Features

- **Intelligent Decomposition**: Uses AI to break tasks into 1-4 hour subtasks
- **Dependency Tracking**: Maintains proper execution order
- **Status Management**: Track subtask progress (pending → in_progress → completed)
- **Database Persistence**: All subtasks stored in `roadmap_subtasks` table

## Usage

### Decompose a Task

```typescript
import { decomposeTask } from "@/lib/roadmap/decompose";

const result = await decomposeTask(
  "task-123",
  "Build user authentication system",
  "Implement complete auth with login, registration, and password reset",
  "user-id"
);

if (result.success) {
  console.log(`Generated ${result.subtasks.length} subtasks`);
}
```

### Get Subtasks

```typescript
import { getSubtasks } from "@/lib/roadmap/decompose";

const subtasks = await getSubtasks("task-123");
```

### Update Status

```typescript
import { updateSubtaskStatus } from "@/lib/roadmap/decompose";

await updateSubtaskStatus("subtask-xyz", "completed");
```

## API Endpoints

### POST /api/javari/decompose

Decompose a task into subtasks.

**Request:**
```json
{
  "taskId": "task-123",
  "taskTitle": "Build authentication",
  "taskDescription": "Complete auth system",
  "userId": "user-id"
}
```

**Response:**
```json
{
  "ok": true,
  "subtasks": [...],
  "subtaskCount": 5,
  "originalTaskId": "task-123"
}
```

### GET /api/javari/decompose?taskId=xxx

Retrieve subtasks for a task.

**Response:**
```json
{
  "ok": true,
  "subtasks": [...],
  "subtaskCount": 5,
  "taskId": "task-123"
}
```

## Database Schema

```sql
CREATE TABLE roadmap_subtasks (
  subtask_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  dependencies TEXT[],
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ
);
```

## Subtask Schema

```typescript
{
  subtask_id: string;
  task_id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  dependencies: string[];
  created_at: string;
}
```

## Benefits

- ✅ Breaks large tasks into manageable pieces
- ✅ Preserves dependency order
- ✅ Enables parallel execution of independent subtasks
- ✅ Provides clear progress tracking
- ✅ Improves task estimation accuracy
