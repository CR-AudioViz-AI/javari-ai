-- supabase/migrations/20260310_grant_roadmaps_table.sql
-- Purpose: Grant service_role full access to roadmaps table.
--          Required for CRAV_PHASE_2 ingest and all future roadmap ingestion.
-- Date: 2026-03-10

-- Disable RLS (internal orchestration table — not user-facing)
ALTER TABLE roadmaps DISABLE ROW LEVEL SECURITY;

-- Grant full access to service_role
GRANT ALL ON TABLE roadmaps TO service_role;
GRANT ALL ON TABLE roadmaps TO authenticated;

-- Also ensure roadmap_tasks has no blocking RLS for service_role
ALTER TABLE roadmap_tasks DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE roadmap_tasks TO service_role;
GRANT ALL ON TABLE roadmap_tasks TO authenticated;
