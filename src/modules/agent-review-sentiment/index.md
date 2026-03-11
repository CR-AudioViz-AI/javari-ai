# Build Agent Review Sentiment Analysis Module

```markdown
# Agent Review Sentiment Analysis Module

## Purpose

The Agent Review Sentiment Analysis Module analyzes agent reviews using transformer models to categorize feedback and identify improvement opportunities for agent creators. It provides insights into customer sentiment, common themes, and actionable improvement suggestions based on aggregated review data.

## Usage

The module can be imported and used within a React application to fetch, analyze, and display agent review sentiments. 

### Importing the Module

```typescript
import { analyzeReviews, getSentimentAnalytics } from 'src/modules/agent-review-sentiment';
```

### Example Usage

```typescript
// Analyzing a single review
const singleReview = {
  id: '1',
  agent_id: 'agent-123',
  user_id: 'user-456',
  rating: 4,
  comment: 'Great experience!',
  created_at: '2023-10-01T12:34:56Z',
  updated_at: '2023-10-01T12:34:56Z'
};

const sentimentResult = await analyzeReviews(singleReview);

// Fetching analytics for an agent
const sentimentAnalytics = await getSentimentAnalytics('agent-123');
```

## Parameters / Props

### Review Interface

```typescript
interface Review {
  id: string;          // Unique identifier for the review
  agent_id: string;   // Identifier for the agent being reviewed
  user_id: string;    // Identifier for the user submitting the review
  rating: number;     // Rating provided by the user (1-5 scale)
  comment: string;    // Text comment of the user's review
  created_at: string; // Timestamp when the review was created
  updated_at: string; // Timestamp when the review was last updated
}
```

### SentimentResult Interface

```typescript
interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral'; // Analyzed sentiment of the review
  confidence: number;                              // Confidence score of the sentiment prediction
  emotions: {                                      // Emotion scores
    joy: number;
    anger: number;
    fear: number;
    sadness: number;
    surprise: number;
    disgust: number;
  };
  aspects: {                                       // Performance metrics
    performance: number;
    usability: number;
    features: number;
    support: number;
  };
}
```

### ImprovementSuggestion Interface

```typescript
interface ImprovementSuggestion {
  category: string;          // Category of improvement
  priority: 'high' | 'medium' | 'low'; // Importance level of the suggestion
  description: string;       // Description of the suggestion
  actionable_steps: string[]; // Steps to address the improvement
  impact_score: number;      // Expected impact score of the suggestion
}
```

## Return Values

- `analyzeReviews(review: Review): Promise<ProcessedReview>`: Processes the given review, returning a `ProcessedReview` that includes sentiment analysis results.
- `getSentimentAnalytics(agent_id: string): Promise<SentimentAnalytics>`: Returns aggregated sentiment analytics for the specified agent, including counts, trends, and common themes.

### Example Output

```typescript
// ProcessedReview Output
{
  id: '1',
  agent_id: 'agent-123',
  user_id: 'user-456',
  rating: 4,
  comment: 'Great experience!',
  created_at: '2023-10-01T12:34:56Z',
  updated_at: '2023-10-01T12:34:56Z',
  sentiment_result: {
    sentiment: 'positive',
    confidence: 0.95,
    emotions: { joy: 0.8, anger: 0.1, fear: 0.05, sadness: 0.02, surprise: 0.03, disgust: 0.0 },
    aspects: { performance: 0.9, usability: 0.8, features: 0.7, support: 0.6 }
  },
  processed_at: '2023-10-01T12:45:00Z'
}
```

## Conclusion

The Agent Review Sentiment Analysis Module enables creators to gain deep insights into customer feedback, helping to enhance agent performance and improve user satisfaction.
```