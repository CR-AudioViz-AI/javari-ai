import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });
const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CREDITS_BY_PLAN = {
  creator: 1000,
  pro: 5000
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan as 'creator' | 'pro';
        
        if (userId && plan) {
          // Get customer email
          const customer = await stripe.customers.retrieve(customerId);
          const email = (customer as Stripe.Customer).email;
          const name = (customer as Stripe.Customer).name || 'Valued Customer';
          
          // Add credits
          const credits = CREDITS_BY_PLAN[plan] || 1000;
          await supabase.from('profiles').update({
            credits: supabase.rpc('increment_credits', { amount: credits }),
            subscription_tier: plan,
            subscription_status: 'active'
          }).eq('id', userId);
          
          // Create subscription record
          await supabase.from('subscriptions').insert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: session.subscription as string,
            plan_type: plan,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          });
          
          // Send welcome email
          if (email) {
            await resend.emails.send({
              from: 'Javari Library <library@craudiovizai.com>',
              to: email,
              subject: '🎊 Welcome to Javari Library Premium!',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #059669;">Welcome to Premium!</h1>
                  <p>Hi ${name},</p>
                  <p>Congratulations! You now have full access to:</p>
                  <ul>
                    <li>✅ <strong>301 Professional eBooks</strong></li>
                    <li>✅ <strong>${credits.toLocaleString()} Credits Added</strong></li>
                    <li>✅ <strong>Audiobook Conversions</strong></li>
                    <li>✅ <strong>Priority Support</strong></li>
                  </ul>
                  <p><a href="https://craudiovizai.com/apps/javari-library" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Explore Your Library →</a></p>
                  <p>Thank you for your support!</p>
                  <p>The Javari Library Team</p>
                </div>
              `
            });
          }
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Update subscription status
        await supabase.from('subscriptions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId);
        
        // Note: User keeps access until current_period_end (annual protection)
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        await supabase.from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_customer_id', customerId);
        break;
      }
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
