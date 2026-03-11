# Build Semantic Agent Discovery Service

# Semantic Agent Discovery Service

## Purpose
The `SemanticAgentDiscoveryService` provides an advanced semantic search capability for discovering AI agents. It leverages vector embeddings and contextual analysis to intelligently match agents based on user queries, capabilities, tags, and other criteria.

## Usage
To utilize the `SemanticAgentDiscoveryService` for discovering agents, you must first instantiate the service with the required configurations. The service can then be used to perform searches and retrieve relevant agent data.

### Example
```typescript
import { SemanticAgentDiscoveryService, SemanticSearchConfig } from './services/semantic-agent-discovery.service';

// Configuration for the service
const config: SemanticSearchConfig = {
  openaiApiKey: 'YOUR_OPENAI_API_KEY',
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseKey: 'YOUR_SUPABASE_KEY',
  vectorDimensions: 512,
  similarityThreshold: 0.7,
  maxResults: 10,
  cacheTtl: 300,
};

// Instantiate the service
const agentDiscoveryService = new SemanticAgentDiscoveryService(config);

// Perform a search
const results = await agentDiscoveryService.search({
  query: 'natural language processing',
  userId: 'user123',
});
console.log(results);
```

## Parameters/Props

### `SemanticSearchConfig`
The configuration object required to initialize the service:
- **openaiApiKey**: string - The API key for OpenAI services.
- **supabaseUrl**: string - The URL for Supabase service.
- **supabaseKey**: string - The API key for Supabase service.
- **vectorDimensions**: number - The dimensions of the vector embeddings used for searches.
- **similarityThreshold**: number - The minimum similarity score for considered results.
- **maxResults**: number - The maximum number of results to return.
- **cacheTtl**: number - Time to live for cached results in seconds.

### `SearchQueryParams`
Parameters for the search query:
- **query**: string - The search query string.
- **userId**: string (optional) - Identifier for the user making the request.
- **capabilities**: string[] (optional) - List of specific capabilities to filter agents.
- **tags**: string[] (optional) - Tags associated with the desired agents.
- **maxResults**: number (optional) - Overrides the `maxResults` from config for this search.
- **minSimilarity**: number (optional) - Overrides the `similarityThreshold` from config for this search.
- **includeInactive**: boolean (optional) - Whether to include inactive agents in the results.

## Return Values
The `search` method will return an array of `AgentSearchResult` objects, each containing:
- **agent**: Agent - The matched agent instance.
- **similarity**: number - The calculated similarity score.
- **capabilityMatch**: number - The degree of capability match.
- **contextualScore**: number - The contextual relevance score.
- **finalScore**: number - The overall score based on various metrics.
- **matchedCapabilities**: string[] - List of matched capabilities for the agent.
- **reasoning**: string - Explanation of why the agent was matched.

## Additional Interfaces
### `AgentSearchResult`
Describes the structure of search results with scoring details.

### `SearchAnalytics`
Captures analytics data relevant to the search execution.

### `AgentMetadata`
Contains metadata related to the agent, including capabilities and descriptions.

---

This documentation should provide a comprehensive overview of the `SemanticAgentDiscoveryService`, including its purpose, how to use it, the required parameters, and the expected return values.