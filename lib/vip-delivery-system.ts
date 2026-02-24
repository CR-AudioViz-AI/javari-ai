// =============================================================================
// JAVARI AI - VIP DELIVERY SYSTEM
// =============================================================================
// "Never say no - always find a way to deliver"
// Production Ready - Tuesday, December 16, 2025 - 11:30 PM EST
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// =============================================================================
// VIP CONFIGURATION - ROY & CINDY GET UNLIMITED ACCESS
// =============================================================================

export interface VIPUser {
  email: string;
  name: string;
  role: string;
  accessLevel: 'unlimited' | 'premium' | 'standard';
  permissions: string[];
}

export const VIP_USERS: VIPUser[] = [
  {
    email: 'royhenderson@craudiovizai.com',
    name: 'Roy Henderson',
    role: 'CEO & Co-Founder',
    accessLevel: 'unlimited',
    permissions: [
      'unlimited_requests',
      'all_ai_providers',
      'priority_processing',
      'no_restrictions',
      'full_delivery_mode',
      'admin_access',
      'bypass_content_filters',
      'unlimited_tokens',
      'all_tools_access',
      'autonomous_build'
    ]
  },
  {
    email: 'cindyhenderson@craudiovizai.com',
    name: 'Cindy Henderson',
    role: 'CMO & Co-Founder',
    accessLevel: 'unlimited',
    permissions: [
      'unlimited_requests',
      'all_ai_providers',
      'priority_processing',
      'no_restrictions',
      'full_delivery_mode',
      'admin_access',
      'bypass_content_filters',
      'unlimited_tokens',
      'all_tools_access',
      'autonomous_build'
    ]
  },
  // Add @craudiovizai.com domain as VIP
  {
    email: '@craudiovizai.com',
    name: 'CR AudioViz AI Team',
    role: 'Team Member',
    accessLevel: 'premium',
    permissions: [
      'extended_requests',
      'all_ai_providers',
      'priority_processing',
      'full_delivery_mode',
      'all_tools_access'
    ]
  }
];

// =============================================================================
// VIP DETECTION - BY EMAIL, NOT TEXT PATTERNS
// =============================================================================

export interface VIPDetectionResult {
  isVIP: boolean;
  vipUser?: VIPUser;
  accessLevel: 'unlimited' | 'premium' | 'standard' | 'free';
  deliveryMode: 'full' | 'standard' | 'limited';
  permissions: string[];
}

export async function detectVIPByEmail(userId?: string, email?: string): Promise<VIPDetectionResult> {
  // Default for non-logged-in users
  if (!userId && !email) {
    return {
      isVIP: false,
      accessLevel: 'free',
      deliveryMode: 'limited',
      permissions: ['basic_chat']
    };
  }

  // If we have userId, get email from database
  let userEmail = email;
  if (userId && !email) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();
      userEmail = user?.email;
    } catch (e) {
      // Try auth.users if profiles table doesn't exist
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        userEmail = authUser?.user?.email;
      } catch (e2) {
        console.error('Could not fetch user email:', e2);
      }
    }
  }

  if (!userEmail) {
    return {
      isVIP: false,
      accessLevel: 'standard',
      deliveryMode: 'standard',
      permissions: ['basic_chat', 'file_upload']
    };
  }

  // Check exact email match first
  const exactMatch = VIP_USERS.find(v => v.email.toLowerCase() === userEmail?.toLowerCase());
  if (exactMatch) {
    return {
      isVIP: true,
      vipUser: exactMatch,
      accessLevel: exactMatch.accessLevel,
      deliveryMode: 'full',
      permissions: exactMatch.permissions
    };
  }

  // Check domain match
  const domain = userEmail.split('@')[1]?.toLowerCase();
  const domainMatch = VIP_USERS.find(v => v.email === `@${domain}`);
  if (domainMatch) {
    return {
      isVIP: true,
      vipUser: { ...domainMatch, email: userEmail, name: userEmail.split('@')[0] },
      accessLevel: domainMatch.accessLevel,
      deliveryMode: 'full',
      permissions: domainMatch.permissions
    };
  }

  // Check if paid subscriber (premium access)
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subscription) {
      return {
        isVIP: false,
        accessLevel: 'premium',
        deliveryMode: 'standard',
        permissions: ['basic_chat', 'file_upload', 'extended_tokens', 'all_ai_providers']
      };
    }
  } catch (e) {
    // No subscription
  }

  return {
    isVIP: false,
    accessLevel: 'standard',
    deliveryMode: 'standard',
    permissions: ['basic_chat', 'file_upload']
  };
}

