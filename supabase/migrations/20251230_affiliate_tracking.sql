-- ═══════════════════════════════════════════════════════════════════════════════
-- AFFILIATE TRACKING DATABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════════
-- Monday, December 30, 2025, 1:27 PM EST
-- Henderson Standard - Complete affiliate attribution
-- ═══════════════════════════════════════════════════════════════════════════════

-- Affiliate Clicks Table
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id TEXT UNIQUE NOT NULL,
  program_id TEXT NOT NULL,
  network TEXT DEFAULT 'direct',
  placement TEXT,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  page_url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliate Conversions Table
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id TEXT UNIQUE NOT NULL,
  click_id TEXT REFERENCES affiliate_clicks(click_id),
  program_id TEXT NOT NULL,
  network TEXT DEFAULT 'direct',
  user_id UUID REFERENCES auth.users(id),
  order_id TEXT,
  order_amount DECIMAL(10,2),
  commission_amount DECIMAL(10,2),
  commission_rate DECIMAL(5,4),
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, paid
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

-- Affiliate Programs Table (for dynamic management)
CREATE TABLE IF NOT EXISTS affiliate_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  network TEXT NOT NULL,
  link TEXT NOT NULL,
  commission_type TEXT NOT NULL, -- recurring, one-time, per-booking, per-lead
  commission_rate TEXT,
  category TEXT,
  platforms TEXT[] DEFAULT '{}',
  badge TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_program ON affiliate_clicks(program_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_network ON affiliate_clicks(network);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_created ON affiliate_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_user ON affiliate_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_session ON affiliate_clicks(session_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_program ON affiliate_conversions(program_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_status ON affiliate_conversions(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_created ON affiliate_conversions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_click ON affiliate_conversions(click_id);

-- RLS Policies
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_programs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access clicks" ON affiliate_clicks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access conversions" ON affiliate_conversions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access programs" ON affiliate_programs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own clicks
CREATE POLICY "Users view own clicks" ON affiliate_clicks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view their own conversions
CREATE POLICY "Users view own conversions" ON affiliate_conversions FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone can view active programs
CREATE POLICY "Public view active programs" ON affiliate_programs FOR SELECT
  USING (is_active = true);

-- Insert initial affiliate programs
INSERT INTO affiliate_programs (program_id, name, network, link, commission_type, commission_rate, category, platforms, badge, description)
VALUES
  ('elevenlabs', 'ElevenLabs', 'partnerstack', 'https://try.elevenlabs.io/z24t231p5l5f', 'recurring', '22%', 'ai-voice', ARRAY['javari-ai', 'crav-website'], 'Premium Voices', 'AI voice synthesis with 1000+ professional voices'),
  ('viator', 'Viator', 'viator', 'https://www.viator.com/?pid=P00280339', 'per-booking', '8%', 'travel', ARRAY['orlando-trip-deal', 'crav-website'], 'Best Tours', 'Tours and activities worldwide'),
  ('getyourguide', 'GetYourGuide', 'getyourguide', 'https://www.getyourguide.com/?partner_id=VZYKZYE', 'per-booking', '8%', 'travel', ARRAY['orlando-trip-deal', 'crav-website'], NULL, 'Tours, attractions, and experiences'),
  ('klook', 'Klook', 'klook', 'https://www.klook.com/?aid=106921', 'per-booking', '3-5%', 'travel', ARRAY['orlando-trip-deal'], NULL, 'Activities and attractions in Asia & beyond'),
  ('discovercars', 'Discover Cars', 'discovercars', 'https://www.discovercars.com/?a_aid=royhenders', 'recurring', '3% lifetime', 'travel', ARRAY['orlando-trip-deal', 'crav-website'], NULL, 'Car rental comparison'),
  ('printful', 'Printful', 'partnerstack', 'https://www.printful.com/a/craudiovizai', 'recurring', '10%', 'pod', ARRAY['market-forge', 'crav-website'], 'Create & Sell', 'Print on demand products'),
  ('crawlbase', 'Crawlbase', 'direct', 'https://crawlbase.com/?s=mMXcTb6S', 'recurring', '25%', 'developer', ARRAY['javari-ai', 'market-oracle'], NULL, 'Web scraping and crawling API')
ON CONFLICT (program_id) DO UPDATE SET
  name = EXCLUDED.name,
  link = EXCLUDED.link,
  commission_rate = EXCLUDED.commission_rate,
  updated_at = NOW();

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_affiliate_program_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS affiliate_programs_updated_at ON affiliate_programs;
CREATE TRIGGER affiliate_programs_updated_at
  BEFORE UPDATE ON affiliate_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_program_timestamp();
