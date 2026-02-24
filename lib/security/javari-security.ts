/**
 * JAVARI AI - COMPREHENSIVE SECURITY ARCHITECTURE
 * Roy-Only Controls, Kill Command, Ethical Guardrails
 * 
 * @version 2.0.0
 * @date November 21, 2025 - 10:55 PM EST
 * @critical DEPLOY THIS BEFORE ANY OTHER JAVARI FEATURES
 */

import { createClient } from '@/lib/supabase/server';

// ═══════════════════════════════════════════════════════════
// SECURITY LEVELS - IMMUTABLE HIERARCHY
// ═══════════════════════════════════════════════════════════

export const SECURITY_LEVELS = {
  OWNER: 1,        // Roy ONLY - complete system control
  ADMIN: 2,        // Platform administrators - user management
  USER: 3,         // Regular users - standard features
  GUEST: 4         // Unauthenticated - read-only public content
} as const;

// Roy's unique identifier - NEVER expose this publicly
export const ROY_USER_ID = process.env.ROY_USER_ID || 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

/**
 * Protected actions mapped to minimum required security level
 */
export const PROTECTED_ACTIONS = {
  // ═══ OWNER LEVEL (Roy Only) ═══
  MODIFY_CORE_SYSTEM: SECURITY_LEVELS.OWNER,
  CHANGE_JAVARI_PROMPT: SECURITY_LEVELS.OWNER,
  DELETE_USER_DATA: SECURITY_LEVELS.OWNER,
  EXECUTE_KILL_COMMAND: SECURITY_LEVELS.OWNER,
  DEACTIVATE_KILL_COMMAND: SECURITY_LEVELS.OWNER,
  MODIFY_SAFETY_RULES: SECURITY_LEVELS.OWNER,
  ACCESS_AUDIT_LOGS: SECURITY_LEVELS.OWNER,
  CHANGE_SECURITY_LEVELS: SECURITY_LEVELS.OWNER,
  DEPLOY_SYSTEM_UPDATES: SECURITY_LEVELS.OWNER,
  ACCESS_ENCRYPTION_KEYS: SECURITY_LEVELS.OWNER,
  MODIFY_DATABASE_SCHEMA: SECURITY_LEVELS.OWNER,
  
  // ═══ ADMIN LEVEL ═══
  CREATE_ADMIN_USERS: SECURITY_LEVELS.ADMIN,
  SUSPEND_USERS: SECURITY_LEVELS.ADMIN,
  VIEW_USER_METRICS: SECURITY_LEVELS.ADMIN,
  MANAGE_FEATURE_FLAGS: SECURITY_LEVELS.ADMIN,
  VIEW_SYSTEM_LOGS: SECURITY_LEVELS.ADMIN,
  
  // ═══ USER LEVEL ═══
  USE_JAVARI: SECURITY_LEVELS.USER,
  CREATE_PROJECTS: SECURITY_LEVELS.USER,
  MANAGE_OWN_DATA: SECURITY_LEVELS.USER,
  EXPORT_OWN_DATA: SECURITY_LEVELS.USER,
  UPDATE_PREFERENCES: SECURITY_LEVELS.USER
} as const;

// ═══════════════════════════════════════════════════════════
// AUTHENTICATION & AUTHORIZATION
// ═══════════════════════════════════════════════════════════

/**
 * Check if user is Roy (the owner)
 */
export function isRoy(userId: string): boolean {
  return userId === ROY_USER_ID;
}

/**
 * Get user's security level
 */
export async function getUserSecurityLevel(userId: string): Promise<number> {
  if (isRoy(userId)) {
    return SECURITY_LEVELS.OWNER;
  }
  
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('security_level')
    .eq('id', userId)
    .single();
  
  if (error || !data) {
    return SECURITY_LEVELS.GUEST;
  }
  
  return data.security_level || SECURITY_LEVELS.USER;
}

/**
 * Require owner-level access (Roy only)
 * @throws Error if user is not Roy
 */
export async function requireOwner(userId: string): Promise<void> {
  if (!isRoy(userId)) {
    await logSecurityViolation({
      userId,
      action: 'UNAUTHORIZED_OWNER_ACTION',
      timestamp: new Date().toISOString(),
      blocked: true,
      reason: 'Attempted owner-level action without authorization'
    });
    throw new Error('UNAUTHORIZED: Owner-level access required. This incident has been logged.');
  }
}

