# Roadmap Execution API

Start and monitor roadmap execution workflows.

## Endpoint

### POST /api/javari/start-roadmap

Start roadmap execution.

**Request:**
```json
{
  "roadmapId": "roadmap-123",
  "userId": "user-id",
  "autoStart": true,
  "maxTasks": 5
}
```

**Parameters:**
- `roadmapId` (required): ID of roadmap to execute
- `userId` (optional): User initiating execution
- `autoStart` (optional): Start queue immediately (default: true)
- `maxTasks` (optional): Max tasks to execute in first batch (default: 5)

**Response:**
```json
{
  "ok": true,
  "execution_id": "exec-1234567890",
  "tasks_loaded": 10,
  "tasks_executed": 5,
  "tasks_succeeded": 4,
  "tasks_failed": 1,
  "auto_started": true,
  "roadmap_id": "roadmap-123",
  "timestamp": "2026-03-06T04:53:00.000Z"
}
```

### GET /api/javari/start-roadmap?execution_id=xxx

Get execution status.

**Response:**
```json
{
  "ok": true,
  "execution_id": "exec-1234567890",
  "stats": {
    "total": 10,
    "pending": 3,
    "in_progress": 1,
    "completed": 5,
    "failed": 1,
    "retry": 0
  },
  "logs": [...],
  "log_count": 5
}
```

## Execution Flow

```
1. Load Roadmap
   ↓
2. Run Ingestion Engine
   ↓
3. Populate roadmap_tasks
   ↓
4. Start Execution Queue (if autoStart)
   ↓
5. Return execution_id
```

## Usage Example

```bash
# Start roadmap execution
curl -X POST https://javari-ai.vercel.app/api/javari/start-roadmap \
  -H "Content-Type: application/json" \
  -d '{
    "roadmapId": "roadmap-123",
    "userId": "user-id",
    "autoStart": true,
    "maxTasks": 5
  }'

# Check execution status
curl https://javari-ai.vercel.app/api/javari/start-roadmap?execution_id=exec-1234567890
```

## Integration with Other APIs

**Generate Roadmap → Load → Execute:**
```typescript
// 1. Generate roadmap
const roadmap = await fetch('/api/javari/generate-roadmap', {
  method: 'POST',
  body: JSON.stringify({ goal: "Build SaaS app", userId: "user-id" })
});

// 2. Start execution
const execution = await fetch('/api/javari/start-roadmap', {
  method: 'POST',
  body: JSON.stringify({ 
    roadmapId: roadmap.roadmap_id,
    autoStart: true 
  })
});

// 3. Monitor progress
const status = await fetch(
  `/api/javari/start-roadmap?execution_id=${execution.execution_id}`
);
```

## Benefits

✅ Single endpoint to orchestrate entire workflow  
✅ Automatic queue processing  
✅ Real-time execution tracking  
✅ Comprehensive error handling  
✅ Execution ID for monitoring  
