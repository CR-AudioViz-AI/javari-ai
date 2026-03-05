# Javari Strategic Planning Engine

The "Javari Brain" - automatically generates comprehensive roadmaps from high-level goals.

## How It Works

### Multi-Agent Planning Team

1. **Architect** (GPT-4o)
   - Breaks down goal into strategic phases
   - Identifies dependencies and milestones
   - Assigns priorities

2. **Builder** (Claude Sonnet 4)
   - Converts phases into specific tasks
   - Adds technical details
   - Defines deliverables

3. **Validator** (GPT-4o)
   - Verifies feasibility
   - Checks for gaps
   - Validates sequencing

4. **Documenter** (GPT-4o-mini)
   - Produces structured JSON roadmap
   - Ensures proper formatting
   - Orders by priority

## API Usage

### Generate Roadmap Only

```bash
curl -X POST /api/javari/generate-roadmap \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Build a secure SaaS authentication system with OAuth2 and JWT"
  }'
```

### Generate and Auto-Queue

```bash
curl -X POST /api/javari/generate-roadmap \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Build a secure SaaS authentication system",
    "autoQueue": true
  }'
```

## Response Format

```json
{
  "ok": true,
  "tasks": [
    {
      "id": "phase1-task1",
      "title": "Design authentication architecture",
      "description": "Create comprehensive auth system design...",
      "priority": 10
    }
  ],
  "tasksGenerated": 8,
  "tasksQueued": 8,
  "estimatedCost": 0.15,
  "autoQueued": true
}
```

## Example Goals

**Simple:**
- "Build user authentication"
- "Create REST API"
- "Add payment processing"

**Complex:**
- "Build a secure SaaS platform with JWT auth, Stripe payments, and PostgreSQL"
- "Create a real-time chat application with WebSockets and Redis"
- "Implement CI/CD pipeline with Docker, GitHub Actions, and AWS"

## Best Practices

1. **Be specific** - Include technologies, requirements, constraints
2. **Set scope** - Define what's in/out of scope
3. **Mention scale** - Small MVP vs production-ready
4. **Include constraints** - Time, budget, tech stack

## Integration with Autonomous Mode

```bash
# 1. Generate roadmap
curl -X POST /api/javari/generate-roadmap \
  -d '{"goal": "Build auth system", "autoQueue": true}'

# 2. Start autonomous execution
curl -X POST /api/javari/run-autonomous \
  -d '{"userId": "production"}'
```

The system will automatically:
- Generate tasks from goal
- Queue tasks by priority
- Execute tasks autonomously
- Self-repair on failure
- Track all execution history
