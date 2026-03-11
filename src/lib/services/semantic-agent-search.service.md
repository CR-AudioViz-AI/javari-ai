# Create Semantic Agent Search Service

```markdown
# Semantic Agent Search Service

## Purpose

The Semantic Agent Search Service facilitates the search and retrieval of agent-related information using natural language queries. It utilizes OpenAI for text embeddings and supports efficient caching through Redis. The service allows users to find, compare agents, or browse categories based on their intents and specific query parameters.

## Usage

To utilize the Semantic Agent Search Service, initialize it with the necessary configuration parameters, then call the search method with the desired query.

### Initialization

```typescript
import { SemanticSearchService, SemanticSearchConfig } from './src/lib/services/semantic-agent-search.service';

const config: SemanticSearchConfig = {
  supabase_url: 'https://your-supabase-url',
  supabase_key: 'your-supabase-key',
  openai_api_key: 'your-openai-api-key',
  redis_url: 'redis://your-redis-url',
  embedding_model: 'text-embedding-ada-002',
  cache_ttl: 3600,
  similarity_threshold: 0.75,
  max_results: 10
};

const searchService = new SemanticSearchService(config);
```

### Performing a Search

```typescript
const query: SearchQuery = {
  query: 'Find AI agents specializing in data analysis',
  limit: 5,
  threshold: 0.8,
  category_filter: 'AI',
  tag_filter: ['data', 'analysis'],
  intent: SearchIntent.FIND_AGENT
};

const results: AgentSearchResult[] = await searchService.search(query);
```

## Parameters/Props

### SemanticSearchConfig
- **supabase_url**: string - URL for Supabase instance.
- **supabase_key**: string - API key for accessing Supabase.
- **openai_api_key**: string - API key for OpenAI.
- **redis_url**: string - URL for Redis instance.
- **embedding_model**: string (optional) - Model used for text embeddings, defaults to 'text-embedding-ada-002'.
- **cache_ttl**: number (optional) - Time-to-live for cache in seconds.
- **similarity_threshold**: number (optional) - Minimum similarity score for search results.
- **max_results**: number (optional) - Maximum number of search results to return.

### SearchQuery
- **query**: string - The search query string entered by the user.
- **limit**: number (optional) - Maximum number of results returned.
- **threshold**: number (optional) - Similarity threshold for results.
- **category_filter**: string (optional) - Filter results by specific category.
- **tag_filter**: string[] (optional) - Filter results by specific tags.
- **intent**: SearchIntent (optional) - Specify the intent of the search (e.g., FIND_AGENT).

## Return Values

The `search` method returns an array of `AgentSearchResult`. Each result contains the following fields:
- **id**: string - Unique identifier of the agent.
- **name**: string - Name of the agent.
- **description**: string - Brief description of the agent.
- **category**: string - Category associated with the agent.
- **tags**: string[] - Tags relevant to the agent.
- **similarity_score**: number - Score indicating how well the result matches the query.
- **relevance_score**: number - Score indicating the relevance of the result.
- **capabilities**: string[] - Capabilities of the agent.
- **rating**: number - User rating of the agent.
- **usage_count**: number - Count of how often the agent has been used.
- **created_at**: string - Timestamp of when the agent was created.
- **updated_at**: string - Timestamp of the last update.

## Examples

### Example Query to Find Agents

```typescript
const query = {
  query: 'Compare data science agents',
  intent: SearchIntent.COMPARE_AGENTS
};

const results = await searchService.search(query);
console.log(results);
```

This example demonstrates how to query the service to compare agents within the data science domain.
```