# Build CRAIverse World State Synchronization API

# CRAIverse World State Synchronization API

## Purpose
The CRAIverse World State Synchronization API facilitates the synchronization of world state data for virtual environments. It enables the management of various world objects and environmental states, including physics, lighting, and weather attributes, while ensuring data integrity and rate limiting.

## Usage
The API is designed to be used within a Next.js application, leveraging Supabase for data handling, Redis for caching, and Upstash's ratelimit for managing request frequencies.

### Example Endpoint
```typescript
// Example usage of the API in a Next.js route
import { NextRequest, NextResponse } from 'next/server';
// Additional imports as needed...

export async function POST(request: NextRequest) {
    // Handle the incoming request to synchronize world state...
}
```

## Parameters/Props
- **WorldObject**: Represents an object in the world state.
  - `id` (string): UUID of the object.
  - `type` (string): Type of the object (`'mesh' | 'light' | 'camera' | 'audio_source' | 'trigger_zone'`).
  - `position` (Vector3): 3D position represented by x, y, z coordinates.
  - `rotation` (Quaternion): Rotational orientation represented as a quaternion.
  - `scale` (Vector3, optional): Scaling factor for the object.
  - `properties` (object, optional): Additional properties related to the object.
  - `metadata` (object): Metadata, including creator and timestamps.

- **EnvironmentState**: Represents the state of the environment.
  - `lighting`: Lighting properties including ambient intensity, sun position, and fog density.
  - `weather`: Weather properties including type, intensity, and wind characteristics.
  - `physics`: Physical attributes such as gravity and air resistance.

### Validation
Schemas are defined using the `zod` library to validate incoming data formats. Incorrect formats lead to validation errors.

## Return Values
- On successful synchronization, the API typically responds with a `200 OK` status along with a confirmation message.
- If validation fails or conditions are not met (e.g., exceeding rate limits), appropriate error messages are returned (e.g., `400 Bad Request` or `429 Too Many Requests`).

## Examples
### POST Request to Synchronize World Object
```typescript
const response = await fetch('/api/craiverse/world-state', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        objects: [
            {
                id: 'd96aad12-67e6-4f51-b2b9-2aae58e831c5',
                type: 'mesh',
                position: { x: 0, y: 1, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                properties: {},
                metadata: {
                    created_by: 'e89e1d3a-7cc2-4d71-a84e-e5f38f470a66',
                    created_at: new Date().toISOString(),
                    version: 1,
                }
            }
        ],
        environment: {
            lighting: {
                ambient_intensity: 1,
                sun_position: { x: 1, y: 1, z: -1 },
                sun_intensity: 2,
                fog_density: 0.1
            },
            weather: {
                type: 'clear',
                intensity: 0,
                wind_direction: { x: 0, y: 0, z: 1 },
                wind_strength: 5
            },
            physics: {
                gravity: { x: 0, y: -9.81, z: 0 },
                air_resistance: 0.1
            }
        }
    }),
});
const data = await response.json();
console.log(data);
```

This is a concise API documentation representation for the CRAIverse World State Synchronization service.