```sql
-- Real-Time Currency Conversion Service Migration
-- Creates comprehensive currency conversion system with multi-source aggregation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Currency metadata table
CREATE TABLE IF NOT EXISTS currency_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10),
    type VARCHAR(20) NOT NULL CHECK (type IN ('fiat', 'crypto', 'stablecoin', 'commodity')),
    decimal_places INTEGER NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Currency pairs table
CREATE TABLE IF NOT EXISTS currency_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency VARCHAR(10) NOT NULL REFERENCES currency_metadata(code),
    quote_currency VARCHAR(10) NOT NULL REFERENCES currency_metadata(code),
    is_active BOOLEAN NOT NULL DEFAULT true,
    min_amount DECIMAL(20,8),
    max_amount DECIMAL(20,8),
    fee_percentage DECIMAL(5,4) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(base_currency, quote_currency)
);

-- Exchange rate sources table
CREATE TABLE IF NOT EXISTS exchange_rate_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('api', 'websocket', 'manual', 'aggregator')),
    base_url VARCHAR(500),
    api_key_required BOOLEAN NOT NULL DEFAULT false,
    rate_limit_per_hour INTEGER,
    reliability_score DECIMAL(3,2) DEFAULT 1.00,
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    supported_currencies TEXT[] DEFAULT '{}',
    configuration JSONB DEFAULT '{}',
    last_successful_fetch TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exchange rates table (raw data from sources)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES exchange_rate_sources(id) ON DELETE CASCADE,
    pair_id UUID NOT NULL REFERENCES currency_pairs(id) ON DELETE CASCADE,
    rate DECIMAL(20,8) NOT NULL,
    bid_rate DECIMAL(20,8),
    ask_rate DECIMAL(20,8),
    volume_24h DECIMAL(20,8),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aggregated rates table (computed from multiple sources)
CREATE TABLE IF NOT EXISTS rate_aggregations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_id UUID NOT NULL REFERENCES currency_pairs(id) ON DELETE CASCADE,
    rate DECIMAL(20,8) NOT NULL,
    weighted_rate DECIMAL(20,8) NOT NULL,
    min_rate DECIMAL(20,8) NOT NULL,
    max_rate DECIMAL(20,8) NOT NULL,
    source_count INTEGER NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    spread_percentage DECIMAL(5,4),
    volume_weighted_rate DECIMAL(20,8),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aggregation_method VARCHAR(50) NOT NULL DEFAULT 'weighted_average',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Source reliability metrics
CREATE TABLE IF NOT EXISTS source_reliability_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES exchange_rate_sources(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    failed_requests INTEGER NOT NULL DEFAULT 0,
    avg_response_time_ms INTEGER,
    uptime_percentage DECIMAL(5,2),
    accuracy_score DECIMAL(3,2),
    data_freshness_score DECIMAL(3,2),
    overall_reliability_score DECIMAL(3,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_id, date)
);

-- Conversion history table
CREATE TABLE IF NOT EXISTS conversion_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    session_id VARCHAR(100),
    pair_id UUID NOT NULL REFERENCES currency_pairs(id),
    from_amount DECIMAL(20,8) NOT NULL,
    to_amount DECIMAL(20,8) NOT NULL,
    rate_used DECIMAL(20,8) NOT NULL,
    rate_source VARCHAR(50) NOT NULL DEFAULT 'aggregated',
    fee_amount DECIMAL(20,8) DEFAULT 0,
    ip_address INET,
    user_agent TEXT,
    reference_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate alerts table
CREATE TABLE IF NOT EXISTS rate_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    pair_id UUID NOT NULL REFERENCES currency_pairs(id) ON DELETE CASCADE,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('above', 'below', 'change')),
    threshold_rate DECIMAL(20,8),
    percentage_change DECIMAL(5,2),
    time_window_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notification_method VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (notification_method IN ('email', 'webhook', 'push')),
    notification_endpoint TEXT,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_currency_pairs_active ON currency_pairs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_currency_pairs_base_quote ON currency_pairs(base_currency, quote_currency);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_source_pair ON exchange_rates(source_id, pair_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_timestamp ON exchange_rates(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_timestamp ON exchange_rates(pair_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_rate_aggregations_pair ON rate_aggregations(pair_id);
CREATE INDEX IF NOT EXISTS idx_rate_aggregations_timestamp ON rate_aggregations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rate_aggregations_pair_timestamp ON rate_aggregations(pair_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_source_reliability_source_date ON source_reliability_metrics(source_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_conversion_history_user ON conversion_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_history_session ON conversion_history(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_history_pair ON conversion_history(pair_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_history_created_at ON conversion_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_alerts_user_active ON rate_alerts(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rate_alerts_pair_active ON rate_alerts(pair_id, is_active) WHERE is_active = true;

-- Function to calculate weighted average rate
CREATE OR REPLACE FUNCTION calculate_weighted_rate(
    p_pair_id UUID,
    p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
    weighted_rate DECIMAL(20,8),
    confidence_score DECIMAL(3,2),
    source_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(
            SUM(er.rate * ers.reliability_score) / NULLIF(SUM(ers.reliability_score), 0),
            AVG(er.rate)
        )::DECIMAL(20,8) as weighted_rate,
        (
            CASE 
                WHEN COUNT(*) >= 3 THEN 0.95
                WHEN COUNT(*) = 2 THEN 0.80
                ELSE 0.60
            END
        )::DECIMAL(3,2) as confidence_score,
        COUNT(*)::INTEGER as source_count
    FROM exchange_rates er
    JOIN exchange_rate_sources ers ON er.source_id = ers.id
    WHERE er.pair_id = p_pair_id
        AND er.timestamp >= p_timestamp - INTERVAL '5 minutes'
        AND ers.is_active = true
    GROUP BY er.pair_id;
END;
$$;

-- Function to aggregate rates from multiple sources
CREATE OR REPLACE FUNCTION aggregate_exchange_rates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_rate_data RECORD;
    v_min_rate DECIMAL(20,8);
    v_max_rate DECIMAL(20,8);
    v_avg_rate DECIMAL(20,8);
BEGIN
    -- Calculate aggregated rates for the affected pair
    SELECT 
        MIN(er.rate) as min_rate,
        MAX(er.rate) as max_rate,
        AVG(er.rate) as avg_rate
    INTO v_min_rate, v_max_rate, v_avg_rate
    FROM exchange_rates er
    JOIN exchange_rate_sources ers ON er.source_id = ers.id
    WHERE er.pair_id = NEW.pair_id
        AND er.timestamp >= NOW() - INTERVAL '5 minutes'
        AND ers.is_active = true;

    -- Get weighted rate calculation
    SELECT * INTO v_rate_data 
    FROM calculate_weighted_rate(NEW.pair_id, NOW());

    -- Insert or update aggregated rate
    INSERT INTO rate_aggregations (
        pair_id,
        rate,
        weighted_rate,
        min_rate,
        max_rate,
        source_count,
        confidence_score,
        spread_percentage,
        timestamp
    )
    VALUES (
        NEW.pair_id,
        COALESCE(v_avg_rate, NEW.rate),
        COALESCE(v_rate_data.weighted_rate, NEW.rate),
        COALESCE(v_min_rate, NEW.rate),
        COALESCE(v_max_rate, NEW.rate),
        COALESCE(v_rate_data.source_count, 1),
        COALESCE(v_rate_data.confidence_score, 0.60),
        CASE 
            WHEN v_max_rate > 0 AND v_min_rate > 0 
            THEN ((v_max_rate - v_min_rate) / v_max_rate * 100)::DECIMAL(5,4)
            ELSE 0
        END,
        NOW()
    );

    RETURN NEW;
END;
$$;

-- Function to update source reliability metrics
CREATE OR REPLACE FUNCTION update_source_reliability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update daily metrics for the source
    INSERT INTO source_reliability_metrics (
        source_id,
        date,
        successful_requests,
        total_requests
    )
    VALUES (
        NEW.source_id,
        CURRENT_DATE,
        1,
        1
    )
    ON CONFLICT (source_id, date)
    DO UPDATE SET
        successful_requests = source_reliability_metrics.successful_requests + 1,
        total_requests = source_reliability_metrics.total_requests + 1,
        overall_reliability_score = (
            source_reliability_metrics.successful_requests + 1
        )::DECIMAL / (
            source_reliability_metrics.total_requests + 1
        )::DECIMAL,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Function to check rate alerts
CREATE OR REPLACE FUNCTION check_rate_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    alert_record RECORD;
    should_trigger BOOLEAN;
    prev_rate DECIMAL(20,8);
BEGIN
    -- Check all active alerts for this pair
    FOR alert_record IN 
        SELECT * FROM rate_alerts 
        WHERE pair_id = NEW.pair_id 
            AND is_active = true
    LOOP
        should_trigger := false;

        CASE alert_record.alert_type
            WHEN 'above' THEN
                should_trigger := NEW.weighted_rate >= alert_record.threshold_rate;
            
            WHEN 'below' THEN
                should_trigger := NEW.weighted_rate <= alert_record.threshold_rate;
            
            WHEN 'change' THEN
                -- Get previous rate within time window
                SELECT weighted_rate INTO prev_rate
                FROM rate_aggregations
                WHERE pair_id = NEW.pair_id
                    AND timestamp >= NOW() - INTERVAL '1 minute' * alert_record.time_window_minutes
                    AND timestamp < NEW.timestamp
                ORDER BY timestamp DESC
                LIMIT 1;

                IF prev_rate IS NOT NULL THEN
                    should_trigger := ABS((NEW.weighted_rate - prev_rate) / prev_rate * 100) >= alert_record.percentage_change;
                END IF;
        END CASE;

        IF should_trigger THEN
            -- Update alert trigger information
            UPDATE rate_alerts 
            SET 
                last_triggered_at = NOW(),
                trigger_count = trigger_count + 1
            WHERE id = alert_record.id;

            -- Here you would typically insert into a notifications queue
            -- or call an external notification service
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_aggregate_rates
    AFTER INSERT ON exchange_rates
    FOR EACH ROW
    EXECUTE FUNCTION aggregate_exchange_rates();

CREATE TRIGGER trigger_update_source_reliability
    AFTER INSERT ON exchange_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_source_reliability();

CREATE TRIGGER trigger_check_rate_alerts
    AFTER INSERT ON rate_aggregations
    FOR EACH ROW
    EXECUTE FUNCTION check_rate_alerts();

-- Update timestamps triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_currency_metadata_updated_at
    BEFORE UPDATE ON currency_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_currency_pairs_updated_at
    BEFORE UPDATE ON currency_pairs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_rate_sources_updated_at
    BEFORE UPDATE ON exchange_rate_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_alerts_updated_at
    BEFORE UPDATE ON rate_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE currency_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_reliability_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public read access to currency data
CREATE POLICY "Public read access for currency metadata" ON currency_metadata
    FOR SELECT TO public USING (true);

CREATE POLICY "Public read access for currency pairs" ON currency_pairs
    FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Public read access for rate aggregations" ON rate_aggregations
    FOR SELECT TO public USING (true);

-- RLS Policies for authenticated users
CREATE POLICY "Users can view their conversion history" ON conversion_history
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their conversion history" ON conversion_history
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage their rate alerts" ON rate_alerts
    FOR ALL TO authenticated 
    USING (auth.uid() = user_id);

-- Admin policies for service management
CREATE POLICY "Service role can manage exchange rate sources" ON exchange_rate_sources
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage exchange rates" ON exchange_rates
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can view reliability metrics" ON source_reliability_metrics
    FOR SELECT TO service_role USING (true);

-- Insert default currency metadata
INSERT INTO currency_metadata (code, name, symbol, type, decimal_places) VALUES
    ('USD', 'US Dollar', '$', 'fiat', 2),
    ('EUR', 'Euro', '€', 'fiat', 2),
    ('GBP', 'British Pound', '£', 'fiat', 2),
    ('JPY', 'Japanese Yen', '¥', 'fiat', 0),
    ('BTC', 'Bitcoin', '₿', 'crypto', 8),
    ('ETH', 'Ethereum', 'Ξ', 'crypto', 8),
    ('USDT', 'Tether', '$', 'stablecoin', 6),
    ('USDC', 'USD Coin', '$', 'stablecoin', 6)
ON CONFLICT (code) DO NOTHING;

-- Insert default currency pairs
INSERT INTO currency_pairs (base_currency, quote_currency) VALUES
    ('BTC', 'USD'),
    ('ETH', 'USD'),
    ('EUR', 'USD'),
    ('GBP', 'USD'),
    ('USD', 'JPY'),
    ('BTC', 'EUR'),
    ('ETH', 'EUR')
ON CONFLICT (base_currency, quote_currency) DO NOTHING;

-- Insert default exchange rate sources
INSERT INTO exchange_rate_sources (name, type, reliability_score, priority) VALUES
    ('CoinGecko API', 'api', 0.95, 1),
    ('CoinMarketCap API', 'api', 0.90, 2),
    ('Binance API', 'api', 0.98, 1),
    ('Exchange Rates API', 'api', 0.85, 3)
ON CONFLICT (name) DO NOTHING;

-- Create view for latest rates
CREATE OR REPLACE VIEW latest_exchange_rates AS
SELECT DISTINCT ON (ra.pair_id)
    cp.base_currency,
    cp.quote_currency,
    ra.weighted_rate as rate,
    ra.confidence_score,
    ra.source_count,
    ra.spread_percentage,
    ra.timestamp,
    cp.id as pair_id
FROM rate_aggregations ra
JOIN currency_pairs cp ON ra.pair_id = cp.id
WHERE cp.is_active = true
ORDER BY ra.pair_id, ra.timestamp DESC;

-- Create view for conversion rates with fees
CREATE OR REPLACE VIEW conversion_rates AS
SELECT 
    cp.base_currency,
    cp.quote_currency,
    ler.rate,
    ler.rate * (1 + COALESCE(cp.fee_percentage, 0)) as rate_with_fee,
    cp.fee_percentage,
    ler.confidence_score,
    ler.timestamp,
    cp.id as pair_id
FROM latest_exchange_rates ler
JOIN currency_pairs cp ON ler.pair_id = cp.id;

-- Create materialized view for hourly rate summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_rate_summary AS
SELECT 
    pair_id,
    date_trunc('hour', timestamp) as hour,
    AVG(weighted_rate) as avg_rate,
    MIN(weighted_rate) as min_rate,
    MAX(weighted_rate) as max_rate,
    FIRST_VALUE(weighted_rate) OVER (PARTITION BY pair_id, date_trunc('hour', timestamp) ORDER BY timestamp) as open_rate,
    LAST_VALUE(weighted_rate) OVER (PARTITION BY pair_id, date_trunc('hour', timestamp) ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as close_rate,
    COUNT(*) as data_points
FROM rate_aggregations
GROUP BY pair_id, date_trunc('hour', timestamp)
ORDER BY pair_id, hour DESC;

-- Create unique index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_rate_summary_pair_hour 
ON hourly_rate_summary (pair_id, hour);

-- Create function to refresh hourly summary
CREATE OR REPLACE FUNCTION refresh_hourly_rate_summary()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_rate_summary;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE currency_metadata IS 'Stores metadata for all supported currencies including fiat, crypto, and stablecoins';
COMMENT ON TABLE currency_pairs IS 'Defines tradeable currency pairs with conversion parameters';
COMMENT ON TABLE exchange_rate_sources IS 'Configuration for external rate data sources';
COMMENT ON TABLE exchange_rates IS 'Raw exchange rate data from various sources';
COMMENT ON TABLE rate_aggregations IS 'Computed aggregated rates from multiple sources';
COMMENT ON TABLE source_reliability_metrics IS 'Tracks reliability and performance of rate sources';
COMMENT ON TABLE conversion_history IS 'Audit trail of all currency conversions performed';
COMMENT ON TABLE rate_alerts IS 'User-defined alerts for rate thresholds and changes';
```