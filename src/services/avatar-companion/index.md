# Deploy AI-Powered Avatar Companion Service

```markdown
# CR AudioViz AI - Avatar Companion Service

## Purpose

The Avatar Companion Service provides AI-powered virtual assistants with emotional intelligence capabilities. It learns user preferences and delivers contextual assistance, enhancing user interactions within CR AudioViz virtual environments.

## Usage

To utilize the Avatar Companion Service, import the service in your TypeScript application, and instantiate the necessary components to create emotional state representations and manage user interactions.

```typescript
import { EmotionalState, UserInteraction } from 'src/services/avatar-companion/index.ts';

// Example of creating a new emotional state
const newEmotionalState: EmotionalState = {
  id: '1',
  companionId: 'companion_001',
  primary: 'joy',
  intensity: 0.8,
  valence: 0.9,
  arousal: 0.7,
  timestamp: new Date(),
};

// Example of recording a user interaction
const userInteraction: UserInteraction = {
  id: 'interaction_001',
  userId: 'user_123',
  companionId: 'companion_001',
  type: 'text',
  content: 'Hello, how are you?',
  sentiment: 0.85,
  intent: 'greeting',
  context: {
    environment: 'living room',
    spatialPosition: [1, 2, 3],
    audioContext: 'quiet',
    nearbyUsers: ['user_124', 'user_125'],
    currentActivity: 'chatting',
  },
  timestamp: new Date(),
};
```

## Parameters/Props

### `EmotionalState`

- `id` (string): Unique identifier for the emotional state.
- `companionId` (string): Identifier for the corresponding avatar companion.
- `primary` (EmotionalPrimary): Primary emotion of the avatar.
- `secondary` (EmotionalSecondary[]): Optional. An array of secondary emotions.
- `intensity` (number): Emotional intensity (0.0 to 1.0).
- `valence` (number): Emotion valence (-1.0 to 1.0).
- `arousal` (number): Emotional arousal (0.0 to 1.0).
- `timestamp` (Date): When the emotional state was recorded.
- `context` (string): Optional context description.

### `UserInteraction`

- `id` (string): Unique identifier for the interaction.
- `userId` (string): Identifier for the user.
- `companionId` (string): Identifier for the avatar companion involved.
- `type` (InteractionType): Type of interaction (text, voice, gesture, spatial, emotional).
- `content` (string): Content of the interaction.
- `sentiment` (number): Sentiment score (-1.0 to 1.0).
- `intent` (string): The intent behind the interaction.
- `context` (InteractionContext): Context of the interaction.
- `response` (CompanionResponse): Optional. The response from the companion.
- `timestamp` (Date): When the interaction occurred.
- `metadata` (Record<string, unknown>): Optional additional metadata.

## Return Values

The service methods typically do not return values directly but instead provide mechanisms to manipulate `EmotionalState` and `UserInteraction` objects, allowing for state management and logging of interactions.

## Examples

1. Creating an emotional state and recording a user interaction:

```typescript
const emotionalState: EmotionalState = { /*...*/ };
const interaction: UserInteraction = { /*...*/ };
// Further processing logic here
```

2. Utilizing the emotional state in decision-making for the avatar companion:

```typescript
if (emotionalState.primary === 'sadness' && emotionalState.intensity > 0.5) {
  // Trigger comforting response
}
```

By utilizing the Avatar Companion Service, developers can create dynamic and emotionally aware avatar assistants that adapt to user interactions in real-time.
```