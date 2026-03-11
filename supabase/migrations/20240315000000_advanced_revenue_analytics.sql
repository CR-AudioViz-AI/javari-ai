```sql
-- Advanced Revenue Analytics Migration
-- Creates comprehensive revenue analytics schema with tables for revenue tracking,
-- metrics aggregation, predictive models, and report generation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Revenue transactions table with detailed breakdown
CREATE TABLE IF NOT EXISTS revenue_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'subscription', 'one_time_payment', 'tip', 'commission', 'royalty', 'refund', 'chargeback'
    )),
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN (
        'content_purchase', 'subscription_fee', 'platform_fee', 'creator_tip', 'affiliate_commission'
    )),
    source_id UUID, -- References content_items, subscription_plans, etc.
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    platform_fee_cents INTEGER DEFAULT 0,
    net_amount_cents INTEGER GENERATED ALWAYS AS (amount_cents - platform_fee_cents) STORED,
    payment_method VARCHAR(50),
    payment_processor VARCHAR(50),
    payment_processor_transaction_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'completed', 'failed', 'refunded', 'disputed'
    )),
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue metrics daily aggregation table
CREATE TABLE IF NOT EXISTS revenue_metrics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_revenue_cents INTEGER DEFAULT 0,
    subscription_revenue_cents INTEGER DEFAULT 0,
    one_time_revenue_cents INTEGER DEFAULT 0,
    tip_revenue_cents INTEGER DEFAULT 0,
    commission_revenue_cents INTEGER DEFAULT 0,
    refund_amount_cents INTEGER DEFAULT 0,
    net_revenue_cents INTEGER DEFAULT 0,
    platform_fees_cents INTEGER DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    unique_buyers_count INTEGER DEFAULT 0,
    avg_transaction_cents INTEGER DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    breakdown JSONB DEFAULT '{}', -- Detailed breakdown by source, method, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, date, currency)
);

-- Revenue predictions table for ML-generated forecasts
CREATE TABLE IF NOT EXISTS revenue_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prediction_date DATE NOT NULL,
    prediction_period VARCHAR(20) NOT NULL CHECK (prediction_period IN (
        'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
    )),
    predicted_revenue_cents INTEGER NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    model_version VARCHAR(50),
    input_features JSONB DEFAULT '{}',
    prediction_bands JSONB DEFAULT '{}', -- Upper/lower bounds
    actual_revenue_cents INTEGER, -- Filled after the period ends
    accuracy_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, prediction_date, prediction_period)
);

-- Revenue reports table for saved/exported reports
CREATE TABLE IF NOT EXISTS revenue_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'summary', 'detailed', 'comparative', 'forecast', 'tax', 'custom'
    )),
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    filters JSONB DEFAULT '{}',
    data JSONB NOT NULL,
    format VARCHAR(20) DEFAULT 'json' CHECK (format IN ('json', 'csv', 'pdf', 'xlsx')),
    file_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'generating', 'completed', 'failed', 'expired'
    )),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue analytics aggregation table for performance
CREATE TABLE IF NOT EXISTS revenue_analytics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    time_period VARCHAR(20) NOT NULL,
    date_key DATE NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, metric_type, time_period, date_key)
);

-- Creator revenue stats materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_revenue_stats AS
SELECT 
    rt.creator_id,
    COUNT(*) as total_transactions,
    SUM(rt.amount_cents) as total_revenue_cents,
    SUM(rt.net_amount_cents) as total_net_revenue_cents,
    AVG(rt.amount_cents) as avg_transaction_cents,
    COUNT(DISTINCT DATE(rt.created_at)) as active_days,
    SUM(CASE WHEN rt.transaction_type = 'subscription' THEN rt.amount_cents ELSE 0 END) as subscription_revenue_cents,
    SUM(CASE WHEN rt.transaction_type = 'one_time_payment' THEN rt.amount_cents ELSE 0 END) as one_time_revenue_cents,
    SUM(CASE WHEN rt.transaction_type = 'tip' THEN rt.amount_cents ELSE 0 END) as tip_revenue_cents,
    MIN(rt.created_at) as first_transaction_at,
    MAX(rt.created_at) as last_transaction_at,
    COUNT(DISTINCT rt.source_id) as unique_revenue_sources,
    EXTRACT(EPOCH FROM (NOW() - MIN(rt.created_at))) / 86400 as days_since_first_transaction
FROM revenue_transactions rt
WHERE rt.status = 'completed'
GROUP BY rt.creator_id;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_creator_id ON revenue_transactions(creator_id);
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_created_at ON revenue_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_status ON revenue_transactions(status);
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_type ON revenue_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_source ON revenue_transactions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_processor ON revenue_transactions(payment_processor, payment_processor_transaction_id);

CREATE INDEX IF NOT EXISTS idx_revenue_metrics_daily_creator_date ON revenue_metrics_daily(creator_id, date);
CREATE INDEX IF NOT EXISTS idx_revenue_metrics_daily_date ON revenue_metrics_daily(date);

CREATE INDEX IF NOT EXISTS idx_revenue_predictions_creator_id ON revenue_predictions(creator_id);
CREATE INDEX IF NOT EXISTS idx_revenue_predictions_date ON revenue_predictions(prediction_date);
CREATE INDEX IF NOT EXISTS idx_revenue_predictions_period ON revenue_predictions(prediction_period);

CREATE INDEX IF NOT EXISTS idx_revenue_reports_creator_id ON revenue_reports(creator_id);
CREATE INDEX IF NOT EXISTS idx_revenue_reports_created_at ON revenue_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_revenue_reports_status ON revenue_reports(status);

CREATE INDEX IF NOT EXISTS idx_revenue_analytics_cache_creator_metric ON revenue_analytics_cache(creator_id, metric_type, time_period);

-- Partial indexes for active data
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_active ON revenue_transactions(creator_id, created_at) 
WHERE status = 'completed';

-- GIN index for JSONB fields
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_metadata ON revenue_transactions USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_revenue_metrics_breakdown ON revenue_metrics_daily USING GIN(breakdown);

-- RLS Policies
ALTER TABLE revenue_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_analytics_cache ENABLE ROW LEVEL SECURITY;

-- RLS for revenue_transactions
CREATE POLICY "Users can view own revenue transactions" ON revenue_transactions
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can insert own revenue transactions" ON revenue_transactions
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own revenue transactions" ON revenue_transactions
    FOR UPDATE USING (auth.uid() = creator_id);

-- RLS for revenue_metrics_daily
CREATE POLICY "Users can view own revenue metrics" ON revenue_metrics_daily
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can manage revenue metrics" ON revenue_metrics_daily
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS for revenue_predictions
CREATE POLICY "Users can view own revenue predictions" ON revenue_predictions
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can manage revenue predictions" ON revenue_predictions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS for revenue_reports
CREATE POLICY "Users can manage own revenue reports" ON revenue_reports
    FOR ALL USING (auth.uid() = creator_id);

-- RLS for revenue_analytics_cache
CREATE POLICY "Users can view own analytics cache" ON revenue_analytics_cache
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can manage analytics cache" ON revenue_analytics_cache
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to calculate revenue growth rate
CREATE OR REPLACE FUNCTION calculate_revenue_growth(
    p_creator_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_period_type VARCHAR DEFAULT 'monthly'
) RETURNS TABLE (
    period_start DATE,
    period_end DATE,
    revenue_cents INTEGER,
    growth_rate DECIMAL,
    period_over_period_change DECIMAL
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    interval_text TEXT;
BEGIN
    interval_text := CASE p_period_type
        WHEN 'daily' THEN '1 day'
        WHEN 'weekly' THEN '7 days'
        WHEN 'monthly' THEN '1 month'
        WHEN 'quarterly' THEN '3 months'
        ELSE '1 month'
    END;

    RETURN QUERY
    WITH period_revenue AS (
        SELECT 
            date_trunc(p_period_type, rt.created_at)::DATE as period_start,
            (date_trunc(p_period_type, rt.created_at) + interval_text::interval - interval '1 day')::DATE as period_end,
            SUM(rt.net_amount_cents) as revenue_cents
        FROM revenue_transactions rt
        WHERE rt.creator_id = p_creator_id
            AND rt.status = 'completed'
            AND rt.created_at >= p_start_date
            AND rt.created_at <= p_end_date
        GROUP BY date_trunc(p_period_type, rt.created_at)
        ORDER BY period_start
    ),
    revenue_with_growth AS (
        SELECT 
            pr.period_start,
            pr.period_end,
            pr.revenue_cents::INTEGER,
            CASE 
                WHEN LAG(pr.revenue_cents) OVER (ORDER BY pr.period_start) = 0 THEN NULL
                ELSE ROUND(
                    ((pr.revenue_cents - LAG(pr.revenue_cents) OVER (ORDER BY pr.period_start)) * 100.0 / 
                     LAG(pr.revenue_cents) OVER (ORDER BY pr.period_start))::DECIMAL, 2
                )
            END as growth_rate,
            (pr.revenue_cents - LAG(pr.revenue_cents) OVER (ORDER BY pr.period_start))::DECIMAL as period_over_period_change
        FROM period_revenue pr
    )
    SELECT * FROM revenue_with_growth;
END;
$$;

-- Function to aggregate daily revenue metrics
CREATE OR REPLACE FUNCTION aggregate_daily_revenue_metrics(
    p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO revenue_metrics_daily (
        creator_id,
        date,
        total_revenue_cents,
        subscription_revenue_cents,
        one_time_revenue_cents,
        tip_revenue_cents,
        commission_revenue_cents,
        refund_amount_cents,
        net_revenue_cents,
        platform_fees_cents,
        transaction_count,
        unique_buyers_count,
        avg_transaction_cents,
        currency,
        breakdown
    )
    SELECT 
        rt.creator_id,
        p_date,
        SUM(rt.amount_cents),
        SUM(CASE WHEN rt.transaction_type = 'subscription' THEN rt.amount_cents ELSE 0 END),
        SUM(CASE WHEN rt.transaction_type = 'one_time_payment' THEN rt.amount_cents ELSE 0 END),
        SUM(CASE WHEN rt.transaction_type = 'tip' THEN rt.amount_cents ELSE 0 END),
        SUM(CASE WHEN rt.transaction_type = 'commission' THEN rt.amount_cents ELSE 0 END),
        SUM(CASE WHEN rt.transaction_type = 'refund' THEN rt.amount_cents ELSE 0 END),
        SUM(rt.net_amount_cents),
        SUM(rt.platform_fee_cents),
        COUNT(*),
        COUNT(DISTINCT rt.payment_processor_transaction_id),
        AVG(rt.amount_cents)::INTEGER,
        rt.currency,
        jsonb_build_object(
            'by_source_type', jsonb_object_agg(rt.source_type, SUM(rt.amount_cents)),
            'by_payment_method', jsonb_object_agg(COALESCE(rt.payment_method, 'unknown'), SUM(rt.amount_cents)),
            'by_status', jsonb_object_agg(rt.status, COUNT(*))
        )
    FROM revenue_transactions rt
    WHERE DATE(rt.created_at) = p_date
        AND rt.status IN ('completed', 'refunded')
    GROUP BY rt.creator_id, rt.currency
    ON CONFLICT (creator_id, date, currency) 
    DO UPDATE SET
        total_revenue_cents = EXCLUDED.total_revenue_cents,
        subscription_revenue_cents = EXCLUDED.subscription_revenue_cents,
        one_time_revenue_cents = EXCLUDED.one_time_revenue_cents,
        tip_revenue_cents = EXCLUDED.tip_revenue_cents,
        commission_revenue_cents = EXCLUDED.commission_revenue_cents,
        refund_amount_cents = EXCLUDED.refund_amount_cents,
        net_revenue_cents = EXCLUDED.net_revenue_cents,
        platform_fees_cents = EXCLUDED.platform_fees_cents,
        transaction_count = EXCLUDED.transaction_count,
        unique_buyers_count = EXCLUDED.unique_buyers_count,
        avg_transaction_cents = EXCLUDED.avg_transaction_cents,
        breakdown = EXCLUDED.breakdown,
        updated_at = NOW();
END;
$$;

-- Function to generate revenue report data
CREATE OR REPLACE FUNCTION generate_revenue_report(
    p_creator_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_report_type VARCHAR DEFAULT 'summary'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    report_data JSONB;
BEGIN
    CASE p_report_type
        WHEN 'summary' THEN
            SELECT jsonb_build_object(
                'period', jsonb_build_object(
                    'start_date', p_start_date,
                    'end_date', p_end_date
                ),
                'totals', jsonb_build_object(
                    'total_revenue_cents', COALESCE(SUM(total_revenue_cents), 0),
                    'net_revenue_cents', COALESCE(SUM(net_revenue_cents), 0),
                    'transaction_count', COALESCE(SUM(transaction_count), 0),
                    'unique_buyers_count', COALESCE(SUM(unique_buyers_count), 0)
                ),
                'by_type', jsonb_build_object(
                    'subscription_revenue_cents', COALESCE(SUM(subscription_revenue_cents), 0),
                    'one_time_revenue_cents', COALESCE(SUM(one_time_revenue_cents), 0),
                    'tip_revenue_cents', COALESCE(SUM(tip_revenue_cents), 0),
                    'commission_revenue_cents', COALESCE(SUM(commission_revenue_cents), 0)
                ),
                'trends', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'date', date,
                            'revenue_cents', total_revenue_cents
                        ) ORDER BY date
                    )
                    FROM revenue_metrics_daily
                    WHERE creator_id = p_creator_id
                        AND date BETWEEN p_start_date AND p_end_date
                )
            ) INTO report_data
            FROM revenue_metrics_daily
            WHERE creator_id = p_creator_id
                AND date BETWEEN p_start_date AND p_end_date;
        
        ELSE
            report_data := '{"error": "Unsupported report type"}'::jsonb;
    END CASE;

    RETURN COALESCE(report_data, '{}'::jsonb);
END;
$$;

-- Trigger to update materialized view
CREATE OR REPLACE FUNCTION refresh_revenue_stats() RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY creator_revenue_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_refresh_revenue_stats
    AFTER INSERT OR UPDATE OR DELETE ON revenue_transactions
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_revenue_stats();

-- Update trigger for timestamp fields
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_revenue_transactions_updated_at
    BEFORE UPDATE ON revenue_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_revenue_metrics_daily_updated_at
    BEFORE UPDATE ON revenue_metrics_daily
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_revenue_predictions_updated_at
    BEFORE UPDATE ON revenue_predictions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_revenue_reports_updated_at
    BEFORE UPDATE ON revenue_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create unique index for materialized view refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_revenue_stats_creator_id 
ON creator_revenue_stats(creator_id);

-- Comments for documentation
COMMENT ON TABLE revenue_transactions IS 'Individual revenue transactions with detailed breakdown and metadata';
COMMENT ON TABLE revenue_metrics_daily IS 'Daily aggregated revenue metrics for performance and analytics';
COMMENT ON TABLE revenue_predictions IS 'ML-generated revenue forecasts with confidence scores';
COMMENT ON TABLE revenue_reports IS 'Saved and exportable revenue reports with various formats';
COMMENT ON MATERIALIZED VIEW creator_revenue_stats IS 'Aggregated creator revenue statistics for quick access';
```