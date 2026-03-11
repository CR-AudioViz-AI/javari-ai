```sql
-- Create comprehensive cryptocurrency payment gateway schema
-- Migration: 20240101000000_create_crypto_payment_gateway.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types for better type safety
CREATE TYPE payment_status AS ENUM (
  'pending',
  'initiated',
  'confirming',
  'confirmed',
  'completed',
  'failed',
  'expired',
  'cancelled'
);

CREATE TYPE transaction_status AS ENUM (
  'pending',
  'broadcasting',
  'broadcasted',
  'confirming',
  'confirmed',
  'failed',
  'dropped'
);

CREATE TYPE blockchain_network AS ENUM (
  'bitcoin',
  'ethereum',
  'bsc',
  'polygon',
  'arbitrum',
  'optimism',
  'avalanche',
  'solana',
  'cardano',
  'polkadot'
);

CREATE TYPE wallet_type AS ENUM (
  'hot',
  'cold',
  'custodial',
  'non_custodial',
  'multisig'
);

CREATE TYPE webhook_event_type AS ENUM (
  'transaction_created',
  'transaction_confirmed',
  'transaction_failed',
  'payment_received',
  'payment_completed',
  'rate_updated'
);

-- Crypto currencies table with token contracts and network configurations
CREATE TABLE IF NOT EXISTS crypto_currencies (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  symbol varchar(20) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  network blockchain_network NOT NULL,
  contract_address varchar(100),
  decimals integer NOT NULL DEFAULT 18,
  is_native boolean DEFAULT false,
  is_stablecoin boolean DEFAULT false,
  is_active boolean DEFAULT true,
  minimum_confirmations integer DEFAULT 1,
  withdrawal_fee numeric(30, 18) DEFAULT 0,
  icon_url text,
  explorer_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT crypto_currencies_decimals_check CHECK (decimals >= 0 AND decimals <= 30),
  CONSTRAINT crypto_currencies_confirmations_check CHECK (minimum_confirmations > 0)
);

-- Crypto wallets table for user wallet management
CREATE TABLE IF NOT EXISTS crypto_wallets (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL,
  currency_id uuid NOT NULL REFERENCES crypto_currencies(id) ON DELETE RESTRICT,
  address varchar(200) NOT NULL,
  wallet_type wallet_type NOT NULL DEFAULT 'hot',
  label varchar(100),
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  balance numeric(30, 18) DEFAULT 0,
  locked_balance numeric(30, 18) DEFAULT 0,
  private_key_encrypted text, -- Only for hot wallets, encrypted
  derivation_path varchar(100),
  public_key text,
  wallet_provider varchar(50),
  metadata jsonb DEFAULT '{}',
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, currency_id, address),
  CONSTRAINT crypto_wallets_balance_check CHECK (balance >= 0),
  CONSTRAINT crypto_wallets_locked_balance_check CHECK (locked_balance >= 0)
);

-- Crypto exchange rates table for real-time price data
CREATE TABLE IF NOT EXISTS crypto_exchange_rates (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  currency_id uuid NOT NULL REFERENCES crypto_currencies(id) ON DELETE CASCADE,
  base_currency varchar(10) NOT NULL DEFAULT 'USD',
  rate numeric(30, 18) NOT NULL,
  volume_24h numeric(30, 8),
  change_24h numeric(10, 4),
  market_cap numeric(30, 2),
  source varchar(50) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(currency_id, base_currency, source),
  CONSTRAINT crypto_exchange_rates_rate_check CHECK (rate > 0)
);

-- Crypto payment methods table for supported payment options
CREATE TABLE IF NOT EXISTS crypto_payment_methods (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL,
  currency_id uuid NOT NULL REFERENCES crypto_currencies(id) ON DELETE RESTRICT,
  wallet_id uuid REFERENCES crypto_wallets(id) ON DELETE SET NULL,
  name varchar(100) NOT NULL,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, currency_id, name)
);

-- Crypto payment requests table for payment initiation
CREATE TABLE IF NOT EXISTS crypto_payment_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL,
  merchant_id uuid,
  currency_id uuid NOT NULL REFERENCES crypto_currencies(id) ON DELETE RESTRICT,
  payment_method_id uuid REFERENCES crypto_payment_methods(id) ON DELETE SET NULL,
  
  -- Payment details
  amount numeric(30, 18) NOT NULL,
  amount_usd numeric(12, 2),
  exchange_rate numeric(30, 18),
  description text,
  reference varchar(100),
  invoice_id varchar(100),
  
  -- Payment addresses
  recipient_address varchar(200) NOT NULL,
  sender_address varchar(200),
  
  -- Status and timing
  status payment_status DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  completed_at timestamptz,
  
  -- Fee information
  network_fee numeric(30, 18) DEFAULT 0,
  service_fee numeric(30, 18) DEFAULT 0,
  total_fee numeric(30, 18) DEFAULT 0,
  
  -- Callback configuration
  webhook_url text,
  return_url text,
  cancel_url text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT crypto_payment_requests_amount_check CHECK (amount > 0),
  CONSTRAINT crypto_payment_requests_expires_check CHECK (expires_at > created_at)
);

-- Crypto transactions table for blockchain transaction tracking
CREATE TABLE IF NOT EXISTS crypto_transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  payment_request_id uuid REFERENCES crypto_payment_requests(id) ON DELETE SET NULL,
  currency_id uuid NOT NULL REFERENCES crypto_currencies(id) ON DELETE RESTRICT,
  wallet_id uuid REFERENCES crypto_wallets(id) ON DELETE SET NULL,
  
  -- Transaction identifiers
  tx_hash varchar(200) UNIQUE,
  block_number bigint,
  block_hash varchar(200),
  transaction_index integer,
  
  -- Transaction details
  from_address varchar(200) NOT NULL,
  to_address varchar(200) NOT NULL,
  amount numeric(30, 18) NOT NULL,
  fee numeric(30, 18) DEFAULT 0,
  gas_price numeric(30, 18),
  gas_limit bigint,
  gas_used bigint,
  nonce bigint,
  
  -- Status and confirmations
  status transaction_status DEFAULT 'pending',
  confirmations integer DEFAULT 0,
  required_confirmations integer DEFAULT 1,
  
  -- Timestamps
  broadcast_at timestamptz,
  mined_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Raw transaction data
  raw_transaction jsonb,
  receipt jsonb,
  
  CONSTRAINT crypto_transactions_amount_check CHECK (amount >= 0),
  CONSTRAINT crypto_transactions_confirmations_check CHECK (confirmations >= 0)
);

-- Crypto webhooks table for blockchain event handling
CREATE TABLE IF NOT EXISTS crypto_webhooks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid,
  payment_request_id uuid REFERENCES crypto_payment_requests(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES crypto_transactions(id) ON DELETE CASCADE,
  
  -- Event details
  event_type webhook_event_type NOT NULL,
  url text NOT NULL,
  secret varchar(100),
  
  -- Request/Response tracking
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 5,
  next_retry_at timestamptz,
  last_response_status integer,
  last_response_body text,
  
  -- Status
  is_active boolean DEFAULT true,
  completed_at timestamptz,
  
  -- Payload
  payload jsonb NOT NULL,
  headers jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT crypto_webhooks_attempts_check CHECK (attempts >= 0),
  CONSTRAINT crypto_webhooks_max_attempts_check CHECK (max_attempts > 0)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_crypto_currencies_symbol ON crypto_currencies(symbol);
CREATE INDEX IF NOT EXISTS idx_crypto_currencies_network ON crypto_currencies(network);
CREATE INDEX IF NOT EXISTS idx_crypto_currencies_active ON crypto_currencies(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_crypto_wallets_user_id ON crypto_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_currency_id ON crypto_wallets(currency_id);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_address ON crypto_wallets(address);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_active ON crypto_wallets(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_crypto_exchange_rates_currency_base ON crypto_exchange_rates(currency_id, base_currency);
CREATE INDEX IF NOT EXISTS idx_crypto_exchange_rates_expires ON crypto_exchange_rates(expires_at);
CREATE INDEX IF NOT EXISTS idx_crypto_exchange_rates_created ON crypto_exchange_rates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crypto_payment_methods_user ON crypto_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_methods_currency ON crypto_payment_methods(currency_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_methods_active ON crypto_payment_methods(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_user ON crypto_payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_merchant ON crypto_payment_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_currency ON crypto_payment_requests(currency_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_status ON crypto_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_expires ON crypto_payment_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_reference ON crypto_payment_requests(reference);

CREATE INDEX IF NOT EXISTS idx_crypto_transactions_payment_request ON crypto_transactions(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_currency ON crypto_transactions(currency_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_wallet ON crypto_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_hash ON crypto_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_status ON crypto_transactions(status);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_addresses ON crypto_transactions(from_address, to_address);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_block ON crypto_transactions(block_number DESC);

CREATE INDEX IF NOT EXISTS idx_crypto_webhooks_payment_request ON crypto_webhooks(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_crypto_webhooks_transaction ON crypto_webhooks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_crypto_webhooks_event_type ON crypto_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_crypto_webhooks_retry ON crypto_webhooks(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crypto_webhooks_active ON crypto_webhooks(is_active) WHERE is_active = true;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_crypto_currencies_updated_at BEFORE UPDATE ON crypto_currencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crypto_wallets_updated_at BEFORE UPDATE ON crypto_wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crypto_payment_methods_updated_at BEFORE UPDATE ON crypto_payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crypto_payment_requests_updated_at BEFORE UPDATE ON crypto_payment_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crypto_transactions_updated_at BEFORE UPDATE ON crypto_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crypto_webhooks_updated_at BEFORE UPDATE ON crypto_webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Utility function to get current exchange rate
CREATE OR REPLACE FUNCTION get_current_exchange_rate(
  p_currency_id uuid,
  p_base_currency varchar(10) DEFAULT 'USD'
)
RETURNS numeric AS $$
DECLARE
  current_rate numeric;
BEGIN
  SELECT rate INTO current_rate
  FROM crypto_exchange_rates
  WHERE currency_id = p_currency_id
    AND base_currency = p_base_currency
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(current_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate payment amount in crypto
CREATE OR REPLACE FUNCTION calculate_crypto_amount(
  p_usd_amount numeric,
  p_currency_id uuid
)
RETURNS numeric AS $$
DECLARE
  exchange_rate numeric;
  crypto_amount numeric;
BEGIN
  SELECT get_current_exchange_rate(p_currency_id) INTO exchange_rate;
  
  IF exchange_rate > 0 THEN
    crypto_amount := p_usd_amount / exchange_rate;
  ELSE
    crypto_amount := 0;
  END IF;
  
  RETURN crypto_amount;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old payment requests
CREATE OR REPLACE FUNCTION expire_payment_requests()
RETURNS integer AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE crypto_payment_requests
  SET status = 'expired',
      updated_at = now()
  WHERE status IN ('pending', 'initiated')
    AND expires_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE crypto_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crypto_currencies (public read, admin write)
CREATE POLICY "Anyone can read crypto currencies" ON crypto_currencies FOR SELECT USING (true);

CREATE POLICY "Admins can manage crypto currencies" ON crypto_currencies FOR ALL 
USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));

-- RLS Policies for crypto_wallets (users can only access their own wallets)
CREATE POLICY "Users can read their own wallets" ON crypto_wallets FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own wallets" ON crypto_wallets FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own wallets" ON crypto_wallets FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own wallets" ON crypto_wallets FOR DELETE 
USING (user_id = auth.uid());

-- RLS Policies for crypto_exchange_rates (public read, service write)
CREATE POLICY "Anyone can read exchange rates" ON crypto_exchange_rates FOR SELECT USING (true);

CREATE POLICY "Service can manage exchange rates" ON crypto_exchange_rates FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for crypto_payment_methods (users can only access their own)
CREATE POLICY "Users can read their own payment methods" ON crypto_payment_methods FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own payment methods" ON crypto_payment_methods FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own payment methods" ON crypto_payment_methods FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own payment methods" ON crypto_payment_methods FOR DELETE 
USING (user_id = auth.uid());

-- RLS Policies for crypto_payment_requests (users and merchants can access relevant requests)
CREATE POLICY "Users can read their payment requests" ON crypto_payment_requests FOR SELECT 
USING (user_id = auth.uid() OR merchant_id = auth.uid());

CREATE POLICY "Users can create payment requests" ON crypto_payment_requests FOR INSERT 
WITH CHECK (user_id = auth.uid() OR merchant_id = auth.uid());

CREATE POLICY "Users can update their payment requests" ON crypto_payment_requests FOR UPDATE 
USING (user_id = auth.uid() OR merchant_id = auth.uid());

-- RLS Policies for crypto_transactions (users can access transactions related to their payments)
CREATE POLICY "Users can read related transactions" ON crypto_transactions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crypto_payment_requests 
    WHERE crypto_payment_requests.id = crypto_transactions.payment_request_id 
    AND (crypto_payment_requests.user_id = auth.uid() OR crypto_payment_requests.merchant_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM crypto_wallets 
    WHERE crypto_wallets.id = crypto_transactions.wallet_id 
    AND crypto_wallets.user_id = auth.uid()
  )
);

CREATE POLICY "Service can manage transactions" ON crypto_transactions FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for crypto_webhooks (users can access webhooks for their requests)
CREATE POLICY "Users can read their webhooks" ON crypto_webhooks FOR SELECT 
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM crypto_payment_requests 
    WHERE crypto_payment_requests.id = crypto_webhooks.payment_request_id 
    AND (crypto_payment_requests.user_id = auth.uid() OR crypto_payment_requests.merchant_id = auth.uid())
  )
);

CREATE POLICY "Service can manage webhooks" ON crypto_webhooks FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');

-- Insert popular cryptocurrencies
INSERT INTO crypto_currencies (symbol, name, network, is_native, is_stablecoin, decimals, minimum_confirmations) VALUES
('BTC', 'Bitcoin', 'bitcoin', true, false, 8, 1),
('ETH', 'Ethereum', 'ethereum', true, false, 18, 12),
('USDT', 'Tether USD', 'ethereum', false, true, 6, 12),
('USDC', 'USD Coin', 'ethereum', false, true, 6, 12),
('BNB', 'BNB', 'bsc', true, false, 18, 15),
('MATIC', 'Polygon', 'polygon', true, false, 18, 20),
('AVAX', 'Avalanche', 'avalanche', true, false, 18, 10),
('SOL', 'Solana', 'solana', true, false, 9, 20),
('ADA', 'Cardano', 'cardano', true, false, 6, 10),
('DOT', 'Polkadot', 'polkadot', true, false, 10, 10)
ON CONFLICT (symbol) DO NOTHING;

-- Add token contract addresses for ERC-20 tokens
UPDATE crypto_currencies SET 
  contract_address = '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  explorer_url = 'https://etherscan.io'
WHERE symbol = 'USDT' AND network = 'ethereum';

UPDATE crypto_currencies SET 
  contract_address = '0xA0b86a33E6417c2f8463d84CDa509e8eEb5fa7BB',
  explorer_url = 'https://etherscan.io'
WHERE symbol = 'USDC' AND network = 'ethereum';

-- Add comments for documentation
COMMENT ON TABLE crypto_currencies IS 'Supported cryptocurrencies with network configurations and metadata';
COMMENT ON TABLE crypto_wallets IS 'User cryptocurrency wallets with balance tracking and security features';
COMMENT ON TABLE crypto_exchange_rates IS 'Real-time cryptocurrency exchange rates from multiple sources';
COMMENT ON TABLE crypto_payment_methods IS 'User-defined payment methods linking wallets to currencies';
COMMENT ON TABLE crypto_payment_requests IS 'Payment requests with amounts, recipients, and status tracking';
COMMENT ON TABLE crypto_transactions IS 'Blockchain transaction records with confirmation tracking';
COMMENT ON TABLE crypto_webhooks IS 'Webhook delivery system for blockchain events and payment updates';

COMMENT ON FUNCTION get_current_exchange_rate IS 'Retrieves the most recent valid exchange rate for a currency pair';
COMMENT ON FUNCTION calculate_crypto_amount IS 'Converts USD amount to cryptocurrency amount using current exchange rates';
COMMENT ON FUNCTION expire_payment_requests IS 'Batch function to expire old pending payment requests';
```