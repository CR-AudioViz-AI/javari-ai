# Build Augmented Reality Overlay Component

# AROverlayComponent Documentation

## Purpose
The `AROverlayComponent` is a React component designed to facilitate the integration of Augmented Reality (AR) overlays in applications. It supports features such as object recognition, spatial audio, and persistent anchors, enabling the interaction with various AR elements.

## Usage
To use the `AROverlayComponent`, import it into your React application and include it in your JSX. You can customize its behavior using the available props.

```jsx
import AROverlayComponent from './src/components/craiverse/ar-overlay/AROverlayComponent';

const App = () => {
  return (
    <AROverlayComponent
      enableObjectRecognition={true}
      enableSpatialAudio={true}
      onObjectDetected={(objects) => console.log(objects)}
      arElements={[]}
    />
  );
};
```

## Parameters/Props

| Prop                          | Type                                        | Default         | Description                                                                                     |
|-------------------------------|---------------------------------------------|------------------|-------------------------------------------------------------------------------------------------|
| `className`                   | `string`                                   | `undefined`      | Additional CSS class names for custom styling.                                                |
| `enableObjectRecognition`     | `boolean`                                  | `false`          | Enables object recognition feature.                                                             |
| `enableSpatialAudio`          | `boolean`                                  | `false`          | Activates spatial audio capabilities.                                                           |
| `enablePersistence`           | `boolean`                                  | `false`          | Allows for persistent spatial anchors.                                                          |
| `onObjectDetected`            | `(objects: DetectedObject[]) => void`     | `undefined`      | Callback triggered when objects are detected.                                                  |
| `onAnchorCreated`             | `(anchor: SpatialAnchor) => void`          | `undefined`      | Callback triggered when a spatial anchor is created.                                           |
| `onElementInteraction`        | `(element: CRAIverseElement, interaction: string) => void` | `undefined` | Callback triggered on interaction with an AR element.                                          |
| `arElements`                  | `CRAIverseElement[]`                       | `[]`             | An array of AR elements to be rendered in the scene.                                          |
| `calibrationSettings`         | `{ focalLength: number; principalPoint: { x: number; y: number }; distortion: number[]; }` | `undefined`      | Calibration settings for camera perspective, including focal length, principal point, and distortion. |

## Return Values
The `AROverlayComponent` does not return any values but manages the rendering of AR overlays and handles user interactions as specified by the props.

## Examples

### Basic Example
```jsx
<AROverlayComponent
  enableObjectRecognition={true}
  onObjectDetected={(objects) => {
    console.log('Detected objects:', objects);
  }}
/>
```

### Using AR Elements
```jsx
const arElements = [
  {
    id: '1',
    type: 'audio_visualizer',
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    data: { /* your data here */ },
    interactive: true,
  },
];

<AROverlayComponent
  arElements={arElements}
  onElementInteraction={(element, interaction) => {
    console.log('Interacted with:', element.id, 'Action:', interaction);
  }}
/>
```

This documentation provides an overview of how to set up and use the `AROverlayComponent` effectively within your Augmented Reality applications.