# Deploy Semantic Agent Search Microservice

# Semantic Agent Search Microservice

## Purpose
The **Semantic Agent Search Microservice** provides advanced vector-based semantic search capabilities specifically designed for efficient agent discovery. Leveraging OpenAI embeddings, this service supports multi-language processing and implements context-aware ranking algorithms to enhance search result relevance.

## Usage
To utilize the `SemanticAgentSearchService`, instantiate it with the required configuration parameters and invoke the `search` method with a search query and optional filters.

### Example
```typescript
const searchService = new SemanticAgentSearchService({
  openaiApiKey: '<YOUR_OPENAI_API_KEY>',
  supabaseUrl: '<YOUR_SUPABASE_URL>',
  supabaseKey: '<YOUR_SUPABASE_KEY>',
  redisUrl: '<YOUR_REDIS_URL>'
});

const results = await searchService.search({
  query: "AI agent for data analysis",
  language: "en",
  filters: { category: "analytics" },
  limit: 10
});
```

## Parameters/Props

### Constructor
```typescript
constructor(config: {
  openaiApiKey: string;  // API key for OpenAI
  supabaseUrl: string;   // URL for Supabase instance
  supabaseKey: string;   // Service role key for Supabase
  redisUrl: string;      // URL for Redis instance
});
```

### `search` Method
```typescript
async search(request: SemanticSearchRequest): Promise<SemanticSearchResponse>;
```

#### Parameters
- **request**: An object containing the following properties:
  - `query`: (string) The search query string.
  - `language`: (LanguageCode) The language code for query processing (e.g., "en").
  - `filters`: (SearchFilters) Optional filters to refine search results (e.g., category).
  - `limit`: (number) Maximum number of results to return (e.g., 10).

### Return Values
- Returns a `Promise<SemanticSearchResponse>` which contains:
  - `results`: (SearchResult[]) An array of search results matching the query.
  - `context`: (SearchContext) Metadata about the search context, if applicable.
  - `totalCount`: (number) Total number of results available for the given query.

## Features
- **Vector similarity search** leveraging the pgvector extension for PostgreSQL.
- **Multi-language support** for processing queries in different languages.
- **Context-aware ranking** utilizing hybrid scoring mechanisms.
- **Redis caching** for efficient storage and retrieval of embeddings and results.
- **Real-time agent metadata enrichment** to provide up-to-date information about agents.

This microservice is designed for scalability and adaptability, making it suitable for various agent discovery applications.