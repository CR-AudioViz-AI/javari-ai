# Build Brand Sponsorship Matching API

```markdown
# Brand Sponsorship Matching API

## Purpose
The Brand Sponsorship Matching API is designed to facilitate the matching of creators with brands based on shared criteria such as audience demographics, budget range, and content categories. This API allows brands to find suitable creators for their sponsorship campaigns and helps creators connect with brands that align with their audience and content.

## Usage
This API handles requests for matching creators with brands and updating the status of sponsorship matches.

### Endpoints
- **POST /api/sponsorship-matching**: Match creators with brands based on specified criteria.
- **PUT /api/sponsorship-matching/:id**: Update the status of a specific sponsorship match.

## Parameters / Props

### Matching Request Parameters
The request body for matching creators with brands should conform to the following schema:
- `creatorId` (string, uuid): Unique identifier of the creator.
- `includeInactive` (boolean, optional): Whether to include inactive brands; defaults to `false`.
- `minBudget` (number, optional): Minimum budget range for the match.
- `maxBudget` (number, optional): Maximum budget range for the match.
- `contentCategories` (array of strings, optional): List of content categories for filtering.
- `audienceAgeRange` (object, optional): Age range of the audience.
  - `min` (number): Minimum age (must be between 13 and 65).
  - `max` (number): Maximum age (must be between 13 and 65).

### Status Update Parameters
The request body for updating the match status should conform to the following schema:
- `status` (string): The status of the match; must be one of `'pending'`, `'accepted'`, `'declined'`, `'completed'`, or `'cancelled'`.
- `notes` (string, optional): Any additional notes regarding the status change.

## Return Values
The response from the matching endpoint will include a list of sponsorship matches. Each match object will have the following structure:
- `id` (string): Unique identifier for the match.
- `creator_id` (string): ID of the matched creator.
- `brand_id` (string): ID of the matched brand.
- `compatibility_score` (number): Score representing overall compatibility.
- `audience_overlap_score` (number): Score for audience overlap.
- `engagement_score` (number): Score based on engagement metrics.
- `content_alignment_score` (number): Score based on content alignment.
- `budget_fit_score` (number): Score indicating budget fit.
- `status` (string): Current status of the match.
- `match_reasons` (array of strings): Reasons for the match.
- `estimated_budget` (number): Estimated budget for the sponsorship.
- `created_at` (string): Timestamp of match creation.

## Examples

### Matching Request Example
```json
{
  "creatorId": "a3bb189e-8bf9-488d-b067-8b11d1b61b65",
  "includeInactive": true,
  "minBudget": 500,
  "maxBudget": 5000,
  "contentCategories": ["technology", "lifestyle"],
  "audienceAgeRange": {
    "min": 18,
    "max": 35
  }
}
```

### Status Update Example
```json
{
  "status": "accepted",
  "notes": "Looking forward to collaborating!"
}
```
```