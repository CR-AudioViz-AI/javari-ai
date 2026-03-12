# Implement Cross-Reality Multiplayer Service

# Cross-Reality Multiplayer Service

## Purpose
The **Cross-Reality Multiplayer Service** enables real-time interactions among users in various reality modes (VR, AR, traditional, and mixed). It manages user presence, device capabilities, and normalized input data, thus facilitating a seamless cross-reality multiplayer experience.

## Usage
To use the `CrossRealityMultiplayerService`, instantiate the service and utilize its methods to manage user sessions, send and receive input data, and maintain an updated state of user presence within the multiplayer environment.

## Parameters/Props

### Enums

- **RealityMode**: Enum representing the types of reality modes supported.
  - `VR`: Virtual Reality
  - `AR`: Augmented Reality
  - `TRADITIONAL`: Non-immersive environments
  - `MIXED`: Combination of immersive and non-immersive environments

### Interfaces

- **DeviceCapabilities**: Information about the device's capabilities.
  - `id`: Unique identifier for the device.
  - `realityMode`: The reality mode of the device.
  - `has6DOF`: Indicates if the device supports 6 Degrees of Freedom.
  - `hasHandTracking`: Indicates hand tracking capability.
  - `hasEyeTracking`: Indicates eye tracking capability.
  - `hasSpatialAudio`: Indicates support for spatial audio.
  - `hasHapticFeedback`: Indicates if haptic feedback is supported.
  - `maxUsers`: Maximum number of users that can be supported.
  - `displayResolution`: Resolution of the display.
  - `fieldOfView`: Field of view in degrees.
  - `trackingSpace`: Tracking space configuration.

- **NormalizedInput**: Structure for normalized user inputs.
  - `userId`: Unique identifier of the user.
  - `timestamp`: The time the input was recorded.
  - `type`: Type of input (gesture, voice, controller, gaze, touch).
  - `position`: 3D position data.
  - `rotation`: Quaternion rotation data.
  - `intensity`: Intensity of the input action.
  - `metadata`: Additional metadata related to the input.

- **UserPresence**: Information about a user session.
  - `userId`: Unique identifier for the user.
  - `sessionId`: Unique identifier for the session.
  - `realityMode`: Current reality mode of the user.
  - `position`: 3D position of the user in the environment.
  - `rotation`: Quaternion rotation of the user.
  - `isActive`: Status of user activity.
  - `lastSeen`: Timestamp of the last user activity.
  - `audioLevel`: User's current audio level.
  - `deviceCapabilities`: User's device capabilities.

- **SpatialCoordinateSystem**: Configuration for the spatial coordinate system.
  - `origin`: The origin point of the coordinate system.
  - `scale`: Scale factor.
  - `bounds`: Boundary limits for the coordinate system.

## Return Values
The service provides instances of the interfaces like `DeviceCapabilities`, `NormalizedInput`, and `UserPresence` and handles events to notify changes in user presence and input states in real-time.

## Examples

```typescript
import { CrossRealityMultiplayerService } from './path/to/cross-reality-multiplayer.service';

// Instantiate the service
const multiplayerService = new CrossRealityMultiplayerService();

// Add a new user
const userData: UserPresence = {
  userId: 'user123',
  sessionId: 'session456',
  realityMode: RealityMode.AR,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  isActive: true,
  lastSeen: Date.now(),
  audioLevel: 0.5,
  deviceCapabilities: {
    id: 'device789',
    realityMode: RealityMode.AR,
    has6DOF: true,
    hasHandTracking: true,
    hasEyeTracking: false,
    hasSpatialAudio: true,
    hasHapticFeedback: true,
    maxUsers: 4,
    displayResolution: { width: 1920, height: 1080 },
    fieldOfView: 90,
    trackingSpace: 'room-scale',
  },
};

// Update user presence
multiplayerService.updateUserPresence(userData);
```

This concise documentation outlines the purpose, usage, parameters, and examples associated with the Cross-Reality Multiplayer Service, enabling developers to integrate and utilize the service effectively.