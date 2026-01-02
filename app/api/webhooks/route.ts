// app/api/webhooks/stripe/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 4:42 PM EST

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const PLAN_CREDITS: Record<string, number> = {
  'price_starter': 500,
  'price_pro': 2000,
  'price_business': 10000
}

const PLAN_NAMES: Record<string, string> = {
  'price_starter': 'starter',
  'price_pro': 'pro',
  'price_business': 'business'
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id
  
  // Get customer email
  const customer = await stripe.customers.retrieve(customerId)
  const email = (customer as Stripe.Customer).email
  
  if (!email) return
  
  // Update user in database
  await supabase
    .from('users')
    .update({
      stripe_customer_id: customerId,
      subscription_id: subscription.id,
      subscription_status: 'active',
      subscription_plan: PLAN_NAMES[priceId] || 'starter',
      subscription_start_date: new Date().toISOString(),
      credits: PLAN_CREDITS[priceId] || 500
    })
    .eq('email', email)
  
  // Create alert for new subscriber
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/javari/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      data: {
        type: 'new_subscriber',
        payload: {
          email,
          plan: PLAN_NAMES[priceId]
        },
        source: 'stripe_webhook'
      }
    })
  })
  
  // Send welcome email
  const templateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: 'welcome',
      data: { name: email.split('@')[0], credits: PLAN_CREDITS[priceId] }
    })
  })
  const { subject, html } = await templateResponse.json()
  
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/bots/marketing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send_email',
      data: { to: email, subject, body: html }
    })
  })
  
  console.log(`New subscriber: ${email} - ${PLAN_NAMES[priceId]}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id
  const status = subscription.status
  
  await supabase
    .from('users')
    .update({
      subscription_status: status === 'active' ? 'active' : status,
      subscription_plan: PLAN_NAMES[priceId] || 'starter',
      credits: status === 'active' ? PLAN_CREDITS[priceId] || 500 : 0
    })
    .eq('stripe_customer_id', customerId)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  
  await supabase
    .from('users')
    .update({
      subscription_status: 'cancelled',
      subscription_plan: 'free',
      credits: 50 // Reset to free tier
    })
    .eq('stripe_customer_id', customerId)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const amount = invoice.amount_paid / 100
  
  // Log payment
  await supabase.from('payments').insert({
    stripe_customer_id: customerId,
    stripe_invoice_id: invoice.id,
    amount,
    currency: invoice.currency,
    status: 'succeeded',
    paid_at: new Date().toISOString()
  })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  const customer = await stripe.customers.retrieve(customerId)
  const email = (customer as Stripe.Customer).email
  
  // Create alert
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/javari/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      data: {
        type: 'payment_failure',
        payload: {
          customer: email,
          amount: (invoice.amount_due / 100).toFixed(2)
        },
        source: 'stripe_webhook'
      }
    })
  })
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  
  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
    
    return NextResponse.json({ received: true })
    
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Webhook error' 
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Stripe Webhook Handler',
    version: '1.0.0',
    events: [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed'
    ]
  })
}
