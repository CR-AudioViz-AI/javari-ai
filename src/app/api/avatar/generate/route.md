# Implement Dynamic Avatar Generation API

```markdown
# Dynamic Avatar Generation API

## Purpose

The Dynamic Avatar Generation API allows developers to generate personalized avatars based on user input, including facial features, preferences, and customizations. This API utilizes advanced machine learning to create realistic or stylized avatars, leveraging external services like Supabase for storage, OpenAI for processing, and MediaPipe for facial feature detection.

## Usage

The API endpoint can be accessed with a `POST` request to `src/app/api/avatar/generate`. The request should include user data and options for customization as defined below.

## Parameters / Props

The API accepts a JSON object containing the following fields:

- `userId` (string, required): A UUID representing the user requesting the avatar.
- `photo` (string, optional): A Base64 encoded image to provide additional context for avatar generation.
- `preferences` (object, optional): Avatar characteristics and preferences:
  - `style` (string, enum: ['realistic', 'cartoon', 'anime', 'stylized'], default: 'realistic'): The desired style of the avatar.
  - `gender` (string, enum: ['male', 'female', 'non-binary'], optional): The gender identity of the avatar.
  - `age` (number, optional): The preferred age of the avatar (must be between 13 and 100).
  - `ethnicity` (string, optional): Describes the ethnicity of the avatar.
  - `hairColor` (string, optional): The color of the avatar's hair.
  - `eyeColor` (string, optional): The color of the avatar's eyes.
  - `skinTone` (string, optional): The skin tone of the avatar.
  - `bodyType` (string, enum: ['slim', 'athletic', 'average', 'plus-size'], default: 'average'): Avatar body type.
  - `clothing` (object, optional): Avatars clothing customization:
    - `top` (string, default: 'casual-shirt'): The type of top clothing.
    - `bottom` (string, default: 'jeans'): The type of bottom clothing.
    - `accessories` (array, default: []): An array of accessory types.
- `customization` (object, optional): Settings to further customize the avatar:
  - `pose` (string, default: 'neutral'): Desired pose of the avatar.
  - `expression` (string, default: 'neutral'): Facial expression of the avatar.
  - `lighting` (string, default: 'studio'): Lighting conditions for the avatar.
  - `background` (string, default: 'transparent'): Background settings for the avatar.

## Return Values

The API returns a JSON response containing:
- `avatarUrl` (string): The URL where the generated avatar is stored.
- `message` (string): A descriptive message about the generation process, including error messages if applicable.
- `status` (string): Indicates success or failure of the request.

## Examples

### Example Request

```json
POST /api/avatar/generate
Content-Type: application/json

{
  "userId": "e4eaaaf2-d142-11e1-b3e4-08002762c195",
  "photo": "data:image/png;base64,...",
  "preferences": {
    "style": "cartoon",
    "gender": "female",
    "age": 25,
    "hairColor": "blonde",
    "bodyType": "athletic",
    "clothing": {
      "top": "t-shirt",
      "bottom": "shorts",
      "accessories": ["hat"]
    }
  },
  "customization": {
    "pose": "smile",
    "expression": "happy",
    "lighting": "natural",
    "background": "blue"
  }
}
```

### Example Response

```json
{
  "avatarUrl": "https://yourdomain.com/avatars/generated/e4eaaaf2.png",
  "message": "Avatar generated successfully.",
  "status": "success"
}
```

## Notes

Ensure your environment variables for Supabase, OpenAI, and other services are correctly set for the API to function properly.
```