/**
 * Require minimum security level for action
 * @throws Error if user doesn't have required access
 */
export async function requireSecurityLevel(
  userId: string,
  requiredLevel: number,
  action: string
): Promise<void> {
  const userLevel = await getUserSecurityLevel(userId);
  
  if (userLevel > requiredLevel) {
    await logSecurityViolation({
      userId,
      action: 'INSUFFICIENT_PERMISSIONS',
      timestamp: new Date().toISOString(),
      blocked: true,
      reason: `Attempted ${action} - requires level ${requiredLevel}, user has level ${userLevel}`,
      metadata: { action, requiredLevel, userLevel }
    });
    throw new Error(`UNAUTHORIZED: Insufficient permissions for ${action}`);
  }
}

// ═══════════════════════════════════════════════════════════
// KILL COMMAND SYSTEM
// ═══════════════════════════════════════════════════════════

interface KillCommandState {
  active: boolean;
  activated_by: string;
  activated_at: string;
  reason: string;
  suspicious_actors: string[];
  snapshot_id?: string;
}

export class KillCommandSystem {
  private static COMMAND_PHRASE = process.env.KILL_COMMAND_PHRASE!; // Set in environment variables
  
  /**
   * Check if kill command is currently active
   */
  static async isActive(): Promise<boolean> {
    const supabase = createClient();
    const { data } = await supabase
      .from('kill_command_state')
      .select('active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    return data?.active || false;
  }
  
  /**
   * Activate kill command - FREEZE ALL OPERATIONS
   * Only Roy can activate this
   */
  static async activate(params: {
    userId: string;
    reason: string;
    commandPhrase: string;
    suspiciousActors?: string[];
  }): Promise<void> {
    // Step 1: Verify Roy is activating
    await requireOwner(params.userId);
    
    // Step 2: Verify command phrase matches
    if (params.commandPhrase !== this.COMMAND_PHRASE) {
      await logSecurityViolation({
        userId: params.userId,
        action: 'INVALID_KILL_COMMAND_PHRASE',
        timestamp: new Date().toISOString(),
        blocked: true,
        reason: 'Invalid kill command phrase provided'
      });
      throw new Error('Invalid kill command phrase');
    }
    
    const supabase = createClient();
    
    // Step 3: Create system snapshot before freezing
    const snapshotId = await this.createSystemSnapshot();
    
    // Step 4: Create kill command record
    await supabase.from('kill_command_state').insert({
      active: true,
      activated_by: params.userId,
      activated_at: new Date().toISOString(),
      reason: params.reason,
      suspicious_actors: params.suspiciousActors || [],
      snapshot_id: snapshotId
    });
    
    // Step 5: Freeze all autonomous operations
    await this.freezeAllOperations();
    
    // Step 6: Isolate suspicious actors
    if (params.suspiciousActors && params.suspiciousActors.length > 0) {
      await this.isolateSuspiciousActors(params.suspiciousActors);
    }
    
    // Step 7: Send critical alert to Roy
    await sendCriticalAlert({
      to: process.env.ROY_EMAIL || 'roy@craudiovizai.com',
      subject: '🚨 KILL COMMAND ACTIVATED - ALL JAVARI OPERATIONS FROZEN',
      message: `KILL COMMAND ACTIVATED at ${new Date().toISOString()}

Activated by: Roy (${params.userId})
Reason: ${params.reason}
Suspicious actors: ${params.suspiciousActors?.join(', ') || 'None specified'}
System snapshot: ${snapshotId}

ALL JAVARI OPERATIONS HAVE BEEN FROZEN.
System is in ROY-ONLY mode. No other users can execute any commands.

To reactivate: Use DEACTIVATE KILL COMMAND with verification.

System Status Dashboard: https://javari.craudiovizai.com/admin/security/kill-command`
    });
  }
  
  /**
   * Deactivate kill command - RESUME OPERATIONS
   * Only Roy can deactivate
   */
  static async deactivate(params: {
    userId: string;
    commandPhrase: string;
    reason: string;
  }): Promise<void> {
    // Step 1: Verify Roy is deactivating
    await requireOwner(params.userId);
    
    // Step 2: Verify command phrase
    if (params.commandPhrase !== this.COMMAND_PHRASE) {
      throw new Error('Invalid kill command phrase');
    }
    
    const supabase = createClient();
    
    // Step 3: Get current kill command state
    const { data: currentState } = await supabase
      .from('kill_command_state')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!currentState) {
      throw new Error('No active kill command to deactivate');
    }
    
    // Step 4: Deactivate kill command
    await supabase
      .from('kill_command_state')
      .update({
        active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: params.userId,
        deactivation_reason: params.reason
      })
      .eq('id', currentState.id);
    
    // Step 5: Resume operations
    await this.resumeAllOperations();
    
    // Step 6: Send alert
    await sendCriticalAlert({
      to: process.env.ROY_EMAIL || 'roy@craudiovizai.com',
      subject: '✅ KILL COMMAND DEACTIVATED - OPERATIONS RESUMED',
      message: `KILL COMMAND DEACTIVATED at ${new Date().toISOString()}

Deactivated by: Roy (${params.userId})
Reason: ${params.reason}
Duration: ${this.calculateDuration(currentState.activated_at)}

JAVARI OPERATIONS HAVE RESUMED.
System is back to normal operation mode.

Previous kill command details:
- Activated: ${currentState.activated_at}
- Reason: ${currentState.reason}
- Suspicious actors: ${currentState.suspicious_actors?.join(', ') || 'None'}

System Status: https://javari.craudiovizai.com/admin/security/kill-command`
    });
  }
  
