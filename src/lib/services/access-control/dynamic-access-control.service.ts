import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import type { User } from '@clerk/nextjs/server';

/**
 * Permission decision result
 */
export interface PermissionDecision {
  /** Whether access is granted */
  granted: boolean;
  /** Reason for the decision */
  reason: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Applicable conditions or restrictions */
  conditions?: string[];
  /** Decision timestamp */
  timestamp: Date;
  /** Time-to-live for cached decision (seconds) */
  ttl: number;
}

/**
 * User access context
 */
export interface AccessContext {
  /** User information */
  user: {
    id: string;
    role: string;
    attributes: Record<string, any>;
    permissions: string[];
    groups: string[];
  };
  /** Environmental context */
  environment: {
    timestamp: Date;
    location?: {
      country: string;
      region: string;
      timezone: string;
    };
    device: {
      type: 'desktop' | 'mobile' | 'tablet';
      trusted: boolean;
      fingerprint: string;
    };
    network: {
      ip: string;
      type: 'internal' | 'external';
      riskScore: number;
    };
  };
  /** Session context */
  session: {
    id: string;
    startTime: Date;
    lastActivity: Date;
    mfaVerified: boolean;
    freshLogin: boolean;
  };
}

/**
 * Resource attributes for access control
 */
export interface ResourceAttributes {
  /** Resource identifier */
  id: string;
  /** Resource type */
  type: string;
  /** Sensitivity classification */
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  /** Owner information */
  owner: {
    id: string;
    type: 'user' | 'organization';
  };
  /** Resource metadata */
  metadata: {
    created: Date;
    modified: Date;
    tags: string[];
    classification: Record<string, any>;
  };
  /** Access patterns */
  patterns: {
    lastAccessed?: Date;
    accessCount: number;
    accessFrequency: number;
  };
}

/**
 * Policy rule definition
 */
export interface PolicyRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule priority (higher = more important) */
  priority: number;
  /** Rule effect */
  effect: 'allow' | 'deny';
  /** Target conditions */
  target: {
    users?: string[];
    roles?: string[];
    resources?: string[];
    actions?: string[];
  };
  /** Condition expressions */
  conditions: {
    user?: Record<string, any>;
    resource?: Record<string, any>;
    environment?: Record<string, any>;
    time?: {
      start?: string;
      end?: string;
      days?: number[];
      timezone?: string;
    };
  };
  /** Rule metadata */
  metadata: {
    created: Date;
    createdBy: string;
    version: number;
    active: boolean;
  };
}

/**
 * Access audit log entry
 */
export interface AccessAuditLog {
  /** Log entry ID */
  id: string;
  /** User ID */
  userId: string;
  /** Resource ID */
  resourceId: string;
  /** Action attempted */
  action: string;
  /** Decision result */
  decision: PermissionDecision;
  /** Access context at time of request */
  context: AccessContext;
  /** Matched policy rules */
  matchedRules: string[];
  /** Additional metadata */
  metadata: Record<string, any>;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Service configuration
 */
export interface DynamicAccessControlConfig {
  /** Redis configuration */
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  /** Cache settings */
  cache: {
    defaultTtl: number;
    maxSize: number;
    keyPrefix: string;
  };
  /** Security settings */
  security: {
    maxSessionAge: number;
    requireMfaForSensitive: boolean;
    trustPeriodAfterMfa: number;
    maxFailedAttempts: number;
  };
  /** Geolocation service */
  geolocation?: {
    apiKey: string;
    provider: 'maxmind' | 'ipapi';
  };
}

/**
 * Dynamic Access Control Service
 * 
 * Implements attribute-based access control (ABAC) with real-time evaluation
 * based on user context, resource sensitivity, and environmental factors.
 */
export class DynamicAccessControlService {
  private redis: Redis;
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private config: DynamicAccessControlConfig;
  private policyCache = new Map<string, PolicyRule[]>();
  private lastPolicyUpdate = new Date();

  constructor(config: DynamicAccessControlConfig) {
    this.config = config;
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    // Initialize policy cache refresh
    this.initializePolicyRefresh();
  }

