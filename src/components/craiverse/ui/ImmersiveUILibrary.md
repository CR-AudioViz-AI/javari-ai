# Generate Immersive UI Element Library

# Immersive UI Element Library Documentation

## Purpose
The `ImmersiveUILibrary` is a React component library designed for creating immersive user interfaces in 3D environments. It facilitates rich interactions using gestures, voice commands, hand tracking, and haptic feedback.

## Usage
To utilize the `ImmersiveUILibrary`, import it into your React application. You can create interactive 3D UI elements that respond to various input types, enhancing user engagement and experience.

```tsx
import { ImmersiveUILibrary } from 'src/components/craiverse/ui/ImmersiveUILibrary';

function App() {
  return (
    <ImmersiveUILibrary>
      {/* Add your interactive 3D components here */}
    </ImmersiveUILibrary>
  );
}
```

## Parameters/Props

### `SpatialUIProps`
The `SpatialUIProps` interface defines the properties that can be passed to interactive UI elements.

- **position** (Vector3D): Specifies the position of the component in 3D space. Default: `{ x: 0, y: 0, z: 0 }`.
- **rotation** (Vector3D): Sets the rotation of the component. Default: `{ x: 0, y: 0, z: 0 }`.
- **scale** (Vector3D): Defines the scale of the component. Default: `{ x: 1, y: 1, z: 1 }`.
- **visible** (boolean): Determines if the component is visible. Default: `true`.
- **interactive** (boolean): If set to `true`, enables interaction with the component. Default: `true`.
- **hapticEnabled** (boolean): Enables haptic feedback when interacting with the component. Default: `false`.
- **voiceEnabled** (boolean): Enables voice command recognition. Default: `false`.
- **gestureEnabled** (boolean): If true, allows gesture recognition for user interaction. Default: `false`.
- **className** (string): Additional CSS classes for styling.
- **children** (ReactNode): Child components that can be rendered inside the spatial UI component.

### `GestureData`
Contains information regarding user gestures:
- **type** (string): Type of gesture (e.g., 'pinch', 'grab').
- **confidence** (number): Confidence level of gesture recognition.
- **position** (Vector3D): Current position of the gesture.
- **velocity** (Vector3D, optional): Velocity of the gesture.
- **landmarks** (Vector3D[], optional): Detailed landmarks of the gesture.

### `VoiceCommand`
Describes voice commands recognized by the system:
- **command** (string): The received voice command.
- **confidence** (number): Confidence level of command recognition.
- **timestamp** (number): When the command was recognized.
- **params** (Record<string, any>, optional): Additional parameters related to the command.

### `HapticPattern`
Defines patterns for haptic feedback:
- **intensity** (number): Intensity of the haptic feedback.
- **duration** (number): Duration for which the haptic feedback lasts.
- **pattern** (string): Type of haptic feedback (e.g., 'click', 'success').

## Return Values
The `ImmersiveUILibrary` component does not return any specific values but provides rendered interactive 3D UI elements that respond to the human-computer interaction inputs defined by the props provided.

## Examples
Here's a simple example of using the `ImmersiveUILibrary` with basic children components:

```tsx
<ImmersiveUILibrary>
  <Button position={{ x: 1, y: 1, z: 0 }} interactive={true}>
    Click Me
  </Button>
  <Card position={{ x: -1, y: 1, z: 0 }} scale={{ x: 0.5, y: 0.5, z: 0.5 }}>
    <Text>Welcome to the immersive world!</Text>
  </Card>
</ImmersiveUILibrary>
```

This will create an immersive UI with a clickable button and a card displaying text in a 3D space. Adjust the props to customize interactions further.