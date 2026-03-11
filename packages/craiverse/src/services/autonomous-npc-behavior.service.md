# Build Autonomous NPC Behavior Service

# Autonomous NPC Behavior Service

## Purpose
The Autonomous NPC Behavior Service enhances Non-Player Characters (NPCs) with intelligent behavior patterns, utilizing personality traits, emotional states, and goal-oriented actions. This service enables dynamic interactions within gaming environments or simulations, providing NPCs with a semblance of personality and purpose.

## Usage
This service is built to be integrated within the CRAIverse platform, and it leverages various components for effective NPC management:

- **LLMService**: For natural language interactions.
- **WorldStateService**: To assess the environment and context.
- **AvatarService**: For NPC representation.
- **WebSocketService**: To facilitate real-time interactions.
- **BehaviorAnalyticsService**: For performance tracking and analytics.

## Parameters/Props

### PersonalityTraits
Defines the personality profile of the NPC.

- `openness` (number): Creativity and openness to experience (0-1).
- `conscientiousness` (number): Organization and reliability (0-1).
- `extraversion` (number): Sociability and assertiveness (0-1).
- `agreeableness` (number): Trust and altruism (0-1).
- `neuroticism` (number): Emotional instability and anxiety (0-1).

### EmotionalState
Represents the emotional condition of the NPC.

- `valence` (number): Emotional positivity (-1 to 1).
- `arousal` (number): Emotional excitement (0-1).
- `dominance` (number): Level of control or submissiveness (0-1).
- `emotions` (object): Contains emotions such as joy, anger, fear, sadness, surprise, and disgust (each as numbers).
- `lastUpdated` (Date): Timestamp of the last emotional state update.

### NPCGoal
Structure defining a specific goal for the NPC under a Goal-Oriented Action Planning (GOAP) system.

- `id` (string): Unique identifier for the goal.
- `type` (string): Goal type: 'survival', 'social', 'exploration', 'achievement', or 'entertainment'.
- `priority` (number): Importance of the goal (0-1).
- `conditions` (Record<string, any>): Conditions to meet for goal completion.
- `actions` (string[]): List of actions associated with the goal.
- `deadline` (Date, optional): Deadline for goal completion.
- `created` (Date): Creation timestamp for the goal.
- `status` (string): Current status: 'active', 'completed', 'failed', or 'paused'.

### NPCAction
Details specific actions that can be performed by the NPC.

- `id` (string): Unique identifier for the action.
- `name` (string): Name of the action.
- `type` (string): Type of the action: 'movement', 'interaction', or 'communication'.

## Return Values
The service outputs the current state and behavior attributes of the NPCs. Specifically, it returns the constructed NPCs with their personality traits, emotional states, available goals, and actions, which can be used directly in the game environment for rendering NPC behavior.

## Examples
### Instantiating an NPC with Personality Traits
```typescript
const npcDetails = {
  personality: {
    openness: 0.7,
    conscientiousness: 0.5,
    extraversion: 0.9,
    agreeableness: 0.8,
    neuroticism: 0.3
  }
};
```

### Creating a Goal for an NPC
```typescript
const npcGoal: NPCGoal = {
  id: 'goal1',
  type: 'exploration',
  priority: 0.8,
  conditions: { explored: false },
  actions: ['walk', 'look_around'],
  created: new Date(),
  status: 'active'
};
```

This service enables the development of more engaging and interactive NPCs, enriching user experiences within the CRAIverse.