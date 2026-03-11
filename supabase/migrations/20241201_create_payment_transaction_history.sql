```sql
-- Payment Transaction History Database Migration
-- File: supabase/migrations/20241201_create_payment_transaction_history.sql
-- Description: Comprehensive payment transaction history schema with audit trails and regulatory compliance

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types for transaction states and categories
CREATE TYPE payment_transaction_status AS ENUM (
  'pending',
  'processing',
  'authorized',
  'captured',
  'completed',
  'failed',
  'cancelled',
  'expired',
  'refunded',
  'partially_refunded',
  'disputed',
  'settled'
);

CREATE TYPE payment_transaction_type AS ENUM (
  'payment',
  'refund',
  'chargeback',
  'adjustment',
  'fee',
  'settlement'
);

CREATE TYPE payment_method_type AS ENUM (
  'credit_card',
  'debit_card',
  'bank_transfer',
  'wallet',
  'cryptocurrency',
  'buy_now_pay_later',
  'direct_debit',
  'wire_transfer'
);

CREATE TYPE dispute_status AS ENUM (
  'initiated',
  'pending_response',
  'responded',
  'accepted',
  'rejected',
  'closed'
);

CREATE TYPE settlement_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled'
);

-- Payment Processors table
CREATE TABLE IF NOT EXISTS payment_processors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  supported_currencies TEXT[] DEFAULT '{}',
  supported_countries TEXT[] DEFAULT '{}',
  configuration JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  user_id UUID,
  processor_id UUID REFERENCES payment_processors(id),
  type payment_method_type NOT NULL,
  name VARCHAR(100),
  last_four VARCHAR(4),
  brand VARCHAR(50),
  expiry_month INTEGER,
  expiry_year INTEGER,
  fingerprint VARCHAR(100),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Transactions table (main transactions)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  user_id UUID,
  external_id VARCHAR(100),
  processor_id UUID REFERENCES payment_processors(id),
  payment_method_id UUID REFERENCES payment_methods(id),
  parent_transaction_id UUID REFERENCES payment_transactions(id),
  
  -- Transaction details
  type payment_transaction_type NOT NULL DEFAULT 'payment',
  status payment_transaction_status NOT NULL DEFAULT 'pending',
  amount DECIMAL(15,4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  fee_amount DECIMAL(15,4) DEFAULT 0,
  net_amount DECIMAL(15,4),
  
  -- Amounts in base currency for reporting
  base_amount DECIMAL(15,4),
  base_currency VARCHAR(3),
  exchange_rate DECIMAL(10,6),
  
  -- Reference information
  reference_id VARCHAR(100),
  order_id VARCHAR(100),
  invoice_id VARCHAR(100),
  description TEXT,
  
  -- Processor specific data
  processor_transaction_id VARCHAR(100),
  processor_reference VARCHAR(100),
  processor_metadata JSONB DEFAULT '{}',
  
  -- Risk and compliance
  risk_score DECIMAL(5,2),
  compliance_status VARCHAR(50),
  compliance_metadata JSONB DEFAULT '{}',
  
  -- Geographic and device info
  country_code VARCHAR(2),
  region VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  authorized_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Transaction Events table (audit trail)
CREATE TABLE IF NOT EXISTS payment_transaction_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  from_status payment_transaction_status,
  to_status payment_transaction_status,
  amount DECIMAL(15,4),
  currency VARCHAR(3),
  
  -- Event metadata
  processor_response JSONB DEFAULT '{}',
  error_code VARCHAR(50),
  error_message TEXT,
  gateway_response JSONB DEFAULT '{}',
  
  -- Audit information
  triggered_by UUID,
  triggered_by_type VARCHAR(20) DEFAULT 'user', -- user, system, processor
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Refunds table
CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  original_transaction_id UUID NOT NULL REFERENCES payment_transactions(id),
  refund_transaction_id UUID REFERENCES payment_transactions(id),
  
  -- Refund details
  amount DECIMAL(15,4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  reason VARCHAR(100),
  description TEXT,
  
  -- Processing info
  processor_refund_id VARCHAR(100),
  status payment_transaction_status DEFAULT 'pending',
  processor_metadata JSONB DEFAULT '{}',
  
  -- Audit
  requested_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Disputes table
CREATE TABLE IF NOT EXISTS payment_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  transaction_id UUID NOT NULL REFERENCES payment_transactions(id),
  
  -- Dispute details
  dispute_id VARCHAR(100) UNIQUE NOT NULL,
  amount DECIMAL(15,4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  reason_code VARCHAR(50),
  reason_description TEXT,
  category VARCHAR(100),
  
  -- Status and timeline
  status dispute_status DEFAULT 'initiated',
  evidence_due_date TIMESTAMPTZ,
  response_due_date TIMESTAMPTZ,
  
  -- Processor information
  processor_dispute_id VARCHAR(100),
  processor_metadata JSONB DEFAULT '{}',
  
  -- Resolution
  resolution VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Settlements table
CREATE TABLE IF NOT EXISTS payment_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  processor_id UUID NOT NULL REFERENCES payment_processors(id),
  
  -- Settlement details
  settlement_id VARCHAR(100) UNIQUE NOT NULL,
  batch_id VARCHAR(100),
  total_amount DECIMAL(15,4) NOT NULL,
  fee_amount DECIMAL(15,4) DEFAULT 0,
  net_amount DECIMAL(15,4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  
  -- Counts and statistics
  transaction_count INTEGER DEFAULT 0,
  successful_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  refund_count INTEGER DEFAULT 0,
  
  -- Timeline
  status settlement_status DEFAULT 'pending',
  settlement_date DATE,
  expected_deposit_date DATE,
  actual_deposit_date DATE,
  
  -- Processor data
  processor_settlement_id VARCHAR(100),
  processor_metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Fees table
CREATE TABLE IF NOT EXISTS payment_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  transaction_id UUID REFERENCES payment_transactions(id),
  settlement_id UUID REFERENCES payment_settlements(id),
  
  -- Fee details
  fee_type VARCHAR(50) NOT NULL, -- processing, gateway, network, etc.
  amount DECIMAL(15,4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  rate DECIMAL(8,6),
  fixed_amount DECIMAL(15,4),
  
  -- Fee breakdown
  description TEXT,
  category VARCHAR(50),
  subcategory VARCHAR(50),
  
  -- Processor information
  processor_fee_id VARCHAR(100),
  processor_metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Compliance Logs table
CREATE TABLE IF NOT EXISTS payment_compliance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  transaction_id UUID REFERENCES payment_transactions(id),
  
  -- Compliance details
  regulation_type VARCHAR(50) NOT NULL, -- PCI, AML, KYC, GDPR, etc.
  compliance_check VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- passed, failed, pending, exempt
  risk_level VARCHAR(20), -- low, medium, high, critical
  
  -- Check details
  check_details JSONB DEFAULT '{}',
  result_details JSONB DEFAULT '{}',
  
  -- External references
  external_check_id VARCHAR(100),
  regulatory_reference VARCHAR(100),
  
  -- Timestamps
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_org_id ON payment_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_type ON payment_transactions(type);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_processor ON payment_transactions(processor_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external ON payment_transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_processor_transaction ON payment_transactions(processor_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_currency ON payment_transactions(currency);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_settled_at ON payment_transactions(settled_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_org_status_created ON payment_transactions(org_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_org_type_created ON payment_transactions(org_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_status_created ON payment_transactions(user_id, status, created_at);

-- Transaction events indexes
CREATE INDEX IF NOT EXISTS idx_payment_transaction_events_transaction_id ON payment_transaction_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transaction_events_created_at ON payment_transaction_events(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transaction_events_event_type ON payment_transaction_events(event_type);

-- Payment methods indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_org_id ON payment_methods(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);

-- Refunds indexes
CREATE INDEX IF NOT EXISTS idx_payment_refunds_org_id ON payment_refunds(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_original_transaction ON payment_refunds(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_created_at ON payment_refunds(created_at);

-- Disputes indexes
CREATE INDEX IF NOT EXISTS idx_payment_disputes_org_id ON payment_disputes(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_transaction_id ON payment_disputes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status ON payment_disputes(status);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_dispute_id ON payment_disputes(dispute_id);

-- Settlements indexes
CREATE INDEX IF NOT EXISTS idx_payment_settlements_org_id ON payment_settlements(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_processor ON payment_settlements(processor_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_status ON payment_settlements(status);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_date ON payment_settlements(settlement_date);

-- Fees indexes
CREATE INDEX IF NOT EXISTS idx_payment_fees_org_id ON payment_fees(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_fees_transaction_id ON payment_fees(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_fees_settlement_id ON payment_fees(settlement_id);
CREATE INDEX IF NOT EXISTS idx_payment_fees_type ON payment_fees(fee_type);

-- Compliance logs indexes
CREATE INDEX IF NOT EXISTS idx_payment_compliance_org_id ON payment_compliance_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_compliance_transaction_id ON payment_compliance_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_compliance_regulation ON payment_compliance_logs(regulation_type);
CREATE INDEX IF NOT EXISTS idx_payment_compliance_status ON payment_compliance_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_compliance_checked_at ON payment_compliance_logs(checked_at);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_description_gin ON payment_transactions USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference_gin ON payment_transactions USING gin(reference_id gin_trgm_ops);

-- Enable Row Level Security
ALTER TABLE payment_processors ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_compliance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_processors (global read, admin write)
CREATE POLICY payment_processors_read_policy ON payment_processors
  FOR SELECT USING (true);

CREATE POLICY payment_processors_write_policy ON payment_processors
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin' OR 
    auth.jwt() ->> 'role' = 'system'
  );

-- RLS Policies for payment_methods
CREATE POLICY payment_methods_org_policy ON payment_methods
  FOR ALL USING (
    org_id = (auth.jwt() ->> 'org_id')::uuid OR
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY payment_methods_user_policy ON payment_methods
  FOR SELECT USING (
    user_id = auth.uid() OR
    org_id = (auth.jwt() ->> 'org_id')::uuid OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- RLS Policies for payment_transactions
CREATE POLICY payment_transactions_org_policy ON payment_transactions
  FOR ALL USING (
    org_id = (auth.jwt() ->> 'org_id')::uuid OR
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY payment_transactions_user_policy ON payment_transactions
  FOR SELECT USING (
    user_id = auth.uid() OR
    org_id = (auth.jwt() ->> 'org_id')::uuid OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- RLS Policies for payment_transaction_events
CREATE POLICY payment_transaction_events_policy ON payment_transaction_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM payment_transactions pt
      WHERE pt.id = payment_transaction_events.transaction_id
      AND (
        pt.org_id = (auth.jwt() ->> 'org_id')::uuid OR
        auth.jwt() ->> 'role' = 'admin'
      )
    )
  );

-- RLS Policies for payment_refunds
CREATE POLICY payment_refunds_org_policy ON payment_refunds
  FOR ALL USING (
    org_id = (auth.jwt() ->> 'org_id')::uuid OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- RLS Policies for payment_disputes
CREATE POLICY payment_disputes_org_policy ON payment_disputes
  FOR ALL USING (
    org_id = (auth.jwt() ->> 'org_id')::uuid OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- RLS Policies for payment_settlements
CREATE POLICY payment_settlements_org_policy ON payment_settlements
  FOR ALL USING (
    org_id = (auth.jwt() ->> 'org_id')::uuid OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- RLS Policies for payment_fees
CREATE POLICY payment_fees_org_policy ON payment_fees
  FOR ALL USING (
    org_id = (auth.jwt() ->> 'org_id')::uuid OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- RLS Policies for payment_compliance_logs
CREATE POLICY payment_compliance_logs_org_policy ON payment_compliance_logs
  FOR ALL USING (
    org_id = (auth.jwt() ->> 'org_id')::uuid OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- Database Functions

-- Function to calculate net amount
CREATE OR REPLACE FUNCTION calculate_net_amount(amount DECIMAL, fee_amount DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  RETURN amount - COALESCE(fee_amount, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to create transaction event
CREATE OR REPLACE FUNCTION create_transaction_event(
  p_transaction_id UUID,
  p_event_type VARCHAR,
  p_from_status payment_transaction_status DEFAULT NULL,
  p_to_status payment_transaction_status DEFAULT NULL,
  p_processor_response JSONB DEFAULT '{}',
  p_error_code VARCHAR DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO payment_transaction_events (
    transaction_id,
    event_type,
    from_status,
    to_status,
    processor_response,
    error_code,
    error_message,
    triggered_by,
    ip_address
  ) VALUES (
    p_transaction_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_processor_response,
    p_error_code,
    p_error_message,
    auth.uid(),
    inet_client_addr()
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get transaction summary by org
CREATE OR REPLACE FUNCTION get_transaction_summary(
  p_org_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_currency VARCHAR DEFAULT NULL
) RETURNS TABLE (
  total_transactions BIGINT,
  total_amount DECIMAL,
  total_fees DECIMAL,
  successful_count BIGINT,
  failed_count BIGINT,
  pending_count BIGINT,
  refunded_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_transactions,
    COALESCE(SUM(pt.amount), 0) as total_amount,
    COALESCE(SUM(pt.fee_amount), 0) as total_fees,
    COUNT(*) FILTER (WHERE pt.status IN ('completed', 'settled')) as successful_count,
    COUNT(*) FILTER (WHERE pt.status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE pt.status IN ('pending', 'processing', 'authorized')) as pending_count,
    COALESCE(SUM(CASE WHEN pt.status IN ('refunded', 'partially_refunded') THEN pt.amount ELSE 0 END), 0) as refunded_amount
  FROM payment_transactions pt
  WHERE pt.org_id = p_org_id
    AND pt.type = 'payment'
    AND (p_start_date IS NULL OR pt.created_at >= p_start_date)
    AND (p_end_date IS NULL OR pt.created_at <= p_end_date)
    AND (p_currency IS NULL OR pt.currency = p_currency);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for automatic event logging
CREATE OR REPLACE FUNCTION log_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM create_transaction_event(
      NEW.id,
      'status_change',
      OLD.status,
      NEW.status
    );
  END IF;
  
  -- Update timestamps
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for transaction status changes
DROP TRIGGER IF EXISTS payment_transaction_status_change_trigger ON payment_transactions;
CREATE TRIGGER payment_transaction_status_change_trigger
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION log_transaction_status_change();

-- Trigger function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
CREATE TRIGGER payment_processors_updated_at
  BEFORE UPDATE ON payment_processors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payment_refunds_updated_at
  BEFORE UPDATE ON payment_refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payment_disputes_updated_at
  BEFORE UPDATE ON payment_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payment_settlements_