# Build Advanced Avatar Customization API

```markdown
# Advanced Avatar Customization API

## Purpose
The Advanced Avatar Customization API allows users to create and manage highly customizable avatars. Users can specify various attributes related to the avatar's appearance, personality, preferences, and more, providing a tailored experience for personal or application use.

## Usage
To use the API, send a request to the `/api/avatar` endpoint with the appropriate payload for creating or updating avatars. The API supports creating new avatars as well as modifying existing ones.

### Endpoints
- **POST** `/api/avatar/create` - Create a new avatar
- **PATCH** `/api/avatar/update` - Update an existing avatar

## Parameters/Props

### Create Avatar
The payload for creating an avatar must match the following schema:

```json
{
  "name": "string (1-100 characters)",
  "description": "string (optional)",
  "appearance": {
    "gender": "enum ['male', 'female', 'non-binary', 'other']",
    "age_range": "enum ['young', 'adult', 'mature', 'elderly']",
    "ethnicity": "string (optional)",
    "hair_color": "string (optional)",
    "eye_color": "string (optional)",
    "skin_tone": "string (optional)",
    "body_type": "enum ['slim', 'athletic', 'average', 'curvy', 'muscular']",
    "height": "enum ['short', 'average', 'tall']",
    "style_preference": "enum ['casual', 'formal', 'artistic', 'sporty', 'gothic', 'futuristic']",
    "ai_generated": "boolean (defaults to false)"
  },
  "personality": {
    "traits": "array of strings (max 10)",
    "voice_tone": "enum ['friendly', 'professional', 'casual', 'energetic', 'calm', 'mysterious']",
    "interaction_style": "enum ['extroverted', 'introverted', 'balanced']",
    "humor_level": "number (1-10)",
    "formality_level": "number (1-10)"
  },
  "preferences": {
    "favorite_colors": "array of strings (max 5)",
    "music_genres": "array of strings (max 10)",
    "interests": "array of strings (max 15)",
    "communication_style": "string (optional)"
  },
  "modules_enabled": "array of strings (defaults to ['all'])"
}
```

### Update Avatar
The payload for updating an existing avatar must include the `avatar_id` and can contain any of the properties from the create schema as optional:

```json
{
  "avatar_id": "string (uuid)",
  "name": "string (optional)",
  "description": "string (optional)",
  "appearance": "object (optional)",
  "personality": "object (optional)",
  "preferences": "object (optional)",
  "modules_enabled": "array of strings (optional)"
}
```

## Return Values
The API will return a JSON object containing the status of the operation and any relevant data about the avatar created or updated.

### Successful Response Example
```json
{
  "status": "success",
  "data": {
    "avatar_id": "uuid",
    "name": "example avatar"
    // Additional avatar data
  }
}
```

### Error Response Example
```json
{
  "status": "error",
  "message": "Validation failed: [error details]"
}
```

## Examples

### Create Avatar Example
```bash
curl -X POST /api/avatar/create -H "Content-Type: application/json" -d '{
  "name": "John Doe",
  "description": "A friendly avatar.",
  "appearance": {
    "gender": "male",
    "age_range": "adult",
    "body_type": "athletic",
    "height": "average",
    "style_preference": "casual"
  },
  "personality": {
    "traits": ["kind", "curious"],
    "voice_tone": "friendly",
    "interaction_style": "extroverted",
    "humor_level": 5,
    "formality_level": 3
  },
  "preferences": {
    "favorite_colors": ["blue", "green"],
    "music_genres": ["rock", "pop"],
    "interests": ["gaming", "reading"]
  }
}'
```

### Update Avatar Example
```bash
curl -X PATCH /api/avatar/update -H "Content-Type: application/json" -d '{
  "avatar_id": "123e4567-e89b-12d3-a456-426