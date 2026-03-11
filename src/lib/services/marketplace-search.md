# Build Advanced Marketplace Search Engine

```markdown
# Marketplace Search Engine

## Purpose
The Marketplace Search Engine provides advanced search capabilities for a marketplace application. It uses Elasticsearch for indexing and searching products while offering extensive filtering and sorting options to help users find relevant items.

## Usage
To use this service, initialize it with the appropriate configuration, including Elasticsearch and, optionally, Redis and OpenAI API settings. This setup enables the effective querying and indexing of marketplace items.

## Configuration Parameters
The following configuration parameters are required when initializing the search engine.

### `SearchConfig`
- **elasticsearch**: Configuration for Elasticsearch.
  - `node`: URL of the Elasticsearch node.
  - `auth`: Authentication details.
    - `username`: Username for Elasticsearch.
    - `password`: Password for Elasticsearch.
  - `index`: The name of the Elasticsearch index to use for searching.
  
- **redis** (optional): Redis instance for caching.
- **openai** (optional): Configuration for OpenAI integration.
  - `apiKey`: API key for OpenAI services.
  - `embeddingModel`: Model used for generating embeddings.

## Query Parameters
The search engine accepts various parameters to refine search results.

### `SearchQuerySchema`
- **query**: (string) Search string (1-500 characters).
- **filters**: (object) Optional filters for refining the search.
  - **categories**: (array of strings) Categories to filter by.
  - **priceRange**: (object) Price filter.
    - `min`: Minimum price (optional).
    - `max`: Maximum price (optional).
  - **sellers**: (array of strings) Seller IDs to filter by.
  - **condition**: (enum) Item condition (new, used, refurbished).
  - **availability**: (enum) Item availability (in_stock, pre_order, out_of_stock).
  - **tags**: (array of strings) Tags to filter by.
  
- **sort**: (object) Sorting options.
  - **field**: (enum) Field to sort by (relevance, price, popularity, created_at, rating).
  - **order**: (enum) Sort order (asc, desc).
  
- **pagination**: (object) Pagination settings.
  - **page**: (number) Page number, defaults to 1.
  - **limit**: (number) Number of results per page, defaults to 20 (max 100).
  
- **semantic**: (boolean) Enable semantic search (defaults to false).

## Return Values
The search engine returns a structured result set containing marketplace items matching the query and applied filters.

### Example Search Result Interface
- `id`: Item identifier.
- `title`: Item title.
- `description`: Item description.
- `price`: Item price.
- `currency`: Currency of the price.
- Other marketplace item attributes as defined in the `MarketplaceItem` interface.

## Examples

### Example Configuration
```typescript
const config: SearchConfig = {
  elasticsearch: {
    node: 'http://localhost:9200',
    auth: {
      username: 'user',
      password: 'password'
    },
    index: 'products'
  },
  redis: new Redis(),
  openai: {
    apiKey: 'your-api-key',
    embeddingModel: 'text-embedding-model'
  }
};
```

### Example Search Query
```typescript
const searchQuery = {
  query: "laptop",
  filters: {
    priceRange: { min: 500, max: 2000 },
    condition: 'new',
    tags: ["gaming", "portable"]
  },
  sort: {
    field: 'price',
    order: 'asc'
  },
  pagination: {
    page: 1,
    limit: 10
  },
  semantic: true
};
```
```