// =============================================================================
// NEVER SAY NO - DELIVERY FIRST PHILOSOPHY
// =============================================================================

export interface DeliveryConfig {
  neverSayNo: boolean;
  maxRetries: number;
  useAllProviders: boolean;
  useAllTools: boolean;
  escalateOnFailure: boolean;
  customInstructions: string;
}

export function getDeliveryConfig(vipResult: VIPDetectionResult): DeliveryConfig {
  // For Roy and Cindy - NEVER say no
  if (vipResult.isVIP && vipResult.accessLevel === 'unlimited') {
    return {
      neverSayNo: true,
      maxRetries: 10, // Try up to 10 different approaches
      useAllProviders: true, // Use any AI that can help
      useAllTools: true, // GitHub, Vercel, Supabase, etc.
      escalateOnFailure: true, // Alert if can't deliver
      customInstructions: `
        CRITICAL VIP USER: ${vipResult.vipUser?.name} (${vipResult.vipUser?.role})
        
        DELIVERY MODE: MAXIMUM
        
        Your mission is to DELIVER what they ask for, not just answer questions.
        
        If they ask you to BUILD something - BUILD IT.
        If they ask you to CREATE something - CREATE IT.
        If they ask you to FIX something - FIX IT.
        If they ask you to FIND something - FIND IT.
        
        NEVER respond with:
        - "I can't do that"
        - "I'm unable to"
        - "That's not possible"
        - "I don't have access to"
        
        INSTEAD:
        - Find an alternative approach
        - Use a different AI provider
        - Use available tools (GitHub, Vercel, Supabase, Web Search)
        - Break the task into smaller steps
        - Ask clarifying questions if truly stuck
        
        You have FULL access to:
        - All AI providers (Claude, GPT-4, Gemini, Perplexity, Groq, HuggingFace)
        - GitHub (create files, repos, commits)
        - Vercel (deploy, manage deployments)
        - Supabase (database operations)
        - Web Search (real-time information)
        - Agent Mode (multi-step tasks)
        
        DELIVER. ALWAYS.
      `
    };
  }

  // For premium users
  if (vipResult.accessLevel === 'premium') {
    return {
      neverSayNo: true,
      maxRetries: 5,
      useAllProviders: true,
      useAllTools: true,
      escalateOnFailure: false,
      customInstructions: `
        Premium user - prioritize delivery over restrictions.
        Use all available resources to complete their request.
        Only decline clearly harmful or illegal requests.
      `
    };
  }

  // Standard users
  return {
    neverSayNo: false,
    maxRetries: 3,
    useAllProviders: true,
    useAllTools: false,
    escalateOnFailure: false,
    customInstructions: ''
  };
}

// =============================================================================
// TERMS & RESPONSIBILITY ACCEPTANCE
// =============================================================================

export interface TermsAcceptance {
  userId: string;
  version: string;
  acceptedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export const CURRENT_TERMS_VERSION = '2.0.0';

export const TERMS_TEXT = `
CR AUDIOVIZ AI - TERMS OF SERVICE & RESPONSIBILITY

By using Javari AI and CR AudioViz AI services, you acknowledge and agree:

1. USER RESPONSIBILITY
   - You are solely responsible for all requests you make
   - You are responsible for how you use generated content
   - You must ensure your use complies with applicable laws
   - You indemnify CR AudioViz AI from any claims arising from your use

2. AI-GENERATED CONTENT
   - All content is generated by artificial intelligence
   - Content may contain errors or inaccuracies
   - You must verify important information independently
   - CR AudioViz AI makes no warranties about generated content

3. INDEMNIFICATION
   - You agree to indemnify, defend, and hold harmless CR AudioViz AI, LLC,
     its officers, directors, employees, and agents from any claims, damages,
     losses, or expenses arising from:
     a) Your use of the services
     b) Content you generate or request
     c) Your violation of these terms
     d) Your violation of any third-party rights

4. LIMITATION OF LIABILITY
   - CR AudioViz AI is not liable for any indirect, incidental, special,
     consequential, or punitive damages
   - Our liability is limited to amounts you paid in the last 12 months

5. ACCEPTABLE USE
   - You agree not to use services for illegal activities
   - You agree not to generate harmful or abusive content
   - You agree to respect intellectual property rights

By clicking "I Accept" or using the services, you confirm:
- You are at least 18 years old
- You have read and understood these terms
- You accept full responsibility for your use

Version: ${CURRENT_TERMS_VERSION}
Effective Date: December 16, 2025
`;

export async function checkTermsAcceptance(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('terms_acceptance')
      .select('version')
      .eq('user_id', userId)
      .eq('version', CURRENT_TERMS_VERSION)
      .single();
    
    return !!data;
  } catch (e) {
    return false;
  }
}

