-- Migration for CR AudioViz AI platform
-- Task: Assess if any repos have user data/databases
-- Date: 2023-10-03
-- This migration checks for existing user data and databases in the schema.
-- No schema changes are needed at this time.

-- Please review the existing tables and indexes for user data.

-- Check existing tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Check existing indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public';

-- Check for user-related data
SELECT *
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name ILIKE '%user%';

-- Committed by Javari
-- Task: r2-data-migration-need-to-assess-if-any-repos-have--014
-- Executed live: false
