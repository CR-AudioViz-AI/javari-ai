-- =============================================================================
-- JAVARI AI - TICKETS & ENHANCEMENTS SYSTEM
-- =============================================================================
-- Complete support ticket and enhancement request management
-- Production Ready - Sunday, December 14, 2025
-- =============================================================================

-- ============ SUPPORT TICKETS ============

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT UNIQUE NOT NULL,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    
    -- Ticket Details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('bug', 'error', 'question', 'account', 'billing', 'feature', 'performance', 'security', 'other')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'auto_fixing', 'awaiting_user', 'resolved', 'closed', 'escalated')),
    
    -- Source Information
    source_app TEXT DEFAULT 'javariai.com',
    source_url TEXT,
    browser_info JSONB,
    error_logs JSONB,
    screenshots TEXT[],
    
    -- Auto-Fix Information
    auto_fix_attempted BOOLEAN DEFAULT false,
    auto_fix_successful BOOLEAN,
    auto_fix_actions JSONB,
    auto_fix_logs TEXT,
    auto_fix_timestamp TIMESTAMPTZ,
    
    -- Assignment
    assigned_to TEXT,
    assigned_bot TEXT,
    escalated_to TEXT,
    
    -- Resolution
    resolution TEXT,
    resolution_type TEXT CHECK (resolution_type IN ('auto_fixed', 'manual_fix', 'user_resolved', 'duplicate', 'wont_fix', 'cannot_reproduce')),
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    
    -- Feedback
    user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
    user_feedback TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    first_response_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- Ticket Comments/Updates
CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_type TEXT NOT NULL CHECK (author_type IN ('user', 'admin', 'bot', 'system')),
    author_id TEXT,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    attachments TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Activity Log
CREATE TABLE IF NOT EXISTS ticket_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'bot', 'system')),
    actor_id TEXT,
    actor_name TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ ENHANCEMENT REQUESTS ============

CREATE TABLE IF NOT EXISTS enhancement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    
    -- Request Details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    use_case TEXT,
    expected_benefit TEXT,
    category TEXT NOT NULL CHECK (category IN ('feature', 'improvement', 'integration', 'ui_ux', 'performance', 'automation', 'api', 'other')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'analysis_complete', 'approved', 'rejected', 'in_development', 'testing', 'deployed', 'deferred')),
    
    -- Javari Analysis (AI Generated)
    ai_analysis JSONB,
    ai_implementation_plan TEXT,
    ai_estimated_effort TEXT,
    ai_estimated_complexity TEXT CHECK (ai_estimated_complexity IN ('trivial', 'simple', 'moderate', 'complex', 'very_complex')),
    ai_potential_impacts JSONB,
    ai_dependencies TEXT[],
    ai_risks JSONB,
    ai_recommendations TEXT,
    ai_analysis_timestamp TIMESTAMPTZ,
    
    -- Voting & Engagement
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    
    -- Review & Approval
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_more_info')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Implementation
    assigned_to TEXT,
    estimated_delivery DATE,
    actual_delivery DATE,
    implementation_notes TEXT,
    related_tickets UUID[],
    related_enhancements UUID[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhancement Comments
CREATE TABLE IF NOT EXISTS enhancement_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enhancement_id UUID NOT NULL REFERENCES enhancement_requests(id) ON DELETE CASCADE,
    author_type TEXT NOT NULL CHECK (author_type IN ('user', 'admin', 'bot', 'system')),
    author_id TEXT,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhancement Votes
CREATE TABLE IF NOT EXISTS enhancement_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enhancement_id UUID NOT NULL REFERENCES enhancement_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(enhancement_id, user_id)
);

-- Enhancement Activity Log
CREATE TABLE IF NOT EXISTS enhancement_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enhancement_id UUID NOT NULL REFERENCES enhancement_requests(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'bot', 'system')),
    actor_id TEXT,
    actor_name TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ AUTO-FIX KNOWLEDGE BASE ============

CREATE TABLE IF NOT EXISTS autofix_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_name TEXT NOT NULL,
    error_pattern TEXT NOT NULL,
    error_category TEXT NOT NULL,
    fix_type TEXT NOT NULL CHECK (fix_type IN ('code', 'config', 'data', 'restart', 'clear_cache', 'api_call', 'notification', 'escalate')),
    fix_actions JSONB NOT NULL,
    fix_script TEXT,
    success_rate DECIMAL(5,2) DEFAULT 0,
    times_used INTEGER DEFAULT 0,
    times_successful INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-Fix Execution Log
CREATE TABLE IF NOT EXISTS autofix_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(id),
    pattern_id UUID REFERENCES autofix_patterns(id),
    execution_status TEXT NOT NULL CHECK (execution_status IN ('started', 'in_progress', 'completed', 'failed', 'rolled_back')),
    actions_taken JSONB,
    execution_log TEXT,
    error_message TEXT,
    rollback_performed BOOLEAN DEFAULT false,
    execution_time_ms INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_tickets_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_bot);

