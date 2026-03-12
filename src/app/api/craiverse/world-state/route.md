# Implement CRAIverse World State API

# CRAIverse World State API Documentation

## Purpose
The CRAIverse World State API provides endpoints to manage and query the state of entities within a shared virtual environment. It supports creating, updating, deleting, and moving world entities, adhering to strict data validation and conflict resolution mechanisms.

## Usage
This API can be integrated into applications utilizing the CRAIverse for managing dynamic environments, such as games or collaborative simulations. It requires a valid authentication token and utilizes rate limiting to ensure fair usage.

## Parameters/Props

### World Entity Schema
- **id**: `string` (UUID) - Unique identifier for the entity.
- **type**: `string` - Entity type (`object`, `terrain`, `structure`, `audio`, `visual`).
- **position**: `object` - Contains `x`, `y`, `z` coordinates.
- **rotation**: `object` - Contains `x`, `y`, `z` rotation values.
- **scale**: `object` - Scaling factors in `x`, `y`, `z`.
- **properties**: `object` - A key-value pair for additional custom properties.
- **metadata**: `object` - Metadata about the entity, including creation and modification info.

### World State Request Schema
- **space_id**: `string` (UUID) - Identifier for the shared space.
- **chunk_coords**: `array` (optional) - Coordinates of the chunks to be loaded.
- **include_locked**: `boolean` (default: `false`) - Whether to include locked entities.

### State Modification Schema
- **space_id**: `string` (UUID) - Identifier for the shared space.
- **operation**: `string` - Operation type (`create`, `update`, `delete`, `move`).
- **entities**: `array` - List of World Entities to be modified.
- **version_base**: `number` - The version number for conflict resolution.
- **conflict_resolution**: `string` (default: `merge`) - Strategy for handling conflicts.

## Return Values
The API returns JSON responses indicating the success or failure of the requested operations. Successful operations will include modified entities and their updated metadata.

## Examples

### Example of Creating a New World Entity
```typescript
const createEntityRequest = {
    space_id: "123e4567-e89b-12d3-a456-426614174000",
    operation: "create",
    entities: [{
        id: "d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d",
        type: "object",
        position: { x: 10, y: 20, z: 30 },
        rotation: { x: 0, y: 90, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        properties: {},
        metadata: {
            created_by: "a1b2c3d4-e5f6-7g8h-9i10-j11k12l13m14",
            created_at: new Date().toISOString(),
            modified_by: "a1b2c3d4-e5f6-7g8h-9i10-j11k12l13m14",
            modified_at: new Date().toISOString(),
            version: 1
        }
    }],
    version_base: 1,
    conflict_resolution: "merge"
};
```

### Example of Querying World State
```typescript
const queryWorldStateRequest = {
    space_id: "123e4567-e89b-12d3-a456-426614174000",
    chunk_coords: [{ x: 0, y: 0 }],
    include_locked: false
};
```

This API forms the backbone for state management in a virtual environment, ensuring robust and conflict-free interactions with world entities.