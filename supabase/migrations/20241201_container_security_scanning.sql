```sql
-- Container Security Scanning Microservice Migration
-- Generated: 2024-12-01
-- Description: Database schema for automated container security scanning with vulnerability tracking and remediation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ENUM types
DO $$ BEGIN
    CREATE TYPE scan_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE severity_level AS ENUM ('critical', 'high', 'medium', 'low', 'info');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE remediation_status AS ENUM ('pending', 'in_progress', 'completed', 'ignored', 'not_applicable');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE policy_action AS ENUM ('allow', 'warn', 'block', 'quarantine');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Vulnerability databases table
CREATE TABLE IF NOT EXISTS vulnerability_databases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    source_url TEXT,
    update_frequency_hours INTEGER DEFAULT 24,
    last_updated TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID NOT NULL
);

-- Container images table
CREATE TABLE IF NOT EXISTS container_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry VARCHAR(255) NOT NULL,
    repository VARCHAR(255) NOT NULL,
    tag VARCHAR(100) NOT NULL,
    digest VARCHAR(100),
    size_bytes BIGINT,
    pushed_at TIMESTAMPTZ,
    labels JSONB DEFAULT '{}',
    manifest JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID NOT NULL,
    UNIQUE(registry, repository, tag, tenant_id)
);

-- Security policies table
CREATE TABLE IF NOT EXISTS security_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    severity_thresholds JSONB DEFAULT '{"critical": 0, "high": 5, "medium": 10, "low": -1}',
    allowed_vulnerabilities TEXT[],
    blocked_vulnerabilities TEXT[],
    default_action policy_action DEFAULT 'warn',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID NOT NULL,
    UNIQUE(name, tenant_id)
);

-- Scan configurations table
CREATE TABLE IF NOT EXISTS scan_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    vulnerability_db_ids UUID[],
    scan_layers BOOLEAN DEFAULT true,
    scan_secrets BOOLEAN DEFAULT true,
    scan_licenses BOOLEAN DEFAULT false,
    scan_malware BOOLEAN DEFAULT false,
    timeout_minutes INTEGER DEFAULT 30,
    policy_id UUID REFERENCES security_policies(id) ON DELETE SET NULL,
    configuration JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID NOT NULL,
    UNIQUE(name, tenant_id)
);

-- Security scans table
CREATE TABLE IF NOT EXISTS security_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL REFERENCES container_images(id) ON DELETE CASCADE,
    config_id UUID REFERENCES scan_configurations(id) ON DELETE SET NULL,
    status scan_status DEFAULT 'pending',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    total_vulnerabilities INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    info_count INTEGER DEFAULT 0,
    scanner_version VARCHAR(50),
    scan_metadata JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID NOT NULL
);

-- Vulnerabilities table
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cve_id VARCHAR(20),
    vulnerability_db_id UUID REFERENCES vulnerability_databases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    severity severity_level NOT NULL,
    cvss_score DECIMAL(3,1),
    cvss_vector TEXT,
    published_date TIMESTAMPTZ,
    modified_date TIMESTAMPTZ,
    affected_packages JSONB DEFAULT '[]',
    fixed_versions JSONB DEFAULT '[]',
    references JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID NOT NULL,
    UNIQUE(cve_id, vulnerability_db_id)
);

-- Scan results table
CREATE TABLE IF NOT EXISTS scan_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES security_scans(id) ON DELETE CASCADE,
    vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    package_name VARCHAR(255),
    package_version VARCHAR(100),
    installed_version VARCHAR(100),
    fixed_version VARCHAR(100),
    layer_digest VARCHAR(100),
    file_path TEXT,
    severity severity_level NOT NULL,
    exploitable BOOLEAN DEFAULT false,
    remediation_available BOOLEAN DEFAULT false,
    result_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID NOT NULL
);

-- Remediation recommendations table
CREATE TABLE IF NOT EXISTS remediation_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    scan_result_id UUID REFERENCES scan_results(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0,
    effort_level VARCHAR(20) DEFAULT 'medium',
    automated BOOLEAN DEFAULT false,
    command_suggestions TEXT[],
    dockerfile_changes TEXT[],
    status remediation_status DEFAULT 'pending',
    applied_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID NOT NULL
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_vulnerability_databases_tenant_active ON vulnerability_databases(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vulnerability_databases_last_updated ON vulnerability_databases(last_updated);

CREATE INDEX IF NOT EXISTS idx_container_images_tenant_registry ON container_images(tenant_id, registry, repository);
CREATE INDEX IF NOT EXISTS idx_container_images_digest ON container_images(digest);
CREATE INDEX IF NOT EXISTS idx_container_images_pushed_at ON container_images(pushed_at);

CREATE INDEX IF NOT EXISTS idx_security_policies_tenant_active ON security_policies(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_scan_configurations_tenant_default ON scan_configurations(tenant_id, is_default);
CREATE INDEX IF NOT EXISTS idx_scan_configurations_policy ON scan_configurations(policy_id);

CREATE INDEX IF NOT EXISTS idx_security_scans_image_date ON security_scans(image_id, started_at);
CREATE INDEX IF NOT EXISTS idx_security_scans_tenant_status ON security_scans(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_security_scans_completed_at ON security_scans(completed_at);

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_cve_severity ON vulnerabilities(cve_id, severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_tenant_severity ON vulnerabilities(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_published_date ON vulnerabilities(published_date);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_db_id ON vulnerabilities(vulnerability_db_id);

CREATE INDEX IF NOT EXISTS idx_scan_results_scan_severity ON scan_results(scan_id, severity);
CREATE INDEX IF NOT EXISTS idx_scan_results_vulnerability ON scan_results(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_package ON scan_results(package_name, package_version);
CREATE INDEX IF NOT EXISTS idx_scan_results_exploitable ON scan_results(exploitable) WHERE exploitable = true;

CREATE INDEX IF NOT EXISTS idx_remediation_recommendations_vulnerability ON remediation_recommendations(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_remediation_recommendations_scan_result ON remediation_recommendations(scan_result_id);
CREATE INDEX IF NOT EXISTS idx_remediation_recommendations_status ON remediation_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_remediation_recommendations_tenant_status ON remediation_recommendations(tenant_id, status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_vulnerability_databases_updated_at BEFORE UPDATE ON vulnerability_databases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_container_images_updated_at BEFORE UPDATE ON container_images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_security_policies_updated_at BEFORE UPDATE ON security_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scan_configurations_updated_at BEFORE UPDATE ON scan_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_security_scans_updated_at BEFORE UPDATE ON security_scans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vulnerabilities_updated_at BEFORE UPDATE ON vulnerabilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_remediation_recommendations_updated_at BEFORE UPDATE ON remediation_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE vulnerability_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_recommendations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY vulnerability_databases_tenant_policy ON vulnerability_databases
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY container_images_tenant_policy ON container_images
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY security_policies_tenant_policy ON security_policies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY scan_configurations_tenant_policy ON scan_configurations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY security_scans_tenant_policy ON security_scans
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY vulnerabilities_tenant_policy ON vulnerabilities
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY scan_results_tenant_policy ON scan_results
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY remediation_recommendations_tenant_policy ON remediation_recommendations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Create audit trigger function for scan status changes
CREATE OR REPLACE FUNCTION audit_scan_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO scan_results (scan_id, vulnerability_id, severity, result_metadata, tenant_id)
        VALUES (NEW.id, NULL, 'info'::severity_level, 
                jsonb_build_object(
                    'event_type', 'status_change',
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'timestamp', now()
                ), NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_security_scans_status_change
    AFTER UPDATE ON security_scans
    FOR EACH ROW
    EXECUTE FUNCTION audit_scan_status_change();

-- Create function to calculate scan completion metrics
CREATE OR REPLACE FUNCTION update_scan_metrics()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at));
        
        -- Update vulnerability counts
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE severity = 'critical') as critical,
            COUNT(*) FILTER (WHERE severity = 'high') as high,
            COUNT(*) FILTER (WHERE severity = 'medium') as medium,
            COUNT(*) FILTER (WHERE severity = 'low') as low,
            COUNT(*) FILTER (WHERE severity = 'info') as info
        INTO 
            NEW.total_vulnerabilities,
            NEW.critical_count,
            NEW.high_count,
            NEW.medium_count,
            NEW.low_count,
            NEW.info_count
        FROM scan_results
        WHERE scan_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_security_scans_metrics
    BEFORE UPDATE ON security_scans
    FOR EACH ROW
    EXECUTE FUNCTION update_scan_metrics();

-- Create view for scan summary with latest results
CREATE OR REPLACE VIEW scan_summary AS
SELECT 
    si.id as image_id,
    si.registry,
    si.repository,
    si.tag,
    ss.id as latest_scan_id,
    ss.status as scan_status,
    ss.started_at as last_scan_date,
    ss.total_vulnerabilities,
    ss.critical_count,
    ss.high_count,
    ss.medium_count,
    ss.low_count,
    ss.info_count,
    CASE 
        WHEN ss.critical_count > 0 THEN 'critical'
        WHEN ss.high_count > 0 THEN 'high'
        WHEN ss.medium_count > 0 THEN 'medium'
        WHEN ss.low_count > 0 THEN 'low'
        ELSE 'clean'
    END as risk_level,
    si.tenant_id
FROM container_images si
LEFT JOIN LATERAL (
    SELECT *
    FROM security_scans
    WHERE image_id = si.id
    ORDER BY started_at DESC
    LIMIT 1
) ss ON true;

-- Grant appropriate permissions (adjust based on your role structure)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT SELECT ON scan_summary TO authenticated;
```