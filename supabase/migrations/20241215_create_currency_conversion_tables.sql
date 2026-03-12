```sql
-- Supabase Migration: Real-Time Currency Conversion API
-- Version: 20241215_create_currency_conversion_tables
-- Description: Create tables for real-time currency conversion system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create enum types
CREATE TYPE currency_type AS ENUM ('fiat', 'cryptocurrency', 'stablecoin', 'commodity');
CREATE TYPE provider_status AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE conversion_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE alert_type AS ENUM ('threshold_high', 'threshold_low', 'volatility', 'offline');
CREATE TYPE fee_type AS ENUM ('percentage', 'fixed', 'tiered');

-- Currency metadata table
CREATE TABLE IF NOT EXISTS currency_metadata (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10),
    type currency_type NOT NULL,
    decimals INTEGER DEFAULT 2 CHECK (decimals >= 0 AND decimals <= 18),
    is_active BOOLEAN DEFAULT true,
    min_conversion_amount DECIMAL(20, 8) DEFAULT 0,
    max_conversion_amount DECIMAL(20, 8),
    daily_limit DECIMAL(20, 8),
    icon_url TEXT,
    description TEXT,
    blockchain_network VARCHAR(50),
    contract_address VARCHAR(42),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate providers table
CREATE TABLE IF NOT EXISTS rate_providers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_endpoint TEXT NOT NULL,
    status provider_status DEFAULT 'active',
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 100),
    refresh_interval_seconds INTEGER DEFAULT 30 CHECK (refresh_interval_seconds >= 1),
    timeout_seconds INTEGER DEFAULT 10 CHECK (timeout_seconds >= 1),
    api_key_encrypted TEXT,
    rate_limit_per_minute INTEGER DEFAULT 60,
    supported_currencies TEXT[], -- Array of currency codes
    reliability_score DECIMAL(3, 2) DEFAULT 1.00 CHECK (reliability_score >= 0 AND reliability_score <= 1),
    last_successful_fetch TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Currency pairs table
CREATE TABLE IF NOT EXISTS currency_pairs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    from_currency VARCHAR(10) NOT NULL REFERENCES currency_metadata(code) ON DELETE CASCADE,
    to_currency VARCHAR(10) NOT NULL REFERENCES currency_metadata(code) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    min_spread_percentage DECIMAL(5, 4) DEFAULT 0.0001,
    max_spread_percentage DECIMAL(5, 4) DEFAULT 0.05,
    base_fee_percentage DECIMAL(5, 4) DEFAULT 0.001,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_currency, to_currency),
    CHECK (from_currency != to_currency)
);

-- Exchange rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pair_id UUID NOT NULL REFERENCES currency_pairs(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES rate_providers(id) ON DELETE CASCADE,
    rate DECIMAL(30, 18) NOT NULL CHECK (rate > 0),
    bid_rate DECIMAL(30, 18),
    ask_rate DECIMAL(30, 18),
    spread_percentage DECIMAL(5, 4),
    volume_24h DECIMAL(20, 8),
    change_24h_percentage DECIMAL(7, 4),
    is_current BOOLEAN DEFAULT true,
    confidence_score DECIMAL(3, 2) DEFAULT 1.00 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Conversion fees table
CREATE TABLE IF NOT EXISTS conversion_fees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pair_id UUID NOT NULL REFERENCES currency_pairs(id) ON DELETE CASCADE,
    user_tier VARCHAR(20) DEFAULT 'standard',
    fee_type fee_type DEFAULT 'percentage',
    fee_value DECIMAL(10, 6) NOT NULL CHECK (fee_value >= 0),
    min_fee DECIMAL(20, 8) DEFAULT 0,
    max_fee DECIMAL(20, 8),
    daily_volume_threshold DECIMAL(20, 8),
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversion sessions table
CREATE TABLE IF NOT EXISTS conversion_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID,
    session_token VARCHAR(255) UNIQUE,
    pair_id UUID NOT NULL REFERENCES currency_pairs(id),
    from_amount DECIMAL(20, 8) NOT NULL CHECK (from_amount > 0),
    quoted_rate DECIMAL(30, 18) NOT NULL,
    quoted_to_amount DECIMAL(20, 8) NOT NULL,
    fee_amount DECIMAL(20, 8) DEFAULT 0,
    total_cost DECIMAL(20, 8) NOT NULL,
    status conversion_status DEFAULT 'pending',
    quote_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    locked_rate_duration INTEGER DEFAULT 300, -- seconds
    client_ip INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversion history table
CREATE TABLE IF NOT EXISTS conversion_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES conversion_sessions(id),
    user_id UUID,
    pair_id UUID NOT NULL REFERENCES currency_pairs(id),
    from_amount DECIMAL(20, 8) NOT NULL,
    to_amount DECIMAL(20, 8) NOT NULL,
    exchange_rate DECIMAL(30, 18) NOT NULL,
    fee_amount DECIMAL(20, 8) DEFAULT 0,
    fee_percentage DECIMAL(5, 4),
    provider_id UUID REFERENCES rate_providers(id),
    status conversion_status DEFAULT 'completed',
    transaction_reference VARCHAR(100),
    processing_time_ms INTEGER,
    client_ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate alerts table
CREATE TABLE IF NOT EXISTS rate_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    pair_id UUID NOT NULL REFERENCES currency_pairs(id),
    alert_type alert_type NOT NULL,
    threshold_value DECIMAL(30, 18),
    current_rate DECIMAL(30, 18),
    is_triggered BOOLEAN DEFAULT false,
    notification_sent BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    webhook_url TEXT,
    email_notification BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    triggered_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate history archive table for historical analysis
CREATE TABLE IF NOT EXISTS rate_history_archive (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pair_id UUID NOT NULL,
    from_currency VARCHAR(10) NOT NULL,
    to_currency VARCHAR(10) NOT NULL,
    rate DECIMAL(30, 18) NOT NULL,
    volume_24h DECIMAL(20, 8),
    change_24h_percentage DECIMAL(7, 4),
    provider_id UUID,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    original_timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exchange_rates_pair_current ON exchange_rates(pair_id, is_current) WHERE is_current = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exchange_rates_fetched_at ON exchange_rates(fetched_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversion_history_user_created ON conversion_history(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversion_sessions_token ON conversion_sessions(session_token);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversion_sessions_expires ON conversion_sessions(quote_expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_alerts_user_active ON rate_alerts(user_id, is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_currency_pairs_active ON currency_pairs(from_currency, to_currency) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_history_archive_timestamp ON rate_history_archive(archived_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversion_fees_pair_tier ON conversion_fees(pair_id, user_tier, is_active);

-- Enable Row Level Security
ALTER TABLE currency_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_history_archive ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public read access to reference data
CREATE POLICY "Public read access to active currencies" ON currency_metadata FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access to active pairs" ON currency_pairs FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access to current rates" ON exchange_rates FOR SELECT USING (is_current = true);
CREATE POLICY "Public read access to active fees" ON conversion_fees FOR SELECT USING (is_active = true);

-- RLS Policies for user-specific data
CREATE POLICY "Users can read their own conversion sessions" ON conversion_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own conversion sessions" ON conversion_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own conversion sessions" ON conversion_sessions FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can read their own conversion history" ON conversion_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own conversion history" ON conversion_history FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their own rate alerts" ON rate_alerts FOR ALL USING (user_id = auth.uid());

-- Functions for rate calculations
CREATE OR REPLACE FUNCTION get_best_exchange_rate(
    p_from_currency VARCHAR(10),
    p_to_currency VARCHAR(10)
)
RETURNS TABLE(
    rate DECIMAL(30, 18),
    spread_percentage DECIMAL(5, 4),
    provider_name VARCHAR(100),
    confidence_score DECIMAL(3, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        er.rate,
        er.spread_percentage,
        rp.name,
        er.confidence_score
    FROM exchange_rates er
    JOIN currency_pairs cp ON er.pair_id = cp.id
    JOIN rate_providers rp ON er.provider_id = rp.id
    WHERE cp.from_currency = p_from_currency
        AND cp.to_currency = p_to_currency
        AND er.is_current = true
        AND cp.is_active = true
        AND rp.status = 'active'
        AND er.expires_at > NOW()
    ORDER BY er.confidence_score DESC, rp.priority ASC, er.rate DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate conversion fees
CREATE OR REPLACE FUNCTION calculate_conversion_fee(
    p_pair_id UUID,
    p_amount DECIMAL(20, 8),
    p_user_tier VARCHAR(20) DEFAULT 'standard'
)
RETURNS DECIMAL(20, 8) AS $$
DECLARE
    v_fee DECIMAL(20, 8) := 0;
    v_fee_record RECORD;
BEGIN
    SELECT * INTO v_fee_record
    FROM conversion_fees
    WHERE pair_id = p_pair_id
        AND user_tier = p_user_tier
        AND is_active = true
        AND effective_from <= NOW()
        AND (effective_until IS NULL OR effective_until > NOW())
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        IF v_fee_record.fee_type = 'percentage' THEN
            v_fee := p_amount * v_fee_record.fee_value / 100;
        ELSIF v_fee_record.fee_type = 'fixed' THEN
            v_fee := v_fee_record.fee_value;
        END IF;
        
        -- Apply min/max fee limits
        IF v_fee_record.min_fee IS NOT NULL AND v_fee < v_fee_record.min_fee THEN
            v_fee := v_fee_record.min_fee;
        END IF;
        
        IF v_fee_record.max_fee IS NOT NULL AND v_fee > v_fee_record.max_fee THEN
            v_fee := v_fee_record.max_fee;
        END IF;
    END IF;
    
    RETURN v_fee;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_currency_metadata_updated_at
    BEFORE UPDATE ON currency_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_providers_updated_at
    BEFORE UPDATE ON rate_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_currency_pairs_updated_at
    BEFORE UPDATE ON currency_pairs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversion_fees_updated_at
    BEFORE UPDATE ON conversion_fees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversion_sessions_updated_at
    BEFORE UPDATE ON conversion_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_alerts_updated_at
    BEFORE UPDATE ON rate_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger function to archive old exchange rates
CREATE OR REPLACE FUNCTION archive_old_exchange_rates()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark previous rates as not current when new rate is inserted
    UPDATE exchange_rates 
    SET is_current = false 
    WHERE pair_id = NEW.pair_id 
        AND provider_id = NEW.provider_id 
        AND id != NEW.id 
        AND is_current = true;
    
    -- Archive rates older than 24 hours to history table
    INSERT INTO rate_history_archive (pair_id, from_currency, to_currency, rate, volume_24h, change_24h_percentage, provider_id, original_timestamp)
    SELECT 
        er.pair_id,
        cp.from_currency,
        cp.to_currency,
        er.rate,
        er.volume_24h,
        er.change_24h_percentage,
        er.provider_id,
        er.fetched_at
    FROM exchange_rates er
    JOIN currency_pairs cp ON er.pair_id = cp.id
    WHERE er.fetched_at < NOW() - INTERVAL '24 hours'
        AND er.is_current = false;
    
    -- Delete archived rates from main table
    DELETE FROM exchange_rates 
    WHERE fetched_at < NOW() - INTERVAL '24 hours' 
        AND is_current = false;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archive_exchange_rates
    AFTER INSERT ON exchange_rates
    FOR EACH ROW EXECUTE FUNCTION archive_old_exchange_rates();

-- Function to check rate alerts
CREATE OR REPLACE FUNCTION check_rate_alerts()
RETURNS void AS $$
DECLARE
    alert_record RECORD;
    current_rate_record RECORD;
BEGIN
    FOR alert_record IN 
        SELECT ra.*, cp.from_currency, cp.to_currency
        FROM rate_alerts ra
        JOIN currency_pairs cp ON ra.pair_id = cp.id
        WHERE ra.is_active = true AND ra.is_triggered = false
    LOOP
        -- Get current rate
        SELECT rate INTO current_rate_record
        FROM exchange_rates er
        WHERE er.pair_id = alert_record.pair_id
            AND er.is_current = true
        ORDER BY er.confidence_score DESC
        LIMIT 1;
        
        IF FOUND THEN
            -- Check if alert should be triggered
            IF (alert_record.alert_type = 'threshold_high' AND current_rate_record.rate >= alert_record.threshold_value) OR
               (alert_record.alert_type = 'threshold_low' AND current_rate_record.rate <= alert_record.threshold_value) THEN
                
                UPDATE rate_alerts
                SET is_triggered = true,
                    triggered_at = NOW(),
                    current_rate = current_rate_record.rate,
                    updated_at = NOW()
                WHERE id = alert_record.id;
                
                -- Here you would typically send notification
                -- This could be handled by a separate service or webhook
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default currencies
INSERT INTO currency_metadata (code, name, symbol, type, decimals) VALUES
('USD', 'US Dollar', '$', 'fiat', 2),
('EUR', 'Euro', '€', 'fiat', 2),
('GBP', 'British Pound', '£', 'fiat', 2),
('JPY', 'Japanese Yen', '¥', 'fiat', 0),
('BTC', 'Bitcoin', '₿', 'cryptocurrency', 8),
('ETH', 'Ethereum', 'Ξ', 'cryptocurrency', 18),
('USDT', 'Tether', '₮', 'stablecoin', 6),
('USDC', 'USD Coin', 'USDC', 'stablecoin', 6),
('BNB', 'Binance Coin', 'BNB', 'cryptocurrency', 18),
('ADA', 'Cardano', '₳', 'cryptocurrency', 6),
('XRP', 'Ripple', 'XRP', 'cryptocurrency', 6),
('SOL', 'Solana', 'SOL', 'cryptocurrency', 9)
ON CONFLICT (code) DO NOTHING;

-- Insert default currency pairs
INSERT INTO currency_pairs (from_currency, to_currency, base_fee_percentage) VALUES
('BTC', 'USD', 0.001),
('ETH', 'USD', 0.001),
('BTC', 'EUR', 0.001),
('ETH', 'EUR', 0.001),
('USD', 'EUR', 0.0005),
('USDT', 'USD', 0.0001),
('USDC', 'USD', 0.0001),
('BTC', 'ETH', 0.002),
('ETH', 'BTC', 0.002)
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- Insert default fee structures
INSERT INTO conversion_fees (pair_id, user_tier, fee_type, fee_value, min_fee) 
SELECT 
    cp.id,
    'standard',
    'percentage',
    cp.base_fee_percentage * 100,
    1.00
FROM currency_pairs cp
ON CONFLICT DO NOTHING;

-- Create materialized view for popular pairs with latest rates
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_currency_pairs AS
SELECT 
    cp.id,
    cp.from_currency,
    cp.to_currency,
    cm1.name as from_currency_name,
    cm1.symbol as from_symbol,
    cm2.name as to_currency_name,
    cm2.symbol as to_symbol,
    er.rate,
    er.change_24h_percentage,
    er.volume_24h,
    er.fetched_at
FROM currency_pairs cp
JOIN currency_metadata cm1 ON cp.from_currency = cm1.code
JOIN currency_metadata cm2 ON cp.to_currency = cm2.code
LEFT JOIN exchange_rates er ON cp.id = er.pair_id AND er.is_current = true
WHERE cp.is_active = true
ORDER BY er.volume_24h DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_pairs_id ON popular_currency_pairs (id);

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON popular_currency_pairs TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_best_exchange_rate TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_conversion_fee TO authenticated, anon;

-- Schedule periodic tasks (requires pg_cron extension)
-- This would typically be configured at the database level
-- SELECT cron.schedule('refresh-popular-pairs', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY popular_currency_pairs;');
-- SELECT cron.schedule('check-rate-alerts', '* * * * *', 'SELECT check_rate_alerts();');

COMMIT;
```