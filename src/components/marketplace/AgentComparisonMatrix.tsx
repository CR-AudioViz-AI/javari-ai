```sql
-- Migration: Create Agent Comparison Matrix Tables
-- Description: Tables for agent features, pricing, benchmarks, and comparison tracking

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agent_features table for feature mapping
CREATE TABLE IF NOT EXISTS agent_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    feature_category VARCHAR(100) NOT NULL,
    feature_name VARCHAR(200) NOT NULL,
    feature_value TEXT,
    score INTEGER CHECK (score >= 1 AND score <= 5),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, feature_category, feature_name)
);

-- Create agent_pricing table for pricing tiers
CREATE TABLE IF NOT EXISTS agent_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tier_name VARCHAR(100) NOT NULL,
    tier_type VARCHAR(50) NOT NULL CHECK (tier_type IN ('free', 'basic', 'premium', 'enterprise')),
    price_amount DECIMAL(10,2),
    price_currency VARCHAR(3) DEFAULT 'USD',
    billing_period VARCHAR(20) CHECK (billing_period IN ('hour', 'day', 'month', 'year')),
    requests_included INTEGER,
    features_included TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent_benchmarks table for performance metrics
CREATE TABLE IF NOT EXISTS agent_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    benchmark_category VARCHAR(100) NOT NULL,
    metric_name VARCHAR(200) NOT NULL,
    metric_value DECIMAL(10,4),
    metric_unit VARCHAR(50),
    benchmark_date DATE DEFAULT CURRENT_DATE,
    test_conditions JSONB,
    percentile_rank INTEGER CHECK (percentile_rank >= 1 AND percentile_rank <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, benchmark_category, metric_name, benchmark_date)
);

-- Create comparison_sessions table for tracking comparisons
CREATE TABLE IF NOT EXISTS comparison_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    agent_ids UUID[],
    comparison_criteria JSONB,
    criteria_weights JSONB,
    export_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feature_categories table for standardized categories
CREATE TABLE IF NOT EXISTS feature_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name VARCHAR(100) UNIQUE NOT NULL,
    category_description TEXT,
    display_order INTEGER DEFAULT 0,
    icon_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comparison_criteria table for custom criteria
CREATE TABLE IF NOT EXISTS comparison_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    criteria_name VARCHAR(200) NOT NULL,
    criteria_type VARCHAR(50) CHECK (criteria_type IN ('feature', 'pricing', 'performance', 'custom')),
    weight_default DECIMAL(3,2) DEFAULT 1.0,
    is_system_defined BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_agent_features_agent_id ON agent_features(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_features_category ON agent_features(feature_category);
CREATE INDEX IF NOT EXISTS idx_agent_features_score ON agent_features(score);

CREATE INDEX IF NOT EXISTS idx_agent_pricing_agent_id ON agent_pricing(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_tier_type ON agent_pricing(tier_type);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_active ON agent_pricing(is_active);

CREATE INDEX IF NOT EXISTS idx_agent_benchmarks_agent_id ON agent_benchmarks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_benchmarks_category ON agent_benchmarks(benchmark_category);
CREATE INDEX IF NOT EXISTS idx_agent_benchmarks_date ON agent_benchmarks(benchmark_date);

CREATE INDEX IF NOT EXISTS idx_comparison_sessions_user_id ON comparison_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_comparison_sessions_created ON comparison_sessions(created_at);

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_agent_features_updated_at
    BEFORE UPDATE ON agent_features
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_pricing_updated_at
    BEFORE UPDATE ON agent_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_benchmarks_updated_at
    BEFORE UPDATE ON agent_benchmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comparison_sessions_updated_at
    BEFORE UPDATE ON comparison_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE agent_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_criteria ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_features
CREATE POLICY "Agent features are publicly readable"
    ON agent_features FOR SELECT
    USING (true);

CREATE POLICY "Agent owners can manage features"
    ON agent_features FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = agent_features.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- RLS policies for agent_pricing
CREATE POLICY "Agent pricing is publicly readable"
    ON agent_pricing FOR SELECT
    USING (is_active = true);

CREATE POLICY "Agent owners can manage pricing"
    ON agent_pricing FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = agent_pricing.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- RLS policies for agent_benchmarks
CREATE POLICY "Agent benchmarks are publicly readable"
    ON agent_benchmarks FOR SELECT
    USING (true);

CREATE POLICY "Agent owners can manage benchmarks"
    ON agent_benchmarks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = agent_benchmarks.agent_id 
            AND agents.owner_id = auth.uid()
        )
    );

-- RLS policies for comparison_sessions
CREATE POLICY "Users can view their own comparison sessions"
    ON comparison_sessions FOR SELECT
    USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create comparison sessions"
    ON comparison_sessions FOR INSERT
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their own comparison sessions"
    ON comparison_sessions FOR UPDATE
    USING (user_id = auth.uid());

-- RLS policies for feature_categories
CREATE POLICY "Feature categories are publicly readable"
    ON feature_categories FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage feature categories"
    ON feature_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- RLS policies for comparison_criteria
CREATE POLICY "Comparison criteria are publicly readable"
    ON comparison_criteria FOR SELECT
    USING (true);

CREATE POLICY "Users can manage their own criteria"
    ON comparison_criteria FOR ALL
    USING (created_by = auth.uid());

CREATE POLICY "System criteria are read-only for users"
    ON comparison_criteria FOR SELECT
    USING (is_system_defined = true);

-- Insert default feature categories
INSERT INTO feature_categories (category_name, category_description, display_order, icon_name) VALUES
('Core Features', 'Essential functionality and capabilities', 1, 'zap'),
('Performance', 'Speed, accuracy, and efficiency metrics', 2, 'activity'),
('Integration', 'API compatibility and third-party connections', 3, 'link'),
('Scalability', 'Capacity and resource handling', 4, 'trending-up'),
('Security', 'Data protection and compliance features', 5, 'shield'),
('Support', 'Documentation, community, and customer service', 6, 'help-circle'),
('Pricing', 'Cost structure and value proposition', 7, 'dollar-sign'),
('Customization', 'Flexibility and configuration options', 8, 'settings')
ON CONFLICT (category_name) DO NOTHING;

-- Insert default system comparison criteria
INSERT INTO comparison_criteria (criteria_name, criteria_type, weight_default, is_system_defined) VALUES
('Overall Performance Score', 'performance', 1.0, true),
('Feature Completeness', 'feature', 0.8, true),
('Cost Effectiveness', 'pricing', 0.9, true),
('Accuracy Rating', 'performance', 1.0, true),
('Response Time', 'performance', 0.7, true),
('API Quality', 'feature', 0.6, true),
('Documentation Quality', 'feature', 0.5, true),
('Community Support', 'feature', 0.4, true)
ON CONFLICT DO NOTHING;

-- Create view for comprehensive agent comparison data
CREATE OR REPLACE VIEW agent_comparison_view AS
SELECT 
    a.id,
    a.name,
    a.description,
    a.category,
    a.logo_url,
    a.rating,
    a.usage_count,
    a.is_featured,
    
    -- Aggregate features
    COALESCE(
        json_agg(
            json_build_object(
                'category', af.feature_category,
                'name', af.feature_name,
                'value', af.feature_value,
                'score', af.score,
                'available', af.is_available
            ) ORDER BY af.feature_category, af.feature_name
        ) FILTER (WHERE af.id IS NOT NULL),
        '[]'::json
    ) as features,
    
    -- Aggregate pricing
    COALESCE(
        json_agg(
            json_build_object(
                'tier', ap.tier_name,
                'type', ap.tier_type,
                'price', ap.price_amount,
                'currency', ap.price_currency,
                'billing_period', ap.billing_period,
                'requests_included', ap.requests_included,
                'features_included', ap.features_included
            ) ORDER BY 
                CASE ap.tier_type 
                    WHEN 'free' THEN 1 
                    WHEN 'basic' THEN 2 
                    WHEN 'premium' THEN 3 
                    WHEN 'enterprise' THEN 4 
                END
        ) FILTER (WHERE ap.id IS NOT NULL AND ap.is_active),
        '[]'::json
    ) as pricing,
    
    -- Aggregate benchmarks
    COALESCE(
        json_agg(
            json_build_object(
                'category', ab.benchmark_category,
                'metric', ab.metric_name,
                'value', ab.metric_value,
                'unit', ab.metric_unit,
                'percentile', ab.percentile_rank
            ) ORDER BY ab.benchmark_category, ab.metric_name
        ) FILTER (WHERE ab.id IS NOT NULL),
        '[]'::json
    ) as benchmarks,
    
    -- Calculate average feature score
    ROUND(AVG(af.score)::numeric, 2) as avg_feature_score,
    
    -- Get minimum price
    MIN(ap.price_amount) FILTER (WHERE ap.tier_type != 'free') as min_price,
    
    a.created_at,
    a.updated_at
    
FROM agents a
LEFT JOIN agent_features af ON a.id = af.agent_id
LEFT JOIN agent_pricing ap ON a.id = ap.agent_id AND ap.is_active = true
LEFT JOIN agent_benchmarks ab ON a.id = ab.agent_id
WHERE a.status = 'active'
GROUP BY a.id, a.name, a.description, a.category, a.logo_url, a.rating, a.usage_count, a.is_featured, a.created_at, a.updated_at;

-- Grant permissions on view
GRANT SELECT ON agent_comparison_view TO authenticated, anon;
```