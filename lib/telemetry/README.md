# Javari Observability and Telemetry

Comprehensive system monitoring for model usage, costs, and performance.

## What Is Tracked

**Per Execution:**
- Model used (gpt-4o, claude-sonnet-4, etc.)
- Provider (openai, anthropic, mistral)
- Tokens consumed
- Latency (milliseconds)
- Cost (USD)
- Success/failure status
- Task ID (if applicable)

**Aggregated:**
- Total executions
- Success rate
- Total cost
- Total tokens
- Average latency
- Model breakdown
- Provider breakdown

## API Usage

### Get Statistics

```bash
curl /api/javari/telemetry
```

### Get Statistics Since Date

```bash
curl "/api/javari/telemetry?since=2026-03-01T00:00:00Z"
```

### Get Recent Logs

```bash
curl "/api/javari/telemetry?logs=true"
```

## Response Format

```json
{
  "ok": true,
  "stats": {
    "totalExecutions": 1250,
    "successRate": 94.4,
    "totalCost": 45.67,
    "totalTokens": 2500000,
    "averageLatency": 2450,
    "modelBreakdown": [
      {
        "model": "gpt-4o-mini",
        "executions": 450,
        "totalCost": 12.34,
        "successRate": 96.2
      }
    ],
    "providerBreakdown": [
      {
        "provider": "openai",
        "executions": 750,
        "totalCost": 28.90
      }
    ]
  }
}
```

## Use Cases

**Cost Optimization**
- Identify most expensive models
- Track cost trends over time
- Set budget alerts

**Performance Monitoring**
- Monitor latency trends
- Identify slow models
- Optimize execution speed

**Reliability Tracking**
- Track success rates by model
- Identify failure patterns
- Improve error handling

**Capacity Planning**
- Predict token usage
- Plan scaling needs
- Optimize model selection
