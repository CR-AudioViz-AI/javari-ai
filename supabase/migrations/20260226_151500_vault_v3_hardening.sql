-- Vault v3 Hardening Migration
-- Removes plaintext storage and enforces strict RLS

ALTER TABLE platform_secrets_v2
  DROP COLUMN IF EXISTS plaintext_value;

-- Ensure access_count default
ALTER TABLE platform_secrets_v2
  ALTER COLUMN access_count SET DEFAULT 0;

-- Remove insecure policies
DROP POLICY IF EXISTS "Service role full access secrets_v2" ON platform_secrets_v2;
DROP POLICY IF EXISTS "Service role full access audit_log" ON vault_audit_log;

-- Strict RLS (service_role only)
CREATE POLICY "service_role_only_secrets"
  ON platform_secrets_v2
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_audit"
  ON vault_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Deterministic access counter RPC
CREATE OR REPLACE FUNCTION increment_secret_access(secret_name TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE platform_secrets_v2
  SET access_count = access_count + 1
  WHERE name = secret_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
