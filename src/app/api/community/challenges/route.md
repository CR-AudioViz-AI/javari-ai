# Generate Community Challenge Management API

# Community Challenge Management API

## Purpose
The Community Challenge Management API provides endpoints to create, update, and retrieve challenges within a community. It allows users to manage and participate in challenges that include various attributes such as difficulty, categories, judging criteria, and submission handling.

## Usage
This API is built using Next.js and Supabase, and it is intended to be used in community-driven applications where audio/visual challenges are a core feature. 

## Endpoints
- **POST /api/community/challenges**: Create a new challenge.
- **PATCH /api/community/challenges/[id]**: Update an existing challenge.
- **GET /api/community/challenges**: Retrieve all challenges.
- **GET /api/community/challenges/[id]**: Retrieve a specific challenge by ID.

## Parameters/Props
### Challenge Object
- `id` (string): Unique identifier for the challenge.
- `title` (string): Title of the challenge (3-200 characters).
- `description` (string): Description of the challenge (10-2000 characters).
- `category` (string): Category of the challenge (2-50 characters).
- `difficulty` (enum): Difficulty level (`beginner`, `intermediate`, `advanced`).
- `start_date` (string): Challenge start date in ISO 8601 format.
- `end_date` (string): Challenge end date in ISO 8601 format.
- `max_participants` (number): Maximum number of participants (1-10000).
- `prize_pool` (number): Total prize pool for the challenge (0 or greater).
- `status` (enum): Status of the challenge (`draft`, `active`, `judging`, `completed`, `cancelled`).
- `judging_criteria` (array): Array of JudgingCriteria objects.
- `rules` (array): Array of rules for the challenge (minimum 5 characters each).

### JudgingCriteria Object
- `name` (string): Name of the criterion (2-100 characters).
- `weight` (number): Weight of the criterion (0.1-1).
- `description` (string): Description of the criterion (5-500 characters).
- `automated` (boolean): Indicates whether the criterion is automated.

### Submission Object
- `id` (string): Unique identifier for the submission.
- `challenge_id` (string): ID of the associated challenge.
- `user_id` (string): ID of the user who made the submission.
- `title` (string): Title of the submission.
- `description` (string): Description of the submission.
- `audio_url` (string): URL to the audio file.
- `visualization_url` (string): URL to the visualization related to the audio.
- `metadata` (object): Additional metadata for the submission.
- `scores` (object): Scores keyed by judging criteria.
- `total_score` (number): Total score of the submission.
- `submitted_at` (string): Submission timestamp in ISO format.

## Return Values
- For a successful creation or update, the API returns a response containing the created or updated Challenge object.
- For retrieval requests, the API returns an array of Challenge objects or a single Challenge object if an ID is specified.

## Examples
### Create Challenge
```json
POST /api/community/challenges
{
  "title": "Weekly Coding Challenge",
  "description": "A fun challenge to improve coding skills weekly.",
  "category": "Coding",
  "difficulty": "intermediate",
  "start_date": "2023-10-01T00:00:00Z",
  "end_date": "2023-10-07T00:00:00Z",
  "max_participants": 50,
  "prize_pool": 1000,
  "judging_criteria": [
    {
      "name": "Creativity",
      "weight": 0.5,
      "description": "How unique the solution is.",
      "automated": false
    },
    {
      "name": "Performance",
      "weight": 0.5,
      "description": "Efficiency of the code.",
      "automated": true
    }
  ],
  "rules": ["Must be original work.", "Share code publicly."]
}
```

### Update Challenge
```json
PATCH /api/community/challenges/1
{
  "status": "active"
}
```

### Retrieve Challenges
```json
GET /api/community/challenges
```

### Retrieve Specific Challenge
```json
GET /api/community/challenges/1
```