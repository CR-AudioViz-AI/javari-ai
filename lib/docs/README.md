# Documentation Engine

Automated generation of customer-facing documentation for completed roadmap tasks.

## Purpose

Provide clear, professional documentation that explains:
1. What was accomplished
2. Why technical decisions were made
3. How much it cost
4. What to do next

## Features

- ✅ Customer-friendly language
- ✅ Technical accuracy
- ✅ Cost transparency
- ✅ Architecture rationale
- ✅ Next steps guidance
- ✅ Markdown formatting
- ✅ Batch processing support

## Usage

### Single Task

```typescript
import { generateDocumentation } from "@/lib/docs/generate";

const result = await generateDocumentation({
  taskId: "task-123",
  taskTitle: "Build User Authentication",
  taskDescription: "Implement JWT auth",
  deliverable: buildResult.deliverable,
  buildCost: 0.42,
  validationScore: 92,
  executionTime: 5420
});

console.log(result.markdown); // Ready to send to customer
```

### Roadmap (Multiple Tasks)

```typescript
import { generateRoadmapDocumentation } from "@/lib/docs/generate";

const result = await generateRoadmapDocumentation(
  "SaaS MVP Development",
  [task1, task2, task3]
);

console.log(result.markdown); // Complete roadmap docs
```

## Output Format

### Documentation Object
```typescript
{
  taskSummary: string;
  whatWasBuilt: string;
  architectureRationale: string;
  costBreakdown: {
    buildCost: number;
    validationCost: number;
    totalCost: number;
    tokensUsed: number;
  };
  nextSteps: string[];
  metadata: {
    taskId: string;
    generatedAt: string;
    executionTime?: number;
    validationScore?: number;
  };
}
```

### Markdown Output
Professional formatted document including:
- Task summary
- Detailed explanation
- Architecture decisions
- Cost breakdown table
- Next recommended steps
- Metadata

## Cost

**Model:** `gpt-4o-mini` (cost-optimized)  
**Typical Cost:** $0.02 - $0.05 per task  
**Batch Cost:** $0.10 - $0.25 for 5 tasks  

## API Endpoints

**POST /api/javari/docs**
- Single task: `mode: "single"`
- Roadmap: `mode: "roadmap"`

See `EXAMPLES.md` for detailed usage.

## Benefits

**For Customers:**
- Understand what was built
- See where money went
- Know what to do next
- Professional deliverable

**For Business:**
- Transparency builds trust
- Reduces support questions
- Provides audit trail
- Increases perceived value

## Integration

The documentation engine integrates with:
- Builder Agent (captures deliverable)
- Validator Agent (includes score)
- Execution Queue (tracks costs)
- Roadmap System (batch docs)
