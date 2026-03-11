```sql
-- Payment Analytics Data Warehouse Migration
-- File: supabase/migrations/20241201_payment_analytics_warehouse.sql
-- Description: Comprehensive payment analytics database with optimized schemas for transaction analysis, revenue reporting, and financial forecasting

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS dimensions;
CREATE SCHEMA IF NOT EXISTS forecasting;

-- Currency rates dimension table
CREATE TABLE IF NOT EXISTS dimensions.currency_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency VARCHAR(3) NOT NULL,
    target_currency VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(18,8) NOT NULL,
    rate_date DATE NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'api',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT currency_rates_unique_date_pair UNIQUE (base_currency, target_currency, rate_date)
);

-- Create indexes for currency rates
CREATE INDEX IF NOT EXISTS idx_currency_rates_date ON dimensions.currency_rates (rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_currency_rates_pair ON dimensions.currency_rates (base_currency, target_currency);
CREATE INDEX IF NOT EXISTS idx_currency_rates_updated ON dimensions.currency_rates (updated_at DESC);

-- Payment methods lookup table
CREATE TABLE IF NOT EXISTS dimensions.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    method_code VARCHAR(20) NOT NULL UNIQUE,
    method_name VARCHAR(100) NOT NULL,
    method_type VARCHAR(50) NOT NULL, -- 'card', 'bank_transfer', 'digital_wallet', 'crypto', 'bnpl'
    provider VARCHAR(100),
    region VARCHAR(10),
    processing_fee_percent DECIMAL(5,4) DEFAULT 0,
    fixed_fee_cents INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for payment methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON dimensions.payment_methods (method_type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON dimensions.payment_methods (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_payment_methods_region ON dimensions.payment_methods (region);

-- Payment transactions table with time partitioning
CREATE TABLE IF NOT EXISTS analytics.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    merchant_id UUID NOT NULL,
    customer_id UUID,
    payment_method_id UUID REFERENCES dimensions.payment_methods(id),
    
    -- Transaction details
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    amount_usd_cents BIGINT, -- Normalized amount
    
    -- Status and timing
    status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded', 'disputed'
    transaction_type VARCHAR(20) NOT NULL, -- 'payment', 'refund', 'chargeback', 'adjustment'
    processed_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    
    -- Geographic and device data
    country_code VARCHAR(2),
    region VARCHAR(50),
    city VARCHAR(100),
    ip_address INET,
    device_type VARCHAR(20), -- 'mobile', 'desktop', 'tablet', 'api'
    user_agent TEXT,
    
    -- Risk and fraud data
    risk_score INTEGER, -- 0-100
    fraud_flags TEXT[], -- Array of fraud indicators
    is_suspicious BOOLEAN DEFAULT FALSE,
    
    -- Financial data
    processing_fee_cents INTEGER DEFAULT 0,
    net_amount_cents BIGINT, -- Amount minus fees
    
    -- Metadata
    gateway_transaction_id VARCHAR(100),
    gateway_response_code VARCHAR(10),
    gateway_response_message TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    tenant_id UUID, -- For RLS
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('analytics.payment_transactions', 'created_at', if_not_exists => TRUE);

-- Create indexes for payment transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_merchant ON analytics.payment_transactions (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer ON analytics.payment_transactions (customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON analytics.payment_transactions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_country ON analytics.payment_transactions (country_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_amount ON analytics.payment_transactions (amount_cents DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_suspicious ON analytics.payment_transactions (is_suspicious, created_at DESC) WHERE is_suspicious = TRUE;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON analytics.payment_transactions (tenant_id, created_at DESC);

-- GIN index for metadata searches
CREATE INDEX IF NOT EXISTS idx_payment_transactions_metadata ON analytics.payment_transactions USING gin(metadata);

-- Merchant analytics fact table
CREATE TABLE IF NOT EXISTS analytics.merchant_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL,
    analysis_date DATE NOT NULL,
    
    -- Volume metrics
    total_transactions INTEGER DEFAULT 0,
    successful_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    refund_transactions INTEGER DEFAULT 0,
    
    -- Revenue metrics
    gross_revenue_cents BIGINT DEFAULT 0,
    net_revenue_cents BIGINT DEFAULT 0,
    refund_amount_cents BIGINT DEFAULT 0,
    processing_fees_cents BIGINT DEFAULT 0,
    
    -- Performance metrics
    success_rate DECIMAL(5,4), -- Percentage as decimal
    average_transaction_cents BIGINT,
    median_transaction_cents BIGINT,
    
    -- Geographic distribution
    top_countries JSONB DEFAULT '[]', -- [{country: 'US', percentage: 0.45}, ...]
    
    -- Payment method distribution
    payment_method_breakdown JSONB DEFAULT '{}', -- {card: 0.6, bank: 0.3, wallet: 0.1}
    
    -- Risk metrics
    fraud_rate DECIMAL(5,4),
    chargeback_rate DECIMAL(5,4),
    high_risk_transactions INTEGER DEFAULT 0,
    
    -- Audit fields
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT merchant_analytics_unique_date UNIQUE (merchant_id, analysis_date, tenant_id)
);

-- Create indexes for merchant analytics
CREATE INDEX IF NOT EXISTS idx_merchant_analytics_date ON analytics.merchant_analytics (analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_analytics_merchant_date ON analytics.merchant_analytics (merchant_id, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_analytics_revenue ON analytics.merchant_analytics (gross_revenue_cents DESC, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_analytics_tenant ON analytics.merchant_analytics (tenant_id, analysis_date DESC);

-- Transaction anomalies detection table
CREATE TABLE IF NOT EXISTS analytics.transaction_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES analytics.payment_transactions(id),
    merchant_id UUID NOT NULL,
    
    -- Anomaly details
    anomaly_type VARCHAR(50) NOT NULL, -- 'volume_spike', 'unusual_amount', 'geographic_outlier', 'velocity_anomaly'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Detection details
    baseline_value DECIMAL(15,2),
    observed_value DECIMAL(15,2),
    deviation_percent DECIMAL(5,2),
    
    -- Context
    detection_algorithm VARCHAR(50),
    contextual_data JSONB DEFAULT '{}',
    
    -- Resolution
    is_false_positive BOOLEAN DEFAULT NULL,
    resolution_notes TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    
    -- Audit fields
    tenant_id UUID,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for anomalies
CREATE INDEX IF NOT EXISTS idx_anomalies_detected_at ON analytics.transaction_anomalies (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_merchant ON analytics.transaction_anomalies (merchant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON analytics.transaction_anomalies (severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_unresolved ON analytics.transaction_anomalies (detected_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_anomalies_tenant ON analytics.transaction_anomalies (tenant_id, detected_at DESC);

-- Payment cohorts analysis table
CREATE TABLE IF NOT EXISTS analytics.payment_cohorts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cohort_id VARCHAR(50) NOT NULL, -- e.g., '2024-01', 'Q1-2024'
    cohort_type VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly', 'custom'
    merchant_id UUID,
    
    -- Cohort definition
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cohort_size INTEGER NOT NULL,
    
    -- Retention analysis by period
    retention_periods JSONB NOT NULL, -- {period_1: {active_users: 100, retention_rate: 0.85}, ...}
    
    -- Revenue analysis by period
    revenue_periods JSONB NOT NULL, -- {period_1: {total_revenue: 10000, avg_revenue_per_user: 100}, ...}
    
    -- Segment data
    acquisition_channel VARCHAR(50),
    customer_segment VARCHAR(50),
    geographic_region VARCHAR(50),
    
    -- Analysis metadata
    analysis_date DATE NOT NULL,
    periods_analyzed INTEGER NOT NULL,
    
    -- Audit fields
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT cohorts_unique_analysis UNIQUE (cohort_id, merchant_id, analysis_date, tenant_id)
);

-- Create indexes for cohorts
CREATE INDEX IF NOT EXISTS idx_cohorts_start_date ON analytics.payment_cohorts (start_date DESC);
CREATE INDEX IF NOT EXISTS idx_cohorts_merchant ON analytics.payment_cohorts (merchant_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_cohorts_type ON analytics.payment_cohorts (cohort_type, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_cohorts_tenant ON analytics.payment_cohorts (tenant_id, start_date DESC);

-- Financial forecasts predictive table
CREATE TABLE IF NOT EXISTS forecasting.financial_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID,
    forecast_type VARCHAR(30) NOT NULL, -- 'revenue', 'volume', 'churn', 'ltv'
    forecast_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
    
    -- Forecast period
    forecast_date DATE NOT NULL,
    forecast_horizon INTEGER NOT NULL, -- Days ahead
    
    -- Predictions
    predicted_value DECIMAL(15,2) NOT NULL,
    confidence_interval_lower DECIMAL(15,2),
    confidence_interval_upper DECIMAL(15,2),
    confidence_level DECIMAL(3,2) DEFAULT 0.95, -- 95% confidence interval
    
    -- Model information
    model_type VARCHAR(50) NOT NULL, -- 'arima', 'linear_regression', 'random_forest', 'prophet'
    model_version VARCHAR(20),
    training_data_start DATE,
    training_data_end DATE,
    
    -- Performance metrics
    mae DECIMAL(10,4), -- Mean Absolute Error
    mape DECIMAL(5,4), -- Mean Absolute Percentage Error
    rmse DECIMAL(10,4), -- Root Mean Square Error
    
    -- Input features
    feature_importance JSONB, -- {seasonality: 0.3, trend: 0.4, external_factors: 0.3}
    external_factors JSONB, -- {economic_indicators: {...}, marketing_spend: {...}}
    
    -- Audit fields
    tenant_id UUID,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT forecasts_unique_prediction UNIQUE (merchant_id, forecast_type, forecast_date, forecast_horizon, tenant_id)
);

-- Create indexes for forecasts
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON forecasting.financial_forecasts (forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_merchant_type ON forecasting.financial_forecasts (merchant_id, forecast_type, forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_generated ON forecasting.financial_forecasts (generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_tenant ON forecasting.financial_forecasts (tenant_id, forecast_date DESC);

-- Create materialized views for revenue aggregates

-- Daily revenue aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.daily_revenue_aggregates AS
SELECT 
    DATE(created_at) as revenue_date,
    merchant_id,
    country_code,
    currency,
    COUNT(*) as transaction_count,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_count,
    SUM(amount_cents) as gross_revenue_cents,
    SUM(net_amount_cents) as net_revenue_cents,
    SUM(processing_fee_cents) as total_fees_cents,
    AVG(amount_cents) as avg_transaction_cents,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount_cents) as median_transaction_cents,
    COUNT(*) FILTER (WHERE is_suspicious = TRUE) as suspicious_count,
    tenant_id,
    NOW() as last_updated
FROM analytics.payment_transactions 
WHERE status IN ('completed', 'refunded')
GROUP BY DATE(created_at), merchant_id, country_code, currency, tenant_id;

-- Create unique index for daily aggregates
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_revenue_unique 
ON analytics.daily_revenue_aggregates (revenue_date, merchant_id, COALESCE(country_code, 'NULL'), currency, tenant_id);

-- Monthly revenue aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.monthly_revenue_aggregates AS
SELECT 
    DATE_TRUNC('month', created_at)::DATE as revenue_month,
    merchant_id,
    country_code,
    currency,
    COUNT(*) as transaction_count,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_count,
    SUM(amount_cents) as gross_revenue_cents,
    SUM(net_amount_cents) as net_revenue_cents,
    SUM(processing_fee_cents) as total_fees_cents,
    AVG(amount_cents) as avg_transaction_cents,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount_cents) as median_transaction_cents,
    COUNT(DISTINCT customer_id) as unique_customers,
    COUNT(*) FILTER (WHERE is_suspicious = TRUE) as suspicious_count,
    tenant_id,
    NOW() as last_updated
FROM analytics.payment_transactions 
WHERE status IN ('completed', 'refunded')
GROUP BY DATE_TRUNC('month', created_at)::DATE, merchant_id, country_code, currency, tenant_id;

-- Create unique index for monthly aggregates
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_revenue_unique 
ON analytics.monthly_revenue_aggregates (revenue_month, merchant_id, COALESCE(country_code, 'NULL'), currency, tenant_id);

-- Create functions for automatic aggregation

-- Function to refresh daily aggregates
CREATE OR REPLACE FUNCTION analytics.refresh_daily_aggregates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.daily_revenue_aggregates;
    
    -- Update merchant analytics for yesterday
    INSERT INTO analytics.merchant_analytics (
        merchant_id, analysis_date, total_transactions, successful_transactions,
        gross_revenue_cents, net_revenue_cents, processing_fees_cents,
        success_rate, average_transaction_cents, median_transaction_cents,
        tenant_id
    )
    SELECT 
        merchant_id,
        revenue_date,
        SUM(transaction_count),
        SUM(successful_count),
        SUM(gross_revenue_cents),
        SUM(net_revenue_cents),
        SUM(total_fees_cents),
        CASE 
            WHEN SUM(transaction_count) > 0 
            THEN ROUND(SUM(successful_count)::DECIMAL / SUM(transaction_count), 4)
            ELSE 0 
        END,
        ROUND(AVG(avg_transaction_cents)),
        ROUND(AVG(median_transaction_cents)),
        tenant_id
    FROM analytics.daily_revenue_aggregates 
    WHERE revenue_date = CURRENT_DATE - INTERVAL '1 day'
    GROUP BY merchant_id, revenue_date, tenant_id
    ON CONFLICT (merchant_id, analysis_date, tenant_id) 
    DO UPDATE SET
        total_transactions = EXCLUDED.total_transactions,
        successful_transactions = EXCLUDED.successful_transactions,
        gross_revenue_cents = EXCLUDED.gross_revenue_cents,
        net_revenue_cents = EXCLUDED.net_revenue_cents,
        processing_fees_cents = EXCLUDED.processing_fees_cents,
        success_rate = EXCLUDED.success_rate,
        average_transaction_cents = EXCLUDED.average_transaction_cents,
        median_transaction_cents = EXCLUDED.median_transaction_cents,
        updated_at = NOW();
END;
$$;

-- Function to detect transaction anomalies
CREATE OR REPLACE FUNCTION analytics.detect_volume_anomalies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    merchant_record RECORD;
    baseline_avg DECIMAL;
    current_volume INTEGER;
    deviation DECIMAL;
BEGIN
    -- Check for volume spikes in the last hour
    FOR merchant_record IN 
        SELECT merchant_id, tenant_id, COUNT(*) as hourly_volume
        FROM analytics.payment_transactions 
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        GROUP BY merchant_id, tenant_id
    LOOP
        -- Calculate 30-day average for same hour
        SELECT AVG(hourly_count) INTO baseline_avg
        FROM (
            SELECT COUNT(*) as hourly_count
            FROM analytics.payment_transactions
            WHERE merchant_id = merchant_record.merchant_id
            AND tenant_id = merchant_record.tenant_id
            AND created_at >= NOW() - INTERVAL '30 days'
            AND created_at < NOW() - INTERVAL '1 hour'
            AND EXTRACT(hour FROM created_at) = EXTRACT(hour FROM NOW())
            GROUP BY DATE(created_at)
        ) daily_counts;
        
        -- Skip if no baseline data
        CONTINUE WHEN baseline_avg IS NULL OR baseline_avg = 0;
        
        current_volume := merchant_record.hourly_volume;
        deviation := ((current_volume - baseline_avg) / baseline_avg) * 100;
        
        -- Create anomaly record if deviation > 200%
        IF deviation > 200 THEN
            INSERT INTO analytics.transaction_anomalies (
                merchant_id, anomaly_type, severity, confidence_score,
                baseline_value, observed_value, deviation_percent,
                detection_algorithm, tenant_id
            ) VALUES (
                merchant_record.merchant_id,
                'volume_spike',
                CASE 
                    WHEN deviation > 500 THEN 'critical'
                    WHEN deviation > 300 THEN 'high'
                    ELSE 'medium'
                END,
                LEAST(0.95, deviation / 500.0),
                baseline_avg,
                current_volume,
                deviation,
                'hourly_volume_comparison',
                merchant_record.tenant_id
            );
        END IF;
    END LOOP;
END;
$$;

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE analytics.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.merchant_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.transaction_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.payment_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasting.financial_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment transactions
CREATE POLICY "payment_transactions_tenant_isolation" ON analytics.payment_transactions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS policies for merchant analytics
CREATE POLICY "merchant_analytics_tenant_isolation" ON analytics.merchant_analytics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS policies for anomalies
CREATE POLICY "anomalies_tenant_isolation" ON analytics.transaction_anomalies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS policies for cohorts
CREATE POLICY "cohorts_tenant_isolation" ON analytics.payment_cohorts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS policies for forecasts
CREATE POLICY "forecasts_tenant_isolation" ON forecasting.financial_forecasts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_currency_rates_updated_at BEFORE UPDATE ON dimensions.currency_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON dimensions.payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON analytics.payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_merchant_analytics_updated_at BEFORE UPDATE ON analytics.merchant_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_cohorts_updated_at BEFORE UPDATE ON analytics.payment_cohorts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial payment methods data
INSERT INTO dimensions.payment_methods (method