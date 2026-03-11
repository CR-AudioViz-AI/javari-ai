```sql
-- Cryptocurrency Payment Gateway Migration
-- Generated: 2024-12-01
-- Description: Complete crypto payment gateway with atomic swaps, multi-sig, and compliance

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE cryptocurrency AS ENUM (
    'BTC', 'ETH', 'USDC', 'USDT', 'DAI', 'WETH', 'WBTC'
);

CREATE TYPE transaction_status AS ENUM (
    'pending', 'initiated', 'confirmed', 'completed', 'failed', 'cancelled', 'expired'
);

CREATE TYPE atomic_swap_state AS ENUM (
    'created', 'locked', 'revealed', 'redeemed', 'refunded', 'expired'
);

CREATE TYPE compliance_status AS ENUM (
    'pending', 'approved', 'rejected', 'under_review', 'flagged'
);

CREATE TYPE kyc_status AS ENUM (
    'not_started', 'pending', 'approved', 'rejected', 'expired'
);

-- Crypto Wallets Table
CREATE TABLE IF NOT EXISTS crypto_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    wallet_address TEXT NOT NULL,
    cryptocurrency cryptocurrency NOT NULL,
    wallet_type TEXT NOT NULL DEFAULT 'standard', -- standard, multi_sig, contract
    is_multi_sig BOOLEAN DEFAULT FALSE,
    required_signatures INTEGER DEFAULT 1,
    public_keys JSONB DEFAULT '[]',
    wallet_metadata JSONB DEFAULT '{}',
    balance_wei TEXT DEFAULT '0',
    balance_decimal DECIMAL(36, 18) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(wallet_address, cryptocurrency),
    CONSTRAINT valid_multi_sig CHECK (
        (is_multi_sig = FALSE AND required_signatures = 1) OR 
        (is_multi_sig = TRUE AND required_signatures > 1)
    )
);

-- Multi-signature Requirements Table
CREATE TABLE IF NOT EXISTS multi_signature_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    signer_address TEXT NOT NULL,
    signer_public_key TEXT NOT NULL,
    signer_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(wallet_id, signer_address)
);

-- Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency cryptocurrency NOT NULL,
    quote_currency TEXT NOT NULL DEFAULT 'USD',
    rate DECIMAL(20, 8) NOT NULL,
    source TEXT NOT NULL DEFAULT 'coinbase',
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(base_currency, quote_currency, source)
);

-- KYC Verification Records Table
CREATE TABLE IF NOT EXISTS kyc_verification_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    verification_level INTEGER NOT NULL DEFAULT 1, -- 1: basic, 2: intermediate, 3: advanced
    status kyc_status DEFAULT 'not_started',
    jurisdiction TEXT NOT NULL,
    documents_submitted JSONB DEFAULT '[]',
    verification_data JSONB DEFAULT '{}',
    risk_score INTEGER DEFAULT 0, -- 0-100
    daily_limit DECIMAL(15, 2) DEFAULT 1000.00,
    monthly_limit DECIMAL(15, 2) DEFAULT 10000.00,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic Swap Contracts Table
CREATE TABLE IF NOT EXISTS atomic_swap_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_hash TEXT NOT NULL UNIQUE,
    initiator_wallet_id UUID NOT NULL REFERENCES crypto_wallets(id),
    participant_wallet_id UUID NOT NULL REFERENCES crypto_wallets(id),
    initiator_amount TEXT NOT NULL, -- Wei/Satoshi format
    participant_amount TEXT NOT NULL,
    initiator_currency cryptocurrency NOT NULL,
    participant_currency cryptocurrency NOT NULL,
    secret_hash TEXT NOT NULL,
    secret TEXT, -- Revealed during redemption
    lock_time TIMESTAMPTZ NOT NULL,
    state atomic_swap_state DEFAULT 'created',
    contract_address TEXT,
    blockchain_tx_hash TEXT,
    contract_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_swap_currencies CHECK (initiator_currency != participant_currency)
);

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_hash TEXT UNIQUE,
    from_wallet_id UUID REFERENCES crypto_wallets(id),
    to_wallet_id UUID REFERENCES crypto_wallets(id),
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    cryptocurrency cryptocurrency NOT NULL,
    amount_wei TEXT NOT NULL,
    amount_decimal DECIMAL(36, 18) NOT NULL,
    usd_value DECIMAL(15, 2),
    gas_fee_wei TEXT DEFAULT '0',
    gas_fee_decimal DECIMAL(36, 18) DEFAULT 0,
    status transaction_status DEFAULT 'pending',
    block_number BIGINT,
    block_hash TEXT,
    confirmations INTEGER DEFAULT 0,
    required_confirmations INTEGER DEFAULT 6,
    atomic_swap_id UUID REFERENCES atomic_swap_contracts(id),
    is_multi_sig BOOLEAN DEFAULT FALSE,
    signatures_collected INTEGER DEFAULT 0,
    signatures_required INTEGER DEFAULT 1,
    signature_data JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    
    CONSTRAINT valid_addresses CHECK (from_address != to_address),
    CONSTRAINT valid_amount CHECK (amount_decimal > 0)
);

-- Compliance Reports Table
CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES payment_transactions(id),
    user_id UUID NOT NULL,
    report_type TEXT NOT NULL, -- 'AML', 'CTR', 'SAR', 'FBAR'
    jurisdiction TEXT NOT NULL,
    reporting_threshold DECIMAL(15, 2),
    transaction_amount DECIMAL(15, 2),
    risk_score INTEGER DEFAULT 0,
    status compliance_status DEFAULT 'pending',
    submitted_to_authority BOOLEAN DEFAULT FALSE,
    authority_reference TEXT,
    report_data JSONB NOT NULL DEFAULT '{}',
    auto_generated BOOLEAN DEFAULT TRUE,
    reviewed_by UUID,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction Monitoring Logs Table
CREATE TABLE IF NOT EXISTS transaction_monitoring_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES payment_transactions(id),
    event_type TEXT NOT NULL, -- 'created', 'broadcast', 'confirmed', 'failed'
    blockchain_network TEXT NOT NULL,
    block_number BIGINT,
    gas_used BIGINT,
    gas_price_gwei BIGINT,
    network_fee_usd DECIMAL(10, 2),
    confirmation_time INTERVAL,
    error_message TEXT,
    raw_blockchain_data JSONB DEFAULT '{}',
    monitored_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_user_id ON crypto_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_address ON crypto_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_currency ON crypto_wallets(cryptocurrency);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_multi_sig ON crypto_wallets(is_multi_sig) WHERE is_multi_sig = TRUE;

CREATE INDEX IF NOT EXISTS idx_multi_sig_wallet_id ON multi_signature_requirements(wallet_id);
CREATE INDEX IF NOT EXISTS idx_multi_sig_signer ON multi_signature_requirements(signer_address);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency ON exchange_rates(base_currency, quote_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_updated ON exchange_rates(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_verification_records(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_verification_records(status);
CREATE INDEX IF NOT EXISTS idx_kyc_jurisdiction ON kyc_verification_records(jurisdiction);

CREATE INDEX IF NOT EXISTS idx_atomic_swaps_hash ON atomic_swap_contracts(contract_hash);
CREATE INDEX IF NOT EXISTS idx_atomic_swaps_state ON atomic_swap_contracts(state);
CREATE INDEX IF NOT EXISTS idx_atomic_swaps_initiator ON atomic_swap_contracts(initiator_wallet_id);
CREATE INDEX IF NOT EXISTS idx_atomic_swaps_participant ON atomic_swap_contracts(participant_wallet_id);
CREATE INDEX IF NOT EXISTS idx_atomic_swaps_lock_time ON atomic_swap_contracts(lock_time);

CREATE INDEX IF NOT EXISTS idx_transactions_hash ON payment_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON payment_transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet ON payment_transactions(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON payment_transactions(cryptocurrency);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON payment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_multi_sig ON payment_transactions(is_multi_sig) WHERE is_multi_sig = TRUE;

CREATE INDEX IF NOT EXISTS idx_compliance_user_id ON compliance_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_reports(status);
CREATE INDEX IF NOT EXISTS idx_compliance_jurisdiction ON compliance_reports(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_created ON compliance_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_transaction ON transaction_monitoring_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_event ON transaction_monitoring_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_time ON transaction_monitoring_logs(monitored_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_crypto_wallets_updated_at BEFORE UPDATE ON crypto_wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_atomic_swap_contracts_updated_at BEFORE UPDATE ON atomic_swap_contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kyc_verification_updated_at BEFORE UPDATE ON kyc_verification_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_reports_updated_at BEFORE UPDATE ON compliance_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies
ALTER TABLE crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_signature_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE atomic_swap_contracts ENABLE ROW LEVEL SECURITY;

-- Wallet access policies
CREATE POLICY "Users can view their own wallets" ON crypto_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own wallets" ON crypto_wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own wallets" ON crypto_wallets FOR UPDATE USING (auth.uid() = user_id);

-- Multi-sig policies
CREATE POLICY "Wallet owners can manage multi-sig requirements" ON multi_signature_requirements FOR ALL USING (
    EXISTS (SELECT 1 FROM crypto_wallets WHERE id = wallet_id AND user_id = auth.uid())
);

-- Transaction policies
CREATE POLICY "Users can view their transactions" ON payment_transactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM crypto_wallets cw 
        WHERE (cw.id = from_wallet_id OR cw.id = to_wallet_id) AND cw.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create transactions from their wallets" ON payment_transactions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM crypto_wallets WHERE id = from_wallet_id AND user_id = auth.uid())
);

-- KYC policies
CREATE POLICY "Users can view their own KYC records" ON kyc_verification_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own KYC records" ON kyc_verification_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own KYC records" ON kyc_verification_records FOR UPDATE USING (auth.uid() = user_id);

-- Compliance policies (admin access required for sensitive operations)
CREATE POLICY "Users can view their compliance reports" ON compliance_reports FOR SELECT USING (auth.uid() = user_id);

-- Atomic swap policies
CREATE POLICY "Swap participants can view their swaps" ON atomic_swap_contracts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM crypto_wallets cw 
        WHERE (cw.id = initiator_wallet_id OR cw.id = participant_wallet_id) AND cw.user_id = auth.uid()
    )
);

-- Exchange rates and monitoring logs are publicly readable
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exchange rates are publicly readable" ON exchange_rates FOR SELECT USING (TRUE);

ALTER TABLE transaction_monitoring_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view monitoring logs for their transactions" ON transaction_monitoring_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM payment_transactions pt 
        JOIN crypto_wallets cw ON (cw.id = pt.from_wallet_id OR cw.id = pt.to_wallet_id)
        WHERE pt.id = transaction_id AND cw.user_id = auth.uid()
    )
);

-- Create functions for common operations
CREATE OR REPLACE FUNCTION get_wallet_balance(wallet_id UUID)
RETURNS TABLE (
    balance_decimal DECIMAL(36, 18),
    balance_wei TEXT,
    usd_value DECIMAL(15, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cw.balance_decimal,
        cw.balance_wei,
        (cw.balance_decimal * COALESCE(er.rate, 0))::DECIMAL(15, 2) as usd_value
    FROM crypto_wallets cw
    LEFT JOIN exchange_rates er ON er.base_currency = cw.cryptocurrency AND er.quote_currency = 'USD'
    WHERE cw.id = wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check multi-sig transaction readiness
CREATE OR REPLACE FUNCTION is_multisig_ready(transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tx_record RECORD;
BEGIN
    SELECT signatures_collected, signatures_required, is_multi_sig
    INTO tx_record
    FROM payment_transactions
    WHERE id = transaction_id;
    
    IF NOT FOUND OR NOT tx_record.is_multi_sig THEN
        RETURN FALSE;
    END IF;
    
    RETURN tx_record.signatures_collected >= tx_record.signatures_required;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate compliance report
CREATE OR REPLACE FUNCTION generate_compliance_report(
    p_transaction_id UUID,
    p_jurisdiction TEXT DEFAULT 'US'
)
RETURNS UUID AS $$
DECLARE
    tx_record RECORD;
    kyc_record RECORD;
    report_id UUID;
    threshold DECIMAL(15, 2);
BEGIN
    -- Get transaction details
    SELECT pt.*, cw.user_id
    INTO tx_record
    FROM payment_transactions pt
    JOIN crypto_wallets cw ON cw.id = pt.from_wallet_id
    WHERE pt.id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found';
    END IF;
    
    -- Get KYC details
    SELECT * INTO kyc_record
    FROM kyc_verification_records
    WHERE user_id = tx_record.user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Determine threshold based on jurisdiction
    threshold := CASE p_jurisdiction
        WHEN 'US' THEN 10000.00
        WHEN 'EU' THEN 15000.00
        ELSE 10000.00
    END;
    
    -- Create compliance report if above threshold
    IF tx_record.usd_value >= threshold THEN
        INSERT INTO compliance_reports (
            transaction_id,
            user_id,
            report_type,
            jurisdiction,
            reporting_threshold,
            transaction_amount,
            risk_score,
            report_data
        )
        VALUES (
            p_transaction_id,
            tx_record.user_id,
            'CTR',
            p_jurisdiction,
            threshold,
            tx_record.usd_value,
            COALESCE(kyc_record.risk_score, 50),
            jsonb_build_object(
                'transaction_hash', tx_record.transaction_hash,
                'amount', tx_record.amount_decimal,
                'currency', tx_record.cryptocurrency,
                'kyc_level', COALESCE(kyc_record.verification_level, 0)
            )
        )
        RETURNING id INTO report_id;
    END IF;
    
    RETURN report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample exchange rates
INSERT INTO exchange_rates (base_currency, quote_currency, rate, source) VALUES
('BTC', 'USD', 42000.00, 'coinbase'),
('ETH', 'USD', 2500.00, 'coinbase'),
('USDC', 'USD', 1.00, 'coinbase'),
('USDT', 'USD', 1.00, 'coinbase'),
('DAI', 'USD', 1.00, 'coinbase')
ON CONFLICT (base_currency, quote_currency, source) DO UPDATE SET
rate = EXCLUDED.rate,
last_updated = NOW();

-- Comments for documentation
COMMENT ON TABLE crypto_wallets IS 'Multi-signature cryptocurrency wallets supporting BTC, ETH, and stablecoins';
COMMENT ON TABLE atomic_swap_contracts IS 'Atomic swap contracts for cross-chain cryptocurrency exchanges';
COMMENT ON TABLE payment_transactions IS 'Cryptocurrency payment transactions with multi-sig support';
COMMENT ON TABLE compliance_reports IS 'Automated compliance reporting for regulatory requirements';
COMMENT ON TABLE kyc_verification_records IS 'KYC/AML verification records with jurisdiction-specific limits';
COMMENT ON TABLE transaction_monitoring_logs IS 'Blockchain transaction monitoring and confirmation tracking';
```