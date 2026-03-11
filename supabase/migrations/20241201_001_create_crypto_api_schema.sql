```sql
-- Multi-Blockchain Cryptocurrency API Schema Migration
-- Created: 2024-12-01
-- Description: Complete database schema for multi-blockchain cryptocurrency API

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_crypto";

-- Create enum types
CREATE TYPE blockchain_network AS ENUM (
    'BITCOIN',
    'ETHEREUM', 
    'POLYGON',
    'BSC',
    'ARBITRUM',
    'OPTIMISM',
    'AVALANCHE'
);

CREATE TYPE wallet_type AS ENUM (
    'HOT',
    'COLD',
    'MULTISIG',
    'HARDWARE',
    'PAPER'
);

CREATE TYPE transaction_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'FAILED',
    'CANCELLED',
    'REJECTED'
);

CREATE TYPE transaction_type AS ENUM (
    'SEND',
    'RECEIVE',
    'SWAP',
    'STAKE',
    'UNSTAKE',
    'BRIDGE',
    'DEFI_DEPOSIT',
    'DEFI_WITHDRAW'
);

CREATE TYPE defi_protocol_type AS ENUM (
    'DEX',
    'LENDING',
    'STAKING',
    'FARMING',
    'BRIDGE',
    'OPTIONS',
    'INSURANCE'
);

-- Blockchain Networks Table
CREATE TABLE IF NOT EXISTS blockchain_networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network blockchain_network NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    chain_id INTEGER,
    rpc_url TEXT NOT NULL,
    explorer_url TEXT,
    native_currency VARCHAR(10) NOT NULL,
    native_decimals INTEGER DEFAULT 18,
    is_testnet BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    block_time_seconds INTEGER,
    min_confirmations INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crypto Wallets Table
CREATE TABLE IF NOT EXISTS crypto_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    network blockchain_network NOT NULL,
    address TEXT NOT NULL,
    wallet_type wallet_type NOT NULL DEFAULT 'HOT',
    name VARCHAR(100),
    encrypted_private_key TEXT,
    public_key TEXT,
    derivation_path TEXT,
    is_watching_only BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, network, address),
    FOREIGN KEY (network) REFERENCES blockchain_networks(network)
);

-- Wallet Balances Table
CREATE TABLE IF NOT EXISTS wallet_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL,
    token_address TEXT DEFAULT 'native',
    token_symbol VARCHAR(20) NOT NULL,
    token_name VARCHAR(100),
    balance DECIMAL(36, 18) NOT NULL DEFAULT 0,
    decimals INTEGER DEFAULT 18,
    usd_value DECIMAL(20, 8),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (wallet_id) REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    UNIQUE(wallet_id, token_address)
);

-- Crypto Transactions Table
CREATE TABLE IF NOT EXISTS crypto_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL,
    tx_hash TEXT NOT NULL,
    network blockchain_network NOT NULL,
    transaction_type transaction_type NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    token_address TEXT DEFAULT 'native',
    token_symbol VARCHAR(20) NOT NULL,
    gas_price DECIMAL(36, 18),
    gas_limit BIGINT,
    gas_used BIGINT,
    transaction_fee DECIMAL(36, 18),
    block_number BIGINT,
    block_hash TEXT,
    confirmation_count INTEGER DEFAULT 0,
    nonce INTEGER,
    input_data TEXT,
    usd_value DECIMAL(20, 8),
    exchange_rate DECIMAL(20, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    FOREIGN KEY (wallet_id) REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    FOREIGN KEY (network) REFERENCES blockchain_networks(network)
);

-- DeFi Protocols Table
CREATE TABLE IF NOT EXISTS defi_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    protocol_type defi_protocol_type NOT NULL,
    network blockchain_network NOT NULL,
    contract_address TEXT NOT NULL,
    website_url TEXT,
    documentation_url TEXT,
    tvl_usd DECIMAL(20, 2),
    apy_percentage DECIMAL(8, 4),
    is_active BOOLEAN DEFAULT true,
    risk_score INTEGER CHECK (risk_score >= 1 AND risk_score <= 10),
    audit_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (network) REFERENCES blockchain_networks(network)
);

-- DeFi Positions Table
CREATE TABLE IF NOT EXISTS defi_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL,
    protocol_id UUID NOT NULL,
    position_type VARCHAR(50) NOT NULL,
    token_address TEXT NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    amount_deposited DECIMAL(36, 18) NOT NULL,
    current_balance DECIMAL(36, 18) NOT NULL,
    rewards_earned DECIMAL(36, 18) DEFAULT 0,
    entry_price DECIMAL(20, 8),
    current_price DECIMAL(20, 8),
    usd_value DECIMAL(20, 8),
    apy_percentage DECIMAL(8, 4),
    is_active BOOLEAN DEFAULT true,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (wallet_id) REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    FOREIGN KEY (protocol_id) REFERENCES defi_protocols(id)
);

-- Transaction Monitoring Table
CREATE TABLE IF NOT EXISTS transaction_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL,
    monitor_type VARCHAR(50) NOT NULL,
    threshold_value DECIMAL(36, 18),
    current_value DECIMAL(36, 18),
    alert_triggered BOOLEAN DEFAULT false,
    alert_message TEXT,
    webhook_url TEXT,
    email_notification BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    triggered_at TIMESTAMPTZ,
    FOREIGN KEY (transaction_id) REFERENCES crypto_transactions(id) ON DELETE CASCADE
);

-- Gas Estimates Table
CREATE TABLE IF NOT EXISTS gas_estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network blockchain_network NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    gas_limit BIGINT NOT NULL,
    slow_gas_price DECIMAL(36, 18) NOT NULL,
    standard_gas_price DECIMAL(36, 18) NOT NULL,
    fast_gas_price DECIMAL(36, 18) NOT NULL,
    estimated_time_slow INTEGER,
    estimated_time_standard INTEGER,
    estimated_time_fast INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (network) REFERENCES blockchain_networks(network)
);

-- Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_symbol VARCHAR(20) NOT NULL,
    token_address TEXT,
    network blockchain_network,
    usd_price DECIMAL(20, 8) NOT NULL,
    market_cap DECIMAL(20, 2),
    volume_24h DECIMAL(20, 2),
    price_change_24h DECIMAL(8, 4),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(token_symbol, network, token_address),
    FOREIGN KEY (network) REFERENCES blockchain_networks(network)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_user_id ON crypto_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_network ON crypto_wallets(network);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_address ON crypto_wallets(address);

CREATE INDEX IF NOT EXISTS idx_wallet_balances_wallet_id ON wallet_balances(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_balances_token_symbol ON wallet_balances(token_symbol);

CREATE INDEX IF NOT EXISTS idx_crypto_transactions_wallet_id ON crypto_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_tx_hash ON crypto_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_network ON crypto_transactions(network);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_status ON crypto_transactions(status);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_created_at ON crypto_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_from_address ON crypto_transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_to_address ON crypto_transactions(to_address);

CREATE INDEX IF NOT EXISTS idx_defi_positions_wallet_id ON defi_positions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_defi_positions_protocol_id ON defi_positions(protocol_id);
CREATE INDEX IF NOT EXISTS idx_defi_positions_is_active ON defi_positions(is_active);

CREATE INDEX IF NOT EXISTS idx_gas_estimates_network ON gas_estimates(network);
CREATE INDEX IF NOT EXISTS idx_gas_estimates_created_at ON gas_estimates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_token_symbol ON exchange_rates(token_symbol);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_network ON exchange_rates(network);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_last_updated ON exchange_rates(last_updated DESC);

-- Create composite indexes
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_wallet_status ON crypto_transactions(wallet_id, status);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_network_status ON crypto_transactions(network, status);
CREATE INDEX IF NOT EXISTS idx_defi_positions_wallet_active ON defi_positions(wallet_id, is_active);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blockchain_networks_updated_at BEFORE UPDATE ON blockchain_networks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crypto_wallets_updated_at BEFORE UPDATE ON crypto_wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_defi_protocols_updated_at BEFORE UPDATE ON defi_protocols FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create balance update trigger
CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update balance based on transaction type and status
    IF NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED' THEN
        IF NEW.transaction_type IN ('RECEIVE', 'DEFI_WITHDRAW') THEN
            INSERT INTO wallet_balances (wallet_id, token_address, token_symbol, balance, last_updated)
            VALUES (NEW.wallet_id, COALESCE(NEW.token_address, 'native'), NEW.token_symbol, NEW.amount, NOW())
            ON CONFLICT (wallet_id, token_address)
            DO UPDATE SET 
                balance = wallet_balances.balance + NEW.amount,
                last_updated = NOW();
        ELSIF NEW.transaction_type IN ('SEND', 'DEFI_DEPOSIT') THEN
            INSERT INTO wallet_balances (wallet_id, token_address, token_symbol, balance, last_updated)
            VALUES (NEW.wallet_id, COALESCE(NEW.token_address, 'native'), NEW.token_symbol, -NEW.amount, NOW())
            ON CONFLICT (wallet_id, token_address)
            DO UPDATE SET 
                balance = wallet_balances.balance - NEW.amount,
                last_updated = NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wallet_balance_trigger AFTER UPDATE ON crypto_transactions FOR EACH ROW EXECUTE FUNCTION update_wallet_balance();

-- Create useful views
CREATE OR REPLACE VIEW user_wallet_overview AS
SELECT 
    cw.user_id,
    cw.network,
    COUNT(cw.id) as wallet_count,
    SUM(wb.usd_value) as total_usd_value,
    COUNT(DISTINCT wb.token_symbol) as unique_tokens
FROM crypto_wallets cw
LEFT JOIN wallet_balances wb ON cw.id = wb.wallet_id
WHERE cw.is_active = true
GROUP BY cw.user_id, cw.network;

CREATE OR REPLACE VIEW transaction_summary AS
SELECT 
    ct.wallet_id,
    ct.network,
    ct.transaction_type,
    ct.status,
    COUNT(*) as transaction_count,
    SUM(ct.usd_value) as total_usd_value,
    AVG(ct.transaction_fee) as avg_transaction_fee
FROM crypto_transactions ct
GROUP BY ct.wallet_id, ct.network, ct.transaction_type, ct.status;

CREATE OR REPLACE VIEW active_defi_positions AS
SELECT 
    dp.*,
    defi.name as protocol_name,
    defi.protocol_type,
    (dp.current_balance - dp.amount_deposited + dp.rewards_earned) as profit_loss
FROM defi_positions dp
JOIN defi_protocols defi ON dp.protocol_id = defi.id
WHERE dp.is_active = true;

-- Enable Row Level Security
ALTER TABLE crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE defi_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_monitoring ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crypto_wallets
CREATE POLICY wallet_user_policy ON crypto_wallets
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for wallet_balances
CREATE POLICY balance_user_policy ON wallet_balances
    FOR ALL USING (
        wallet_id IN (
            SELECT id FROM crypto_wallets WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for crypto_transactions
CREATE POLICY transaction_user_policy ON crypto_transactions
    FOR ALL USING (
        wallet_id IN (
            SELECT id FROM crypto_wallets WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for defi_positions
CREATE POLICY defi_position_user_policy ON defi_positions
    FOR ALL USING (
        wallet_id IN (
            SELECT id FROM crypto_wallets WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for transaction_monitoring
CREATE POLICY monitoring_user_policy ON transaction_monitoring
    FOR ALL USING (
        transaction_id IN (
            SELECT ct.id FROM crypto_transactions ct
            JOIN crypto_wallets cw ON ct.wallet_id = cw.id
            WHERE cw.user_id = auth.uid()
        )
    );

-- Insert default blockchain networks
INSERT INTO blockchain_networks (network, name, chain_id, rpc_url, explorer_url, native_currency, native_decimals, block_time_seconds, min_confirmations) VALUES
('BITCOIN', 'Bitcoin', NULL, 'https://bitcoin.rpc.url', 'https://blockstream.info', 'BTC', 8, 600, 6),
('ETHEREUM', 'Ethereum', 1, 'https://eth.rpc.url', 'https://etherscan.io', 'ETH', 18, 12, 12),
('POLYGON', 'Polygon', 137, 'https://polygon.rpc.url', 'https://polygonscan.com', 'MATIC', 18, 2, 20),
('BSC', 'Binance Smart Chain', 56, 'https://bsc.rpc.url', 'https://bscscan.com', 'BNB', 18, 3, 15),
('ARBITRUM', 'Arbitrum One', 42161, 'https://arb1.rpc.url', 'https://arbiscan.io', 'ETH', 18, 1, 1),
('OPTIMISM', 'Optimism', 10, 'https://optimism.rpc.url', 'https://optimistic.etherscan.io', 'ETH', 18, 2, 1),
('AVALANCHE', 'Avalanche C-Chain', 43114, 'https://api.avax.network/ext/bc/C/rpc', 'https://snowtrace.io', 'AVAX', 18, 2, 1)
ON CONFLICT (network) DO NOTHING;

-- Insert common exchange rates
INSERT INTO exchange_rates (token_symbol, network, usd_price, last_updated) VALUES
('BTC', 'BITCOIN', 45000.00, NOW()),
('ETH', 'ETHEREUM', 2500.00, NOW()),
('MATIC', 'POLYGON', 0.85, NOW()),
('BNB', 'BSC', 350.00, NOW()),
('AVAX', 'AVALANCHE', 35.00, NOW())
ON CONFLICT (token_symbol, network, token_address) DO NOTHING;
```