// app/api/features/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - FEATURE FLAGS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Saturday, December 13, 2025 - 8:35 PM EST
// Version: 1.0 - TOGGLE CAPABILITIES
//
// Features:
// - Enable/disable system capabilities
// - User-level feature overrides
// - A/B testing support
// - Gradual rollouts
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'core' | 'ai' | 'integration' | 'experimental' | 'admin';
  rolloutPercentage: number;
  allowedUsers: string[];
  blockedUsers: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_FLAGS: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>[] = [
  // Core Features
  {
    id: 'chat_enabled',
    name: 'Chat Engine',
    description: 'Enable/disable the main chat functionality',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'streaming_enabled',
    name: 'Streaming Responses',
    description: 'Enable real-time streaming of AI responses',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'tools_enabled',
    name: 'Tools Execution',
    description: 'Enable tool execution capabilities',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },

  // AI Features
  {
    id: 'claude_enabled',
    name: 'Claude AI',
    description: 'Enable Anthropic Claude as AI provider',
    enabled: true,
    category: 'ai',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: { model: 'claude-3-5-sonnet-20241022' }
  },
  {
    id: 'gpt4_enabled',
    name: 'GPT-4 Turbo',
    description: 'Enable OpenAI GPT-4 as AI provider',
    enabled: true,
    category: 'ai',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: { model: 'gpt-4-turbo-preview' }
  },
  {
    id: 'gemini_enabled',
    name: 'Google Gemini',
    description: 'Enable Google Gemini as AI provider',
    enabled: true,
    category: 'ai',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: { model: 'gemini-1.5-pro' }
  },
  {
    id: 'perplexity_enabled',
    name: 'Perplexity AI',
    description: 'Enable Perplexity for web search',
    enabled: true,
    category: 'ai',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'vision_enabled',
    name: 'Vision AI',
    description: 'Enable image analysis capabilities',
    enabled: true,
    category: 'ai',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'voice_enabled',
    name: 'Voice Synthesis',
    description: 'Enable ElevenLabs voice synthesis',
    enabled: true,
    category: 'ai',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },

  // Integration Features
  {
    id: 'github_integration',
    name: 'GitHub Integration',
    description: 'Enable GitHub tools and webhooks',
    enabled: true,
    category: 'integration',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'vercel_integration',
    name: 'Vercel Integration',
    description: 'Enable Vercel deployments and webhooks',
    enabled: true,
    category: 'integration',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'email_notifications',
    name: 'Email Notifications',
    description: 'Enable SendGrid email alerts',
    enabled: true,
    category: 'integration',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },

  // Experimental Features
  {
    id: 'agent_mode',
    name: 'Agent Mode',
    description: 'Enable multi-step autonomous task execution',
    enabled: true,
    category: 'experimental',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'self_healing',
    name: 'Self-Healing',
    description: 'Enable automatic deployment issue detection and fixing',
    enabled: true,
    category: 'experimental',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'proactive_intelligence',
    name: 'Proactive Intelligence',
    description: 'Enable proactive suggestions and insights',
    enabled: true,
    category: 'experimental',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'memory_system',
    name: 'Memory System',
    description: 'Enable long-term memory and learning',
    enabled: true,
    category: 'experimental',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },

  // Admin Features
  {
    id: 'admin_dashboard',
    name: 'Admin Dashboard',
    description: 'Enable admin dashboard access',
    enabled: true,
    category: 'admin',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'debug_mode',
    name: 'Debug Mode',
    description: 'Enable verbose logging and debug information',
    enabled: false,
    category: 'admin',
    rolloutPercentage: 0,
    allowedUsers: [],
    blockedUsers: [],
    metadata: {}
  },
  {
    id: 'rate_limiting',
    name: 'Rate Limiting',
    description: 'Enable API rate limiting',
    enabled: true,
    category: 'admin',
    rolloutPercentage: 100,
    allowedUsers: [],
    blockedUsers: [],
    metadata: { requestsPerMinute: 60, requestsPerHour: 1000 }
  }
];

// In-memory cache (in production, use Redis)
let featureCache: Map<string, FeatureFlag> = new Map();
let cacheInitialized = false;

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE FLAG FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function initializeCache(): void {
  if (cacheInitialized) return;
  
  const now = new Date().toISOString();
  for (const flag of DEFAULT_FLAGS) {
    featureCache.set(flag.id, {
      ...flag,
      createdAt: now,
      updatedAt: now
    });
  }
  cacheInitialized = true;
}

function isFeatureEnabled(flagId: string, userId?: string): boolean {
  initializeCache();
  
  const flag = featureCache.get(flagId);
  if (!flag) return false;
  
  // Check if globally disabled
  if (!flag.enabled) return false;
  
  // Check blocked users
  if (userId && flag.blockedUsers.includes(userId)) return false;
  
  // Check allowed users (override rollout)
  if (userId && flag.allowedUsers.includes(userId)) return true;
  
  // Check rollout percentage
  if (flag.rolloutPercentage < 100) {
    // Simple hash-based rollout
    const hash = userId 
      ? userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 100
      : Math.random() * 100;
    return hash < flag.rolloutPercentage;
  }
  
  return true;
}

