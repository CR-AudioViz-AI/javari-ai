# Create Personalized Agent Recommendation Service

# Personalized Agent Recommendation Service

## Purpose
The Personalized Agent Recommendation Service aims to provide tailored recommendations for agents based on user interactions and preferences. It leverages user behavior analysis, agent performance metrics, and metadata to generate relevant suggestions.

## Usage
To utilize the recommendation engine, you need to create an instance of the service and invoke the recommendation method with appropriate parameters. The service processes user data to generate agent suggestions that best fit the user's needs.

## Parameters/Props

### Request Parameters
- **`userId`**: `string` (Required) - Unique identifier for the user requesting recommendations.
- **`limit`**: `number` (Optional) - Maximum number of agents to recommend. Default is 5.
- **`excludeAgentIds`**: `string[]` (Optional) - List of agent IDs to exclude from the recommendations.
- **`contextTags`**: `string[]` (Optional) - Tags that provide additional context for the recommendation.
- **`minConfidence`**: `number` (Optional) - Minimum confidence score for recommended agents. Default is 0.5.
- **`includeExplanations`**: `boolean` (Optional) - Flag to include detailed explanations for each recommendation. Default is false.

### Return Values
The service returns an array of recommendation results with the following structure:
- **`agentId`**: `string` - ID of the recommended agent.
- **`score`**: `number` - Overall score representing the quality of the recommendation.
- **`confidence`**: `number` - Confidence level of the recommendation.
- **`explanation`**: `string` - Text explaining why the recommendation was made.
- **`reasoning`**: `object` - Breakdown of the scoring factors including:
  - **`collaborativeScore`**: `number` - Score based on collaborative filtering.
  - **`contentScore`**: `number` - Score based on content-related factors.
  - **`performanceScore`**: `number` - Score based on agent performance metrics.
  - **`recencyScore`**: `number` - Score based on the recency of user interactions.
- **`metadata`**: `AgentMetadata` - Additional information about the recommended agent.

## Examples

### Basic Recommendation Request
```typescript
const recommendationService = new RecommendationEngine();
const recommendations = recommendationService.getRecommendations({
  userId: 'user123',
  limit: 5,
});
```

### Request with Context and Exclusions
```typescript
const recommendations = recommendationService.getRecommendations({
  userId: 'user456',
  limit: 3,
  excludeAgentIds: ['agent789'],
  contextTags: ['finance', 'AI'],
  minConfidence: 0.75,
  includeExplanations: true,
});
```

### Handling Recommendations
```typescript
recommendations.forEach(rec => {
  console.log(`Recommended Agent: ${rec.metadata.name}`);
  console.log(`Score: ${rec.score}`);
  if (rec.includeExplanations) {
    console.log(`Explanation: ${rec.explanation}`);
  }
});
```

This service offers a versatile approach to personalizing agent suggestions, enhancing user experience through relevance and context-awareness.