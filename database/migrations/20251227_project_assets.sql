-- ================================================================
-- JAVARI PROJECT ASSETS - Created Dec 27, 2025
-- ================================================================
-- Stores all Javari-built projects for central access and customer assets

-- Central project registry (for Roy/Admin)
CREATE TABLE IF NOT EXISTS javari_project_registry (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_name text NOT NULL,
  project_type text NOT NULL DEFAULT 'component', -- component, app, full-stack
  description text,
  github_repo text NOT NULL,
  deployment_url text,
  vercel_project_id text,
  category text, -- real_estate, law, ai, avatar, business, creative, etc.
  tags text[], -- searchable tags
  complexity text DEFAULT 'simple', -- simple, moderate, detailed
  build_id text,
  status text DEFAULT 'active', -- active, archived, failed
  created_by uuid REFERENCES auth.users(id),
  created_for_user uuid REFERENCES auth.users(id), -- null = internal/Roy
  code_snapshot jsonb, -- stores the component code
  metadata jsonb, -- additional info like file count, dependencies
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Customer assets folder (per-user)
CREATE TABLE IF NOT EXISTS customer_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES javari_project_registry(id),
  asset_type text NOT NULL DEFAULT 'project', -- project, component, template, image, document
  asset_name text NOT NULL,
  asset_url text,
  github_url text,
  deployment_url text,
  folder_path text DEFAULT '/', -- virtual folder structure
  file_size integer,
  metadata jsonb,
  is_favorite boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_project_registry_category ON javari_project_registry(category);
CREATE INDEX IF NOT EXISTS idx_project_registry_created_for ON javari_project_registry(created_for_user);
CREATE INDEX IF NOT EXISTS idx_project_registry_status ON javari_project_registry(status);
CREATE INDEX IF NOT EXISTS idx_customer_assets_user ON customer_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_assets_type ON customer_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_customer_assets_folder ON customer_assets(user_id, folder_path);

-- RLS Policies
ALTER TABLE javari_project_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_assets ENABLE ROW LEVEL SECURITY;

-- Admin can see all projects
CREATE POLICY "Admin can view all projects" ON javari_project_registry 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can see their own projects
CREATE POLICY "Users can view own projects" ON javari_project_registry 
  FOR SELECT USING (created_for_user = auth.uid() OR created_by = auth.uid());

-- Customer assets - users can only see their own
CREATE POLICY "Users can view own assets" ON customer_assets 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own assets" ON customer_assets 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own assets" ON customer_assets 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own assets" ON customer_assets 
  FOR DELETE USING (user_id = auth.uid());
