# Create Advanced CRAIverse World Editor

# Advanced CRAIverse World Editor

## Purpose
The Advanced CRAIverse World Editor is a React component designed for creating and modifying 3D worlds in a virtual environment. It allows users to manipulate objects, customize terrain and lighting, and collaborate on world-building projects.

## Usage
To use the `WorldEditor` component, import it into your React application and render it with the desired props.

```tsx
import WorldEditor from 'src/components/craiverse/world-editor/WorldEditor';

// Example usage
<WorldEditor 
  className="my-editor" 
  worldId="12345" 
  readOnly={false} 
  onSave={handleSave} 
  onShare={handleShare} 
  onCollaborate={handleCollaborate} 
/>
```

## Parameters/Props
### WorldEditorProps
- **className** (string, optional): A custom class name to style the component.
- **worldId** (string, optional): The unique identifier for the world being edited.
- **readOnly** (boolean, optional): If set to `true`, the editor will disable changes, making it read-only.
- **onSave** (function, optional): Callback function that receives world data when the save action is called.
- **onShare** (function, optional): Callback function that receives world data when the share action is initiated.
- **onCollaborate** (function, optional): Callback function triggered to join a collaboration room, receiving the room ID.

### WorldData
- **id** (string): Unique identifier for the world.
- **name** (string): Name of the world.
- **description** (string): Brief description of the world.
- **objects** (WorldObject[]): Array of 3D objects present in the world.
- **terrain** (TerrainData): Data structure describing the world’s terrain.
- **lighting** (LightingData): Information on the world’s lighting setup.
- **physics** (PhysicsData): Physics configuration for the world.

## Return Values
The `WorldEditor` component does not return any values directly. It interacts through callback props that provide world data and manage user actions.

## Examples

### Basic Usage
```tsx
const handleSave = (worldData: WorldData) => {
  console.log('World Saved:', worldData);
};

const handleShare = (worldData: WorldData) => {
  console.log('World Shared:', worldData);
};

const handleCollaborate = (roomId: string) => {
  console.log('Collaborating in Room:', roomId);
};

<WorldEditor 
  className="editor" 
  worldId="world_001" 
  readOnly={false} 
  onSave={handleSave} 
  onShare={handleShare} 
  onCollaborate={handleCollaborate} 
/>
```

### Read-Only Mode
```tsx
<WorldEditor 
  worldId="world_002" 
  readOnly={true} 
/>
```

This makes the editor non-editable, suitable for viewing existing worlds.

## Conclusion
The Advanced CRAIverse World Editor is a powerful tool for creating immersive 3D environments, featuring options for saving, sharing, and collaborating, making it an essential component for any CRAIverse project.