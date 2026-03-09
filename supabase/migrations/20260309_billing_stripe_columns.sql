-- supabase/migrations/20260309_billing_stripe_columns.sql
-- Javari AI — Stripe Billing Infrastructure
-- Purpose: Add Stripe customer/subscription columns and billing_events log.
-- Date: 2026-03-09

-- ── Add Stripe columns to users_profile ─────────────────────────────────────
ALTER TABLE users_profile
  ADD COLUMN IF NOT EXISTS stripe_customer_id  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_sub_id        TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status  TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS full_name            TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url           TEXT,
  ADD COLUMN IF NOT EXISTS bio                  TEXT,
  ADD COLUMN IF NOT EXISTS website              TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step      INTEGER DEFAULT 0;

-- Indexes for Stripe lookups (high-frequency in webhook handler)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON users_profile (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_sub
  ON users_profile (stripe_sub_id)
  WHERE stripe_sub_id IS NOT NULL;

-- ── Billing events audit log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type          TEXT NOT NULL,
  tier                TEXT,
  stripe_customer_id  TEXT,
  stripe_sub_id       TEXT,
  stripe_event_id     TEXT UNIQUE,   -- idempotency key
  amount_cents        INTEGER DEFAULT 0,
  currency            TEXT DEFAULT 'usd',
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user_id
  ON billing_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_events_type
  ON billing_events (event_type, occurred_at DESC);

-- RLS: admins can read all; users can only read their own
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "billing_events_user_read"
  ON billing_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "billing_events_service_write"
  ON billing_events FOR INSERT
  WITH CHECK (true);  -- service_role only via API

-- ── Social impact / mission tracking table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS social_impact_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  module_type     TEXT NOT NULL,  -- 'veteran', 'first_responder', 'faith', 'animal_rescue'
  org_name        TEXT NOT NULL,
  org_type        TEXT,
  contact_email   TEXT NOT NULL,
  contact_name    TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'pending',  -- pending, approved, rejected
  approved_at     TIMESTAMPTZ,
  approved_by     UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_impact_user
  ON social_impact_applications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_impact_status
  ON social_impact_applications (status, module_type);

ALTER TABLE social_impact_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "social_impact_user_own"
  ON social_impact_applications FOR ALL
  USING (auth.uid() = user_id);

-- ── Avatar system table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_avatars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name            TEXT DEFAULT 'My Avatar',
  style           TEXT DEFAULT 'professional',  -- professional, casual, creative, mission
  color_primary   TEXT DEFAULT '#3b82f6',
  color_secondary TEXT DEFAULT '#a855f7',
  emoji           TEXT DEFAULT '🤖',
  personality     TEXT DEFAULT 'helpful',
  voice_style     TEXT DEFAULT 'warm',
  badge           TEXT,
  level           INTEGER DEFAULT 1,
  xp              INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "avatars_user_own"
  ON user_avatars FOR ALL
  USING (auth.uid() = user_id);

-- ── Grant execution credits on signup trigger ────────────────────────────────
-- Ensure every new user gets a free credits row automatically
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile row
  INSERT INTO users_profile (id, subscription_tier, credits, onboarding_completed)
  VALUES (NEW.id, 'free', 100, false)
  ON CONFLICT (id) DO NOTHING;

  -- Create credits row (if user_credits table exists)
  INSERT INTO user_credits (user_id, balance, lifetime_earned, lifetime_spent)
  VALUES (NEW.id, 100, 100, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create starter avatar
  INSERT INTO user_avatars (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger to ensure it's current
DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

COMMENT ON FUNCTION public.handle_new_user_credits() IS
  'Javari AI — Auto-provision profile, credits (100 free), and starter avatar on signup';
