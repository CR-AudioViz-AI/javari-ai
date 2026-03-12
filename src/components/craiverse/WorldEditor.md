# Create CRAIverse World Editor Interface

```markdown
# CRAIverse World Editor Interface

## Purpose
The CRAIverse World Editor Interface provides a component for creating and editing 3D worlds using React and Three.js. It allows users to manipulate objects, adjust terrain settings, configure lighting, and navigate within a 3D canvas.

## Usage
To utilize the `WorldEditor` component, import it into your React application and include it in your JSX. The component handles its own state and incorporates various UI elements for user interaction.

```tsx
import WorldEditor from 'src/components/craiverse/WorldEditor';

function App() {
  return (
    <div>
      <WorldEditor />
    </div>
  );
}
```

## Parameters/Props
The `WorldEditor` component does not accept any props. It manages its own internal state for user actions, object manipulation, and various settings.

### Internal States
- **User State**: Represents active users in the editor with their cursor positions.
- **World Objects**: Array of objects representing different elements in the world, including their type, transformations, and visibility settings.
- **Terrain Settings**: Parameters controlling terrain features (e.g., height scale, texture, erosion).
- **Lighting Settings**: Configurations for ambient light and sun properties.

## Return Values
The `WorldEditor` component returns a fully functional 3D editing interface rendered within a `<Canvas>` element, integrated with Three.js for 3D rendering. Users can interact with:
- 3D objects (mesh, lights, cameras, groups)
- Terrain and lighting settings
- UI controls for object transformations (move, rotate, scale)

## Examples
1. **Basic Use of WorldEditor**:
   ```tsx
   import React from 'react';
   import WorldEditor from 'src/components/craiverse/WorldEditor';

   function My3DApp() {
     return (
       <div>
         <h1>My CRAIverse World Editor</h1>
         <WorldEditor />
       </div>
     );
   }
   ```

2. **Handling User Interaction**:
   The interface includes buttons, sliders, and other controls for users to manipulate the scene dynamically. Users can:
   - Add new objects
   - Adjust terrain and lighting settings using UI components
   - Save changes or undo/redo actions

3. **Navigating the 3D Space**:
   Users can navigate in the 3D space using `OrbitControls`, allowing for immersive editing experiences.

## Dependencies
The CRAIverse World Editor uses several libraries:
- `@react-three/fiber` for rendering 3D graphics
- `@react-three/drei` for helper components like `OrbitControls` and `Environment`
- UI components from a custom UI library (e.g., buttons, sliders, and cards) for creating a cohesive editing experience.

Ensure you have the necessary packages installed in your project to utilize the editor component effectively.
```