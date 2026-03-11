# Build Multi-Agent Consensus Decision Service

# Multi-Agent Consensus Decision Service

## Purpose
The Multi-Agent Consensus Decision Service facilitates consensus building among multiple agents by collecting their proposals, votes, and evaluations. It utilizes weighted voting mechanisms based on agents’ expertise and confidence levels to reach a collective decision within specified configurations.

## Usage
This service can be used within distributed systems requiring automated decision-making mechanisms with input from multiple agents. It streamlines the process of evaluating proposals, determining consensus, and logging the decision-making journey.

### Importing the Service
To use this service, ensure you have the necessary dependencies and import the service file as follows:

```typescript
import { MultiAgentConsensusService } from './src/services/multi-agent-consensus.service';
```

## Parameters/Props

### AgentProposal
- **agentId**: (string) Unique identifier for the agent.
- **proposalId**: (string) Unique identifier for the proposal.
- **solution**: (any) Proposed solution by the agent.
- **confidenceScore**: (number) Confidence level of the proposal (0-1).
- **expertiseDomains**: (ExpertiseDomain[]) List of expertise domains related to the agent.
- **timestamp**: (Date) The date and time when the proposal was made.
- **reasoning**: (string, optional) Justification for the proposal.
- **supportingEvidence**: (any[], optional) Evidence supporting the proposal.

### ExpertiseDomain
- **domain**: (string) Name of the expertise domain.
- **proficiency**: (number) Proficiency level of the agent in the domain (0-1).
- **lastUpdated**: (Date) Timestamp of the last proficiency update.

### ConsensusConfig
- **consensusThreshold**: (ConsensusThreshold) Type of threshold for achieving consensus.
- **minParticipants**: (number) Minimum number of agents required to participate.
- **maxDecisionTime**: (number) Maximum time allotted for decision-making in milliseconds.
- **confidenceDecayRate**: (number) Rate at which confidence levels decay per hour.
- **expertiseWeightings**: (Record<string, number>) Weightings assigned to different expertise domains.
- **tieBreakingMethod**: (string) Method used for tie-breaking scenarios.
- **enableRealTimeUpdates**: (boolean) Flag to enable or disable real-time updates.

### ConsensusResult
- **decisionId**: (string) Unique identifier for the consensus decision.
- **selectedProposal**: (AgentProposal | null) The final selected proposal.
- **consensusReached**: (boolean) Indicates if consensus was achieved.
- **finalScore**: (number) Final score representing the consensus.
- **participantCount**: (number) Total number of participants in the voting.
- **votingResults**: (WeightedVote[]) Detailed results of the voting process.
- **dissentingOpinions**: (AgentProposal[]) List of dissenting proposals, if any.
- **decisionMetadata**: (DecisionMetadata) Metadata related to the decision process.
- **conflictResolution**: (ConflictResolution, optional) Strategy applied to resolve any conflicts.

## Return Values
The service returns a `ConsensusResult` object that encapsulates the outcome of the consensus decision and associated details.

## Examples
```typescript
// Example configuration for manual consensus decision-making
const config: ConsensusConfig = {
  consensusThreshold: 'supermajority',
  minParticipants: 3,
  maxDecisionTime: 300000,
  confidenceDecayRate: 0.1,
  expertiseWeightings: {
    'AI': 2,
    'Logic': 1
  },
  tieBreakingMethod: 'highest_confidence',
  enableRealTimeUpdates: true
};

// Example agent proposal
const proposal: AgentProposal = {
  agentId: 'agent123',
  proposalId: 'prop456',
  solution: { spendBudget: 1000 },
  confidenceScore: 0.85,
  expertiseDomains: [{ domain: 'Finance', proficiency: 0.9, lastUpdated: new Date() }],
  timestamp: new Date(),
  reasoning: "This budget allocation aligns with our strategic goals.",
  supportingEvidence: []
};

// Initiating the consensus process
const result: ConsensusResult = await multiAgentConsensusService.consensusDecision([proposal], config);
```

This documentation outlines the critical components and functionality of the Multi-Agent Consensus Decision Service, enhancing understanding and usability in automated decision-making applications.