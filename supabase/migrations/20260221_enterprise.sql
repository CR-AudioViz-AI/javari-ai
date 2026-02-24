-- supabase/migrations/20260221_enterprise.sql
-- CR AudioViz AI — STEP 10: Enterprise Tables
-- organizations, workspaces, members, partner_keys, partner_logs, audit_log, billing

-- ── organizations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  slug         TEXT        UNIQUE NOT NULL,
  plan         TEXT        NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','business','enterprise','custom')),
  status       TEXT        NOT NULL DEFAULT 'trial' CHECK (status IN ('active','suspended','trial')),
  sso_enabled  BOOLEAN     NOT NULL DEFAULT false,
  sso_provider TEXT,
  max_seats    INT         NOT NULL DEFAULT 5,
  credit_pool  INT         NOT NULL DEFAULT 10000,
  owner_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orgs_slug    ON organizations (slug);
CREATE INDEX IF NOT EXISTS idx_orgs_owner   ON organizations (owner_id);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orgs_service_all"   ON organizations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "orgs_owner_select"  ON organizations FOR SELECT USING (owner_id = auth.uid());

-- ── workspaces ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL,
  team_type     TEXT        NOT NULL DEFAULT 'general' CHECK (team_type IN ('marketing','engineering','ops','support','general')),
  credit_quota  INT         NOT NULL DEFAULT 1000,
  credit_used   INT         NOT NULL DEFAULT 0,
  is_default    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_ws_org ON workspaces (org_id);
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_service_all" ON workspaces FOR ALL USING (auth.role() = 'service_role');

-- ── workspace_members ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','manager','member','viewer')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_wm_workspace ON workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user      ON workspace_members (user_id);
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wm_service_all"  ON workspace_members FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "wm_user_own"     ON workspace_members FOR SELECT USING (user_id = auth.uid());

-- ── seat_assignments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seat_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat_type    TEXT        NOT NULL DEFAULT 'full' CHECK (seat_type IN ('full','viewer','api_only')),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by  UUID        REFERENCES auth.users(id),
  UNIQUE (org_id, user_id)
);
ALTER TABLE seat_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seats_service_all" ON seat_assignments FOR ALL USING (auth.role() = 'service_role');

-- ── partner_keys ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   TEXT        NOT NULL,
  key_hash     TEXT        UNIQUE NOT NULL,
  key_prefix   TEXT        NOT NULL,
  scopes       TEXT[]      NOT NULL DEFAULT '{}',
  rate_limit   INT         NOT NULL DEFAULT 60,
  expires_at   TIMESTAMPTZ,
  active       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pk_partner ON partner_keys (partner_id, active);
CREATE INDEX IF NOT EXISTS idx_pk_hash    ON partner_keys (key_hash);
ALTER TABLE partner_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pk_service_all" ON partner_keys FOR ALL USING (auth.role() = 'service_role');

-- ── partner_logs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  TEXT        NOT NULL,
  key_id      UUID        REFERENCES partner_keys(id) ON DELETE SET NULL,
  endpoint    TEXT        NOT NULL,
  method      TEXT        NOT NULL,
  status_code INT,
  latency_ms  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pl_partner  ON partner_logs (partner_id, created_at DESC);
ALTER TABLE partner_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_service_all" ON partner_logs FOR ALL USING (auth.role() = 'service_role');

-- ── partner_manifests ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_manifests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   TEXT        NOT NULL,
  manifest     JSONB       NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending_review',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at  TIMESTAMPTZ,
  reviewed_by  UUID        REFERENCES auth.users(id)
);
ALTER TABLE partner_manifests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_service_all" ON partner_manifests FOR ALL USING (auth.role() = 'service_role');

-- ── audit_log (immutable) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT        PRIMARY KEY,
  org_id      UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES auth.users(id)    ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  resource    TEXT,
  resource_id TEXT,
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB,
  severity    TEXT        NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org     ON audit_log (org_id, created_at DESC) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_log (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_service_all"  ON audit_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "audit_insert_anon"  ON audit_log FOR INSERT WITH CHECK (true);
-- Prevent updates/deletes to enforce immutability
CREATE POLICY "audit_no_update"    ON audit_log FOR UPDATE USING (false);
CREATE POLICY "audit_no_delete"    ON audit_log FOR DELETE USING (false);

-- ── Enterprise billing (org-level) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enterprise_billing (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer TEXT,
  plan            TEXT        NOT NULL DEFAULT 'starter',
  seats_purchased INT         NOT NULL DEFAULT 5,
  annual          BOOLEAN     NOT NULL DEFAULT false,
  billing_email   TEXT,
  next_invoice_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE enterprise_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eb_service_all" ON enterprise_billing FOR ALL USING (auth.role() = 'service_role');

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON organizations      TO service_role;
GRANT SELECT, INSERT, UPDATE ON workspaces         TO service_role;
GRANT SELECT, INSERT, UPDATE ON workspace_members  TO service_role;
GRANT SELECT, INSERT, UPDATE ON seat_assignments   TO service_role;
GRANT SELECT, INSERT, UPDATE ON partner_keys       TO service_role;
GRANT SELECT, INSERT         ON partner_logs       TO service_role;
GRANT SELECT, INSERT, UPDATE ON partner_manifests  TO service_role;
GRANT SELECT, INSERT         ON audit_log          TO service_role;
GRANT SELECT, INSERT, UPDATE ON enterprise_billing TO service_role;
