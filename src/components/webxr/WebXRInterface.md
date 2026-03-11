# Create WebXR Interface Components

# WebXR Interface Components

## Purpose
The `WebXRInterface` contains components and context necessary for building immersive experiences in WebXR. It facilitates support for VR and AR sessions, gesture recognition, and spatial interactions.

## Usage
To use the WebXR components, import them into your React application and wrap the relevant portions of your application with the `WebXRProvider`. Components such as `SpatialMenu`, `HolographicDisplay`, and `SpatialButton` can be utilized to create interactive elements in a 3D environment.

### Example
```tsx
import { WebXRProvider, SpatialMenu, HolographicDisplay, SpatialButton } from './src/components/webxr/WebXRInterface';

const App = () => {
  return (
    <WebXRProvider>
      <HolographicDisplay position={[0, 1, -2]} content={<Text>Hello, WebXR!</Text>} />
      <SpatialMenu
        position={[1, 1, -1]}
        items={[
          { id: 'start', label: 'Start', action: () => console.log('Start clicked') },
          { id: 'settings', label: 'Settings', action: () => console.log('Settings clicked') }
        ]}
      />
      <SpatialButton onClick={() => console.log('Button clicked')} position={[0, 0, -2]}>
        Click Me
      </SpatialButton>
    </WebXRProvider>
  );
};
```

## Parameters/Props

### WebXRSessionData
- `isSupported`: (boolean) Indicates if WebXR is supported.
- `isActive`: (boolean) Indicates if a WebXR session is currently active.
- `sessionMode`: ('immersive-vr' | 'immersive-ar' | null) The mode of the session.
- `referenceSpace`: (XRReferenceSpace | null) The reference space for the session.
- `handTracking`: (boolean) Indicates if hand tracking is available.
- `voiceCommands`: (boolean) Indicates if voice commands are available.

### GestureData
- `type`: ('pinch' | 'grab' | 'point' | 'swipe' | 'tap') The type of gesture detected.
- `confidence`: (number) Confidence level of the gesture recognition.
- `position`: (Vector3) The position of the gesture in 3D space.
- `direction`: (Vector3) The direction of the gesture (optional).
- `handedness`: ('left' | 'right') Hand used for the gesture.

### SpatialMenuProps
- `position`: ([number, number, number]) The position of the menu in 3D space.
- `rotation`: ([number, number, number]) The rotation of the menu.
- `visible`: (boolean) Controls the visibility of the menu.
- `onItemSelect`: (function) Callback for when an item is selected.
- `items`: (Array) List of items to display in the menu.

### HolographicDisplayProps
- `position`: ([number, number, number]) Position in 3D space.
- `content`: (ReactNode) Content to render inside the display.
- `scale`: (number) Scale factor for the display.
- `opacity`: (number) Opacity value (0 to 1).
- `animated`: (boolean) Toggles animations.

### SpatialButtonProps
- `position`: ([number, number, number]) Position in 3D space.
- `onClick`: (function) Click event handler.
- `children`: (ReactNode) Content to be rendered inside the button.
- `variant`: ('primary' | 'secondary' | 'ghost') Styling variant.
- `size`: ('sm' | 'md' | 'lg') Size variant of the button.
- `disabled`: (boolean) Disables the button if true.

## Return Values
Components render according to the provided properties, incorporating interactive elements for immersive user experiences in WebXR environments.