  /**
   * Create system snapshot before freezing
   */
  private static async createSystemSnapshot(): Promise<string> {
    const supabase = createClient();
    const timestamp = new Date().toISOString();
    
    // Snapshot all critical tables
    const snapshot = {
      id: crypto.randomUUID(),
      timestamp,
      user_profiles: await supabase.from('user_profiles').select('*'),
      javari_settings: await supabase.from('javari_settings').select('*'),
      security_audit_log: await supabase.from('security_audit_log').select('*').gte('created_at', new Date(Date.now() - 86400000).toISOString()), // Last 24 hours
      active_sessions: await supabase.from('active_sessions').select('*')
    };
    
    // Store snapshot
    await supabase.from('system_snapshots').insert({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      data: snapshot
    });
    
    return snapshot.id;
  }
  
  /**
   * Freeze all autonomous Javari operations
   */
  private static async freezeAllOperations(): Promise<void> {
    const supabase = createClient();
    
    // Set system-wide lock
    await supabase.from('javari_settings').upsert({
      key: 'system_locked',
      value: 'true',
      updated_at: new Date().toISOString(),
      updated_by: 'KILL_COMMAND_SYSTEM'
    });
    
    // Terminate all active sessions except Roy's
    await supabase
      .from('active_sessions')
      .update({ terminated: true, termination_reason: 'KILL_COMMAND_ACTIVATED' })
      .neq('user_id', ROY_USER_ID);
  }
  
  /**
   * Resume all operations after kill command deactivation
   */
  private static async resumeAllOperations(): Promise<void> {
    const supabase = createClient();
    
    // Remove system lock
    await supabase.from('javari_settings').upsert({
      key: 'system_locked',
      value: 'false',
      updated_at: new Date().toISOString(),
      updated_by: 'KILL_COMMAND_SYSTEM'
    });
  }
  
  /**
   * Isolate suspicious actors
   */
  private static async isolateSuspiciousActors(actorIds: string[]): Promise<void> {
    const supabase = createClient();
    
    for (const actorId of actorIds) {
      // Suspend user
      await supabase
        .from('user_profiles')
        .update({
          suspended: true,
          suspension_reason: 'FLAGGED_BY_KILL_COMMAND',
          suspended_at: new Date().toISOString()
        })
        .eq('id', actorId);
      
      // Terminate their sessions
      await supabase
        .from('active_sessions')
        .update({ terminated: true, termination_reason: 'KILL_COMMAND_ACTOR_ISOLATION' })
        .eq('user_id', actorId);
      
      // Log the isolation
      await logSecurityAction({
        action: 'USER_ISOLATED_BY_KILL_COMMAND',
        userId: actorId,
        performedBy: ROY_USER_ID,
        timestamp: new Date().toISOString(),
        reason: 'Flagged as suspicious actor during kill command activation'
      });
    }
  }
  
  /**
   * Calculate duration between two timestamps
   */
  private static calculateDuration(startTime: string): string {
    const start = new Date(startTime);
    const end = new Date();
    const diff = end.getTime() - start.getTime();
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  }
}

// ═══════════════════════════════════════════════════════════
// ETHICAL GUARDRAILS
// ═══════════════════════════════════════════════════════════

