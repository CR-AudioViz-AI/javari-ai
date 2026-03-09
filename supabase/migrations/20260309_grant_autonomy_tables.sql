-- supabase/migrations/20260309_grant_autonomy_tables.sql
-- Purpose: GRANT service_role full access to 4 autonomy tables.
-- The 20260309_missing_autonomy_tables.sql created them but forgot GRANTs.
-- Date: 2026-03-09

GRANT ALL ON TABLE autonomy_execution_log     TO service_role;
GRANT ALL ON TABLE autonomy_execution_log     TO authenticated;
GRANT ALL ON TABLE javari_scheduler_lock      TO service_role;
GRANT ALL ON TABLE javari_scheduler_lock      TO authenticated;
GRANT ALL ON TABLE javari_security_events     TO service_role;
GRANT ALL ON TABLE javari_security_events     TO authenticated;
GRANT ALL ON TABLE javari_model_usage_metrics TO service_role;
GRANT ALL ON TABLE javari_model_usage_metrics TO authenticated;
