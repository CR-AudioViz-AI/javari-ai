# Create Advanced Agent Discovery Service

```markdown
# Advanced Agent Discovery Service

## Purpose
The Advanced Agent Discovery Service is designed to facilitate the discovery of agents based on user personalized preferences and various search filters. It leverages machine learning and data aggregation to provide relevant agent recommendations, enhancing user experience by matching agents with user needs efficiently.

## Usage
This service can be used in applications that require agent discovery based on various attributes like category, price, rating, and personalized user context. The output consists of a ranked list of agents along with their relevance scores.

## Parameters / Props

### AgentSearchFilters
This interface defines the optional search criteria for agent discovery.

- **categories** (string[]): An array of agent categories to filter by.
- **priceRange** (object): An object specifying the minimum and maximum price.
  - `min`: (number) Minimum price.
  - `max`: (number) Maximum price.
- **rating** (object): An object specifying the minimum and maximum rating.
  - `min`: (number) Minimum rating.
  - `max`: (number) Maximum rating.
- **features** (string[]): List of desired features.
- **languages** (string[]): Allowed languages.
- **availability** ('online' | 'offline' | 'both'): Availability status of agents.

### UserContext
Information about the user to provide personalized recommendations.

- **recentSearches** (string[]): The user's recent search queries.
- **preferredCategories** (string[]): Categories preferred by the user.
- **budgetRange** (object): User's budget limits.
  - `min`: (number) Minimum budget.
  - `max`: (number) Maximum budget.
- **industryFocus** (string[]): Industries of interest.
- **usagePatterns** (object): Patterns of agent usage.
  - `frequency`: ('low' | 'medium' | 'high') How often the user interacts with agents.
  - `timeOfDay`: (string[]): Preferred times for usage.
  - `sessionDuration`: (number) Average session duration.

### RecommendationResult
Results returned from the recommendation engine.

- **agents** (AgentSearchResult[]): List of agents recommended for the user.
- **reasoning** (object): 
  - `personalizedFactors`: (string[]) Factors affecting personalization.
  - `trendingFactors`: (string[]) Current trends influencing choices.
  - `similarUserFactors`: (string[]) Preferences of similar users.
- **confidence** (number): Confidence score of the recommendation.

## Return Values
The service returns a structured grid of recommendations that includes:
- A list of agents along with their ranking details,
- Reasoning behind the recommendations to enhance user trust,
- A numerical confidence metric to indicate the recommendation's reliability.

## Examples

### Example Search Filters
```typescript
const searchFilters: AgentSearchFilters = {
  categories: ['consultant', 'developer'],
  priceRange: { min: 50, max: 200 },
  rating: { min: 4.5 },
  languages: ['English', 'Spanish']
};
```

### Example User Context
```typescript
const userContext: UserContext = {
  recentSearches: ['SEO expert', 'full-stack developer'],
  preferredCategories: ['developer'],
  budgetRange: { min: 100, max: 150 },
  usagePatterns: { frequency: 'medium', timeOfDay: ['afternoon'], sessionDuration: 30 }
};
```

### Example Recommendation Result
```typescript
const recommendationResult: RecommendationResult = {
  agents: [
    {
      agent: {
        id: '1',
        name: 'Sam the Developer',
        description: 'Expert in full-stack development',
        capabilities: ['React', 'Node.js'],
        category: 'developer',
        price: 120,
        rating: 4.8,
        features: ['online', 'fast'],
        languages: ['English'],
        tags: ['developer', 'freelancer'],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      relevanceScore: 0.95,
      capabilityMatch: 0.9,
      personalizedScore: 0.92,
      reasons: ['Matches user frequency', 'Top rating']
    }
  ],
  reasoning: {
    personalizedFactors: ['recently searched for developers'],
    trendingFactors: ['increasing demand for full-stack developers'],
    similarUserFactors: ['similar users preferred this agent']
  },
  confidence: 0.93
};
```
```