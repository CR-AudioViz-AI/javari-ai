```sql
-- Post-Quantum Cryptography Module Migration
-- Implements quantum-resistant encryption infrastructure with algorithm agility

-- Create enum types for supported PQC algorithms
CREATE TYPE pqc_algorithm AS ENUM (
    'kyber512', 'kyber768', 'kyber1024',
    'dilithium2', 'dilithium3', 'dilithium5',
    'sphincs_sha256_128s', 'sphincs_sha256_192s', 'sphincs_sha256_256s',
    'sphincs_shake256_128s', 'sphincs_shake256_192s', 'sphincs_shake256_256s'
);

CREATE TYPE key_type AS ENUM ('public', 'private', 'symmetric');
CREATE TYPE migration_phase AS ENUM ('pre_quantum', 'hybrid', 'post_quantum');
CREATE TYPE operation_type AS ENUM ('keygen', 'encrypt', 'decrypt', 'sign', 'verify', 'derive');

-- Cryptographic algorithms registry and versioning
CREATE TABLE IF NOT EXISTS crypto_algorithms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    algorithm pqc_algorithm NOT NULL,
    version VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    security_level INTEGER NOT NULL CHECK (security_level IN (1, 3, 5)),
    key_size INTEGER NOT NULL,
    signature_size INTEGER,
    public_key_size INTEGER,
    private_key_size INTEGER,
    implementation_details JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    compliance_standards TEXT[],
    deprecated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(algorithm, version)
);

-- Quantum-resistant key storage
CREATE TABLE IF NOT EXISTS quantum_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    algorithm_id UUID REFERENCES crypto_algorithms(id) ON DELETE RESTRICT,
    key_type key_type NOT NULL,
    key_data BYTEA NOT NULL,
    key_metadata JSONB DEFAULT '{}',
    key_derivation_info JSONB DEFAULT '{}',
    parent_key_id UUID REFERENCES quantum_keys(id) ON DELETE SET NULL,
    purpose TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    max_usage_count INTEGER,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_expiry CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT valid_usage CHECK (max_usage_count IS NULL OR usage_count <= max_usage_count)
);

-- Algorithm-specific key derivation parameters
CREATE TABLE IF NOT EXISTS key_derivation_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    algorithm pqc_algorithm NOT NULL,
    param_name VARCHAR(100) NOT NULL,
    param_value JSONB NOT NULL,
    param_type VARCHAR(50) NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    default_value JSONB,
    validation_rules JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(algorithm, param_name)
);

-- Migration status tracking for cryptographic transitions
CREATE TABLE IF NOT EXISTS migration_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL, -- 'user', 'session', 'data', etc.
    entity_id VARCHAR(255) NOT NULL,
    current_phase migration_phase NOT NULL DEFAULT 'pre_quantum',
    target_phase migration_phase NOT NULL DEFAULT 'post_quantum',
    old_algorithm VARCHAR(100),
    new_algorithm pqc_algorithm,
    migration_progress JSONB DEFAULT '{"completed_steps": [], "total_steps": 0, "current_step": 0}',
    rollback_data JSONB DEFAULT '{}',
    error_log JSONB DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    last_checkpoint_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(user_id, entity_type, entity_id),
    CONSTRAINT valid_phase_transition CHECK (
        (current_phase = 'pre_quantum' AND target_phase IN ('hybrid', 'post_quantum')) OR
        (current_phase = 'hybrid' AND target_phase = 'post_quantum') OR
        (current_phase = target_phase)
    )
);

-- Audit log for cryptographic operations
CREATE TABLE IF NOT EXISTS crypto_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT,
    operation_type operation_type NOT NULL,
    algorithm pqc_algorithm,
    key_id UUID REFERENCES quantum_keys(id) ON DELETE SET NULL,
    operation_data JSONB DEFAULT '{}',
    result_status VARCHAR(50) NOT NULL DEFAULT 'success',
    error_message TEXT,
    performance_metrics JSONB DEFAULT '{}',
    client_ip INET,
    user_agent TEXT,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (result_status IN ('success', 'failure', 'partial'))
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_crypto_algorithms_active ON crypto_algorithms(algorithm, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_crypto_algorithms_security_level ON crypto_algorithms(security_level, is_active);

CREATE INDEX IF NOT EXISTS idx_quantum_keys_user_id ON quantum_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_quantum_keys_algorithm_id ON quantum_keys(algorithm_id);
CREATE INDEX IF NOT EXISTS idx_quantum_keys_active ON quantum_keys(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_quantum_keys_purpose ON quantum_keys(purpose);
CREATE INDEX IF NOT EXISTS idx_quantum_keys_expires ON quantum_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quantum_keys_parent ON quantum_keys(parent_key_id) WHERE parent_key_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_key_derivation_params_algorithm ON key_derivation_params(algorithm);
CREATE INDEX IF NOT EXISTS idx_key_derivation_params_required ON key_derivation_params(algorithm, is_required) WHERE is_required = true;

CREATE INDEX IF NOT EXISTS idx_migration_status_user ON migration_status(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_migration_status_entity ON migration_status(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_migration_status_phase ON migration_status(current_phase, target_phase);
CREATE INDEX IF NOT EXISTS idx_migration_status_active ON migration_status(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_crypto_audit_log_user ON crypto_audit_log(user_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_crypto_audit_log_operation ON crypto_audit_log(operation_type, performed_at);
CREATE INDEX IF NOT EXISTS idx_crypto_audit_log_key ON crypto_audit_log(key_id) WHERE key_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crypto_audit_log_status ON crypto_audit_log(result_status, performed_at);

-- Enable RLS on all tables
ALTER TABLE crypto_algorithms ENABLE ROW LEVEL SECURITY;
ALTER TABLE quantum_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_derivation_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for crypto_algorithms (read-only for authenticated users)
CREATE POLICY "crypto_algorithms_read_policy" ON crypto_algorithms
    FOR SELECT TO authenticated
    USING (true);

-- RLS policies for quantum_keys (user can only access their own keys)
CREATE POLICY "quantum_keys_select_policy" ON quantum_keys
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "quantum_keys_insert_policy" ON quantum_keys
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quantum_keys_update_policy" ON quantum_keys
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quantum_keys_delete_policy" ON quantum_keys
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- RLS policies for key_derivation_params (read-only for authenticated users)
CREATE POLICY "key_derivation_params_read_policy" ON key_derivation_params
    FOR SELECT TO authenticated
    USING (true);

-- RLS policies for migration_status (user can only access their own migration status)
CREATE POLICY "migration_status_select_policy" ON migration_status
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "migration_status_insert_policy" ON migration_status
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "migration_status_update_policy" ON migration_status
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS policies for crypto_audit_log (user can only access their own audit logs)
CREATE POLICY "crypto_audit_log_select_policy" ON crypto_audit_log
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "crypto_audit_log_insert_policy" ON crypto_audit_log
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_crypto_algorithms_updated_at
    BEFORE UPDATE ON crypto_algorithms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quantum_keys_updated_at
    BEFORE UPDATE ON quantum_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to increment key usage count
CREATE OR REPLACE FUNCTION increment_key_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment for actual operations (not metadata updates)
    IF TG_OP = 'INSERT' AND NEW.operation_type IN ('encrypt', 'decrypt', 'sign', 'verify') THEN
        UPDATE quantum_keys 
        SET usage_count = usage_count + 1,
            last_used_at = NOW()
        WHERE id = NEW.key_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to track key usage
CREATE TRIGGER track_key_usage
    AFTER INSERT ON crypto_audit_log
    FOR EACH ROW
    WHEN (NEW.key_id IS NOT NULL)
    EXECUTE FUNCTION increment_key_usage();

-- Insert default supported algorithms
INSERT INTO crypto_algorithms (algorithm, version, security_level, key_size, signature_size, public_key_size, private_key_size, implementation_details, compliance_standards) VALUES
('kyber512', '1.0', 1, 1632, NULL, 800, 1632, '{"type": "KEM", "variant": "Kyber-512"}', ARRAY['NIST']),
('kyber768', '1.0', 3, 2400, NULL, 1184, 2400, '{"type": "KEM", "variant": "Kyber-768"}', ARRAY['NIST']),
('kyber1024', '1.0', 5, 3168, NULL, 1568, 3168, '{"type": "KEM", "variant": "Kyber-1024"}', ARRAY['NIST']),
('dilithium2', '1.0', 1, 2544, 2420, 1312, 2544, '{"type": "DSA", "variant": "Dilithium2"}', ARRAY['NIST']),
('dilithium3', '1.0', 3, 4016, 3293, 1952, 4016, '{"type": "DSA", "variant": "Dilithium3"}', ARRAY['NIST']),
('dilithium5', '1.0', 5, 4880, 4595, 2592, 4880, '{"type": "DSA", "variant": "Dilithium5"}', ARRAY['NIST']),
('sphincs_sha256_128s', '1.0', 1, 64, 7856, 32, 64, '{"type": "DSA", "variant": "SPHINCS+-SHA256-128s-simple"}', ARRAY['NIST']),
('sphincs_sha256_192s', '1.0', 3, 96, 16224, 48, 96, '{"type": "DSA", "variant": "SPHINCS+-SHA256-192s-simple"}', ARRAY['NIST']),
('sphincs_sha256_256s', '1.0', 5, 128, 29792, 64, 128, '{"type": "DSA", "variant": "SPHINCS+-SHA256-256s-simple"}', ARRAY['NIST'])
ON CONFLICT (algorithm, version) DO NOTHING;

-- Insert common key derivation parameters
INSERT INTO key_derivation_params (algorithm, param_name, param_value, param_type, description, is_required) VALUES
('kyber512', 'seed_length', '32', 'integer', 'Seed length in bytes for key generation', true),
('kyber768', 'seed_length', '32', 'integer', 'Seed length in bytes for key generation', true),
('kyber1024', 'seed_length', '32', 'integer', 'Seed length in bytes for key generation', true),
('dilithium2', 'seed_length', '32', 'integer', 'Seed length in bytes for key generation', true),
('dilithium3', 'seed_length', '32', 'integer', 'Seed length in bytes for key generation', true),
('dilithium5', 'seed_length', '32', 'integer', 'Seed length in bytes for key generation', true),
('sphincs_sha256_128s', 'seed_length', '48', 'integer', 'Seed length in bytes for key generation', true),
('sphincs_sha256_192s', 'seed_length', '72', 'integer', 'Seed length in bytes for key generation', true),
('sphincs_sha256_256s', 'seed_length', '96', 'integer', 'Seed length in bytes for key generation', true)
ON CONFLICT (algorithm, param_name) DO NOTHING;
```