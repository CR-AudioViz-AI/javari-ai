# Build Agent Review and Rating System

```markdown
# AgentReviewSystem Component Documentation

## Purpose
The `AgentReviewSystem` component is designed for creating an interactive review and rating system for marketplace agents. It includes features such as sentiment analysis, usage verification, and various filters to assist users in evaluating agents based on reviews.

## Usage
To utilize the `AgentReviewSystem`, import it into your desired React component and provide the required `agentId` prop. Optionally, you can also pass a `className` prop to customize the styling.

```tsx
import AgentReviewSystem from 'src/components/marketplace/agent-reviews/AgentReviewSystem';

const MyMarketplacePage = () => {
  return (
    <AgentReviewSystem agentId="agent123" className="custom-class" />
  );
};
```

## Parameters / Props

### `AgentReviewSystemProps`
- `agentId` (string, required): The unique identifier for the agent being reviewed.
- `className` (string, optional): Additional CSS classes to apply to the component.

## Return Values
The `AgentReviewSystem` component does not return explicit values but rather renders a user interface containing:
- A review submission form.
- An interactive display of reviews including ratings, titles, content, and user information.
- Statistical insights about ratings and sentiments related to the agent.

## Interfaces
The following interfaces define data structures within the component:

### `Review`
Represents a single review with the following properties:
- `id`: (string) Unique identifier for the review.
- `agent_id`: (string) ID of the reviewed agent.
- `user_id`: (string) ID of the user who submitted the review.
- `rating`: (number) Rating score given to the agent (1 to 5).
- `title`: (string) Title of the review.
- `content`: (string) Content of the review body.
- `sentiment_score`: (number) Score representing sentiment analysis.
- `sentiment_label`: ('positive' | 'neutral' | 'negative') Describes the overall sentiment.
- `usage_verified`: (boolean) Indicates if the usage of the agent is verified.
- `usage_hours`: (number) Duration of agent's usage by the reviewer.
- `helpful_count`: (number) Count of users finding the review helpful.
- `flagged_count`: (number) Count of reports against the review.
- `status`: ('published' | 'pending' | 'hidden' | 'removed') Current status of the review.
- `created_at`: (string) Timestamp of creation.
- `updated_at`: (string) Timestamp of last update.
- `user_profile`: (optional) Contains user info such as `username`, `avatar_url`, and `is_verified`.

### `AgentRating`
Handles statistical summaries for the agent:
- `average_rating`: (number) Average rating score across all reviews.
- `total_reviews`: (number) Total number of reviews submitted.
- `rating_distribution`: (object) Distribution of ratings from 1 to 5.
- `sentiment_distribution`: (object) Count distribution for sentiments.

### `ReviewFormData`
Structure for the review submission form:
- `rating`: (number) Rating score.
- `title`: (string) Title of the review.
- `content`: (string) Body of the review.
- `usage_hours`: (number) Number of hours the agent was used.

### `ReviewFilters`
Data structure for filtering reviews:
- `rating`: (number, optional) Specific rating to filter by.
- `sentiment`: ('positive' | 'neutral' | 'negative', optional) Sentiment filter.
- `verified_only`: (boolean) Flag for verified users only.
- `sort_by`: ('newest' | 'oldest' | 'rating_high' | 'rating_low' | 'helpful') Sorting criteria.
- `search`: (string, optional) Search term for reviews.

## Examples
### Submitting a Review
The component provides an integrated form to submit a review, including fields for rating, title, content, and usage duration.

### Filtering Reviews
Users can filter reviews based on rating, sentiment, verification status, sorting criteria, and search terms to tailor their experience.

By following this documentation, you can effectively integrate and utilize the `AgentReviewSystem` within your React applications.
```