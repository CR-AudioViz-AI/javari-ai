# Implement Community Reputation Scoring API

# Community Reputation Scoring API Documentation

## Purpose
The Community Reputation Scoring API calculates the reputation score of a user based on their contributions to a community. It allows for configurable scoring through weighting of contribution quality, helpfulness, and engagement over specified timeframes.

## Usage
The API supports two endpoints for scoring:
1. Single user score calculation: Accepts a user ID and other parameters to compute their reputation score.
2. Batch user score calculation: Accepts an array of user IDs to compute their reputation scores in one request.

## Parameters/Props

### Score Request Parameters
- `userId` (string, required): The UUID of the user whose score is to be calculated.
- `timeframe` (enum, optional): The period for which the score is calculated, can be '7d', '30d', '90d', '1y', or 'all'. Defaults to '30d'.
- `weightingConfig` (object, optional):
  - `contributionQuality` (number, optional): Weight of the contribution quality (0 to 1), defaults to 0.4.
  - `helpfulness` (number, optional): Weight of helpfulness (0 to 1), defaults to 0.3.
  - `engagement` (number, optional): Weight of engagement (0 to 1), defaults to 0.3.
- `includeHistory` (boolean, optional): If true, includes historical data in calculations. Defaults to false.
- `detectBias` (boolean, optional): If true, checks for biases in the reputation metrics. Defaults to true.

### Batch Score Request Parameters
- `userIds` (array of strings, required): List of UUIDs for users.
- `timeframe` (enum, optional): Same options as above with a default of '30d'.
- `weightingConfig` (object, required): The same weighting configuration as in the single score request.
- `detectBias` (boolean, optional): Same functionality as in the single score request.

## Return Values

### Reputation Score
- `userId` (string): The ID of the user.
- `overallScore` (number): The computed overall reputation score.
- `dimensionScores` (object): Scores for each dimension (e.g., contribution quality, helpfulness, engagement).
- `rawMetrics` (ReputationMetrics): Detailed metrics underlying the scores.
- `biasDetection` (BiasDetectionResult, optional): Details on any detected biases.
- `calculatedAt` (string): Timestamp of when the score was calculated.
- `timeframe` (string): The timeframe for which the score was calculated.
- `rank` (number, optional): Rank of the user within a specified context (if applicable).

## Examples

### Single User Score Request
```typescript
const singleScore = await calculateReputationScore({
  userId: '123e4567-e89b-12d3-a456-426614174000',
  timeframe: '30d',
  weightingConfig: {
    contributionQuality: 0.5,
    helpfulness: 0.3,
    engagement: 0.2
  },
  includeHistory: true,
  detectBias: true
});
```

### Batch User Score Request
```typescript
const batchScore = await calculateBatchReputationScore({
  userIds: [
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001'
  ],
  timeframe: '7d',
  weightingConfig: {
    contributionQuality: 0.4,
    helpfulness: 0.4,
    engagement: 0.2
  },
  detectBias: true
});
```

This API provides a flexible way to assess user reputation within a community based on configurable parameters and temporal considerations.