-- supabase/migrations/20260220_beta_invites.sql
-- CR AudioViz AI — Beta Invites & Waitlist
-- 2026-02-20 — STEP 8 Go-Live

-- ── beta_config ───────────────────────────────────────────────────────────────
-- Controls whether beta is open or invite-only

CREATE TABLE IF NOT EXISTS beta_config (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phase        TEXT        NOT NULL DEFAULT 'open_beta'
                           CHECK (phase IN ('closed','invite_only','open_beta','general')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed initial config
INSERT INTO beta_config (phase) VALUES ('open_beta')
ON CONFLICT DO NOTHING;

-- ── waitlist ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS waitlist (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        NOT NULL UNIQUE,
  name         TEXT,
  invited      BOOLEAN     NOT NULL DEFAULT false,
  invite_code  TEXT,
  source       TEXT        DEFAULT 'beta_page',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email   ON waitlist (email);
CREATE INDEX IF NOT EXISTS idx_waitlist_invited ON waitlist (invited, created_at);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Service role can manage all; no user-level access (PII protection)
CREATE POLICY "waitlist_service_all"
  ON waitlist FOR ALL
  USING (auth.role() = 'service_role');

-- ── invite_codes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invite_codes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT        NOT NULL UNIQUE,
  email         TEXT,                  -- pre-assigned to specific email (optional)
  uses_max      INT         NOT NULL DEFAULT 1,
  uses_current  INT         NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT uses_valid CHECK (uses_current <= uses_max)
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code   ON invite_codes (code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_invite_codes_email  ON invite_codes (email) WHERE email IS NOT NULL;

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_codes_service_all"
  ON invite_codes FOR ALL
  USING (auth.role() = 'service_role');

-- ── invite_redemptions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invite_redemptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id      UUID        NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);

ALTER TABLE invite_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_redemptions_service_all"
  ON invite_redemptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "invite_redemptions_user_own"
  ON invite_redemptions FOR SELECT
  USING (user_id = auth.uid());

-- ── Function: redeem invite code ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION redeem_invite_code(
  p_code    TEXT,
  p_user_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code    invite_codes%ROWTYPE;
  v_result  JSONB;
BEGIN
  -- Lock the row for update
  SELECT * INTO v_code
  FROM invite_codes
  WHERE code = p_code AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive invite code');
  END IF;

  -- Check expiry
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite code has expired');
  END IF;

  -- Check uses
  IF v_code.uses_current >= v_code.uses_max THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite code has reached its usage limit');
  END IF;

  -- Check email restriction
  IF v_code.email IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM auth.users WHERE id = p_user_id AND email = v_code.email
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'This invite code is restricted to a specific email address');
    END IF;
  END IF;

  -- Already redeemed by this user?
  IF EXISTS (SELECT 1 FROM invite_redemptions WHERE code_id = v_code.id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Code already redeemed by this user');
  END IF;

  -- Record redemption
  INSERT INTO invite_redemptions (code_id, user_id) VALUES (v_code.id, p_user_id);

  -- Increment uses
  UPDATE invite_codes SET uses_current = uses_current + 1 WHERE id = v_code.id;

  RETURN jsonb_build_object('success', true, 'message', 'Invite code redeemed successfully');
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON beta_config         TO service_role;
GRANT SELECT, INSERT, UPDATE ON waitlist            TO service_role;
GRANT SELECT, INSERT, UPDATE ON invite_codes        TO service_role;
GRANT SELECT, INSERT         ON invite_redemptions  TO service_role;
GRANT EXECUTE ON FUNCTION redeem_invite_code        TO service_role;