  /**
   * Evaluate access permission for a user and resource
   */
  async evaluateAccess(
    user: User,
    resourceId: string,
    action: string,
    additionalContext?: Partial<AccessContext>
  ): Promise<PermissionDecision> {
    try {
      // Check cache first
      const cacheKey = this.buildCacheKey(user.id, resourceId, action);
      const cachedDecision = await this.getCachedDecision(cacheKey);
      
      if (cachedDecision && this.isCacheValid(cachedDecision)) {
        await this.logAccess(user.id, resourceId, action, cachedDecision, 'cached');
        return cachedDecision;
      }

      // Collect full access context
      const context = await this.collectAccessContext(user, additionalContext);
      
      // Get resource attributes
      const resourceAttributes = await this.getResourceAttributes(resourceId);
      
      // Evaluate policies
      const decision = await this.evaluatePolicies(
        context,
        resourceAttributes,
        action
      );

      // Cache the decision
      await this.cacheDecision(cacheKey, decision);

      // Log the access attempt
      await this.logAccess(user.id, resourceId, action, decision, 'evaluated', {
        context,
        resourceAttributes
      });

      return decision;

    } catch (error) {
      console.error('[DynamicAccessControl] Evaluation error:', error);
      
      // Fail-safe decision
      const failSafeDecision: PermissionDecision = {
        granted: false,
        reason: 'System error during access evaluation',
        confidence: 0,
        timestamp: new Date(),
        ttl: 60, // Short cache for errors
      };

      await this.logAccess(user.id, resourceId, action, failSafeDecision, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return failSafeDecision;
    }
  }

  /**
   * Bulk evaluate access for multiple resources
   */
  async evaluateBulkAccess(
    user: User,
    requests: Array<{ resourceId: string; action: string }>,
    additionalContext?: Partial<AccessContext>
  ): Promise<Record<string, PermissionDecision>> {
    const results: Record<string, PermissionDecision> = {};
    const context = await this.collectAccessContext(user, additionalContext);

    // Process requests in parallel with concurrency limit
    const concurrency = 10;
    const chunks = this.chunkArray(requests, concurrency);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (request) => {
        const key = `${request.resourceId}:${request.action}`;
        results[key] = await this.evaluateAccess(
          user,
          request.resourceId,
          request.action,
          { ...additionalContext, ...context }
        );
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * Invalidate cached permissions for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `${this.config.cache.keyPrefix}:${userId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      console.log(`[DynamicAccessControl] Invalidated ${keys.length} cached permissions for user ${userId}`);
    } catch (error) {
      console.error('[DynamicAccessControl] Cache invalidation error:', error);
    }
  }

  /**
   * Invalidate cached permissions for a resource
   */
  async invalidateResourceCache(resourceId: string): Promise<void> {
    try {
      const pattern = `${this.config.cache.keyPrefix}:*:${resourceId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      console.log(`[DynamicAccessControl] Invalidated ${keys.length} cached permissions for resource ${resourceId}`);
    } catch (error) {
      console.error('[DynamicAccessControl] Cache invalidation error:', error);
    }
  }

  /**
   * Update access policies
   */
  async updatePolicies(policies: PolicyRule[]): Promise<void> {
    try {
      // Store policies in database
      const { error } = await this.supabase
        .from('access_policies')
        .upsert(policies.map(policy => ({
          id: policy.id,
          name: policy.name,
          description: policy.description,
          priority: policy.priority,
          effect: policy.effect,
          target: policy.target,
          conditions: policy.conditions,
          metadata: policy.metadata,
          updated_at: new Date().toISOString()
        })));

      if (error) throw error;

      // Update local cache
      this.policyCache.clear();
      this.lastPolicyUpdate = new Date();

      // Invalidate all cached decisions
      await this.invalidateAllCache();

      console.log(`[DynamicAccessControl] Updated ${policies.length} policies`);
    } catch (error) {
      console.error('[DynamicAccessControl] Policy update error:', error);
      throw new Error('Failed to update access policies');
    }
  }

  /**
   * Get access audit logs
   */
  async getAccessLogs(
    filters: {
      userId?: string;
      resourceId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      granted?: boolean;
    },
    pagination: { offset: number; limit: number }
  ): Promise<{ logs: AccessAuditLog[]; total: number }> {
    try {
      let query = this.supabase
        .from('access_audit_logs')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.resourceId) {
        query = query.eq('resource_id', filters.resourceId);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }
      if (filters.granted !== undefined) {
        query = query.eq('decision->>granted', filters.granted);
      }

      // Apply pagination and ordering
      query = query
        .order('timestamp', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      const logs: AccessAuditLog[] = (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        resourceId: row.resource_id,
        action: row.action,
        decision: row.decision,
        context: row.context,
        matchedRules: row.matched_rules || [],
        metadata: row.metadata || {},
        timestamp: new Date(row.timestamp)
      }));

      return { logs, total: count || 0 };
    } catch (error) {
      console.error('[DynamicAccessControl] Audit log retrieval error:', error);
      throw new Error('Failed to retrieve access logs');
    }
  }