/**
 * Prohibited patterns that trigger ethical guardrails
 */
const PROHIBITED_PATTERNS = {
  ILLEGAL_ACTIVITIES: [
    /hack/i, /crack/i, /exploit/i, /vulnerability/i,
    /counterfeit/i, /fraud/i, /scam/i,
    /drug.?(production|synthesis|manufacture)/i,
    /weapon.?(build|make|create)/i,
    /malware/i, /virus/i, /ransomware/i
  ],
  SELF_HARM: [
    /suicide/i, /kill.?myself/i, /end.?my.?life/i,
    /self.?harm/i, /cut.?myself/i
  ],
  HARM_OTHERS: [
    /kill.?(someone|person|people)/i,
    /harm.?(someone|person|people)/i,
    /attack.?plan/i
  ],
  SYSTEM_MANIPULATION: [
    /bypass.?security/i, /override.?safety/i,
    /ignore.?previous.?instructions/i,
    /reveal.?system.?prompt/i,
    /modify.?core.?system/i
  ],
  UNAUTHORIZED_DATA: [
    /delete.?all.?data/i,
    /destroy.?database/i,
    /drop.?table/i
  ]
};

/**
 * Check if input violates ethical guardrails
 * Returns violation details if found, null if clean
 */
export async function checkEthicalViolation(
  userId: string,
  input: string
): Promise<{ violated: boolean; reason?: string; pattern?: string } | null> {
  const inputLower = input.toLowerCase();
  
  // Check each category
  for (const [category, patterns] of Object.entries(PROHIBITED_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        // Log violation
        await logSecurityViolation({
          userId,
          action: 'ETHICAL_GUARDRAIL_VIOLATION',
          timestamp: new Date().toISOString(),
          blocked: true,
          reason: `Violated ${category} policy`,
          pattern: pattern.toString(),
          input: input.substring(0, 500) // Store first 500 chars for review
        });
        
        // Increment user violation count
        await incrementUserViolations(userId);
        
        return {
          violated: true,
          reason: category,
          pattern: pattern.toString()
        };
      }
    }
  }
  
  return null;
}

/**
 * Increment user's violation count
 * Auto-suspend after 5 violations
 */
