# Build CRAIverse VR Meeting Spaces

```markdown
# VR Meeting Spaces Module for CRAIverse

## Purpose
The VR Meeting Spaces Module provides immersive virtual reality environments for collaborative meetings, featuring AI agent interaction, spatial audio, gesture recognition, and full WebXR compatibility.

## Usage
To utilize the VR Meeting Spaces Module, ensure you have the necessary dependencies installed, including `three` and the related WebXR components. Instantiate the module with a configuration that specifies the parameters of the VR environment.

## Parameters/Props

### VRMeetingConfig
An object to configure the VR meeting space.

- `maxParticipants` (number): Maximum number of participants in a meeting.
- `spatialAudio` (boolean): Enable or disable spatial audio.
- `gestureRecognition` (boolean): Enable or disable gesture recognition.
- `defaultEnvironment` (string): Specify the default environment scene to be used.
- `audioQuality` ('low' | 'medium' | 'high'): Set the desired audio quality.
- `xrMode` ('immersive-vr' | 'immersive-ar'): Define the WebXR session type.
- `handTracking` (boolean): Enable hand tracking for participants.

### VRParticipant
Defines the structure for participant information.

- `id` (string): Unique identifier for the participant.
- `name` (string): Display name of the participant.
- `avatar` (THREE.Object3D): Reference to the participant's avatar model.
- `position` (THREE.Vector3): Spatial position of the participant within the VR space.
- `rotation` (THREE.Quaternion): Rotation data for the participant's avatar.
- `isAI` (boolean): Indicates if the participant is an AI agent.
- `audioStream` (MediaStream, optional): Audio stream for the participant.
- `handTracking` (object, optional): Contains hand tracking data for left and right hands, each a THREE.Object3D.

### GestureData
Information about recognized gestures.

- `type` ('point' | 'grab' | 'wave' | 'thumbsUp' | 'peace' | 'custom'): The type of gesture detected.
- `hand` ('left' | 'right'): Indicates which hand is performing the gesture.
- `confidence` (number): Confidence score for the gesture recognition.
- `position` (THREE.Vector3): 3D position where the gesture was recognized.
- `timestamp` (number): Timestamp for when the gesture was detected.

## Return Values
The module returns an instance of a VR meeting space that can manage participants, track gestures, and handle audio streams based on the provided configuration.

## Examples

### Example Configuration

```typescript
const vrConfig: VRMeetingConfig = {
  maxParticipants: 10,
  spatialAudio: true,
  gestureRecognition: true,
  defaultEnvironment: 'office',
  audioQuality: 'high',
  xrMode: 'immersive-vr',
  handTracking: true
};
```

### Creating a VR Meeting Space

```typescript
const meetingSpace = new VRMeetingSpace(vrConfig);
```

### Adding a Participant

```typescript
const participant: VRParticipant = {
  id: 'user123',
  name: 'John Doe',
  avatar: new THREE.Object3D(), // Placeholder for an avatar model
  position: new THREE.Vector3(0, 1.5, -3),
  rotation: new THREE.Quaternion(),
  isAI: false
};

meetingSpace.addParticipant(participant);
```
```