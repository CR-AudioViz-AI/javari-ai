# Generate CRAIverse World Builder UI Component

```markdown
# CRAIverse World Builder UI Component

## Purpose
The CRAIverse World Builder UI Component provides an interactive user interface for creating and managing 3D worlds. It leverages React and the @react-three/fiber library to render 3D scenes, allowing users to visualize, create, and manipulate virtual environments.

## Usage
To use the WorldBuilder component, import it into your React application and include it in your JSX. It supports drag-and-drop functionality, various UI controls for world customization, and integrates with a backend storage solution.

### Installation
Ensure you have the required dependencies:
```bash
npm install @react-three/fiber @react-three/drei react-dnd react-dnd-html5-backend three
```

### Example
```tsx
import React from 'react';
import WorldBuilder from './src/components/craiverse/WorldBuilder';

function App() {
  const handleSave = (worldData) => {
    console.log('World data saved:', worldData);
  };

  const handleLoad = (worldId) => {
    console.log('Loading world with ID:', worldId);
  };

  return (
    <div className="App">
      <WorldBuilder worldId="12345" onSave={handleSave} onLoad={handleLoad} />
    </div>
  );
}

export default App;
```

## Parameters / Props
The WorldBuilder component accepts the following props:

- `worldId` (optional): A string representing the unique identifier for the world to load or edit.
- `onSave` (optional): A callback function that is triggered when the user saves the world. It receives the `worldData` object as an argument.
- `onLoad` (optional): A callback function that is invoked when loading a world by its `worldId`.
- `className` (optional): A string for custom CSS class names for styling the component.

## Return Values
The WorldBuilder component returns a JSX element that represents the interactive world-building interface. It encapsulates the rendering canvas, UI controls (like buttons, sliders, and input fields), and the event handlers for saving and loading worlds.

## Features
- 3D canvas rendering using `@react-three/fiber`.
- Drag-and-drop functionality utilizing `react-dnd`.
- Fully customizable UI with various components from a design system.
- Integration with Supabase for world data storage and retrieval.
- Tools for manipulation (move, rotate, scale) and environmental customization (add trees, mountains, etc.).

## Notes
Make sure to handle the callbacks (`onSave`, `onLoad`) to manage world data effectively when integrating with your app's state or backend services.
```