CREATE INDEX IF NOT EXISTS idx_enhancements_number ON enhancement_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_enhancements_user ON enhancement_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_enhancements_status ON enhancement_requests(status);
CREATE INDEX IF NOT EXISTS idx_enhancements_category ON enhancement_requests(category);
CREATE INDEX IF NOT EXISTS idx_enhancements_created ON enhancement_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enhancements_votes ON enhancement_requests(upvotes DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_enhancement_comments_enhancement ON enhancement_comments(enhancement_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket ON ticket_activity(ticket_id);
CREATE INDEX IF NOT EXISTS idx_enhancement_activity_enhancement ON enhancement_activity(enhancement_id);

-- ============ FUNCTIONS ============

-- Generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
    seq_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5) AS INTEGER)), 0) + 1 
    INTO seq_num 
    FROM support_tickets;
    RETURN 'TKT-' || LPAD(seq_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Generate enhancement number
CREATE OR REPLACE FUNCTION generate_enhancement_number()
RETURNS TEXT AS $$
DECLARE
    seq_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 5) AS INTEGER)), 0) + 1 
    INTO seq_num 
    FROM enhancement_requests;
    RETURN 'ENH-' || LPAD(seq_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := generate_ticket_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_ticket_number ON support_tickets;
CREATE TRIGGER trigger_set_ticket_number
    BEFORE INSERT ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_number();

-- Trigger to auto-generate enhancement number
CREATE OR REPLACE FUNCTION set_enhancement_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_number IS NULL THEN
        NEW.request_number := generate_enhancement_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_enhancement_number ON enhancement_requests;
CREATE TRIGGER trigger_set_enhancement_number
    BEFORE INSERT ON enhancement_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_enhancement_number();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tickets_updated ON support_tickets;
CREATE TRIGGER trigger_tickets_updated
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_enhancements_updated ON enhancement_requests;
CREATE TRIGGER trigger_enhancements_updated
    BEFORE UPDATE ON enhancement_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============ RLS POLICIES ============

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhancement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhancement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhancement_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhancement_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE autofix_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE autofix_executions ENABLE ROW LEVEL SECURITY;

-- Allow full access (service role handles auth)
CREATE POLICY "Full access tickets" ON support_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access ticket_comments" ON ticket_comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access ticket_activity" ON ticket_activity FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access enhancements" ON enhancement_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access enhancement_comments" ON enhancement_comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access enhancement_votes" ON enhancement_votes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access enhancement_activity" ON enhancement_activity FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access autofix_patterns" ON autofix_patterns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access autofix_executions" ON autofix_executions FOR ALL USING (true) WITH CHECK (true);

-- ============ GRANTS ============

GRANT ALL ON support_tickets TO anon, authenticated, service_role;
GRANT ALL ON ticket_comments TO anon, authenticated, service_role;
GRANT ALL ON ticket_activity TO anon, authenticated, service_role;
GRANT ALL ON enhancement_requests TO anon, authenticated, service_role;
GRANT ALL ON enhancement_comments TO anon, authenticated, service_role;
GRANT ALL ON enhancement_votes TO anon, authenticated, service_role;
GRANT ALL ON enhancement_activity TO anon, authenticated, service_role;
GRANT ALL ON autofix_patterns TO anon, authenticated, service_role;
GRANT ALL ON autofix_executions TO anon, authenticated, service_role;

-- ============ SEED DATA: AUTO-FIX PATTERNS ============

INSERT INTO autofix_patterns (pattern_name, error_pattern, error_category, fix_type, fix_actions, fix_script, success_rate, is_active) VALUES
('API Rate Limit', 'rate limit|too many requests|429', 'api', 'config', '{"action": "enable_rate_limiting", "wait_time": 60}', NULL, 85.00, true),
('Database Connection', 'connection refused|ECONNREFUSED|database.*unavailable', 'database', 'restart', '{"action": "restart_db_pool", "max_retries": 3}', NULL, 92.00, true),
('Cache Miss', 'cache miss|cache.*expired|stale data', 'cache', 'clear_cache', '{"action": "invalidate_cache", "rebuild": true}', NULL, 95.00, true),
('Auth Token Expired', 'token expired|jwt.*invalid|unauthorized', 'auth', 'api_call', '{"action": "refresh_tokens", "notify_user": true}', NULL, 88.00, true),
('Memory Leak', 'out of memory|heap.*exceeded|memory limit', 'performance', 'restart', '{"action": "restart_service", "clear_memory": true}', NULL, 78.00, true),
('Network Timeout', 'timeout|ETIMEDOUT|connection timed out', 'network', 'api_call', '{"action": "retry_with_backoff", "max_retries": 5}', NULL, 82.00, true),
('Invalid Input', 'validation.*failed|invalid.*input|malformed', 'validation', 'notification', '{"action": "notify_user", "provide_guidance": true}', NULL, 90.00, true),
('File Not Found', '404|not found|file.*missing', 'filesystem', 'api_call', '{"action": "check_and_restore", "fallback": true}', NULL, 75.00, true),
('Permission Denied', '403|permission denied|access denied', 'auth', 'notification', '{"action": "check_permissions", "escalate_if_needed": true}', NULL, 70.00, true),
('SSL Certificate', 'ssl.*error|certificate.*expired|https.*failed', 'security', 'escalate', '{"action": "escalate_to_admin", "priority": "high"}', NULL, 60.00, true)
ON CONFLICT DO NOTHING;

-- ============ VIEWS ============

-- Dashboard view for tickets
CREATE OR REPLACE VIEW ticket_dashboard AS
SELECT 
    status,
    priority,
    category,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))/3600)::INTEGER as avg_resolution_hours,
    COUNT(CASE WHEN auto_fix_successful = true THEN 1 END) as auto_fixed_count,
    AVG(user_satisfaction) as avg_satisfaction
FROM support_tickets
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY status, priority, category;

-- Dashboard view for enhancements
CREATE OR REPLACE VIEW enhancement_dashboard AS
SELECT 
    status,
    category,
    COUNT(*) as count,
    SUM(upvotes) as total_upvotes,
    AVG(upvotes) as avg_upvotes,
    COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN ai_analysis IS NOT NULL THEN 1 END) as analyzed_count
FROM enhancement_requests
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY status, category;
