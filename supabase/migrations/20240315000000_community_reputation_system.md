# Implement Community Reputation System Database

# Community Reputation System Database

## Purpose

The Community Reputation System Database implementation provides a structured way to manage user reputation through a comprehensive scoring system. This system includes trust levels, user reputation scores, and mechanisms for score decay and tracking events related to reputation changes.

## Usage

This SQL migration file is designed to be executed in a PostgreSQL database using Supabase. It sets up the necessary tables and constraints to support the community reputation system.

## Parameters/Props

### Tables

1. **trust_levels**
   - **id**: `SERIAL` PK - Unique identifier for the trust level.
   - **name**: `VARCHAR(50)` - Unique name of the trust level.
   - **min_reputation**: `INTEGER` - Minimum reputation required for this trust level.
   - **max_reputation**: `INTEGER` (nullable) - Maximum reputation for this trust level.
   - **description**: `TEXT` - Description of the trust level.
   - **color_code**: `VARCHAR(7)` - Color representation for the trust level.
   - **sort_order**: `INTEGER` - Order in which to display trust levels.
   - **created_at**: `TIMESTAMPTZ` - Timestamp of record creation.
   - **updated_at**: `TIMESTAMPTZ` - Timestamp of last update.

2. **reputation_scores**
   - **id**: `UUID` PK - Unique identifier for the reputation score record.
   - **user_id**: `UUID` - Foreign key referencing the user profile.
   - **current_score**: `INTEGER` - Current reputation score of the user.
   - **lifetime_score**: `INTEGER` - Total reputation score earned.
   - **trust_level_id**: `INTEGER` - Foreign key referencing the trust level.
   - **last_decay_at**: `TIMESTAMPTZ` - Timestamp when the last decay occurred.
   - **score_breakdown**: `JSONB` - JSON structure to detail score components.
   - **created_at**: `TIMESTAMPTZ` - Timestamp of record creation.
   - **updated_at**: `TIMESTAMPTZ` - Timestamp of last update.

3. **reputation_events**
   - **id**: `UUID` PK - Unique identifier for the reputation event.
   - (Further definition required, not included in the snippet.)

### Constraints

- Unique indexes are created for:
  - Trust level ranges to prevent overlaps.
  - Each user to ensure a single reputation score record.

## Return Values

The migration does not return values directly but establishes the necessary database schema for managing community reputation. Successful execution will result in the creation of three tables with defined relationships and constraints.

## Examples

To apply this migration, run the following command in your PostgreSQL management interface:

```bash
psql -U your_user -d your_database -f supabase/migrations/20240315000000_community_reputation_system.sql
```

After applying the migration, you may insert trust levels like so:

```sql
INSERT INTO trust_levels (name, min_reputation, max_reputation, description, color_code, sort_order)
VALUES ('Beginner', 0, 100, 'Just starting out', '#6B7280', 1);
```

And to update a user’s reputation score:

```sql
UPDATE reputation_scores
SET current_score = current_score + 10, last_decay_at = NOW()
WHERE user_id = 'your-user-uuid';
```

This setup allows for ongoing management and tracking of community reputation, enabling trust-building and engagement within your platform.