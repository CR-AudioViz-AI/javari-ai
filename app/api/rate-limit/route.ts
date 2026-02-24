// app/api/rate-limit/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - RATE LIMITING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Saturday, December 13, 2025 - 8:45 PM EST
// Version: 1.0 - PROTECT API RESOURCES
//
// Features:
// - Per-user rate limiting
// - Per-endpoint limits
// - Sliding window algorithm
// - Quota management
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitConfig {
  endpoint: string;
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
  firstRequest: number;
}

interface UserQuota {
  userId: string;
  tier: 'free' | 'pro' | 'enterprise' | 'unlimited';
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  tokensPerDay: number;
  currentUsage: {
    minuteRequests: number;
    hourRequests: number;
    dayRequests: number;
    dayTokens: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const RATE_LIMITS: RateLimitConfig[] = [
  // Chat endpoints - more restrictive
  { endpoint: '/api/chat', windowMs: 60000, maxRequests: 30, message: 'Chat rate limit exceeded' },
  { endpoint: '/api/chat/stream', windowMs: 60000, maxRequests: 30, message: 'Streaming rate limit exceeded' },
  
  // Tools - moderate limits
  { endpoint: '/api/tools/execute', windowMs: 60000, maxRequests: 60, message: 'Tools rate limit exceeded' },
  { endpoint: '/api/agent/execute', windowMs: 60000, maxRequests: 10, message: 'Agent rate limit exceeded' },
  
  // Vision/Voice - resource intensive
  { endpoint: '/api/vision/analyze', windowMs: 60000, maxRequests: 20, message: 'Vision rate limit exceeded' },
  { endpoint: '/api/voice/synthesize', windowMs: 60000, maxRequests: 10, message: 'Voice rate limit exceeded' },
  
  // Webhooks - high limits
  { endpoint: '/api/webhooks/github', windowMs: 60000, maxRequests: 100, message: 'GitHub webhook rate limit exceeded' },
  { endpoint: '/api/webhooks/vercel', windowMs: 60000, maxRequests: 100, message: 'Vercel webhook rate limit exceeded' },
  
  // System endpoints - moderate
  { endpoint: '/api/autonomous/heal', windowMs: 60000, maxRequests: 5, message: 'Healing rate limit exceeded' },
  { endpoint: '/api/cron', windowMs: 60000, maxRequests: 20, message: 'Cron rate limit exceeded' },
  
  // Analytics - high limits
  { endpoint: '/api/analytics/dashboard', windowMs: 60000, maxRequests: 60, message: 'Analytics rate limit exceeded' },
  { endpoint: '/api/projects/orchestrate', windowMs: 60000, maxRequests: 30, message: 'Projects rate limit exceeded' },
  
  // Default fallback
  { endpoint: '*', windowMs: 60000, maxRequests: 60, message: 'Rate limit exceeded' }
];

const TIER_QUOTAS: Record<string, Omit<UserQuota, 'userId' | 'currentUsage'>> = {
  free: {
    tier: 'free',
    requestsPerMinute: 20,
    requestsPerHour: 200,
    requestsPerDay: 1000,
    tokensPerDay: 50000
  },
  pro: {
    tier: 'pro',
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    tokensPerDay: 500000
  },
  enterprise: {
    tier: 'enterprise',
    requestsPerMinute: 200,
    requestsPerHour: 5000,
    requestsPerDay: 100000,
    tokensPerDay: 5000000
  },
  unlimited: {
    tier: 'unlimited',
    requestsPerMinute: 999999,
    requestsPerHour: 999999,
    requestsPerDay: 999999,
    tokensPerDay: 999999999
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY RATE LIMIT STORE
// In production, use Redis for distributed rate limiting
// ═══════════════════════════════════════════════════════════════════════════════

const rateLimitStore = new Map<string, RateLimitEntry>();
const userQuotaStore = new Map<string, UserQuota>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from header or query
  const userId = request.headers.get('x-user-id') || 
                 new URL(request.url).searchParams.get('userId');
  if (userId) return `user:${userId}`;
  
  // Fall back to IP address
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';
  return `ip:${ip}`;
}

function getRateLimitConfig(endpoint: string): RateLimitConfig {
  // Find exact match first
  const exact = RATE_LIMITS.find(r => r.endpoint === endpoint);
  if (exact) return exact;
  
  // Find prefix match
  const prefix = RATE_LIMITS.find(r => r.endpoint !== '*' && endpoint.startsWith(r.endpoint));
  if (prefix) return prefix;
  
  // Return default
  return RATE_LIMITS.find(r => r.endpoint === '*')!;
}

function checkRateLimit(
  clientId: string,
  endpoint: string
): { allowed: boolean; remaining: number; resetAt: number; limit: number } {
  const config = getRateLimitConfig(endpoint);
  const key = `${clientId}:${config.endpoint}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    // Create new window
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
      firstRequest: now
    };
    rateLimitStore.set(key, entry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
      limit: config.maxRequests
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit: config.maxRequests
    };
  }
  
  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
    limit: config.maxRequests
  };
}

function getUserQuota(userId: string): UserQuota {
  let quota = userQuotaStore.get(userId);
  
  if (!quota) {
    // Create default quota (free tier)
    quota = {
      userId,
      ...TIER_QUOTAS.free,
      currentUsage: {
        minuteRequests: 0,
        hourRequests: 0,
        dayRequests: 0,
        dayTokens: 0
      }
    };
    userQuotaStore.set(userId, quota);
  }
  
  return quota;
}

function updateUserQuota(userId: string, tokensUsed: number = 0): void {
  const quota = getUserQuota(userId);
  quota.currentUsage.minuteRequests++;
  quota.currentUsage.hourRequests++;
  quota.currentUsage.dayRequests++;
  quota.currentUsage.dayTokens += tokensUsed;
  userQuotaStore.set(userId, quota);
}

function checkUserQuota(userId: string): { allowed: boolean; reason?: string } {
  const quota = getUserQuota(userId);
  
  if (quota.currentUsage.minuteRequests >= quota.requestsPerMinute) {
    return { allowed: false, reason: 'Minute request limit exceeded' };
  }
  if (quota.currentUsage.hourRequests >= quota.requestsPerHour) {
    return { allowed: false, reason: 'Hourly request limit exceeded' };
  }
  if (quota.currentUsage.dayRequests >= quota.requestsPerDay) {
    return { allowed: false, reason: 'Daily request limit exceeded' };
  }
  if (quota.currentUsage.dayTokens >= quota.tokensPerDay) {
    return { allowed: false, reason: 'Daily token limit exceeded' };
  }
  
  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const clientId = searchParams.get('clientId') || getClientIdentifier(request);
  const endpoint = searchParams.get('endpoint');
  
  // Check rate limit for an endpoint
  if (action === 'check' && endpoint) {
    const result = checkRateLimit(clientId, endpoint);
    return NextResponse.json({
      success: true,
      clientId,
      endpoint,
      ...result
    });
  }
  
  // Get user quota
  if (action === 'quota') {
    const userId = searchParams.get('userId') || 'anonymous';
    const quota = getUserQuota(userId);
    const quotaCheck = checkUserQuota(userId);
    
    return NextResponse.json({
      success: true,
      quota: {
        ...quota,
        allowed: quotaCheck.allowed,
        reason: quotaCheck.reason
      }
    });
  }
  
  // Return rate limit configuration
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Rate Limiting',
    version: '1.0',
    endpoints: RATE_LIMITS.map(r => ({
      endpoint: r.endpoint,
      windowMs: r.windowMs,
      maxRequests: r.maxRequests,
      windowDescription: `${r.windowMs / 1000} seconds`
    })),
    tiers: Object.entries(TIER_QUOTAS).map(([name, config]) => ({
      name,
      ...config
    })),
    usage: {
      check: 'GET /api/rate-limit?action=check&endpoint=/api/chat&clientId=user:123',
      quota: 'GET /api/rate-limit?action=quota&userId=123',
      setTier: 'POST /api/rate-limit { "action": "setTier", "userId": "123", "tier": "pro" }'
    },
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, tier, endpoint, tokensUsed } = body;
    
    switch (action) {
      case 'check': {
        const clientId = userId ? `user:${userId}` : getClientIdentifier(request);
        const result = checkRateLimit(clientId, endpoint || '/api/chat');
        return NextResponse.json({
          success: true,
          ...result
        });
      }
      
      case 'setTier': {
        if (!userId || !tier) {
          return NextResponse.json({
            success: false,
            error: 'userId and tier are required'
          }, { status: 400 });
        }
        
        if (!TIER_QUOTAS[tier]) {
          return NextResponse.json({
            success: false,
            error: `Invalid tier. Must be one of: ${Object.keys(TIER_QUOTAS).join(', ')}`
          }, { status: 400 });
        }
        
        const quota = getUserQuota(userId);
        const newQuota: UserQuota = {
          ...quota,
          ...TIER_QUOTAS[tier],
          userId
        };
        userQuotaStore.set(userId, newQuota);
        
        return NextResponse.json({
          success: true,
          message: `User ${userId} upgraded to ${tier} tier`,
          quota: newQuota
        });
      }
      
      case 'recordUsage': {
        if (!userId) {
          return NextResponse.json({
            success: false,
            error: 'userId is required'
          }, { status: 400 });
        }
        
        updateUserQuota(userId, tokensUsed || 0);
        const quota = getUserQuota(userId);
        const quotaCheck = checkUserQuota(userId);
        
        return NextResponse.json({
          success: true,
          quota: {
            ...quota,
            allowed: quotaCheck.allowed,
            reason: quotaCheck.reason
          }
        });
      }
      
      case 'resetQuota': {
        if (!userId) {
          return NextResponse.json({
            success: false,
            error: 'userId is required'
          }, { status: 400 });
        }
        
        const quota = getUserQuota(userId);
        quota.currentUsage = {
          minuteRequests: 0,
          hourRequests: 0,
          dayRequests: 0,
          dayTokens: 0
        };
        userQuotaStore.set(userId, quota);
        
        return NextResponse.json({
          success: true,
          message: `Quota reset for user ${userId}`,
          quota
        });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          availableActions: ['check', 'setTier', 'recordUsage', 'resetQuota']
        }, { status: 400 });
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
