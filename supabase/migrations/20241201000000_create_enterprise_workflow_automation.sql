```sql
-- Enterprise Workflow Automation Service Migration
-- Created: 2024-12-01
-- Description: Complete database schema for enterprise workflow automation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types for workflow management
CREATE TYPE workflow_status AS ENUM ('draft', 'active', 'inactive', 'archived');
CREATE TYPE instance_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled', 'suspended');
CREATE TYPE step_status AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'delegated', 'expired');
CREATE TYPE document_status AS ENUM ('pending', 'routed', 'processed', 'archived', 'error');
CREATE TYPE compliance_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE integration_type AS ENUM ('rest_api', 'database', 'file_system', 'email', 'ldap', 'saml');
CREATE TYPE notification_type AS ENUM ('email', 'sms', 'push', 'webhook', 'internal');

-- Workflow Definitions Table
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    schema_definition JSONB NOT NULL,
    status workflow_status DEFAULT 'draft',
    category VARCHAR(100),
    tags TEXT[],
    created_by UUID NOT NULL,
    organization_id UUID NOT NULL,
    is_template BOOLEAN DEFAULT false,
    template_variables JSONB DEFAULT '{}',
    max_execution_time INTERVAL DEFAULT '24 hours',
    retry_policy JSONB DEFAULT '{"max_attempts": 3, "backoff_strategy": "exponential"}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT workflow_definitions_schema_check CHECK (
        jsonb_typeof(schema_definition) = 'object' AND
        schema_definition ? 'steps' AND
        jsonb_typeof(schema_definition->'steps') = 'array'
    ),
    CONSTRAINT workflow_definitions_template_vars_check CHECK (
        jsonb_typeof(template_variables) = 'object'
    )
);

-- Workflow Instances Table
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,
    name VARCHAR(255),
    status instance_status DEFAULT 'pending',
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    context_data JSONB DEFAULT '{}',
    error_details JSONB,
    started_by UUID NOT NULL,
    organization_id UUID NOT NULL,
    parent_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL,
    scheduled_start TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    progress_percentage DECIMAL(5,2) DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    current_step_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Steps Table
CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_definition_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    step_type VARCHAR(100) NOT NULL,
    sequence_number INTEGER NOT NULL,
    status step_status DEFAULT 'pending',
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    configuration JSONB DEFAULT '{}',
    assigned_to UUID,
    assigned_group VARCHAR(255),
    prerequisites UUID[],
    dependencies JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    execution_log JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workflow_instance_id, sequence_number)
);

-- Approval Chains Table
CREATE TABLE IF NOT EXISTS approval_chains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
    chain_name VARCHAR(255) NOT NULL,
    sequence_number INTEGER NOT NULL,
    approver_id UUID,
    approver_role VARCHAR(255),
    approver_group VARCHAR(255),
    delegation_allowed BOOLEAN DEFAULT true,
    status approval_status DEFAULT 'pending',
    decision_data JSONB DEFAULT '{}',
    comments TEXT,
    decision_made_at TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    escalation_rule JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT approval_chains_approver_check CHECK (
        (approver_id IS NOT NULL) OR 
        (approver_role IS NOT NULL) OR 
        (approver_group IS NOT NULL)
    ),
    UNIQUE(workflow_step_id, sequence_number)
);

-- Document Routes Table
CREATE TABLE IF NOT EXISTS document_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    document_id VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    source_location VARCHAR(500),
    destination_location VARCHAR(500),
    routing_rules JSONB DEFAULT '{}',
    transformation_rules JSONB DEFAULT '{}',
    status document_status DEFAULT 'pending',
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    file_size BIGINT,
    checksum VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    routed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Rules Table
CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(100) NOT NULL,
    severity compliance_severity DEFAULT 'medium',
    rule_definition JSONB NOT NULL,
    applicable_workflows UUID[],
    applicable_steps TEXT[],
    is_active BOOLEAN DEFAULT true,
    organization_id UUID NOT NULL,
    regulatory_framework VARCHAR(255),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT compliance_rules_definition_check CHECK (
        jsonb_typeof(rule_definition) = 'object' AND
        rule_definition ? 'condition'
    )
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL,
    user_id UUID,
    organization_id UUID NOT NULL,
    event_data JSONB DEFAULT '{}',
    before_data JSONB,
    after_data JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    correlation_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration Configs Table
CREATE TABLE IF NOT EXISTS integration_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    integration_type integration_type NOT NULL,
    endpoint_url VARCHAR(500),
    configuration JSONB DEFAULT '{}',
    credentials JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    organization_id UUID NOT NULL,
    created_by UUID NOT NULL,
    test_connection_status VARCHAR(50),
    last_tested_at TIMESTAMPTZ,
    rate_limit JSONB DEFAULT '{}',
    timeout_seconds INTEGER DEFAULT 30,
    retry_policy JSONB DEFAULT '{"max_attempts": 3}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Templates Table
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    notification_type notification_type NOT NULL,
    trigger_event VARCHAR(100) NOT NULL,
    subject_template TEXT,
    body_template TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    conditions JSONB DEFAULT '{}',
    recipients_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    organization_id UUID NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT notification_templates_variables_check CHECK (
        jsonb_typeof(variables) = 'object'
    ),
    CONSTRAINT notification_templates_recipients_check CHECK (
        jsonb_typeof(recipients_config) = 'object'
    )
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_organization ON workflow_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_status ON workflow_definitions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_category ON workflow_definitions(category);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_by ON workflow_definitions(created_by);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_definition ON workflow_instances(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_organization ON workflow_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_started_by ON workflow_instances(started_by);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_parent ON workflow_instances(parent_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_scheduled ON workflow_instances(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_deadline ON workflow_instances(deadline);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_instance ON workflow_steps(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_assigned_to ON workflow_steps(assigned_to);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_sequence ON workflow_steps(workflow_instance_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_deadline ON workflow_steps(deadline);

CREATE INDEX IF NOT EXISTS idx_approval_chains_step ON approval_chains(workflow_step_id);
CREATE INDEX IF NOT EXISTS idx_approval_chains_approver ON approval_chains(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_chains_status ON approval_chains(status);
CREATE INDEX IF NOT EXISTS idx_approval_chains_deadline ON approval_chains(deadline);

CREATE INDEX IF NOT EXISTS idx_document_routes_instance ON document_routes(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_document_routes_status ON document_routes(status);
CREATE INDEX IF NOT EXISTS idx_document_routes_type ON document_routes(document_type);

CREATE INDEX IF NOT EXISTS idx_compliance_rules_organization ON compliance_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_active ON compliance_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_framework ON compliance_rules(regulatory_framework);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workflow ON audit_logs(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_integration_configs_organization ON integration_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_type ON integration_configs(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_configs_active ON integration_configs(is_active);

CREATE INDEX IF NOT EXISTS idx_notification_templates_organization ON notification_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_trigger ON notification_templates(trigger_event);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active);

-- Create functions for workflow automation
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_workflow_definitions_updated_at BEFORE UPDATE ON workflow_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_instances_updated_at BEFORE UPDATE ON workflow_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_steps_updated_at BEFORE UPDATE ON workflow_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_chains_updated_at BEFORE UPDATE ON approval_chains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_routes_updated_at BEFORE UPDATE ON document_routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_rules_updated_at BEFORE UPDATE ON compliance_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_configs_updated_at BEFORE UPDATE ON integration_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to validate compliance rules
CREATE OR REPLACE FUNCTION validate_compliance_rules(
    p_workflow_instance_id UUID,
    p_step_id UUID DEFAULT NULL
)
RETURNS TABLE(rule_id UUID, rule_name TEXT, severity compliance_severity, violations JSONB) AS $$
BEGIN
    RETURN QUERY
    WITH applicable_rules AS (
        SELECT cr.*
        FROM compliance_rules cr
        JOIN workflow_instances wi ON wi.id = p_workflow_instance_id
        WHERE cr.is_active = true
        AND cr.organization_id = wi.organization_id
        AND (
            cr.applicable_workflows IS NULL OR 
            wi.workflow_definition_id = ANY(cr.applicable_workflows)
        )
    )
    SELECT 
        ar.id,
        ar.name,
        ar.severity,
        ar.rule_definition
    FROM applicable_rules ar;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-progress workflow steps
CREATE OR REPLACE FUNCTION auto_progress_workflow()
RETURNS void AS $$
DECLARE
    step_record RECORD;
BEGIN
    -- Find completed steps that have pending next steps
    FOR step_record IN
        SELECT DISTINCT wi.id as workflow_instance_id
        FROM workflow_instances wi
        JOIN workflow_steps ws ON ws.workflow_instance_id = wi.id
        WHERE wi.status = 'running'
        AND ws.status = 'completed'
    LOOP
        -- Update workflow progress
        UPDATE workflow_instances 
        SET progress_percentage = (
            SELECT ROUND((COUNT(*) FILTER (WHERE status = 'completed')::decimal / COUNT(*)) * 100, 2)
            FROM workflow_steps 
            WHERE workflow_instance_id = step_record.workflow_instance_id
        )
        WHERE id = step_record.workflow_instance_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log(
    p_event_type VARCHAR(100),
    p_entity_type VARCHAR(100),
    p_entity_id UUID,
    p_workflow_instance_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_event_data JSONB DEFAULT '{}',
    p_before_data JSONB DEFAULT NULL,
    p_after_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        event_type, entity_type, entity_id, workflow_instance_id,
        user_id, organization_id, event_data, before_data, after_data
    ) VALUES (
        p_event_type, p_entity_type, p_entity_id, p_workflow_instance_id,
        p_user_id, p_organization_id, p_event_data, p_before_data, p_after_data
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    CASE TG_OP
        WHEN 'INSERT' THEN
            PERFORM create_audit_log(
                'INSERT',
                TG_TABLE_NAME,
                NEW.id,
                CASE WHEN TG_TABLE_NAME = 'workflow_instances' THEN NEW.id
                     WHEN TG_TABLE_NAME = 'workflow_steps' THEN NEW.workflow_instance_id
                     ELSE NULL END,
                CASE WHEN TG_TABLE_NAME IN ('workflow_definitions', 'workflow_instances') THEN NEW.created_by
                     ELSE NULL END,
                CASE WHEN TG_TABLE_NAME IN ('workflow_definitions', 'workflow_instances', 'compliance_rules', 'integration_configs', 'notification_templates') THEN NEW.organization_id
                     ELSE NULL END,
                row_to_json(NEW),
                NULL,
                row_to_json(NEW)
            );
            RETURN NEW;
        WHEN 'UPDATE' THEN
            PERFORM create_audit_log(
                'UPDATE',
                TG_TABLE_NAME,
                NEW.id,
                CASE WHEN TG_TABLE_NAME = 'workflow_instances' THEN NEW.id
                     WHEN TG_TABLE_NAME = 'workflow_steps' THEN NEW.workflow_instance_id
                     ELSE NULL END,
                NULL,
                CASE WHEN TG_TABLE_NAME IN ('workflow_definitions', 'workflow_instances', 'compliance_rules', 'integration_configs', 'notification_templates') THEN NEW.organization_id
                     ELSE NULL END,
                '{}',
                row_to_json(OLD),
                row_to_json(NEW)
            );
            RETURN NEW;
        WHEN 'DELETE' THEN
            PERFORM create_audit_log(
                'DELETE',
                TG_TABLE_NAME,
                OLD.id,
                CASE WHEN TG_TABLE_NAME = 'workflow_instances' THEN OLD.id
                     WHEN TG_TABLE_NAME = 'workflow_steps' THEN OLD.workflow_instance_id
                     ELSE NULL END,
                NULL,
                CASE WHEN TG_TABLE_NAME IN ('workflow_definitions', 'workflow_instances', 'compliance_rules', 'integration_configs', 'notification_templates') THEN OLD.organization_id
                     ELSE NULL END,
                '{}',
                row_to_json(OLD),
                NULL
            );
            RETURN OLD;
    END CASE;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers
CREATE TRIGGER audit_workflow_definitions AFTER INSERT OR UPDATE OR DELETE ON workflow_definitions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_workflow_instances AFTER INSERT OR UPDATE OR DELETE ON workflow_instances
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_workflow_steps AFTER INSERT OR UPDATE OR DELETE ON workflow_steps
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Enable Row Level Security
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for multi-tenant isolation
CREATE POLICY workflow_definitions_org_isolation ON workflow_definitions
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY workflow_instances_org_isolation ON workflow_instances
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY workflow_steps_org_isolation ON workflow_steps
    FOR ALL USING (
        workflow_instance_id IN (
            SELECT id FROM workflow_instances 
            WHERE organization_id = current_setting('app.current_organization_id')::UUID
        )
    );

CREATE POLICY approval_chains_org_isolation ON approval_chains
    FOR ALL USING (
        workflow_step_id IN (
            SELECT ws.id FROM workflow_steps ws
            JOIN workflow_instances wi ON wi.id = ws.workflow_instance_id
            WHERE wi.organization_id = current_setting('app.current_organization_id')::UUID
        )
    );

CREATE POLICY document_routes_org_isolation ON document_routes
    FOR ALL USING (
        workflow_instance_id IN (
            SELECT id FROM workflow_instances 
            WHERE organization_id = current_setting('app.current_organization_id')::UUID
        )
    );

CREATE POLICY compliance_rules_org_isolation ON compliance_rules
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY audit_logs_org_isolation ON audit_logs
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY integration_configs_org_isolation ON integration_configs
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY notification_templates_org_isolation ON notification_templates
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Create views for common queries
CREATE VIEW workflow_dashboard AS
SELECT 
    wi.id,
    wi.name,
    wd.name as definition_name,
    wi.status,
    wi.priority,
    wi.progress_percentage,
    wi.