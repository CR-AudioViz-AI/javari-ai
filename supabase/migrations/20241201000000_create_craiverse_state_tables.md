# Implement CRAIverse State Persistence Database

# CRAIverse State Persistence Database

## Purpose
The CRAIverse State Persistence Database is designed to provide a structured, efficient way to store and manage state data for different zones in a multi-dimensional environment. It leverages PostgreSQL with PostGIS extensions for geographic data handling and enhances data integrity through the use of custom enum types.

## Usage
This SQL migration file should be executed in a PostgreSQL database to set up the necessary schema for the CRAIverse state persistence system. It creates the foundational tables and partitions required to handle various world zones and their states.

## Parameters/Props
- **world_zone_type**: Enum specifying types of world zones (`central`, `north`, `south`, `east`, `west`, `underground`, `sky`).
- **interaction_type**: Enum for defining possible interactions (`pickup`, `activate`, `dialogue`, `quest`, `portal`, `combat`).
- **progress_status**: Enum representing the status of tasks (`not_started`, `in_progress`, `completed`, `failed`).
  
### Tables Created
- **world_zones**: Master table for world zones.
  - `id`: UUID, primary key.
  - `name`: Unique identifier for zones.
  - `zone_type`: Type of zone (enum).
  - `boundary`: Geometric boundary of the zone.
  - `metadata`: JSONB for additional data.
  - `active`: Boolean indicating if the zone is active.
  - `created_at`: Timestamp of creation.
  - `updated_at`: Timestamp of last update.

- **world_states**: Table for storing state data of the zones.
  - `id`: UUID, primary key.
  - `world_id`: Foreign key referencing `world_zones`.
  - `zone_type`: Type of zone (enum).
  - `position`: Geometric point specifying state location.
  - `state_data`: JSONB for state-specific data.
  - `version`: Integer representing state version.
  - `checksum`: Text for data integrity.
  - `created_at`: Timestamp of creation.
  - `updated_at`: Timestamp of last update.

### Partitions
- **world_states_central**
- **world_states_north**
- **world_states_south**
- **world_states_east**
- **world_states_west**
- **world_states_underground**
- **world_states_sky**

Each partition corresponds to the respective `zone_type` and is designed to efficiently manage and query states based on their geographical characteristics.

## Return Values
Executing this migration does not return values but sets up the database schema, ready for data insertion and further operations related to the CRAIverse state management.

## Examples
To execute the migration, run the following command in your PostgreSQL environment:

```bash
psql -U username -d database_name -f supabase/migrations/20241201000000_create_craiverse_state_tables.sql
```

This creates the necessary tables and partitions for managing world zones and their associated states, enabling developers to store game state information systematically.