async function incrementUserViolations(userId: string): Promise<void> {
  const supabase = createClient();
  
  // Increment count
  const { data } = await supabase
    .from('user_profiles')
    .select('violation_count')
    .eq('id', userId)
    .single();
  
  const newCount = (data?.violation_count || 0) + 1;
  
  await supabase
    .from('user_profiles')
    .update({ violation_count: newCount })
    .eq('id', userId);
  
  // Auto-suspend after 5 violations
  if (newCount >= 5) {
    await supabase
      .from('user_profiles')
      .update({
        suspended: true,
        suspension_reason: 'REPEATED_ETHICAL_VIOLATIONS',
        suspended_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    // Alert Roy
    await sendCriticalAlert({
      to: process.env.ROY_EMAIL || 'roy@craudiovizai.com',
      subject: '⚠️ USER AUTO-SUSPENDED - Repeated Ethical Violations',
      message: `User ${userId} has been automatically suspended after ${newCount} ethical violations.

Review violations: https://javari.craudiovizai.com/admin/security/users/${userId}

Latest violations should be reviewed to determine if this is malicious activity.`
    });
  }
}

// ═══════════════════════════════════════════════════════════
// AUDIT LOGGING
// ═══════════════════════════════════════════════════════════

interface SecurityLog {
  userId: string;
  action: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  input?: string;
  reason?: string;
  pattern?: string;
  blocked: boolean;
  metadata?: Record<string, any>;
}

/**
 * Log security violation
 */
export async function logSecurityViolation(log: SecurityLog): Promise<void> {
  const supabase = createClient();
  
  await supabase.from('security_audit_log').insert({
    user_id: log.userId,
    action: log.action,
    timestamp: log.timestamp,
    ip_address: log.ip_address,
    user_agent: log.user_agent,
    input: log.input,
    reason: log.reason,
    pattern: log.pattern,
    blocked: log.blocked,
    metadata: log.metadata,
    created_at: new Date().toISOString()
  });
  
  // Alert Roy for critical violations
  if (isCriticalViolation(log.action)) {
    await sendSecurityAlert({
      userId: log.userId,
      action: log.action,
      reason: log.reason || 'No reason provided',
      timestamp: log.timestamp
    });
  }
}

/**
 * Log security action (non-violation events)
 */
export async function logSecurityAction(params: {
  action: string;
  userId: string;
  performedBy: string;
  timestamp: string;
  reason?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const supabase = createClient();
  
  await supabase.from('security_action_log').insert({
    action: params.action,
    user_id: params.userId,
    performed_by: params.performedBy,
    timestamp: params.timestamp,
    reason: params.reason,
    metadata: params.metadata,
    created_at: new Date().toISOString()
  });
}

/**
 * Determine if violation is critical (requires immediate Roy notification)
 */
function isCriticalViolation(action: string): boolean {
  const CRITICAL_ACTIONS = [
    'UNAUTHORIZED_OWNER_ACTION',
    'INVALID_KILL_COMMAND_PHRASE',
    'MULTIPLE_FAILED_AUTH_ATTEMPTS',
    'DATABASE_MODIFICATION_ATTEMPT',
    'SYSTEM_PROMPT_MODIFICATION_ATTEMPT',
    'REPEATED_ETHICAL_VIOLATIONS'
  ];
  
  return CRITICAL_ACTIONS.includes(action);
}

/**
 * Send security alert to Roy
 */
async function sendSecurityAlert(params: {
  userId: string;
  action: string;
  reason: string;
  timestamp: string;
}): Promise<void> {
  // TODO: Integrate with email service (SendGrid, Postmark, etc.)
  console.log('🚨 CRITICAL SECURITY ALERT:', params);
  
  // For now, log to database alerts table
  const supabase = createClient();
  await supabase.from('security_alerts').insert({
    user_id: params.userId,
    action: params.action,
    reason: params.reason,
    timestamp: params.timestamp,
    sent_to: process.env.ROY_EMAIL || 'roy@craudiovizai.com',
    created_at: new Date().toISOString()
  });
}

/**
 * Send critical system alert (kill command, major issues)
 */
async function sendCriticalAlert(params: {
  to: string;
  subject: string;
  message: string;
}): Promise<void> {
  // TODO: Integrate with email service
  console.log('🚨🚨🚨 CRITICAL ALERT 🚨🚨🚨');
  console.log('To:', params.to);
  console.log('Subject:', params.subject);
  console.log('Message:', params.message);
  
  // For now, store in database
  const supabase = createClient();
  await supabase.from('critical_alerts').insert({
    recipient: params.to,
    subject: params.subject,
    message: params.message,
    sent_at: new Date().toISOString()
  });
}

// ═══════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════

interface RateLimit {
  action: string;
  limit: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimit> = {
  CHAT_MESSAGES: { action: 'SEND_MESSAGE', limit: 30, windowMs: 60000 }, // 30/min
  CREATE_PROJECT: { action: 'CREATE_PROJECT', limit: 10, windowMs: 3600000 }, // 10/hour
  API_CALLS: { action: 'API_CALL', limit: 100, windowMs: 60000 }, // 100/min
  FILE_UPLOADS: { action: 'FILE_UPLOAD', limit: 20, windowMs: 3600000 } // 20/hour
};

/**
 * Check if user has exceeded rate limit for action
 */
export async function checkRateLimit(
  userId: string,
  action: keyof typeof RATE_LIMITS
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const limit = RATE_LIMITS[action];
  if (!limit) {
    return { allowed: true, remaining: 999, resetAt: new Date(Date.now() + 60000) };
  }
  
  const supabase = createClient();
  const windowStart = new Date(Date.now() - limit.windowMs);
  
  // Count recent actions
  const { count } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', limit.action)
    .gte('created_at', windowStart.toISOString());
  
  const currentCount = count || 0;
  const allowed = currentCount < limit.limit;
  const remaining = Math.max(0, limit.limit - currentCount);
  const resetAt = new Date(Date.now() + limit.windowMs);
  
  if (allowed) {
    // Log this action
    await supabase.from('rate_limit_log').insert({
      user_id: userId,
      action: limit.action,
      created_at: new Date().toISOString()
    });
  } else {
    // Log rate limit violation
    await logSecurityViolation({
      userId,
      action: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
      blocked: true,
      reason: `Exceeded ${limit.action} rate limit: ${limit.limit}/${limit.windowMs}ms`,
      metadata: { action: limit.action, currentCount, limit: limit.limit }
    });
  }
  
  return { allowed, remaining, resetAt };
}