function updateFlag(flagId: string, updates: Partial<FeatureFlag>): FeatureFlag | null {
  initializeCache();
  
  const flag = featureCache.get(flagId);
  if (!flag) return null;
  
  const updated = {
    ...flag,
    ...updates,
    id: flag.id, // Prevent ID changes
    updatedAt: new Date().toISOString()
  };
  
  featureCache.set(flagId, updated);
  return updated;
}

function getAllFlags(): FeatureFlag[] {
  initializeCache();
  return Array.from(featureCache.values());
}

function getFlag(flagId: string): FeatureFlag | null {
  initializeCache();
  return featureCache.get(flagId) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const flagId = searchParams.get('id');
  const userId = searchParams.get('userId');
  const checkEnabled = searchParams.get('check');
  
  // Check if a specific flag is enabled for a user
  if (checkEnabled && flagId) {
    return NextResponse.json({
      flagId,
      userId: userId || 'anonymous',
      enabled: isFeatureEnabled(flagId, userId || undefined)
    });
  }
  
  // Get specific flag
  if (flagId) {
    const flag = getFlag(flagId);
    if (!flag) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, flag });
  }
  
  // List all flags
  const allFlags = getAllFlags();
  const category = searchParams.get('category');
  
  let filteredFlags = allFlags;
  if (category) {
    filteredFlags = allFlags.filter(f => f.category === category);
  }
  
  // Group by category
  const grouped = {
    core: filteredFlags.filter(f => f.category === 'core'),
    ai: filteredFlags.filter(f => f.category === 'ai'),
    integration: filteredFlags.filter(f => f.category === 'integration'),
    experimental: filteredFlags.filter(f => f.category === 'experimental'),
    admin: filteredFlags.filter(f => f.category === 'admin')
  };
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Feature Flags',
    version: '1.0',
    totalFlags: allFlags.length,
    enabledFlags: allFlags.filter(f => f.enabled).length,
    categories: ['core', 'ai', 'integration', 'experimental', 'admin'],
    flags: filteredFlags,
    grouped,
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, flagId, updates, userId } = body;
    
    switch (action) {
      case 'check': {
        if (!flagId) {
          return NextResponse.json({ error: 'flagId is required' }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          flagId,
          enabled: isFeatureEnabled(flagId, userId)
        });
      }
      
      case 'enable': {
        if (!flagId) {
          return NextResponse.json({ error: 'flagId is required' }, { status: 400 });
        }
        const flag = updateFlag(flagId, { enabled: true });
        if (!flag) {
          return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
        }
        
        // Log the change
        try {
          await supabase.from('audit_logs').insert({
            action: 'feature_flag_enable',
            resource_type: 'feature_flag',
            resource_id: flagId,
            details: { flagId, previousState: false, newState: true },
            created_at: new Date().toISOString()
          });
        } catch (e) { /* ignore */ }
        
        return NextResponse.json({ success: true, flag });
      }
      
      case 'disable': {
        if (!flagId) {
          return NextResponse.json({ error: 'flagId is required' }, { status: 400 });
        }
        const flag = updateFlag(flagId, { enabled: false });
        if (!flag) {
          return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
        }
        
        try {
          await supabase.from('audit_logs').insert({
            action: 'feature_flag_disable',
            resource_type: 'feature_flag',
            resource_id: flagId,
            details: { flagId, previousState: true, newState: false },
            created_at: new Date().toISOString()
          });
        } catch (e) { /* ignore */ }
        
        return NextResponse.json({ success: true, flag });
      }
      
      case 'update': {
        if (!flagId || !updates) {
          return NextResponse.json({ error: 'flagId and updates are required' }, { status: 400 });
        }
        const flag = updateFlag(flagId, updates);
        if (!flag) {
          return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
        }
        
        try {
          await supabase.from('audit_logs').insert({
            action: 'feature_flag_update',
            resource_type: 'feature_flag',
            resource_id: flagId,
            details: { flagId, updates },
            created_at: new Date().toISOString()
          });
        } catch (e) { /* ignore */ }
        
        return NextResponse.json({ success: true, flag });
      }
      
      case 'rollout': {
        if (!flagId || typeof updates?.rolloutPercentage !== 'number') {
          return NextResponse.json({ error: 'flagId and rolloutPercentage are required' }, { status: 400 });
        }
        const percentage = Math.min(100, Math.max(0, updates.rolloutPercentage));
        const flag = updateFlag(flagId, { rolloutPercentage: percentage });
        if (!flag) {
          return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, flag });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          availableActions: ['check', 'enable', 'disable', 'update', 'rollout']
        }, { status: 400 });
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
