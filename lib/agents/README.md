# Javari Agent System

Builder and Validator agents for autonomous roadmap execution.

## Agents

### Builder Agent

**Purpose:** Generate deliverables for roadmap tasks

**Default Model:** `gpt-4o-mini` (cost-optimized)

**Features:**
- Generates code, designs, or documentation
- Automatic retry on failure
- Escalates to premium model (`gpt-4o`) if needed
- Returns structured deliverables

**Usage:**
```typescript
import { buildTaskWithRetry } from "@/lib/agents/builder";

const result = await buildTaskWithRetry({
  taskId: "task-123",
  taskTitle: "Build user authentication",
  taskDescription: "Implement login with JWT",
  userId: "user-id"
});

if (result.success) {
  console.log("Code:", result.code);
  console.log("Docs:", result.documentation);
}
```

### Validator Agent

**Purpose:** Verify task output quality

**Default Model:** `claude-sonnet-4` (high-quality validation)

**Validation Rules:**
1. Code correctness
2. Architecture alignment  
3. JSON schema compliance
4. Completeness
5. Production readiness

**Scoring:**
- 90-100: Excellent
- 70-89: Good
- 50-69: Acceptable
- 0-49: Failed

**Usage:**
```typescript
import { validateTaskWithRetry } from "@/lib/agents/validator";

const result = await validateTaskWithRetry({
  taskId: "task-123",
  taskTitle: "Build user authentication",
  taskDescription: "Implement login with JWT",
  deliverable: buildResult.deliverable,
  code: buildResult.code
});

if (result.valid) {
  console.log("Score:", result.score);
  console.log("Feedback:", result.feedback);
}
```

## Integrated Workflow

**Purpose:** Complete build-validate cycle

**Usage:**
```typescript
import { executeBuildValidateWorkflow } from "@/lib/agents/workflow";

const result = await executeBuildValidateWorkflow(
  "task-123",
  "Build user authentication",
  "Implement login with JWT tokens",
  ["task-100", "task-101"], // dependencies
  "user-id"
);

if (result.success) {
  console.log("Deliverable:", result.finalDeliverable);
  console.log("Total cost:", result.totalCost);
  console.log("Validation score:", result.validationResult?.score);
}
```

## Retry & Escalation Logic

### Builder
1. Try with `gpt-4o-mini` (cheap)
2. Retry with `gpt-4o-mini` 
3. Escalate to `gpt-4o` (premium)

### Validator
1. Try with `claude-sonnet-4`
2. Retry with `claude-sonnet-4`
3. Escalate to `gpt-4o` (second opinion)

## Cost Optimization

**Typical Costs:**
- Builder (cheap): $0.02 - $0.05
- Builder (premium): $0.30 - $0.50
- Validator: $0.40 - $0.60
- **Total (successful):** $0.42 - $0.65

**With Retries:**
- Maximum: ~$1.50 (all retries + escalation)

## Response Format

### Builder Result
```typescript
{
  success: boolean;
  deliverable: any;
  code?: string;
  documentation?: string;
  model: string;
  cost: number;
  retryCount: number;
}
```

### Validation Result
```typescript
{
  success: boolean;
  valid: boolean;
  score: number;
  feedback: string;
  issues: string[];
  recommendations: string[];
  model: string;
  cost: number;
  retryCount: number;
}
```

## Benefits

✅ Automated task execution  
✅ Quality validation  
✅ Cost optimization via tiered models  
✅ Automatic retry logic  
✅ Premium escalation when needed  
✅ Comprehensive logging  