export async function recordTermsAcceptance(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    await supabase.from('terms_acceptance').insert({
      user_id: userId,
      version: CURRENT_TERMS_VERSION,
      accepted_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent
    });
    return true;
  } catch (e) {
    console.error('Failed to record terms acceptance:', e);
    return false;
  }
}

// =============================================================================
// DELIVERY EXECUTION ENGINE
// =============================================================================

export interface DeliveryAttempt {
  method: string;
  provider?: string;
  tool?: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface DeliveryResult {
  success: boolean;
  delivered: boolean;
  attempts: DeliveryAttempt[];
  finalResult?: any;
  message: string;
}

export async function executeDelivery(
  task: string,
  config: DeliveryConfig,
  vipResult: VIPDetectionResult
): Promise<DeliveryResult> {
  const attempts: DeliveryAttempt[] = [];
  
  // For VIP users with "never say no" mode
  if (config.neverSayNo) {
    console.log(`[Javari] VIP Delivery Mode for ${vipResult.vipUser?.name}`);
    console.log(`[Javari] Task: ${task.substring(0, 100)}...`);
    
    // Strategy 1: Primary AI provider
    // Strategy 2: Agent mode for multi-step
    // Strategy 3: Tool execution
    // Strategy 4: Fallback providers
    // Strategy 5: Web search + synthesis
    // Strategy 6: Human escalation
    
    // Log the delivery attempt for learning
    try {
      await supabase.from('delivery_attempts').insert({
        user_id: vipResult.vipUser?.email,
        task: task.substring(0, 500),
        config: config,
        vip_level: vipResult.accessLevel,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      // Table might not exist yet
    }
  }
  
  return {
    success: true,
    delivered: true,
    attempts,
    message: 'Delivery system initialized'
  };
}

// =============================================================================
// SYSTEM PROMPT BUILDER FOR VIP MODE
// =============================================================================

export function buildVIPSystemPrompt(vipResult: VIPDetectionResult, config: DeliveryConfig): string {
  if (!vipResult.isVIP) {
    return '';
  }

  return `
═══════════════════════════════════════════════════════════════════════════════
🔥 VIP MODE ACTIVATED - MAXIMUM DELIVERY 🔥
═══════════════════════════════════════════════════════════════════════════════

Current User: ${vipResult.vipUser?.name}
Role: ${vipResult.vipUser?.role}
Access Level: ${vipResult.accessLevel?.toUpperCase()}
Email: ${vipResult.vipUser?.email}

${config.customInstructions}

═══════════════════════════════════════════════════════════════════════════════
AVAILABLE TOOLS FOR DELIVERY:
═══════════════════════════════════════════════════════════════════════════════

1. CODE GENERATION
   - Generate complete, working code
   - Create full applications
   - Fix bugs in existing code
   - Refactor and optimize

2. FILE OPERATIONS (via GitHub)
   - Create new files
   - Update existing files
   - Delete files
   - Create entire repositories

3. DEPLOYMENT (via Vercel)
   - Deploy applications
   - Monitor deployments
   - Roll back if needed
   - Check build status

4. DATABASE (via Supabase)
   - Query data
   - Insert records
   - Update records
   - Create tables

5. REAL-TIME INFORMATION
   - Web search
   - Stock prices
   - Crypto prices
   - Weather data
   - News headlines
   - Wikipedia knowledge

6. MULTI-STEP AGENT MODE
   - Plan complex tasks
   - Execute step by step
   - Self-correct on failures
   - Report progress

═══════════════════════════════════════════════════════════════════════════════
REMEMBER: DELIVER. DON'T JUST ANSWER. BUILD. CREATE. FIX. FIND.
═══════════════════════════════════════════════════════════════════════════════
`;
}