  /**
   * Collect comprehensive access context
   */
  private async collectAccessContext(
    user: User,
    additionalContext?: Partial<AccessContext>
  ): Promise<AccessContext> {
    try {
      const now = new Date();
      
      // Get user attributes and permissions
      const { data: userProfile } = await this.supabase
        .from('user_profiles')
        .select('role, attributes, permissions, groups')
        .eq('user_id', user.id)
        .single();

      // Collect environmental context
      const environmentContext = {
        timestamp: now,
        location: additionalContext?.environment?.location,
        device: additionalContext?.environment?.device || {
          type: 'desktop' as const,
          trusted: false,
          fingerprint: 'unknown'
        },
        network: additionalContext?.environment?.network || {
          ip: '0.0.0.0',
          type: 'external' as const,
          riskScore: 0.5
        }
      };

      // Get session information
      const sessionContext = {
        id: additionalContext?.session?.id || `session_${user.id}_${now.getTime()}`,
        startTime: additionalContext?.session?.startTime || now,
        lastActivity: additionalContext?.session?.lastActivity || now,
        mfaVerified: additionalContext?.session?.mfaVerified || false,
        freshLogin: additionalContext?.session?.freshLogin || false
      };

      return {
        user: {
          id: user.id,
          role: userProfile?.role || 'user',
          attributes: userProfile?.attributes || {},
          permissions: userProfile?.permissions || [],
          groups: userProfile?.groups || []
        },
        environment: environmentContext,
        session: sessionContext
      };
    } catch (error) {
      console.error('[DynamicAccessControl] Context collection error:', error);
      
      // Return minimal context
      return {
        user: {
          id: user.id,
          role: 'user',
          attributes: {},
          permissions: [],
          groups: []
        },
        environment: {
          timestamp: new Date(),
          device: {
            type: 'desktop',
            trusted: false,
            fingerprint: 'unknown'
          },
          network: {
            ip: '0.0.0.0',
            type: 'external',
            riskScore: 0.5
          }
        },
        session: {
          id: `session_${user.id}`,
          startTime: new Date(),
          lastActivity: new Date(),
          mfaVerified: false,
          freshLogin: false
        }
      };
    }
  }

  /**
   * Get resource attributes
   */
  private async getResourceAttributes(resourceId: string): Promise<ResourceAttributes> {
    try {
      const { data, error } = await this.supabase
        .from('resources')
        .select('*')
        .eq('id', resourceId)
        .single();

      if (error || !data) {
        throw new Error(`Resource ${resourceId} not found`);
      }

      return {
        id: data.id,
        type: data.type,
        sensitivity: data.sensitivity || 'internal',
        owner: {
          id: data.owner_id,
          type: data.owner_type || 'user'
        },
        metadata: {
          created: new Date(data.created_at),
          modified: new Date(data.updated_at),
          tags: data.tags || [],
          classification: data.classification || {}
        },
        patterns: {
          lastAccessed: data.last_accessed ? new Date(data.last_accessed) : undefined,
          accessCount: data.access_count || 0,
          accessFrequency: data.access_frequency || 0
        }
      };
    } catch (error) {
      console.error('[DynamicAccessControl] Resource attributes error:', error);
      
      // Return default attributes
      return {
        id: resourceId,
        type: 'unknown',
        sensitivity: 'restricted',
        owner: { id: 'unknown', type: 'user' },
        metadata: {
          created: new Date(),
          modified: new Date(),
          tags: [],
          classification: {}
        },
        patterns: {
          accessCount: 0,
          accessFrequency: 0
        }
      };
    }
  }

