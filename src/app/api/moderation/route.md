# Generate AI-Powered Content Moderation API

# AI-Powered Content Moderation API

## Purpose
The AI-Powered Content Moderation API enables automated content moderation for various types of user-generated content (text, images, videos, and audio). It leverages OpenAI's capabilities to analyze content for compliance with specified moderation rules and policies, ensuring a safer user environment.

## Usage
To utilize the moderation API, send a POST request to the moderation endpoint. The request must be formatted according to the specified schemas to be processed correctly.

### Endpoint
```
POST /api/moderation
```

## Parameters/Props

### Request Body
The API accepts a JSON object structured as follows:

#### Content Object
- **content**: An object containing:
  - **type**: (string) The type of content, options are `'text'`, `'image'`, `'video'`, `'audio'`.
  - **data**: (string) The base64 encoded or plain text content which needs moderation. Must be between 1 and 50,000,000 characters.
  - **metadata**: (object) Additional information including:
    - **userId**: (string) UUID of the user submitting the content.
    - **contentId**: (string) Optional UUID of the content being moderated.
    - **source**: (string) Optional source information.
    - **timestamp**: (string) Optional timestamp in ISO8601 format.

#### Options Object (optional)
- **options**: An object containing moderation options:
  - **strictMode**: (boolean) Whether to apply strict moderation rules. Defaults to `false`.
  - **customRules**: (array of strings) Any custom rules to apply to moderation.
  - **skipCache**: (boolean) If true, skips any cached moderation results. Defaults to `false`.

### Response
The API responds with a moderation result containing:
- **id**: (string) Unique identifier for the moderation task.
- **status**: (string) Current moderation status, options are `'approved'`, `'flagged'`, `'rejected'`, or `'pending_review'`.
- **confidence**: (number) Confidence score of the moderation decision (0 to 100).
- **categories**: (array of strings) Categories identified in the content.
- **reason**: (string, optional) Reason for the decision if flagged or rejected.

## Examples

### Successful Moderation Request
```json
POST /api/moderation
{
  "content": {
    "type": "text",
    "data": "This is a sample content to be moderated.",
    "metadata": {
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "contentId": "223e4567-e89b-12d3-a456-426614174001"
    }
  },
  "options": {
    "strictMode": true
  }
}
```

### Successful Response
```json
{
  "id": "456e4567-e89b-12d3-a456-426614174002",
  "status": "approved",
  "confidence": 95.0,
  "categories": ["safe"]
}
```

### Error due to Missing Content Data
```json
{
  "error": "Missing required field 'data' in content object."
}
```

This documentation provides a comprehensive overview of the AI-Powered Content Moderation API, ensuring developers can integrate and utilize the API effectively to moderate content for their applications.