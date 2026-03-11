# Build World State Persistence Database

# World State Persistence Database Migration Documentation

## Purpose
The World State Persistence Database schema is designed to manage the storage of various entities and their states within the context of CR AIVerse. This schema enables efficient handling of world data through spatial indexing, version control, and custom data types to facilitate world creation, modifications, and state management.

## Usage
This SQL migration script should be executed in a PostgreSQL database environment equipped with the PostGIS extension for spatial data types. It establishes the foundational structure for the CRAIverse world states, including metadata for worlds and their chunked spatial components.

## Parameters/Props

### Extensions
- **postgis**: Provides support for geographic objects.
- **uuid-ossp**: Facilitates UUID generation.
- **btree_gin**: Enables GIN indexing with B-tree.
- **btree_gist**: Enables GiST indexing with B-tree.

### Custom Types
- **world_status**: ENUM values include 'active', 'archived', 'maintenance', 'deleted'.
- **object_type**: ENUM values include 'building', 'terrain', 'character', 'item', 'decoration', 'system'.
- **modification_type**: ENUM values include 'create', 'update', 'delete', 'move', 'batch'.
- **sync_status**: ENUM values include 'pending', 'synced', 'conflict', 'failed'.

### Tables
1. **worlds**
   - `id`: UUID (Primary Key)
   - `name`: TEXT (World name)
   - `description`: TEXT (World description)
   - `creator_id`: UUID (References auth.users)
   - `status`: world_status (Current status of the world)
   - `bounds`: GEOMETRY(POLYGON, 4326) (Spatial bounds)
   - `chunk_size`: INTEGER (Size of chunks; default 64)
   - `max_objects_per_chunk`: INTEGER (Default max objects; default 1000)
   - `settings`: JSONB (Additional settings)
   - `metadata`: JSONB (Extra metadata)
   - `version`: INTEGER (Version control; default 1)
   - `created_at`: TIMESTAMPTZ (Creation timestamp)
   - `updated_at`: TIMESTAMPTZ (Last updated timestamp)
   - `last_accessed_at`: TIMESTAMPTZ (Last accessed timestamp)

2. **world_chunks**
   - `id`: UUID (Primary Key)
   - `world_id`: UUID (References worlds)
   - `chunk_x`: INTEGER (X coordinate of the chunk)
   - `chunk_y`: INTEGER (Y coordinate of the chunk)
   - `bounds`: GEOMETRY(POLYGON, 4326) (Spatial bounds)
   - `object_count`: INTEGER (Count of objects in the chunk)
   - `data_size`: BIGINT (Size of the chunk data)
   - `last_modified`: TIMESTAMPTZ (Last modified timestamp)
   - `checksum`: TEXT (Integrity check value)
   - `metadata`: JSONB (Additional data)
   - `is_dirty`: BOOLEAN (Dirty flag for unsaved changes)

## Return Values
This migration does not produce direct output values but establishes database tables and structures necessary for managing world states and objects, setting up the persistence layer for future CRUD operations and spatial queries.

## Examples
To run this migration, execute the SQL script in your PostgreSQL database:

```sql
-- Run the migration
\i path/to/20241201_craiverse_world_state.sql;
```

After execution, you can insert and manage world data as follows:

```sql
INSERT INTO worlds (name, description, bounds, creator_id)
VALUES ('Fantasy World', 'A vibrant fantasy world.', 'POLYGON((...))', 'some-uuid');

SELECT * FROM worlds WHERE status = 'active';
``` 

Utilizing this schema enables the effective persistence of the virtual world's state within your application.