# Build Marketplace Agent Review and Rating System

# Marketplace Agent Review and Rating System

## Purpose
The Marketplace Agent Review and Rating System is designed to enable users to submit reviews and ratings for agents within a marketplace platform. The system facilitates the management, filtering, and visualization of reviews, helping potential customers assess agent performance based on user feedback.

## Usage
This system allows users to interact with agent reviews through displaying information, submitting new reviews, and filtering existing ones. The component handles visual elements for ratings and incorporates moderation functionalities.

## Parameters/Props

### Review
Represents an individual review entry with the following properties:
- `id` (string): Unique identifier for the review.
- `agent_id` (string): Identifier for the reviewed agent.
- `user_id` (string): Identifier of the user who submitted the review.
- `rating` (number): Rating given to the agent (e.g., 1-5 scale).
- `content` (string): Text content of the review.
- `sentiment_score` (number): Score reflecting the sentiment of the review.
- `status` ('pending' | 'approved' | 'rejected' | 'flagged'): Status of the review.
- `verified` (boolean): Indicates if the review is from a verified user.
- `helpful_count` (number): Count of users who found the review helpful.
- `not_helpful_count` (number): Count of users who found the review not helpful.
- `created_at` (string): Timestamp for when the review was created.
- `updated_at` (string): Timestamp for the last update to the review.
- `user` (object): Information about the user, including:
  - `id` (string): User ID.
  - `username` (string): User's display name.
  - `avatar_url` (string, optional): URL to user’s avatar image.
- `agent` (object): Information about the agent, including:
  - `id` (string): Agent ID.
  - `name` (string): Agent's name.
  - `category` (string): Category of service provided by the agent.

### AgentStats
Provides statistical information on agent reviews:
- `agent_id` (string): ID of the agent.
- `total_reviews` (number): Total number of reviews for the agent.
- `average_rating` (number): Average rating score.
- `rating_distribution` (object): Distribution of ratings.
- `sentiment_breakdown` (object): Count of sentiments (positive, neutral, negative).
- `verified_percentage` (number): Percentage of verified reviews.

### ReviewFilters
Dimensionality for review filtering:
- `rating` (number, optional): Filter by rating score.
- `sentiment` ('positive' | 'neutral' | 'negative', optional): Filter by sentiment type.
- `verified` (boolean, optional): Filter by verified status of reviews.
- `dateRange` ('week' | 'month' | 'year' | 'all', optional): Filter by date range.
- `sortBy` ('newest' | 'oldest' | 'rating_high' | 'rating_low' | 'helpful', optional): Sorting preference for reviews.

### ModerationAction
Specifies actions taken by moderators:
- `id` (string): Unique identifier for the moderation action.
- `review_id` (string): ID of the reviewed entry.
- `moderator_id` (string): ID of the moderator performing the action.
- `action` ('approve' | 'reject' | 'flag' | 'verify'): Type of action taken.
- `reason` (string, optional): Reason for the action.
- `created_at` (string): Timestamp of when the action was taken.

### RatingDisplay Component
Displays the rating with the following props:
- `rating` (number): Numerical rating value.
- `size` ('sm' | 'md' | 'lg', optional): Size of the display.
- `showValue` (boolean, optional): Flag to show numerical rating.
- `interactive` (boolean, optional): Enable or disable user interaction for changing rating.
- `onChange` (function, optional): Callback function triggered on rating change.

## Examples
```tsx
<RatingDisplay 
  rating={4} 
  size="md" 
  showValue={true} 
  interactive={true} 
  onChange={(newRating) => console.log(newRating)} 
/>
```

This code renders a RatingDisplay component that shows a 4-star rating, allows user interaction, and logs the new rating when changed.