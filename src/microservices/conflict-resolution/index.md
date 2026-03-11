# Deploy Agent Decision Conflict Resolution System

# Agent Decision Conflict Resolution System

## Purpose

The Agent Decision Conflict Resolution System aims to identify and resolve conflicts arising from differing agent decisions within a multi-agent environment. Leveraging data from agents, it analyzes recommendations, assesses conflicts, and proposes resolutions while tracking agent performance.

## Usage

To deploy the conflict resolution system, ensure the following environment variables are set up:

- `SUPABASE_URL`: The endpoint for the Supabase database.
- `SUPABASE_SERVICE_ROLE_KEY`: The service role key for Supabase.
- `REDIS_URL`: The URL for the Redis database.
- `OPENAI_API_KEY`: API key for OpenAI services.

After setting up the environment, you can initiate the conflict detection process by invoking the `detectConflicts` method.

## Parameters/Props

### 1. AgentDecision
- `agentId` (string): Unique identifier for the agent.
- `agentType` (string): Type of the agent (e.g., human, AI).
- `recommendation` (any): The decision or recommendation made by the agent.
- `confidence` (number): Confidence level of the agent's decision (0-1).
- `reasoning` (string): Explanation for the agent's decision.
- `timestamp` (Date): The time when the decision was made.
- `contextId` (string): Identifier for the context in which the decision was made.
- `metadata` (object, optional): Additional information about the decision.

### 2. ConflictMetrics
- `conflictId` (string): Unique identifier for the conflict.
- `decisions` (AgentDecision[]): List of decisions involved in the conflict.
- `conflictType` (string): Type of conflict ("recommendation", "priority", "approach", "value").
- `severity` (string): Severity level ("low", "medium", "high", "critical").
- `contextId` (string): Identifier for the relevant context.
- `detectedAt` (Date): The time when the conflict was detected.

### 3. ResolutionCandidate
- `candidateId` (string): Unique identifier for the resolution candidate.
- `resolution` (any): Proposed resolution for the conflict.
- `supportingAgents` (string[]): List of agents supporting this resolution.
- `opposingAgents` (string[]): List of agents opposing this resolution.
- `weightedScore` (number): Score representing the strength of the resolution.
- `confidence` (number): Confidence level of the proposed resolution.

### 4. EscalationRequest
- `escalationId` (string): Identifier for the escalation request.
- `conflictId` (string): Identifier of the related conflict.
- `severity` (string): Severity level of the escalation.
- `humanRequired` (boolean): Indicates if human intervention is needed.
- `deadline` (Date): Deadline for resolution.
- `context` (object): Additional context for the escalation.

## Return Values

The `detectConflicts` method returns a Promise that resolves to an array of `ConflictMetrics` objects that detail the identified conflicts based on the input decisions.

## Example

```typescript
const decisions: AgentDecision[] = [
  {
    agentId: "agent_01",
    agentType: "AI",
    recommendation: "Increase resource allocation",
    confidence: 0.9,
    reasoning: "Resource-intensive project phases.",
    timestamp: new Date(),
    contextId: "context_01"
  },
  {
    agentId: "agent_02",
    agentType: "AI",
    recommendation: "Maintain current allocation",
    confidence: 0.8,
    reasoning: "Budget constraints in next quarter.",
    timestamp: new Date(),
    contextId: "context_01"
  }
];

const conflictEngine = new ConflictDetectionEngine();
const conflicts = await conflictEngine.detectConflicts(decisions);
console.log(conflicts);
```

This example demonstrates how to set up decision data, initialize the conflict detection engine, and retrieve any detected conflicts based on the provided decisions.