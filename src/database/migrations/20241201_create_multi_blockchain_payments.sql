```sql
-- Multi-Blockchain Payment Service Migration
-- Created: 2024-12-01
-- Description: Comprehensive database schema for multi-blockchain payment processing

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_crypto";

-- Blockchain Networks Configuration
CREATE TABLE IF NOT EXISTS blockchain_networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    chain_id INTEGER NOT NULL UNIQUE,
    symbol VARCHAR(10) NOT NULL,
    rpc_endpoint TEXT NOT NULL,
    explorer_url TEXT,
    native_currency VARCHAR(10) NOT NULL,
    network_type VARCHAR(20) NOT NULL CHECK (network_type IN ('mainnet', 'testnet')),
    confirmation_blocks INTEGER NOT NULL DEFAULT 12,
    gas_multiplier DECIMAL(4,2) DEFAULT 1.5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Wallets for Multi-Chain Management
CREATE TABLE IF NOT EXISTS payment_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    network_id UUID NOT NULL REFERENCES blockchain_networks(id),
    wallet_address VARCHAR(255) NOT NULL,
    wallet_type VARCHAR(20) NOT NULL CHECK (wallet_type IN ('hot', 'cold', 'multisig')),
    private_key_encrypted TEXT,
    mnemonic_encrypted TEXT,
    derivation_path VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    balance_cache JSONB DEFAULT '{}',
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, network_id, wallet_address)
);

-- Payment Transactions with Blockchain-Specific Fields
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    network_id UUID NOT NULL REFERENCES blockchain_networks(id),
    from_wallet_id UUID REFERENCES payment_wallets(id),
    to_wallet_id UUID REFERENCES payment_wallets(id),
    transaction_hash VARCHAR(255),
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    amount DECIMAL(38,18) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    gas_price DECIMAL(38,18),
    gas_limit BIGINT,
    gas_used BIGINT,
    transaction_fee DECIMAL(38,18),
    block_number BIGINT,
    block_hash VARCHAR(255),
    transaction_index INTEGER,
    nonce BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'confirmed', 'failed', 'cancelled', 'expired')
    ),
    transaction_type VARCHAR(20) NOT NULL CHECK (
        transaction_type IN ('send', 'receive', 'conversion', 'settlement')
    ),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time Conversion Rates
CREATE TABLE IF NOT EXISTS conversion_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_currency VARCHAR(20) NOT NULL,
    to_currency VARCHAR(20) NOT NULL,
    rate DECIMAL(20,8) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_currency, to_currency, provider)
);

-- Settlement Batches for Automated Processing
CREATE TABLE IF NOT EXISTS settlement_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) NOT NULL UNIQUE,
    network_id UUID NOT NULL REFERENCES blockchain_networks(id),
    total_amount DECIMAL(38,18) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
    ),
    settlement_address VARCHAR(255),
    settlement_transaction_hash VARCHAR(255),
    gas_estimate DECIMAL(38,18),
    processing_fee DECIMAL(38,18),
    scheduled_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-Chain Bridge Protocol Management
CREATE TABLE IF NOT EXISTS cross_chain_bridges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    source_network_id UUID NOT NULL REFERENCES blockchain_networks(id),
    destination_network_id UUID NOT NULL REFERENCES blockchain_networks(id),
    bridge_contract_address VARCHAR(255) NOT NULL,
    supported_tokens JSONB NOT NULL DEFAULT '[]',
    min_amount DECIMAL(38,18) NOT NULL DEFAULT 0,
    max_amount DECIMAL(38,18),
    fee_percentage DECIMAL(8,6) NOT NULL DEFAULT 0,
    estimated_time_minutes INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_network_id, destination_network_id, bridge_contract_address)
);

-- Dynamic Gas Fee Estimates
CREATE TABLE IF NOT EXISTS gas_fee_estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES blockchain_networks(id),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('slow', 'standard', 'fast')),
    base_fee DECIMAL(20,8),
    priority_fee DECIMAL(20,8),
    gas_price DECIMAL(20,8) NOT NULL,
    estimated_wait_time INTEGER, -- minutes
    confidence_level DECIMAL(5,2), -- percentage
    data_source VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Multi-Block Confirmation Tracking
CREATE TABLE IF NOT EXISTS payment_confirmations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(255) NOT NULL,
    confirmation_number INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    is_final BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(transaction_id, block_number)
);

-- Settlement Batch Items
CREATE TABLE IF NOT EXISTS settlement_batch_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES settlement_batches(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES payment_transactions(id),
    amount DECIMAL(38,18) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(batch_id, transaction_id)
);

-- Cross-Chain Transaction Tracking
CREATE TABLE IF NOT EXISTS cross_chain_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bridge_id UUID NOT NULL REFERENCES cross_chain_bridges(id),
    source_transaction_id UUID NOT NULL REFERENCES payment_transactions(id),
    destination_transaction_id UUID REFERENCES payment_transactions(id),
    amount DECIMAL(38,18) NOT NULL,
    source_currency VARCHAR(20) NOT NULL,
    destination_currency VARCHAR(20) NOT NULL,
    bridge_fee DECIMAL(38,18),
    status VARCHAR(20) NOT NULL DEFAULT 'initiated' CHECK (
        status IN ('initiated', 'locked', 'relayed', 'completed', 'failed', 'refunded')
    ),
    bridge_transaction_hash VARCHAR(255),
    estimated_completion TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_blockchain_networks_chain_id ON blockchain_networks(chain_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_networks_active ON blockchain_networks(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_payment_wallets_user ON payment_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_wallets_network ON payment_wallets(network_id);
CREATE INDEX IF NOT EXISTS idx_payment_wallets_address ON payment_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payment_wallets_active ON payment_wallets(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_hash ON payment_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_network ON payment_transactions(network_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_from_address ON payment_transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_to_address ON payment_transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_block_number ON payment_transactions(block_number);

CREATE INDEX IF NOT EXISTS idx_conversion_rates_currencies ON conversion_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_conversion_rates_updated ON conversion_rates(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_rates_active ON conversion_rates(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_settlement_batches_status ON settlement_batches(status);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_network ON settlement_batches(network_id);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_scheduled ON settlement_batches(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_cross_chain_bridges_networks ON cross_chain_bridges(source_network_id, destination_network_id);
CREATE INDEX IF NOT EXISTS idx_cross_chain_bridges_active ON cross_chain_bridges(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_gas_fee_estimates_network ON gas_fee_estimates(network_id);
CREATE INDEX IF NOT EXISTS idx_gas_fee_estimates_timestamp ON gas_fee_estimates(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_payment_confirmations_transaction ON payment_confirmations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_confirmations_block ON payment_confirmations(block_number);

CREATE INDEX IF NOT EXISTS idx_settlement_batch_items_batch ON settlement_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_settlement_batch_items_transaction ON settlement_batch_items(transaction_id);

CREATE INDEX IF NOT EXISTS idx_cross_chain_transactions_bridge ON cross_chain_transactions(bridge_id);
CREATE INDEX IF NOT EXISTS idx_cross_chain_transactions_status ON cross_chain_transactions(status);
CREATE INDEX IF NOT EXISTS idx_cross_chain_transactions_source ON cross_chain_transactions(source_transaction_id);

-- Enable Row Level Security
ALTER TABLE blockchain_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_chain_bridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE gas_fee_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_chain_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user data isolation
CREATE POLICY "Users can view their own wallets" ON payment_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallets" ON payment_wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallets" ON payment_wallets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own transactions" ON payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" ON payment_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" ON payment_transactions
    FOR UPDATE USING (auth.uid() = user_id);

-- Public read access for reference data
CREATE POLICY "Public read access to blockchain networks" ON blockchain_networks
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public read access to conversion rates" ON conversion_rates
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public read access to cross chain bridges" ON cross_chain_bridges
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public read access to gas fee estimates" ON gas_fee_estimates
    FOR SELECT TO authenticated USING (true);

-- Service role policies for system operations
CREATE POLICY "Service role full access to settlement batches" ON settlement_batches
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to payment confirmations" ON payment_confirmations
    TO service_role USING (true) WITH CHECK (true);

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_blockchain_networks_updated_at BEFORE UPDATE ON blockchain_networks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_wallets_updated_at BEFORE UPDATE ON payment_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_batches_updated_at BEFORE UPDATE ON settlement_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cross_chain_bridges_updated_at BEFORE UPDATE ON cross_chain_bridges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cross_chain_transactions_updated_at BEFORE UPDATE ON cross_chain_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default blockchain networks
INSERT INTO blockchain_networks (name, chain_id, symbol, rpc_endpoint, explorer_url, native_currency, network_type, confirmation_blocks)
VALUES 
    ('Ethereum Mainnet', 1, 'ETH', 'https://mainnet.infura.io/v3/', 'https://etherscan.io', 'ETH', 'mainnet', 12),
    ('Bitcoin Mainnet', 0, 'BTC', 'https://bitcoin-mainnet-rpc.com', 'https://blockstream.info', 'BTC', 'mainnet', 6),
    ('Polygon Mainnet', 137, 'MATIC', 'https://polygon-rpc.com', 'https://polygonscan.com', 'MATIC', 'mainnet', 128),
    ('Binance Smart Chain', 56, 'BNB', 'https://bsc-dataseed.binance.org', 'https://bscscan.com', 'BNB', 'mainnet', 15),
    ('Arbitrum One', 42161, 'ETH', 'https://arb1.arbitrum.io/rpc', 'https://arbiscan.io', 'ETH', 'mainnet', 1)
ON CONFLICT (chain_id) DO NOTHING;

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE payment_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE payment_confirmations;
ALTER PUBLICATION supabase_realtime ADD TABLE settlement_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE cross_chain_transactions;
```