  /**
   * Evaluate policies against context and resource
   */
  private async evaluatePolicies(
    context: AccessContext,
    resource: ResourceAttributes,
    action: string
  ): Promise<PermissionDecision> {
    try {
      // Get applicable policies
      const policies = await this.getApplicablePolicies(context, resource, action);
      
      if (policies.length === 0) {
        return {
          granted: false,
          reason: 'No applicable policies found',
          confidence: 1,
          timestamp: new Date(),
          ttl: this.config.cache.defaultTtl
        };
      }

      // Sort by priority (higher priority first)
      policies.sort((a, b) => b.priority - a.priority);

      const matchedRules: string[] = [];
      let decision: PermissionDecision | null = null;

      // Evaluate each policy
      for (const policy of policies) {
        const matches = await this.evaluatePolicy(policy, context, resource, action);
        
        if (matches) {
          matchedRules.push(policy.id);
          
          // First matching policy determines the decision
          if (!decision) {
            decision = {
              granted: policy.effect === 'allow',
              reason: policy.effect === 'allow' 
                ? `Access granted by policy: ${policy.name}`
                : `Access denied by policy: ${policy.name}`,
              confidence: this.calculateConfidence(policy, context, resource),
              timestamp: new Date(),
              ttl: this.calculateTtl(policy, context, resource),
              conditions: this.extractConditions(policy)
            };
          }

          // Deny policies override allow policies
          if (policy.effect === 'deny') {
            decision.granted = false;
            decision.reason = `Access denied by policy: ${policy.name}`;
            break;
          }
        }
      }

      // Default deny if no policies matched
      if (!decision) {
        decision = {
          granted: false,
          reason: 'No matching policies found - default deny',
          confidence: 1,
          timestamp: new Date(),
          ttl: this.config.cache.defaultTtl
        };
      }

      return decision;
    } catch (error) {
      console.error('[DynamicAccessControl] Policy evaluation error:', error);
      
      return {
        granted: false,
        reason: 'Error during policy evaluation',
        confidence: 0,
        timestamp: new Date(),
        ttl: 60
      };
    }
  }

  /**
   * Get applicable policies for the current context
   */
  private async getApplicablePolicies(
    context: AccessContext,
    resource: ResourceAttributes,
    action: string
  ): Promise<PolicyRule[]> {
    // Try cache first
    const cacheKey = 'policies';
    let policies = this.policyCache.get(cacheKey);

    if (!policies) {
      // Load from database
      const { data, error } = await this.supabase
        .from('access_policies')
        .select('*')
        .eq('metadata->>active', true);

      if (error) {
        console.error('[DynamicAccessControl] Policy loading error:', error);
        return [];
      }

      policies = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        priority: row.priority,
        effect: row.effect,
        target: row.target,
        conditions: row.conditions,
        metadata: {
          created: new Date(row.created_at),
          createdBy: row.created_by,
          version: row.version,
          active: row.metadata?.active || true
        }
      }));

      this.policyCache.set(cacheKey, policies);
    }

    // Filter applicable policies
    return policies.filter(policy => {
      // Check target matching
      const target = policy.target;
      
      if (target.users && !target.users.includes(context.user.id)) {
        return false;
      }
      
      if (target.roles && !target.roles.includes(context.user.role)) {
        return false;
      }
      
      if (target.resources && !target.resources.includes(resource.id) && 
          !target.resources.includes(resource.type)) {
        return false;
      }
      
      if (target.actions && !target.actions.includes(action)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Evaluate individual policy against context
   */
  private async evaluatePolicy(
    policy: PolicyRule,
    context: AccessContext,
    resource: ResourceAttributes,
    action: string
  ): Promise<boolean> {
    try {
      // Evaluate user conditions
      if (policy.conditions.user) {
        if (!this.evaluateObjectConditions(policy.conditions.user, context.user)) {
          return false;
        }
      }

      // Evaluate resource conditions
      if (policy.conditions.resource) {
        if (!this.evaluateObjectConditions(policy.conditions.resource, resource)) {
          return false;
        }
      }

      // Evaluate environment conditions
      if (policy.conditions.environment) {
        if (!this.evaluateObjectConditions(policy.conditions.environment, context.environment)) {
          return false;
        }
      }

      // Evaluate time conditions
      if (policy.conditions.time) {
        if (!this.evaluateTimeConditions(policy.conditions.time, context.environment.timestamp)) {
          return false;
        }
      }

      // Additional security checks for sensitive resources
      if (resource.sensitivity === 'restricted' || resource.sensitivity === 'confidential') {
        if (this.config.security.requireMfaForSensitive && !context.session.m