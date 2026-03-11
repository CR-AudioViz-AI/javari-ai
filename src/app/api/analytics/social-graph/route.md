# Create Advanced Social Graph Analytics API

# Advanced Social Graph Analytics API

## Purpose
The Advanced Social Graph Analytics API provides a set of endpoints to perform in-depth analyses of social interactions within a network. It allows users to derive insights on influence, community structures, and relationships based on user activities over defined time ranges.

## Usage
This API is designed for integration into applications that require advanced analytics on social networks. It supports querying various types of analyses while utilizing caching for performance and efficiency.

## Parameters/Props

### Query Parameters
- `analysis_type` (string, optional): Specifies the type of analysis to perform. Possible values are:
  - `influence`: Analyze influence metrics.
  - `communities`: Identify community structures.
  - `relationships`: Evaluate direct relationships.
  - `full`: Provide comprehensive analysis. Defaults to `full`.

- `user_ids` (string, optional): Comma-separated user IDs to limit the analysis scope.

- `time_range` (string, optional): The period over which to analyze interactions. Possible values include:
  - `24h`: Last 24 hours
  - `7d`: Last 7 days
  - `30d`: Last 30 days
  - `90d`: Last 90 days
  - `1y`: Last year. Defaults to `30d`.

- `min_interactions` (string, optional): Minimum number of interactions a user must have to be included in the analysis. Defaults to `5`.

- `include_visualization` (string, optional): Flag indicating whether to include graphical visualizations in the response. Converts to a boolean. Defaults to `false`.

- `community_algorithm` (string, optional): The algorithm to use for community detection. Possible values:
  - `modularity`: Modularity-based clustering.
  - `leiden`: Leiden algorithm.
  - `louvain`: Louvain method. Defaults to `modularity`.

- `max_nodes` (string, optional): Maximum number of nodes to include in the analysis. Converts to a number. Defaults to `1000`.

## Return Values
The API returns a JSON object containing the results of the requested analysis based on the supplied parameters. The structure varies according to the `analysis_type`, but common components include:

- **GraphNode**: Represents nodes in the graph, including properties like user statistics and metrics.
- **GraphEdge**: Represents connections between nodes with attributes for interaction and relationship strength.
- **Community**: Contains details about detected communities, including member nodes and cohesion metrics.

## Examples

### Example Request
```http
GET /api/analytics/social-graph?analysis_type=influence&user_ids=1,2,3&time_range=30d
```
### Example Response
```json
{
  "nodes": [
    {
      "id": "1",
      "label": "User 1",
      "weight": 10,
      "properties": {
        "user_id": "1",
        "username": "user1",
        "avatar_url": "http://example.com/avatar1.png",
        "join_date": "2022-01-01",
        "total_interactions": 200,
        "influence_score": 85,
        "betweenness_centrality": 0.5,
        "closeness_centrality": 0.8,
        "degree_centrality": 10,
        "page_rank": 0.7,
        "community_id": "community_1"
      }
    }
  ],
  "edges": [],
  "communities": []
}
```

### Notes
Ensure that the API keys and necessary environment variables are set up correctly to access the Supabase and Redis clients.