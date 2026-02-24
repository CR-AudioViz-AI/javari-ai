-- ============================================================================
-- NOTIFICATIONOS (JAVARI INBOX) - PHASE 1 MVP SCHEMA
-- ============================================================================
-- Description: Email notifications, system alerts, event-triggered messages
-- Version: 1.0.0
-- Created: 2026-01-29
-- Repository: CR-AudioViz-AI/javari-ai
-- ============================================================================

-- ============================================================================
-- TABLE: notifications
-- Purpose: Core notification storage with multi-channel support
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient information
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification content
  type VARCHAR(50) NOT NULL, -- 'email', 'system', 'alert', 'info', 'warning', 'error'
  priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent', 'critical'
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT, -- Optional HTML version for emails
  
  -- Delivery configuration
  channel VARCHAR(20) NOT NULL DEFAULT 'email', -- 'email', 'in_app', 'sms' (Phase 1: email + in_app)
  template_id UUID REFERENCES notification_templates(id),
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'read'
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- Delivery tracking
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Extensible metadata (action links, related entities, etc.)
  tags TEXT[], -- Searchable tags
  
  -- Deduplication
  dedup_key TEXT, -- Optional deduplication key
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Indexes
  CONSTRAINT valid_type CHECK (type IN ('email', 'system', 'alert', 'info', 'warning', 'error')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
  CONSTRAINT valid_channel CHECK (channel IN ('email', 'in_app', 'sms', 'push')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read'))
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_dedup_key ON notifications(dedup_key) WHERE dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_next_retry ON notifications(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- ============================================================================
-- TABLE: notification_templates
-- Purpose: Reusable notification templates with variable substitution
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template identification
  template_key VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'welcome_email', 'password_reset', 'invoice_ready'
  name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Template content
  subject_template TEXT NOT NULL, -- Supports {{variable}} syntax
  body_template TEXT NOT NULL,
  html_template TEXT, -- Optional HTML version
  
  -- Configuration
  channel VARCHAR(20) NOT NULL DEFAULT 'email',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  
  -- Metadata
  variables JSONB DEFAULT '[]'::jsonb, -- Array of required variables
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_template_channel CHECK (channel IN ('email', 'in_app', 'sms', 'push')),
  CONSTRAINT valid_template_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_key ON notification_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(active) WHERE active = true;

-- ============================================================================
-- TABLE: notification_delivery_log
-- Purpose: Immutable audit log of all delivery attempts
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  
  -- Delivery details
  attempt_number INTEGER NOT NULL,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'pending'
  
  -- Provider tracking
  provider VARCHAR(50), -- 'smtp', 'resend', 'sendgrid', 'twilio', 'firebase', etc.
  provider_message_id TEXT, -- External provider's message ID
  provider_response JSONB, -- Full provider response
  
  -- Timing
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER, -- Time taken to send
  
  -- Error tracking
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_delivery_status CHECK (status IN ('success', 'failed', 'pending')),
  CONSTRAINT valid_delivery_channel CHECK (channel IN ('email', 'in_app', 'sms', 'push'))
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_notification ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_status ON notification_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_delivery_log_attempted_at ON notification_delivery_log(attempted_at DESC);

-- ============================================================================
-- TABLE: notification_preferences
-- Purpose: User notification preferences and consent
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Channel preferences
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false, -- Phase 2
  push_enabled BOOLEAN NOT NULL DEFAULT false, -- Phase 2
  
  -- Category preferences (can be extended)
  preferences JSONB NOT NULL DEFAULT '{
    "system_alerts": true,
    "account_activity": true,
    "marketing": false,
    "product_updates": true,
    "security_alerts": true
  }'::jsonb,
  
  -- Quiet hours (UTC)
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_preferences UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all NotificationOS tables
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications (mark as read)"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Service role only (controlled by API)

CREATE POLICY "Service role can manage all notifications"
  ON notifications FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- notification_templates policies (admin-only management)
CREATE POLICY "Anyone can view active templates"
  ON notification_templates FOR SELECT
  USING (active = true);

CREATE POLICY "Service role can manage templates"
  ON notification_templates FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- notification_delivery_log policies (read-only audit)
CREATE POLICY "Users can view their notification delivery logs"
  ON notification_delivery_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notifications
      WHERE notifications.id = notification_delivery_log.notification_id
      AND notifications.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert delivery logs"
  ON notification_delivery_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can view all delivery logs"
  ON notification_delivery_log FOR SELECT
  USING (auth.jwt() ->> 'role' = 'service_role');

-- notification_preferences policies
CREATE POLICY "Users can view their own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all preferences"
  ON notification_preferences FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Auto-create notification preferences for new users
CREATE OR REPLACE FUNCTION create_notification_preferences_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_create_notification_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences_for_new_user();

-- ============================================================================
-- SEED DATA: Default notification templates
-- ============================================================================

INSERT INTO notification_templates (template_key, name, description, subject_template, body_template, channel, priority)
VALUES
  (
    'welcome',
    'Welcome Email',
    'Welcome new users to the platform',
    'Welcome to CRAudioVizAI, {{user_name}}!',
    'Hi {{user_name}},\n\nWelcome to CRAudioVizAI! We''re excited to have you on board.\n\nBest regards,\nThe CRAudioVizAI Team',
    'email',
    'normal'
  ),
  (
    'password_reset',
    'Password Reset',
    'Password reset request notification',
    'Password Reset Request',
    'Hi {{user_name}},\n\nYou requested a password reset. Click the link below to reset your password:\n\n{{reset_link}}\n\nThis link will expire in {{expiry_hours}} hours.\n\nIf you didn''t request this, please ignore this email.\n\nBest regards,\nThe CRAudioVizAI Team',
    'email',
    'high'
  ),
  (
    'system_alert',
    'System Alert',
    'Critical system alerts',
    '{{alert_type}}: {{alert_title}}',
    '{{alert_message}}',
    'in_app',
    'critical'
  ),
  (
    'task_complete',
    'Task Completed',
    'Notify user when async task completes',
    'Your task "{{task_name}}" is complete',
    'Hi {{user_name}},\n\nYour task "{{task_name}}" has been completed successfully.\n\n{{task_details}}\n\nBest regards,\nJavari AI',
    'in_app',
    'normal'
  )
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the schema was created successfully:
--
-- SELECT COUNT(*) FROM notifications;
-- SELECT COUNT(*) FROM notification_templates;
-- SELECT COUNT(*) FROM notification_delivery_log;
-- SELECT COUNT(*) FROM notification_preferences;
-- SELECT * FROM notification_templates WHERE active = true;
-- ============================================================================

COMMENT ON TABLE notifications IS 'NotificationOS: Core notification storage with multi-channel delivery support';
COMMENT ON TABLE notification_templates IS 'NotificationOS: Reusable notification templates with variable substitution';
COMMENT ON TABLE notification_delivery_log IS 'NotificationOS: Immutable audit log of all delivery attempts';
COMMENT ON TABLE notification_preferences IS 'NotificationOS: User notification preferences and consent management';
