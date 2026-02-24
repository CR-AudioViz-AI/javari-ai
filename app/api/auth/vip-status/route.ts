// =============================================================================
// VIP STATUS API - DETECT ROY & CINDY BY EMAIL
// =============================================================================
// Tuesday, December 16, 2025 - 11:50 PM EST
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// =============================================================================
// VIP CONFIGURATION
// =============================================================================

interface VIPUser {
  email: string;
  name: string;
  role: string;
  accessLevel: 'unlimited' | 'premium' | 'standard';
}

const VIP_USERS: VIPUser[] = [
  {
    email: 'royhenderson@craudiovizai.com',
    name: 'Roy Henderson',
    role: 'CEO & Co-Founder',
    accessLevel: 'unlimited'
  },
  {
    email: 'cindyhenderson@craudiovizai.com',
    name: 'Cindy Henderson',
    role: 'CMO & Co-Founder',
    accessLevel: 'unlimited'
  }
];

// Domain-based VIP (all @craudiovizai.com emails)
const VIP_DOMAINS = ['craudiovizai.com'];

// =============================================================================
// GET - Check VIP Status
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get the user's session
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    
    // Try to get user from Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || accessToken;

    if (!token) {
      return NextResponse.json({
        isVIP: false,
        accessLevel: 'free',
        message: 'Not logged in'
      });
    }

    // Get user from Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user?.email) {
      // Try alternative: check session
      const { data: session } = await supabase.auth.getSession();
      const email = session?.session?.user?.email;
      
      if (!email) {
        return NextResponse.json({
          isVIP: false,
          accessLevel: 'standard',
          message: 'User session not found'
        });
      }
      
      return checkVIPStatus(email);
    }

    return checkVIPStatus(user.email);

  } catch (error) {
    console.error('[VIP Status] Error:', error);
    return NextResponse.json({
      isVIP: false,
      accessLevel: 'standard',
      error: 'Failed to check VIP status'
    });
  }
}

// =============================================================================
// VIP CHECK LOGIC
// =============================================================================

function checkVIPStatus(email: string) {
  const emailLower = email.toLowerCase();

  // Check exact match first
  const exactMatch = VIP_USERS.find(v => v.email.toLowerCase() === emailLower);
  if (exactMatch) {
    console.log(`[VIP Status] ✅ VIP DETECTED: ${exactMatch.name} (${exactMatch.role})`);
    return NextResponse.json({
      isVIP: true,
      name: exactMatch.name,
      role: exactMatch.role,
      accessLevel: exactMatch.accessLevel,
      permissions: [
        'unlimited_requests',
        'all_ai_providers',
        'priority_processing',
        'full_delivery_mode',
        'autonomous_build',
        'all_tools_access'
      ],
      message: `Welcome back, ${exactMatch.name}! Full delivery mode activated.`
    });
  }

  // Check domain match
  const domain = emailLower.split('@')[1];
  if (VIP_DOMAINS.includes(domain)) {
    const userName = email.split('@')[0].replace(/[._]/g, ' ');
    console.log(`[VIP Status] ✅ VIP Domain Match: ${email}`);
    return NextResponse.json({
      isVIP: true,
      name: userName,
      role: 'Team Member',
      accessLevel: 'premium',
      permissions: [
        'extended_requests',
        'all_ai_providers',
        'priority_processing',
        'full_delivery_mode'
      ],
      message: `Welcome, ${userName}! Team access enabled.`
    });
  }

  // Standard user
  console.log(`[VIP Status] Standard user: ${email}`);
  return NextResponse.json({
    isVIP: false,
    accessLevel: 'standard',
    email: email
  });
}

// =============================================================================
// POST - Manual VIP Check (for testing)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    return checkVIPStatus(email);

  } catch (error) {
    console.error('[VIP Status] POST Error:', error);
    return NextResponse.json({
      error: 'Failed to check VIP status'
    }, { status: 500 });
  }
}
