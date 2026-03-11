# Implement Dynamic Avatar Customization API

# Dynamic Avatar Customization API

## Purpose
The Dynamic Avatar Customization API allows users to customize their avatars dynamically by sending customization parameters. This API supports a variety of customization options including appearance, clothing, accessories, and behavioral traits. It integrates with a backend service for storing and retrieving user preferences, as well as providing real-time updates via Pusher.

## Usage
This API is intended to be invoked via an HTTP POST request to the endpoint `/api/avatar/customize`. The request should contain a JSON body which adheres to the schema defined for avatar customization. Upon successful customization, it broadcasts the changes to subscribers through Pusher.

## Parameters/Props
The request body must be a JSON object containing the following properties:

- `appearance` (optional): An object defining the visual attributes of the avatar.
  - `skinTone`: Hex code for the skin tone (e.g., `#FFC0CB`).
  - `eyeColor`: Hex code for eye color (e.g., `#0000FF`).
  - `hairColor`: Hex code for hair color (e.g., `#000000`).
  - `hairStyle`: A string representing the style of hair (1-50 characters).
  - `faceShape`: Enum value from `['oval', 'round', 'square', 'heart', 'long']`.
  - `bodyType`: Enum value from `['slim', 'athletic', 'average', 'curvy', 'plus']`.
  - `height`: A number representing the height (0.5 to 2.5 meters).

- `clothing` (optional): An object defining clothing attributes.
  - `head`: String (nullable) for headwear.
  - `top`: String (nullable) for upper clothing.
  - `bottom`: String (nullable) for lower clothing.
  - `shoes`: String (nullable) for footwear.
  - `outerwear`: String (nullable) for outer garments.

- `accessories` (optional): An object for accessory attributes.
  - `jewelry`: Array of strings (max 5 items) for jewelry items.
  - `bags`: Array of strings (max 2 items) for bags.
  - `glasses`: String (nullable) for eyeglasses.
  - `hat`: String (nullable) for hats.
  - `watch`: String (nullable) for watches.

- `behavioral` (optional): An object defining behavioral characteristics.
  - `personality`: Enum from `['friendly', 'professional', 'casual', 'energetic', 'calm']`.
  - `gesture_style`: Enum from `['minimal', 'expressive', 'formal', 'animated']`.
  - `voice_tone`: Enum from `['warm', 'neutral', 'authoritative', 'cheerful']`.
  - `interaction_preference`: Enum from `['extroverted', 'introverted', 'balanced']`.

## Return Values
On a successful request, the API returns a JSON response with the following properties:
- `status`: HTTP status code (e.g., `200`).
- `message`: Confirmation message indicating successful customization.
- `data`: The customized avatar attributes.

In case of an error:
- `status`: Relevant error code (e.g., `400`).
- `message`: Description of the error encountered.

## Examples

### Example Request
```json
POST /api/avatar/customize
Content-Type: application/json

{
  "appearance": {
    "skinTone": "#FFC0CB",
    "eyeColor": "#0000FF",
    "hairColor": "#000000",
    "hairStyle": "curly",
    "faceShape": "oval",
    "bodyType": "athletic",
    "height": 1.75
  },
  "clothing": {
    "top": "t-shirt",
    "bottom": "jeans",
    "shoes": "sneakers"
  },
  "accessories": {
    "jewelry": ["necklace", "earrings"],
    "glasses": "sunglasses"
  },
  "behavioral": {
    "personality": "friendly",
    "gesture_style": "expressive",
    "voice_tone": "cheerful",
    "interaction_preference": "extroverted"
  }
}
```

### Example Response
```json
{
  "status": 200,
  "message": "Avatar customized successfully.",
  "data": {
    "appearance": {
      "skinTone": "#FFC0CB",
      "eyeColor": "#0000FF",
      "hairColor": "#000000",
      "hairStyle": "curly",
      "faceShape": "oval",
      "bodyType": "athletic",
      "height": 1.