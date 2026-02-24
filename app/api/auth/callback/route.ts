// app/api/auth/callback/route.ts (modified section for welcome email)
// ═══════════════════════════════════════════════════════════════════════════════
// AUTH CALLBACK WITH WELCOME EMAIL TRIGGER
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:34 PM EST
// Sends welcome email on first-time user signup
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }

  try {
    // Exchange code for session
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (authError || !authData.user) {
      console.error('Auth error:', authError);
      return NextResponse.redirect(new URL('/auth/error', request.url));
    }

    const user = authData.user;

    // Check if this is a new user (first sign-in)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, welcome_email_sent')
      .eq('id', user.id)
      .single();

    // If new user or welcome email not sent, send it
    if (!existingUser || !existingUser.welcome_email_sent) {
      // Send welcome email
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/user-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'welcome',
            to: user.email,
            data: {
              name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'there'
            }
          })
        });

        // Mark welcome email as sent
        await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            welcome_email_sent: true,
            created_at: new Date().toISOString()
          }, { onConflict: 'id' });

        console.log(`Welcome email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the auth flow for email errors
      }

      // Initialize credits for new user (50 free credits)
      await supabase
        .from('user_credits')
        .upsert({
          user_id: user.id,
          balance: 50,
          lifetime_earned: 50,
          subscription_tier: 'free',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    }

    // Redirect to dashboard or specified next URL
    return NextResponse.redirect(new URL(next, request.url));

  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }
}
