```sql
-- Distributed Payment Ledger Database Migration
-- File: supabase/migrations/20241201000000_create_distributed_payment_ledger.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
DO $$ BEGIN
    CREATE TYPE ledger_entry_type AS ENUM (
        'debit',
        'credit',
        'transfer',
        'settlement',
        'adjustment',
        'fee',
        'refund'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ledger_entry_status AS ENUM (
        'pending',
        'confirmed',
        'settled',
        'disputed',
        'reversed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE block_status AS ENUM (
        'open',
        'sealed',
        'finalized'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE settlement_status AS ENUM (
        'pending',
        'processing',
        'completed',
        'failed',
        'disputed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main ledger blocks table for grouping transactions
CREATE TABLE IF NOT EXISTS ledger_blocks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_number bigint NOT NULL,
    previous_block_hash text,
    merkle_root text,
    block_hash text NOT NULL,
    status block_status NOT NULL DEFAULT 'open',
    tenant_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    sealed_at timestamptz,
    finalized_at timestamptz,
    transaction_count integer NOT NULL DEFAULT 0,
    total_amount decimal(20,8) NOT NULL DEFAULT 0,
    metadata jsonb DEFAULT '{}',
    
    CONSTRAINT ledger_blocks_block_number_tenant_unique UNIQUE (block_number, tenant_id),
    CONSTRAINT ledger_blocks_block_hash_unique UNIQUE (block_hash)
);

-- Immutable payment ledger entries with hash chains
CREATE TABLE IF NOT EXISTS payment_ledger_entries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id uuid NOT NULL REFERENCES ledger_blocks(id),
    entry_number bigint NOT NULL,
    transaction_id uuid NOT NULL,
    previous_entry_hash text,
    entry_hash text NOT NULL,
    entry_type ledger_entry_type NOT NULL,
    status ledger_entry_status NOT NULL DEFAULT 'pending',
    tenant_id uuid NOT NULL,
    
    -- Transaction details
    from_account_id uuid,
    to_account_id uuid,
    amount decimal(20,8) NOT NULL,
    currency_code varchar(3) NOT NULL,
    exchange_rate decimal(20,8),
    
    -- Cryptographic verification
    signature text NOT NULL,
    public_key text NOT NULL,
    nonce bigint NOT NULL,
    
    -- Metadata and audit
    description text,
    reference_id varchar(255),
    external_reference varchar(255),
    idempotency_key varchar(255),
    metadata jsonb DEFAULT '{}',
    
    -- Timestamps (immutable once created)
    created_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    settled_at timestamptz,
    
    CONSTRAINT payment_ledger_entries_entry_hash_unique UNIQUE (entry_hash),
    CONSTRAINT payment_ledger_entries_idempotency_key_unique UNIQUE (idempotency_key),
    CONSTRAINT payment_ledger_entries_entry_number_block_unique UNIQUE (entry_number, block_id),
    CONSTRAINT payment_ledger_entries_amount_positive CHECK (amount > 0)
);

-- Multi-party transaction participants
CREATE TABLE IF NOT EXISTS transaction_participants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id uuid NOT NULL,
    ledger_entry_id uuid NOT NULL REFERENCES payment_ledger_entries(id),
    participant_account_id uuid NOT NULL,
    participant_type varchar(50) NOT NULL, -- 'payer', 'payee', 'intermediary', 'fee_collector'
    amount decimal(20,8) NOT NULL,
    currency_code varchar(3) NOT NULL,
    role_metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT transaction_participants_unique_role UNIQUE (transaction_id, participant_account_id, participant_type)
);

-- Settlement batches for reconciliation
CREATE TABLE IF NOT EXISTS settlement_batches (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number varchar(100) NOT NULL,
    status settlement_status NOT NULL DEFAULT 'pending',
    tenant_id uuid NOT NULL,
    
    -- Batch details
    settlement_date date NOT NULL,
    cut_off_time timestamptz NOT NULL,
    total_entries integer NOT NULL DEFAULT 0,
    total_amount decimal(20,8) NOT NULL DEFAULT 0,
    net_amount decimal(20,8) NOT NULL DEFAULT 0,
    
    -- Processing timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    processing_started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    
    -- Reconciliation data
    reconciliation_hash text,
    external_batch_id varchar(255),
    metadata jsonb DEFAULT '{}',
    
    CONSTRAINT settlement_batches_batch_number_unique UNIQUE (batch_number, tenant_id)
);

-- Ledger snapshots for state checkpoints
CREATE TABLE IF NOT EXISTS ledger_snapshots (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_number bigint NOT NULL,
    tenant_id uuid NOT NULL,
    
    -- Snapshot data
    block_number bigint NOT NULL,
    total_entries bigint NOT NULL,
    total_debits decimal(20,8) NOT NULL DEFAULT 0,
    total_credits decimal(20,8) NOT NULL DEFAULT 0,
    account_balances jsonb NOT NULL DEFAULT '{}',
    
    -- Verification
    state_hash text NOT NULL,
    merkle_root text NOT NULL,
    signature text NOT NULL,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    validated_at timestamptz,
    
    -- Metadata
    metadata jsonb DEFAULT '{}',
    
    CONSTRAINT ledger_snapshots_number_tenant_unique UNIQUE (snapshot_number, tenant_id)
);

-- Comprehensive audit log with cryptographic signatures
CREATE TABLE IF NOT EXISTS audit_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type varchar(100) NOT NULL,
    entity_type varchar(100) NOT NULL,
    entity_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    
    -- Event details
    action varchar(100) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    changes jsonb,
    
    -- User context
    user_id uuid,
    session_id varchar(255),
    ip_address inet,
    user_agent text,
    
    -- Cryptographic verification
    event_hash text NOT NULL,
    signature text NOT NULL,
    timestamp_signature text NOT NULL,
    
    -- Metadata
    correlation_id uuid,
    metadata jsonb DEFAULT '{}',
    
    -- Immutable timestamp
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT audit_log_event_hash_unique UNIQUE (event_hash)
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_ledger_blocks_tenant_number ON ledger_blocks (tenant_id, block_number);
CREATE INDEX IF NOT EXISTS idx_ledger_blocks_status ON ledger_blocks (status) WHERE status != 'finalized';
CREATE INDEX IF NOT EXISTS idx_ledger_blocks_created_at ON ledger_blocks (created_at);

CREATE INDEX IF NOT EXISTS idx_payment_ledger_entries_tenant ON payment_ledger_entries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_entries_transaction ON payment_ledger_entries (transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_entries_accounts ON payment_ledger_entries (from_account_id, to_account_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_entries_status ON payment_ledger_entries (status) WHERE status != 'settled';
CREATE INDEX IF NOT EXISTS idx_payment_ledger_entries_created_at ON payment_ledger_entries (created_at);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_entries_reference ON payment_ledger_entries (reference_id) WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_participants_transaction ON transaction_participants (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_participants_account ON transaction_participants (participant_account_id);

CREATE INDEX IF NOT EXISTS idx_settlement_batches_tenant_status ON settlement_batches (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_date ON settlement_batches (settlement_date);

CREATE INDEX IF NOT EXISTS idx_ledger_snapshots_tenant_number ON ledger_snapshots (tenant_id, snapshot_number);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_entity ON audit_log (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON audit_log (correlation_id) WHERE correlation_id IS NOT NULL;

-- Cryptographic hash verification functions
CREATE OR REPLACE FUNCTION calculate_entry_hash(
    p_entry_number bigint,
    p_transaction_id uuid,
    p_previous_hash text,
    p_amount decimal,
    p_from_account uuid,
    p_to_account uuid,
    p_timestamp timestamptz,
    p_nonce bigint
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN encode(
        digest(
            p_entry_number::text || 
            p_transaction_id::text || 
            COALESCE(p_previous_hash, '') ||
            p_amount::text ||
            COALESCE(p_from_account::text, '') ||
            COALESCE(p_to_account::text, '') ||
            extract(epoch from p_timestamp)::text ||
            p_nonce::text,
            'sha256'
        ),
        'hex'
    );
END;
$$;

CREATE OR REPLACE FUNCTION calculate_block_hash(
    p_block_number bigint,
    p_previous_block_hash text,
    p_merkle_root text,
    p_transaction_count integer,
    p_total_amount decimal,
    p_timestamp timestamptz
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN encode(
        digest(
            p_block_number::text ||
            COALESCE(p_previous_block_hash, '') ||
            p_merkle_root ||
            p_transaction_count::text ||
            p_total_amount::text ||
            extract(epoch from p_timestamp)::text,
            'sha256'
        ),
        'hex'
    );
END;
$$;

-- Merkle tree verification function
CREATE OR REPLACE FUNCTION calculate_merkle_root(p_block_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    entry_hashes text[];
    current_level text[];
    next_level text[];
    i integer;
BEGIN
    -- Get all entry hashes in order
    SELECT array_agg(entry_hash ORDER BY entry_number)
    INTO entry_hashes
    FROM payment_ledger_entries
    WHERE block_id = p_block_id;
    
    IF array_length(entry_hashes, 1) IS NULL THEN
        RETURN '';
    END IF;
    
    current_level := entry_hashes;
    
    -- Build Merkle tree bottom-up
    WHILE array_length(current_level, 1) > 1 LOOP
        next_level := ARRAY[]::text[];
        
        FOR i IN 1..array_length(current_level, 1) BY 2 LOOP
            IF i = array_length(current_level, 1) THEN
                -- Odd number, duplicate last hash
                next_level := next_level || encode(
                    digest(current_level[i] || current_level[i], 'sha256'),
                    'hex'
                );
            ELSE
                next_level := next_level || encode(
                    digest(current_level[i] || current_level[i+1], 'sha256'),
                    'hex'
                );
            END IF;
        END LOOP;
        
        current_level := next_level;
    END LOOP;
    
    RETURN current_level[1];
END;
$$;

-- Immutability enforcement trigger
CREATE OR REPLACE FUNCTION enforce_ledger_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Allow only status updates and confirmation timestamps
        IF OLD.entry_hash != NEW.entry_hash OR 
           OLD.amount != NEW.amount OR
           OLD.from_account_id != NEW.from_account_id OR
           OLD.to_account_id != NEW.to_account_id OR
           OLD.transaction_id != NEW.transaction_id OR
           OLD.created_at != NEW.created_at THEN
            RAISE EXCEPTION 'Ledger entries are immutable once created';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Ledger entries cannot be deleted';
    END IF;
    
    RETURN NULL;
END;
$$;

-- Hash chain validation trigger
CREATE OR REPLACE FUNCTION validate_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    calculated_hash text;
    previous_hash text;
BEGIN
    -- Get previous entry hash in the block
    IF NEW.entry_number > 1 THEN
        SELECT entry_hash INTO previous_hash
        FROM payment_ledger_entries
        WHERE block_id = NEW.block_id
        AND entry_number = NEW.entry_number - 1;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Previous entry not found for hash chain validation';
        END IF;
    END IF;
    
    -- Calculate and validate entry hash
    calculated_hash := calculate_entry_hash(
        NEW.entry_number,
        NEW.transaction_id,
        previous_hash,
        NEW.amount,
        NEW.from_account_id,
        NEW.to_account_id,
        NEW.created_at,
        NEW.nonce
    );
    
    IF NEW.entry_hash != calculated_hash THEN
        RAISE EXCEPTION 'Invalid entry hash. Expected: %, Got: %', calculated_hash, NEW.entry_hash;
    END IF;
    
    NEW.previous_entry_hash := previous_hash;
    
    RETURN NEW;
END;
$$;

-- Audit log trigger
CREATE OR REPLACE FUNCTION create_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    event_hash text;
    entity_type_name text;
BEGIN
    -- Determine entity type
    entity_type_name := TG_TABLE_NAME;
    
    -- Calculate event hash
    event_hash := encode(
        digest(
            TG_OP || entity_type_name || 
            COALESCE(NEW.id::text, OLD.id::text) ||
            extract(epoch from now())::text ||
            gen_random_uuid()::text,
            'sha256'
        ),
        'hex'
    );
    
    -- Insert audit record
    INSERT INTO audit_log (
        event_type,
        entity_type,
        entity_id,
        tenant_id,
        action,
        old_values,
        new_values,
        event_hash,
        signature,
        timestamp_signature
    ) VALUES (
        TG_TABLE_NAME || '_' || lower(TG_OP),
        entity_type_name,
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        event_hash,
        encode(digest(event_hash || 'signature_key', 'sha256'), 'hex'),
        encode(digest(event_hash || extract(epoch from now())::text, 'sha256'), 'hex')
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trig_ledger_immutability ON payment_ledger_entries;
CREATE TRIGGER trig_ledger_immutability
    BEFORE UPDATE OR DELETE ON payment_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION enforce_ledger_immutability();

DROP TRIGGER IF EXISTS trig_validate_hash_chain ON payment_ledger_entries;
CREATE TRIGGER trig_validate_hash_chain
    BEFORE INSERT ON payment_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION validate_hash_chain();

DROP TRIGGER IF EXISTS trig_audit_ledger_entries ON payment_ledger_entries;
CREATE TRIGGER trig_audit_ledger_entries
    AFTER INSERT OR UPDATE OR DELETE ON payment_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION create_audit_entry();

DROP TRIGGER IF EXISTS trig_audit_ledger_blocks ON ledger_blocks;
CREATE TRIGGER trig_audit_ledger_blocks
    AFTER INSERT OR UPDATE OR DELETE ON ledger_blocks
    FOR EACH ROW EXECUTE FUNCTION create_audit_entry();

DROP TRIGGER IF EXISTS trig_audit_settlement_batches ON settlement_batches;
CREATE TRIGGER trig_audit_settlement_batches
    AFTER INSERT OR UPDATE OR DELETE ON settlement_batches
    FOR EACH ROW EXECUTE FUNCTION create_audit_entry();

-- Enable Row Level Security
ALTER TABLE ledger_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant isolation
CREATE POLICY tenant_isolation_ledger_blocks ON ledger_blocks
    USING (tenant_id = auth.jwt() ->> 'tenant_id'::text);

CREATE POLICY tenant_isolation_payment_ledger_entries ON payment_ledger_entries
    USING (tenant_id = auth.jwt() ->> 'tenant_id'::text);

CREATE POLICY tenant_isolation_settlement_batches ON settlement_batches
    USING (tenant_id = auth.jwt() ->> 'tenant_id'::text);

CREATE POLICY tenant_isolation_ledger_snapshots ON ledger_snapshots
    USING (tenant_id = auth.jwt() ->> 'tenant_id'::text);

CREATE POLICY tenant_isolation_audit_log ON audit_log
    USING (tenant_id = auth.jwt() ->> 'tenant_id'::text);

-- Transaction participants inherit tenant isolation from ledger entries
CREATE POLICY tenant_isolation_transaction_participants ON transaction_participants
    USING (EXISTS (
        SELECT 1 FROM payment_ledger_entries 
        WHERE id = ledger_entry_id 
        AND tenant_id = auth.jwt() ->> 'tenant_id'::text
    ));

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON ledger_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON payment_ledger_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON transaction_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON settlement_batches TO authenticated;
GRANT SELECT, INSERT ON ledger_snapshots TO authenticated;
GRANT SELECT ON audit_log TO authenticated;

-- Grant sequence access
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```