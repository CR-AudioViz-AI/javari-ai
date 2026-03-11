```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import * as cron from 'node-cron';
import rateLimit from '@/lib/rate-limit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface PayoutRule {
  id: string;
  creator_id: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  minimum_threshold: number;
  auto_payout_enabled: boolean;
  next_payout_date: string;
  created_at: string;
  updated_at: string;
}

interface CreatorEarnings {
  creator_id: string;
  total_earnings: number;
  pending_earnings: number;
  last_payout_amount: number;
  last_payout_date: string;
}

interface PayoutHistory {
  id: string;
  creator_id: string;
  amount: number;
  stripe_transfer_id: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

class PayoutScheduler {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.initializeCronJobs();
  }

  private initializeCronJobs(): void {
    // Run daily at 9 AM UTC
    cron.schedule('0 9 * * *', async () => {
      await this.executeScheduledPayouts();
    });
  }

  async executeScheduledPayouts(): Promise<void> {
    try {
      const { data: rules } = await this.supabase
        .from('payout_rules')
        .select('*')
        .eq('auto_payout_enabled', true)
        .lte('next_payout_date', new Date().toISOString());

      if (!rules || rules.length === 0) return;

      for (const rule of rules) {
        await this.processPayoutForCreator(rule);
      }
    } catch (error) {
      console.error('Error executing scheduled payouts:', error);
    }
  }

  private async processPayoutForCreator(rule: PayoutRule): Promise<void> {
    try {
      const earnings = await this.getCreatorEarnings(rule.creator_id);
      
      if (earnings.pending_earnings < rule.minimum_threshold) {
        return;
      }

      const { data: creator } = await this.supabase
        .from('creators')
        .select('stripe_account_id')
        .eq('id', rule.creator_id)
        .single();

      if (!creator?.stripe_account_id) {
        throw new Error('Creator does not have connected Stripe account');
      }

      await this.initiateStripeTransfer(
        creator.stripe_account_id,
        earnings.pending_earnings,
        rule.creator_id
      );

      await this.updateNextPayoutDate(rule);
    } catch (error) {
      console.error(`Error processing payout for creator ${rule.creator_id}:`, error);
    }
  }

  private async getCreatorEarnings(creatorId: string): Promise<CreatorEarnings> {
    const { data } = await this.supabase
      .from('creator_earnings')
      .select('*')
      .eq('creator_id', creatorId)
      .single();

    return data || {
      creator_id: creatorId,
      total_earnings: 0,
      pending_earnings: 0,
      last_payout_amount: 0,
      last_payout_date: null
    };
  }

  private async initiateStripeTransfer(
    stripeAccountId: string,
    amount: number,
    creatorId: string
  ): Promise<void> {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      destination: stripeAccountId,
      metadata: {
        creator_id: creatorId,
        type: 'automated_payout'
      }
    });

    await this.recordPayoutHistory({
      creator_id: creatorId,
      amount,
      stripe_transfer_id: transfer.id,
      status: 'pending'
    });

    // Update creator earnings
    await this.supabase
      .from('creator_earnings')
      .update({
        pending_earnings: 0,
        last_payout_amount: amount,
        last_payout_date: new Date().toISOString()
      })
      .eq('creator_id', creatorId);
  }

  private async recordPayoutHistory(payout: Omit<PayoutHistory, 'id' | 'created_at'>): Promise<void> {
    await this.supabase
      .from('creator_payouts')
      .insert({
        ...payout,
        created_at: new Date().toISOString()
      });
  }

  private async updateNextPayoutDate(rule: PayoutRule): Promise<void> {
    const nextDate = this.calculateNextPayoutDate(rule.frequency, new Date());
    
    await this.supabase
      .from('payout_rules')
      .update({
        next_payout_date: nextDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', rule.id);
  }

  private calculateNextPayoutDate(frequency: string, currentDate: Date): Date {
    const next = new Date(currentDate);
    
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    
    return next;
  }
}

class PayoutThresholdValidator {
  private static readonly MIN_PAYOUT = 10; // $10 minimum
  private static readonly MAX_PAYOUT = 100000; // $100k maximum

  static validate(amount: number): { valid: boolean; error?: string } {
    if (amount < this.MIN_PAYOUT) {
      return { valid: false, error: `Minimum payout amount is $${this.MIN_PAYOUT}` };
    }
    
    if (amount > this.MAX_PAYOUT) {
      return { valid: false, error: `Maximum payout amount is $${this.MAX_PAYOUT}` };
    }
    
    return { valid: true };
  }
}

// Rate limiting
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function GET(request: NextRequest) {
  try {
    await limiter.check(request, 10, 'CACHE_TOKEN');
    
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creator_id') || user.id;

    // Verify creator access
    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('id', creatorId)
      .eq('user_id', user.id)
      .single();

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // Get payout rules
    const { data: rules, error: rulesError } = await supabase
      .from('payout_rules')
      .select('*')
      .eq('creator_id', creatorId);

    if (rulesError) throw rulesError;

    // Get payout history
    const { data: history, error: historyError } = await supabase
      .from('creator_payouts')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (historyError) throw historyError;

    // Get current earnings
    const { data: earnings, error: earningsError } = await supabase
      .from('creator_earnings')
      .select('*')
      .eq('creator_id', creatorId)
      .single();

    if (earningsError && earningsError.code !== 'PGRST116') throw earningsError;

    return NextResponse.json({
      rules: rules || [],
      history: history || [],
      earnings: earnings || {
        total_earnings: 0,
        pending_earnings: 0,
        last_payout_amount: 0,
        last_payout_date: null
      }
    });

  } catch (error: any) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await limiter.check(request, 5, 'CACHE_TOKEN');
    
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'schedule':
        return await handleSchedulePayouts(supabase, user, data);
      case 'execute':
        return await handleExecutePayouts(supabase, user, data);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Error processing payout request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleSchedulePayouts(supabase: any, user: any, data: any) {
  const { creator_id, frequency, minimum_threshold, auto_payout_enabled } = data;

  // Validate input
  if (!frequency || !['weekly', 'biweekly', 'monthly'].includes(frequency)) {
    return NextResponse.json(
      { error: 'Invalid frequency' },
      { status: 400 }
    );
  }

  const thresholdValidation = PayoutThresholdValidator.validate(minimum_threshold);
  if (!thresholdValidation.valid) {
    return NextResponse.json(
      { error: thresholdValidation.error },
      { status: 400 }
    );
  }

  // Verify creator ownership
  const { data: creator } = await supabase
    .from('creators')
    .select('id')
    .eq('id', creator_id)
    .eq('user_id', user.id)
    .single();

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  const scheduler = new PayoutScheduler(supabase);
  const nextPayoutDate = scheduler['calculateNextPayoutDate'](frequency, new Date());

  const { data: rule, error } = await supabase
    .from('payout_rules')
    .upsert({
      creator_id,
      frequency,
      minimum_threshold,
      auto_payout_enabled: auto_payout_enabled || false,
      next_payout_date: nextPayoutDate.toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'creator_id',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({ rule });
}

async function handleExecutePayouts(supabase: any, user: any, data: any) {
  const { creator_id } = data;

  // Verify creator ownership
  const { data: creator } = await supabase
    .from('creators')
    .select('id, stripe_account_id')
    .eq('id', creator_id)
    .eq('user_id', user.id)
    .single();

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  if (!creator.stripe_account_id) {
    return NextResponse.json(
      { error: 'Stripe account not connected' },
      { status: 400 }
    );
  }

  const scheduler = new PayoutScheduler(supabase);
  const earnings = await scheduler['getCreatorEarnings'](creator_id);

  if (earnings.pending_earnings < 10) {
    return NextResponse.json(
      { error: 'Insufficient balance for payout' },
      { status: 400 }
    );
  }

  try {
    await scheduler['initiateStripeTransfer'](
      creator.stripe_account_id,
      earnings.pending_earnings,
      creator_id
    );

    return NextResponse.json({
      message: 'Payout initiated successfully',
      amount: earnings.pending_earnings
    });

  } catch (error: any) {
    console.error('Error initiating manual payout:', error);
    return NextResponse.json(
      { error: 'Failed to initiate payout' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await limiter.check(request, 5, 'CACHE_TOKEN');
    
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, frequency, minimum_threshold, auto_payout_enabled } = body;

    // Validate threshold
    const thresholdValidation = PayoutThresholdValidator.validate(minimum_threshold);
    if (!thresholdValidation.valid) {
      return NextResponse.json(
        { error: thresholdValidation.error },
        { status: 400 }
      );
    }

    // Verify rule ownership through creator
    const { data: rule } = await supabase
      .from('payout_rules')
      .select(`
        id,
        creator_id,
        creators!inner(user_id)
      `)
      .eq('id', id)
      .eq('creators.user_id', user.id)
      .single();

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const { data: updatedRule, error } = await supabase
      .from('payout_rules')
      .update({
        frequency,
        minimum_threshold,
        auto_payout_enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ rule: updatedRule });

  } catch (error: any) {
    console.error('Error updating payout rule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await limiter.check(request, 5, 'CACHE_TOKEN');
    
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    // Verify rule ownership through creator
    const { data: rule } = await supabase
      .from('payout_rules')
      .select(`
        id,
        creators!inner(user_id)
      `)
      .eq('id', ruleId)
      .eq('creators.user_id', user.id)
      .single();

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('payout_rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;

    return NextResponse.json({ message: 'Payout rule deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting payout rule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```