```sql
-- Revenue Forecasting Widget Migration
-- Created: 2024-12-15
-- Description: Creates tables and functions for revenue forecasting with trend analysis, seasonal patterns, and scenario modeling

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Historical revenue data table (time-partitioned for performance)
CREATE TABLE IF NOT EXISTS revenue_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    revenue_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
    revenue_source VARCHAR(100),
    category VARCHAR(50),
    currency CHAR(3) DEFAULT 'USD',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (revenue_date);

-- Create partitions for revenue_data (current year and next year)
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Current year partition
    start_date := DATE_TRUNC('year', CURRENT_DATE);
    end_date := start_date + INTERVAL '1 year';
    partition_name := 'revenue_data_' || EXTRACT(YEAR FROM start_date);
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF revenue_data 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
    
    -- Next year partition
    start_date := end_date;
    end_date := start_date + INTERVAL '1 year';
    partition_name := 'revenue_data_' || EXTRACT(YEAR FROM start_date);
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF revenue_data 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
END $$;

-- Forecasting models table
CREATE TABLE IF NOT EXISTS forecasting_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('linear_trend', 'exponential', 'seasonal_arima', 'moving_average', 'custom')),
    algorithm_config JSONB NOT NULL DEFAULT '{}',
    accuracy_score DECIMAL(5,4) CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
    is_active BOOLEAN DEFAULT true,
    training_period_days INTEGER DEFAULT 365 CHECK (training_period_days > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, model_name)
);

-- Seasonal patterns table
CREATE TABLE IF NOT EXISTS seasonal_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pattern_name VARCHAR(100) NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'weekly', 'daily')),
    pattern_data JSONB NOT NULL, -- Array of multipliers for each period
    confidence_level DECIMAL(5,4) CHECK (confidence_level >= 0 AND confidence_level <= 1),
    detection_method VARCHAR(50) DEFAULT 'automatic',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, pattern_name)
);

-- Forecast scenarios table for what-if modeling
CREATE TABLE IF NOT EXISTS forecast_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario_name VARCHAR(100) NOT NULL,
    description TEXT,
    base_model_id UUID REFERENCES forecasting_models(id) ON DELETE CASCADE,
    adjustments JSONB NOT NULL DEFAULT '{}', -- Growth rate, seasonal adjustments, etc.
    forecast_horizon_months INTEGER NOT NULL DEFAULT 12 CHECK (forecast_horizon_months > 0),
    is_baseline BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, scenario_name)
);

-- Forecast parameters table for adjustable model inputs
CREATE TABLE IF NOT EXISTS forecast_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario_id UUID REFERENCES forecast_scenarios(id) ON DELETE CASCADE,
    parameter_name VARCHAR(100) NOT NULL,
    parameter_value DECIMAL(15,6),
    parameter_type VARCHAR(50) NOT NULL CHECK (parameter_type IN ('growth_rate', 'seasonal_multiplier', 'trend_adjustment', 'volatility', 'custom')),
    min_value DECIMAL(15,6),
    max_value DECIMAL(15,6),
    default_value DECIMAL(15,6),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue forecasts table for generated predictions
CREATE TABLE IF NOT EXISTS revenue_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario_id UUID NOT NULL REFERENCES forecast_scenarios(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    predicted_amount DECIMAL(15,2) NOT NULL,
    confidence_interval_lower DECIMAL(15,2),
    confidence_interval_upper DECIMAL(15,2),
    trend_component DECIMAL(15,2),
    seasonal_component DECIMAL(15,2),
    residual_component DECIMAL(15,2),
    forecast_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(scenario_id, forecast_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_revenue_data_user_date ON revenue_data(user_id, revenue_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_data_source ON revenue_data(user_id, revenue_source);
CREATE INDEX IF NOT EXISTS idx_forecasting_models_user_active ON forecasting_models(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_seasonal_patterns_user_type ON seasonal_patterns(user_id, period_type);
CREATE INDEX IF NOT EXISTS idx_forecast_scenarios_user ON forecast_scenarios(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_scenario_date ON revenue_forecasts(scenario_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecast_parameters_scenario ON forecast_parameters(scenario_id, parameter_name);

-- Create aggregated revenue metrics view
CREATE OR REPLACE VIEW revenue_metrics_view AS
SELECT 
    r.user_id,
    DATE_TRUNC('month', r.revenue_date) as month,
    SUM(r.amount) as monthly_revenue,
    AVG(r.amount) as avg_daily_revenue,
    COUNT(*) as transaction_count,
    STDDEV(r.amount) as revenue_volatility,
    LAG(SUM(r.amount)) OVER (PARTITION BY r.user_id ORDER BY DATE_TRUNC('month', r.revenue_date)) as prev_month_revenue,
    (SUM(r.amount) - LAG(SUM(r.amount)) OVER (PARTITION BY r.user_id ORDER BY DATE_TRUNC('month', r.revenue_date))) / 
    NULLIF(LAG(SUM(r.amount)) OVER (PARTITION BY r.user_id ORDER BY DATE_TRUNC('month', r.revenue_date)), 0) * 100 as growth_rate_pct
FROM revenue_data r
WHERE r.revenue_date >= CURRENT_DATE - INTERVAL '24 months'
GROUP BY r.user_id, DATE_TRUNC('month', r.revenue_date);

-- Function to calculate trend metrics
CREATE OR REPLACE FUNCTION calculate_trend_metrics(
    p_user_id UUID,
    p_days_back INTEGER DEFAULT 365
) RETURNS TABLE (
    trend_slope DECIMAL,
    trend_intercept DECIMAL,
    correlation_coefficient DECIMAL,
    mean_revenue DECIMAL,
    revenue_volatility DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_revenue AS (
        SELECT 
            revenue_date,
            SUM(amount) as daily_amount,
            EXTRACT(EPOCH FROM revenue_date - MIN(revenue_date) OVER()) / 86400 as day_number
        FROM revenue_data
        WHERE user_id = p_user_id 
        AND revenue_date >= CURRENT_DATE - INTERVAL '1 day' * p_days_back
        GROUP BY revenue_date
    ),
    trend_calc AS (
        SELECT
            COALESCE(REGR_SLOPE(daily_amount, day_number), 0) as slope,
            COALESCE(REGR_INTERCEPT(daily_amount, day_number), 0) as intercept,
            COALESCE(CORR(daily_amount, day_number), 0) as correlation,
            AVG(daily_amount) as mean_amt,
            COALESCE(STDDEV(daily_amount), 0) as volatility
        FROM daily_revenue
    )
    SELECT 
        slope::DECIMAL,
        intercept::DECIMAL,
        correlation::DECIMAL,
        mean_amt::DECIMAL,
        volatility::DECIMAL
    FROM trend_calc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect seasonal patterns
CREATE OR REPLACE FUNCTION detect_seasonal_patterns(
    p_user_id UUID,
    p_period_type VARCHAR(20) DEFAULT 'monthly'
) RETURNS JSONB AS $$
DECLARE
    seasonal_data JSONB;
    period_func TEXT;
BEGIN
    -- Set the appropriate date truncation function based on period type
    CASE p_period_type
        WHEN 'monthly' THEN period_func := 'month';
        WHEN 'quarterly' THEN period_func := 'quarter';
        WHEN 'weekly' THEN period_func := 'week';
        WHEN 'daily' THEN period_func := 'dow'; -- day of week
        ELSE period_func := 'month';
    END CASE;

    -- Calculate seasonal multipliers
    EXECUTE format('
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                ''period'', period_key,
                ''multiplier'', seasonal_multiplier,
                ''confidence'', confidence_score
            ) ORDER BY period_key
        ), ''[]''::jsonb)
        FROM (
            WITH period_averages AS (
                SELECT 
                    EXTRACT(%s FROM revenue_date) as period_key,
                    AVG(amount) as period_avg,
                    COUNT(*) as sample_size
                FROM revenue_data 
                WHERE user_id = $1 
                AND revenue_date >= CURRENT_DATE - INTERVAL ''2 years''
                GROUP BY EXTRACT(%s FROM revenue_date)
                HAVING COUNT(*) >= 3
            ),
            overall_average AS (
                SELECT AVG(amount) as overall_avg
                FROM revenue_data 
                WHERE user_id = $1 
                AND revenue_date >= CURRENT_DATE - INTERVAL ''2 years''
            )
            SELECT 
                pa.period_key,
                ROUND((pa.period_avg / oa.overall_avg)::numeric, 4) as seasonal_multiplier,
                LEAST(pa.sample_size::decimal / 12, 1.0) as confidence_score
            FROM period_averages pa
            CROSS JOIN overall_average oa
            WHERE oa.overall_avg > 0
        ) seasonal_calc',
        period_func, period_func
    ) USING p_user_id INTO seasonal_data;

    RETURN seasonal_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate revenue forecasts
CREATE OR REPLACE FUNCTION generate_revenue_forecast(
    p_scenario_id UUID,
    p_months_ahead INTEGER DEFAULT 12
) RETURNS INTEGER AS $$
DECLARE
    scenario_rec RECORD;
    base_trend RECORD;
    seasonal_data JSONB;
    forecast_count INTEGER := 0;
    forecast_date DATE;
    predicted_value DECIMAL;
    i INTEGER;
BEGIN
    -- Get scenario details
    SELECT s.*, fm.model_type, fm.algorithm_config
    INTO scenario_rec
    FROM forecast_scenarios s
    JOIN forecasting_models fm ON s.base_model_id = fm.id
    WHERE s.id = p_scenario_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scenario not found';
    END IF;

    -- Calculate base trend
    SELECT * INTO base_trend 
    FROM calculate_trend_metrics(scenario_rec.user_id, 365);

    -- Get seasonal patterns
    SELECT detect_seasonal_patterns(scenario_rec.user_id, 'monthly') INTO seasonal_data;

    -- Clear existing forecasts for this scenario
    DELETE FROM revenue_forecasts WHERE scenario_id = p_scenario_id;

    -- Generate forecasts for each month
    FOR i IN 1..p_months_ahead LOOP
        forecast_date := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' * i;
        
        -- Basic linear trend prediction
        predicted_value := base_trend.mean_revenue + (base_trend.trend_slope * 30 * i);
        
        -- Apply seasonal adjustment if available
        IF seasonal_data != '[]'::jsonb THEN
            WITH seasonal_multiplier AS (
                SELECT COALESCE(
                    (seasonal_data->((EXTRACT(MONTH FROM forecast_date)::int - 1)::text)->>'multiplier')::decimal,
                    1.0
                ) as multiplier
            )
            SELECT predicted_value * sm.multiplier INTO predicted_value
            FROM seasonal_multiplier sm;
        END IF;

        -- Apply scenario adjustments
        IF scenario_rec.adjustments ? 'growth_rate' THEN
            predicted_value := predicted_value * (1 + (scenario_rec.adjustments->>'growth_rate')::decimal / 100);
        END IF;

        -- Insert forecast
        INSERT INTO revenue_forecasts (
            user_id, scenario_id, forecast_date, predicted_amount,
            confidence_interval_lower, confidence_interval_upper,
            trend_component, seasonal_component
        ) VALUES (
            scenario_rec.user_id,
            p_scenario_id,
            forecast_date,
            GREATEST(predicted_value, 0),
            GREATEST(predicted_value * 0.8, 0), -- Simple confidence interval
            predicted_value * 1.2,
            base_trend.mean_revenue + (base_trend.trend_slope * 30 * i),
            predicted_value - (base_trend.mean_revenue + (base_trend.trend_slope * 30 * i))
        );

        forecast_count := forecast_count + 1;
    END LOOP;

    RETURN forecast_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to relevant tables
CREATE TRIGGER update_revenue_data_updated_at BEFORE UPDATE ON revenue_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forecasting_models_updated_at BEFORE UPDATE ON forecasting_models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_seasonal_patterns_updated_at BEFORE UPDATE ON seasonal_patterns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forecast_scenarios_updated_at BEFORE UPDATE ON forecast_scenarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forecast_parameters_updated_at BEFORE UPDATE ON forecast_parameters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE revenue_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasting_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user data isolation
CREATE POLICY "Users can manage their own revenue data" ON revenue_data FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own forecasting models" ON forecasting_models FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own seasonal patterns" ON seasonal_patterns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own forecast scenarios" ON forecast_scenarios FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own forecast parameters" ON forecast_parameters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own revenue forecasts" ON revenue_forecasts FOR ALL USING (auth.uid() = user_id);

-- Create default forecasting model and scenario for new users
CREATE OR REPLACE FUNCTION create_default_forecasting_setup()
RETURNS TRIGGER AS $$
DECLARE
    model_id UUID;
    scenario_id UUID;
BEGIN
    -- Create default linear trend model
    INSERT INTO forecasting_models (user_id, model_name, model_type, algorithm_config)
    VALUES (NEW.id, 'Default Linear Trend', 'linear_trend', '{"smoothing_factor": 0.3}')
    RETURNING id INTO model_id;

    -- Create default baseline scenario
    INSERT INTO forecast_scenarios (user_id, scenario_name, description, base_model_id, is_baseline)
    VALUES (NEW.id, 'Baseline Forecast', 'Default revenue forecast based on historical trends', model_id, true)
    RETURNING id INTO scenario_id;

    -- Add default parameters
    INSERT INTO forecast_parameters (user_id, scenario_id, parameter_name, parameter_value, parameter_type, default_value)
    VALUES 
    (NEW.id, scenario_id, 'growth_rate', 0.0, 'growth_rate', 0.0),
    (NEW.id, scenario_id, 'seasonal_adjustment', 1.0, 'seasonal_multiplier', 1.0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default setup for new users
CREATE TRIGGER create_user_forecasting_setup 
    AFTER INSERT ON auth.users 
    FOR EACH ROW 
    EXECUTE FUNCTION create_default_forecasting_setup();

-- Insert sample seasonal pattern detection
INSERT INTO seasonal_patterns (user_id, pattern_name, period_type, pattern_data, confidence_level, detection_method)
SELECT 
    id as user_id,
    'Default Monthly Pattern' as pattern_name,
    'monthly' as period_type,
    '[
        {"period": 1, "multiplier": 0.95},
        {"period": 2, "multiplier": 0.90},
        {"period": 3, "multiplier": 1.05},
        {"period": 4, "multiplier": 1.10},
        {"period": 5, "multiplier": 1.15},
        {"period": 6, "multiplier": 1.20},
        {"period": 7, "multiplier": 1.25},
        {"period": 8, "multiplier": 1.20},
        {"period": 9, "multiplier": 1.15},
        {"period": 10, "multiplier": 1.10},
        {"period": 11, "multiplier": 1.30},
        {"period": 12, "multiplier": 1.35}
    ]'::jsonb as pattern_data,
    0.75 as confidence_level,
    'template' as detection_method
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM seasonal_patterns WHERE pattern_name = 'Default Monthly Pattern')
ON CONFLICT (user_id, pattern_name) DO NOTHING;
```