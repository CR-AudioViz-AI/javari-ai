/**
 * UNIVERSAL CREDITS SYSTEM API
 * CR AudioViz AI - Henderson Standard
 * 
 * Handles all credit operations across the ecosystem:
 * - Check balance
 * - Deduct credits
 * - Add credits
 * - Transaction history
 * - Refunds
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Credit costs per action (configurable)
const CREDIT_COSTS: Record<string, number> = {
  'ai_chat': 1,
  'ai_image': 5,
  'ai_voice': 3,
  'pdf_generate': 2,
  'invoice_create': 1,
  'ebook_export': 10,
  'logo_design': 5,
  'social_graphic': 2,
  'scrapbook_page': 3,
  'market_analysis': 15,
  'pattern_generate': 5,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action');

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // Get user's current balance
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, credits_balance, subscription_tier')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If action specified, check if user can afford it
    if (action) {
      const cost = CREDIT_COSTS[action] || 1;
      const canAfford = user.credits_balance >= cost;
      
      return NextResponse.json({
        user_id: userId,
        current_balance: user.credits_balance,
        subscription_tier: user.subscription_tier,
        action,
        cost,
        can_afford: canAfford,
        credit_costs: CREDIT_COSTS
      });
    }

    return NextResponse.json({
      user_id: userId,
      current_balance: user.credits_balance,
      subscription_tier: user.subscription_tier,
      credit_costs: CREDIT_COSTS
    });

  } catch (error) {
    console.error('Credits GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, action, amount, operation, app_id, description } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // Get current balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, credits_balance, subscription_tier')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let newBalance = user.credits_balance;
    let transactionType = operation || 'deduct';
    let creditAmount = amount || CREDIT_COSTS[action] || 1;

    switch (transactionType) {
      case 'deduct':
        if (user.credits_balance < creditAmount) {
          return NextResponse.json({
            error: 'Insufficient credits',
            current_balance: user.credits_balance,
            required: creditAmount,
            shortfall: creditAmount - user.credits_balance
          }, { status: 402 });
        }
        newBalance = user.credits_balance - creditAmount;
        break;

      case 'add':
        newBalance = user.credits_balance + creditAmount;
        break;

      case 'refund':
        newBalance = user.credits_balance + creditAmount;
        transactionType = 'refund';
        break;

      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }

    // Update balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        credits_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) {
      throw updateError;
    }

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id,
      amount: creditAmount,
      type: transactionType,
      action: action || description || 'manual',
      app_id: app_id || 'javari',
      balance_before: user.credits_balance,
      balance_after: newBalance,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      user_id,
      operation: transactionType,
      amount: creditAmount,
      previous_balance: user.credits_balance,
      new_balance: newBalance,
      action: action || description
    });

  } catch (error) {
    console.error('Credits POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
