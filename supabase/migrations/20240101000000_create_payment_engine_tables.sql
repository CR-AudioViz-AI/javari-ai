```sql
-- Multi-Blockchain Payment Engine Database Schema
-- Creates comprehensive tables for cross-chain payments, routing, and DeFi integration

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Payment Networks Configuration
CREATE TABLE IF NOT EXISTS payment_networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_name VARCHAR(50) NOT NULL UNIQUE,
    chain_id BIGINT NOT NULL UNIQUE,
    rpc_url TEXT NOT NULL,
    explorer_url TEXT,
    native_token VARCHAR(10) NOT NULL,
    native_decimals INTEGER DEFAULT 18,
    gas_token VARCHAR(10) NOT NULL,
    average_block_time INTEGER DEFAULT 12,
    finality_blocks INTEGER DEFAULT 12,
    is_testnet BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    min_gas_price BIGINT DEFAULT 0,
    max_gas_price BIGINT,
    network_fee_multiplier DECIMAL(5,3) DEFAULT 1.000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Routes for Cross-Chain Routing
CREATE TABLE IF NOT EXISTS payment_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_network_id UUID NOT NULL REFERENCES payment_networks(id),
    destination_network_id UUID NOT NULL REFERENCES payment_networks(id),
    token_address TEXT NOT NULL,
    bridge_protocol VARCHAR(50) NOT NULL,
    route_type VARCHAR(20) DEFAULT 'direct', -- direct, multi_hop
    estimated_time_minutes INTEGER DEFAULT 5,
    min_amount DECIMAL(36,18) DEFAULT 0,
    max_amount DECIMAL(36,18),
    fee_percentage DECIMAL(5,4) DEFAULT 0.003,
    gas_estimate BIGINT DEFAULT 150000,
    is_active BOOLEAN DEFAULT TRUE,
    priority_score INTEGER DEFAULT 100,
    success_rate DECIMAL(5,4) DEFAULT 1.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_network_id, destination_network_id, token_address, bridge_protocol)
);

-- Payment Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    external_reference VARCHAR(100),
    source_network_id UUID NOT NULL REFERENCES payment_networks(id),
    destination_network_id UUID REFERENCES payment_networks(id),
    route_id UUID REFERENCES payment_routes(id),
    token_address TEXT NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    amount_usd DECIMAL(18,2),
    recipient_address TEXT NOT NULL,
    sender_address TEXT NOT NULL,
    transaction_hash TEXT,
    bridge_transaction_hash TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, bridging, completed, failed
    gas_used BIGINT,
    gas_price DECIMAL(36,18),
    network_fee DECIMAL(36,18),
    bridge_fee DECIMAL(36,18),
    protocol_fee DECIMAL(36,18),
    total_fee_usd DECIMAL(18,2),
    execution_time_ms INTEGER,
    block_number BIGINT,
    block_timestamp TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gas Optimization Cache
CREATE TABLE IF NOT EXISTS gas_optimization_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES payment_networks(id),
    token_address TEXT NOT NULL,
    operation_type VARCHAR(30) NOT NULL, -- transfer, bridge, swap, approve
    gas_limit BIGINT NOT NULL,
    gas_price_slow DECIMAL(36,18),
    gas_price_standard DECIMAL(36,18),
    gas_price_fast DECIMAL(36,18),
    estimated_time_slow INTEGER,
    estimated_time_standard INTEGER,
    estimated_time_fast INTEGER,
    base_fee DECIMAL(36,18),
    priority_fee DECIMAL(36,18),
    congestion_level VARCHAR(10), -- low, medium, high
    price_source VARCHAR(20), -- chainlink, defipulse, ethgasstation
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes',
    UNIQUE(network_id, token_address, operation_type)
);

-- Bridge Protocols Configuration
CREATE TABLE IF NOT EXISTS bridge_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    protocol_name VARCHAR(50) NOT NULL UNIQUE,
    protocol_type VARCHAR(20) NOT NULL, -- layerzero, multichain, wormhole, hop
    contract_address TEXT,
    supported_networks UUID[] DEFAULT '{}',
    min_transfer_usd DECIMAL(18,2) DEFAULT 1.00,
    max_transfer_usd DECIMAL(18,2),
    base_fee_usd DECIMAL(8,2) DEFAULT 0.00,
    fee_percentage DECIMAL(5,4) DEFAULT 0.0030,
    avg_confirmation_time INTEGER DEFAULT 300, -- seconds
    security_score INTEGER DEFAULT 85,
    is_active BOOLEAN DEFAULT TRUE,
    api_endpoint TEXT,
    api_key_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stablecoin Liquidity Pools
CREATE TABLE IF NOT EXISTS stablecoin_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES payment_networks(id),
    pool_address TEXT NOT NULL,
    pool_name VARCHAR(100) NOT NULL,
    stablecoin_address TEXT NOT NULL,
    stablecoin_symbol VARCHAR(10) NOT NULL,
    pool_type VARCHAR(20) DEFAULT 'uniswap_v3', -- uniswap_v2, uniswap_v3, curve, balancer
    liquidity_usd DECIMAL(24,2),
    volume_24h_usd DECIMAL(24,2),
    apy DECIMAL(8,4),
    fee_tier DECIMAL(6,4),
    tick_lower INTEGER,
    tick_upper INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DeFi Protocol Integrations
CREATE TABLE IF NOT EXISTS defi_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES payment_networks(id),
    protocol_name VARCHAR(50) NOT NULL,
    protocol_type VARCHAR(20) NOT NULL, -- lending, dex, yield_farming, staking
    contract_address TEXT NOT NULL,
    token_address TEXT,
    token_symbol VARCHAR(20),
    current_apy DECIMAL(8,4),
    tvl_usd DECIMAL(24,2),
    risk_score INTEGER DEFAULT 50, -- 0-100
    auto_compound BOOLEAN DEFAULT FALSE,
    min_deposit_usd DECIMAL(18,2) DEFAULT 1.00,
    max_deposit_usd DECIMAL(24,2),
    lock_period_days INTEGER DEFAULT 0,
    withdrawal_fee DECIMAL(5,4) DEFAULT 0.0000,
    is_active BOOLEAN DEFAULT TRUE,
    integration_status VARCHAR(20) DEFAULT 'active', -- pending, active, deprecated
    last_apy_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multi-Chain Wallet Management
CREATE TABLE IF NOT EXISTS payment_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    wallet_address TEXT NOT NULL,
    wallet_type VARCHAR(20) NOT NULL, -- metamask, walletconnect, hardware, custodial
    network_id UUID NOT NULL REFERENCES payment_networks(id),
    is_primary BOOLEAN DEFAULT FALSE,
    balance_native DECIMAL(36,18) DEFAULT 0,
    balance_usd DECIMAL(18,2) DEFAULT 0,
    nonce BIGINT DEFAULT 0,
    gas_balance_warning BOOLEAN DEFAULT FALSE,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, wallet_address, network_id)
);

-- Transaction Fee Tracking
CREATE TABLE IF NOT EXISTS transaction_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES payment_transactions(id),
    fee_type VARCHAR(20) NOT NULL, -- gas, bridge, protocol, slippage
    fee_amount DECIMAL(36,18) NOT NULL,
    fee_token VARCHAR(20) NOT NULL,
    fee_usd DECIMAL(18,2),
    paid_to_address TEXT,
    block_number BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bridge Transaction Tracking
CREATE TABLE IF NOT EXISTS bridge_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_transaction_id UUID NOT NULL REFERENCES payment_transactions(id),
    bridge_protocol_id UUID NOT NULL REFERENCES bridge_protocols(id),
    source_tx_hash TEXT NOT NULL,
    destination_tx_hash TEXT,
    source_block_number BIGINT,
    destination_block_number BIGINT,
    bridge_status VARCHAR(20) DEFAULT 'initiated', -- initiated, pending, completed, failed
    estimated_completion TIMESTAMP WITH TIME ZONE,
    actual_completion TIMESTAMP WITH TIME ZONE,
    bridge_fee DECIMAL(36,18),
    bridge_fee_usd DECIMAL(18,2),
    error_code VARCHAR(50),
    retry_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token Price Cache
CREATE TABLE IF NOT EXISTS token_price_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES payment_networks(id),
    token_address TEXT NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    price_usd DECIMAL(18,8) NOT NULL,
    price_source VARCHAR(30) DEFAULT 'chainlink',
    market_cap_usd DECIMAL(24,2),
    volume_24h_usd DECIMAL(24,2),
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 minute',
    UNIQUE(network_id, token_address)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_payment_networks_chain_id ON payment_networks(chain_id);
CREATE INDEX IF NOT EXISTS idx_payment_networks_active ON payment_networks(is_active);

CREATE INDEX IF NOT EXISTS idx_payment_routes_source_dest ON payment_routes(source_network_id, destination_network_id);
CREATE INDEX IF NOT EXISTS idx_payment_routes_active ON payment_routes(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_routes_priority ON payment_routes(priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_hash ON payment_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(external_reference);

CREATE INDEX IF NOT EXISTS idx_gas_optimization_network ON gas_optimization_cache(network_id);
CREATE INDEX IF NOT EXISTS idx_gas_optimization_expires ON gas_optimization_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_bridge_protocols_active ON bridge_protocols(is_active);
CREATE INDEX IF NOT EXISTS idx_bridge_protocols_type ON bridge_protocols(protocol_type);

CREATE INDEX IF NOT EXISTS idx_stablecoin_pools_network ON stablecoin_pools(network_id);
CREATE INDEX IF NOT EXISTS idx_stablecoin_pools_active ON stablecoin_pools(is_active);
CREATE INDEX IF NOT EXISTS idx_stablecoin_pools_liquidity ON stablecoin_pools(liquidity_usd DESC);

CREATE INDEX IF NOT EXISTS idx_defi_protocols_network ON defi_protocols(network_id);
CREATE INDEX IF NOT EXISTS idx_defi_protocols_type ON defi_protocols(protocol_type);
CREATE INDEX IF NOT EXISTS idx_defi_protocols_apy ON defi_protocols(current_apy DESC);

CREATE INDEX IF NOT EXISTS idx_payment_wallets_user ON payment_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_wallets_address ON payment_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payment_wallets_network ON payment_wallets(network_id);

CREATE INDEX IF NOT EXISTS idx_transaction_fees_transaction ON transaction_fees(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_fees_type ON transaction_fees(fee_type);

CREATE INDEX IF NOT EXISTS idx_bridge_transactions_parent ON bridge_transactions(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bridge_transactions_status ON bridge_transactions(bridge_status);
CREATE INDEX IF NOT EXISTS idx_bridge_transactions_protocol ON bridge_transactions(bridge_protocol_id);

CREATE INDEX IF NOT EXISTS idx_token_price_cache_network_token ON token_price_cache(network_id, token_address);
CREATE INDEX IF NOT EXISTS idx_token_price_cache_expires ON token_price_cache(expires_at);

-- Enable Row Level Security
ALTER TABLE payment_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gas_optimization_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE stablecoin_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE defi_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_price_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public read access on configuration tables
CREATE POLICY "Public read access for payment networks" ON payment_networks
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for payment routes" ON payment_routes
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for bridge protocols" ON bridge_protocols
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for stablecoin pools" ON stablecoin_pools
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for defi protocols" ON defi_protocols
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access for token prices" ON token_price_cache
    FOR SELECT USING (expires_at > NOW());

-- RLS Policies for user-specific data
CREATE POLICY "Users can view own transactions" ON payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON payment_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON payment_transactions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own wallets" ON payment_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own wallets" ON payment_wallets
    FOR ALL USING (auth.uid() = user_id);

-- Service role policies for system operations
CREATE POLICY "Service role full access" ON gas_optimization_cache
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role transaction fees access" ON transaction_fees
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bridge transactions access" ON bridge_transactions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
CREATE TRIGGER update_payment_networks_updated_at BEFORE UPDATE ON payment_networks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_routes_updated_at BEFORE UPDATE ON payment_routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bridge_protocols_updated_at BEFORE UPDATE ON bridge_protocols
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_wallets_updated_at BEFORE UPDATE ON payment_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bridge_transactions_updated_at BEFORE UPDATE ON bridge_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial network configurations
INSERT INTO payment_networks (network_name, chain_id, rpc_url, explorer_url, native_token, gas_token, average_block_time, finality_blocks) VALUES
('Ethereum', 1, 'https://mainnet.infura.io/v3/', 'https://etherscan.io', 'ETH', 'ETH', 12, 12),
('Polygon', 137, 'https://polygon-rpc.com', 'https://polygonscan.com', 'MATIC', 'MATIC', 2, 128),
('BSC', 56, 'https://bsc-dataseed.binance.org', 'https://bscscan.com', 'BNB', 'BNB', 3, 15),
('Arbitrum', 42161, 'https://arb1.arbitrum.io/rpc', 'https://arbiscan.io', 'ETH', 'ETH', 1, 1),
('Optimism', 10, 'https://mainnet.optimism.io', 'https://optimistic.etherscan.io', 'ETH', 'ETH', 2, 1)
ON CONFLICT (chain_id) DO NOTHING;

-- Insert initial bridge protocol configurations
INSERT INTO bridge_protocols (protocol_name, protocol_type, min_transfer_usd, max_transfer_usd, base_fee_usd, fee_percentage, avg_confirmation_time) VALUES
('LayerZero', 'layerzero', 1.00, 1000000.00, 5.00, 0.0010, 300),
('Multichain', 'multichain', 10.00, 5000000.00, 0.50, 0.0020, 600),
('Wormhole', 'wormhole', 5.00, 2000000.00, 3.00, 0.0015, 480),
('Hop Protocol', 'hop', 1.00, 100000.00, 2.00, 0.0025, 180)
ON CONFLICT (protocol_name) DO NOTHING;
```