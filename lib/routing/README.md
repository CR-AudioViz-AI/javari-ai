# Javari Adaptive Model Routing Intelligence

Automatically selects optimal models based on real-world performance telemetry.

## How It Works

### Performance Scoring

Each model is scored using three factors:

```
score = (successRate × 0.5) + (1/latency × 0.3) + (1/cost × 0.2)
```

**Weights:**
- Success Rate: 50% - Most important factor
- Latency: 30% - Speed matters
- Cost: 20% - Efficiency consideration

**Higher score = Better model**

### Minimum Data Requirement

Models need at least **10 executions** before being considered for ranking.

This ensures statistical significance.

## API Usage

### Get Model Rankings

```bash
curl /api/javari/model-stats
```

**Response:**
```json
{
  "ok": true,
  "rankings": [
    {
      "model": "gpt-4o-mini",
      "provider": "openai",
      "score": 0.856,
      "successRate": 98.5,
      "avgLatency": 1850,
      "avgCost": 0.0012,
      "executions": 450
    }
  ]
}
```

## Programmatic Usage

### Select Optimal Model by Role

```typescript
import { selectOptimalModel } from "@/lib/routing/model-intelligence";

const model = await selectOptimalModel("architect", "planning");
// Returns: "gpt-4o" (based on telemetry)
```

### Select by Capability

```typescript
import { selectOptimalModelByCapability } from "@/lib/routing/model-intelligence";

const model = await selectOptimalModelByCapability("high");
// Returns best performing high-capability model
```

## Default Fallbacks

If insufficient telemetry data exists, defaults to:

| Role | Default Model |
|------|---------------|
| Architect | gpt-4o |
| Builder | claude-sonnet-4-20250514 |
| Validator | gpt-4o |
| Documenter | gpt-4o-mini |

## Benefits

✅ **Self-Optimizing** - Gets better over time  
✅ **Data-Driven** - Based on real performance  
✅ **Cost-Aware** - Balances quality and cost  
✅ **Fast** - Optimizes for latency  
✅ **Reliable** - Prioritizes success rate  

## Example Rankings

```
Rank 1: gpt-4o-mini
  Score: 0.856
  Success: 98.5%
  Latency: 1850ms
  Cost: $0.0012

Rank 2: claude-sonnet-4
  Score: 0.832
  Success: 95.2%
  Latency: 2200ms
  Cost: $0.0035

Rank 3: gpt-4o
  Score: 0.791
  Success: 97.1%
  Latency: 2450ms
  Cost: $0.0089
```
