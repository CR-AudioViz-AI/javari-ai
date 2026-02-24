// app/settings/plans/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Check, CreditCard, Zap, Star, Crown } from 'lucide-react'

interface Credits {
  remaining: number
  total: number
  used: number
  usage_percentage: number
  plan_type: string
  plan_badge: string
  credits_per_month: number
  renewal_date: string | null
  never_expires: boolean
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    credits: '1,000 credits/month',
    icon: Zap,
    features: [
      'Basic AI assistance',
      '1,000 credits monthly',
      'Community support',
      'Basic analytics',
      'Email support',
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/month',
    credits: '10,000 credits/month',
    icon: Star,
    features: [
      'Everything in Free',
      '10,000 credits monthly',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
      'API access',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$99',
    period: '/month',
    credits: '50,000 credits/month',
    icon: Crown,
    features: [
      'Everything in Pro',
      '50,000 credits monthly',
      'Dedicated support',
      'Team collaboration',
      'Custom models',
      'White-label options',
      'SLA guarantee',
    ],
    cta: 'Upgrade to Business',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    credits: '200,000+ credits/month',
    icon: Crown,
    features: [
      'Everything in Business',
      'Unlimited credits',
      'On-premise deployment',
      'Custom training',
      'Dedicated account manager',
      '24/7 phone support',
      'Custom SLA',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
]

export default function PlansSettingsPage() {
  const [credits, setCredits] = useState<Credits | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCredits() {
      try {
        const res = await fetch('/api/user/credits')
        if (res.ok) {
          const data = await res.json()
          setCredits(data.credits)
        }
      } catch (error: unknown) {
        console.error('Error loading credits:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCredits()
  }, [])

  function handleUpgrade(planId: string) {
    // TODO: Implement Stripe checkout
    window.location.href = `/checkout?plan=${planId}`
  }

  function handleContactSales() {
    window.location.href = 'mailto:sales@craudiovizai.com?subject=Enterprise%20Plan%20Inquiry'
  }

  if (loading) {
    return (
      <div className="container max-w-7xl py-8">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Plans & Billing</h1>
            <p className="text-muted-foreground">
              Manage your subscription and payment methods
            </p>
          </div>
        </div>
      </div>

      {/* Current Plan Card */}
      {credits && (
        <Card className="mb-8 border-primary/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current Plan: {credits.plan_badge}</CardTitle>
                <CardDescription>
                  {credits.never_expires 
                    ? 'Your credits renew monthly' 
                    : 'Free plan with 1,000 credits per month'}
                </CardDescription>
              </div>
              <Badge variant="default" className="text-lg px-4 py-2">
                {credits.plan_badge}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Credits Remaining</p>
                <p className="text-2xl font-bold">{credits.remaining.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Credits Used</p>
                <p className="text-2xl font-bold">{credits.used.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Usage</p>
                <p className="text-2xl font-bold">{credits.usage_percentage}%</p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${credits.usage_percentage}%` }}
                />
              </div>
            </div>

            {credits.renewal_date && (
              <p className="text-sm text-muted-foreground mt-4">
                Credits renew on {new Date(credits.renewal_date).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const Icon = plan.icon
          const isCurrentPlan = credits?.plan_type === plan.id
          
          return (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''} ${isCurrentPlan ? 'border-2 border-primary' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">
                  Most Popular
                </Badge>
              )}
              {isCurrentPlan && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="secondary">
                  Current Plan
                </Badge>
              )}
              
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.credits}</CardDescription>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground ml-2">{plan.period}</span>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  disabled={isCurrentPlan}
                  onClick={() => {
                    if (plan.id === 'enterprise') {
                      handleContactSales()
                    } else {
                      handleUpgrade(plan.id)
                    }
                  }}
                >
                  {isCurrentPlan ? 'Current Plan' : plan.cta}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* FAQ Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">What are credits?</h4>
            <p className="text-sm text-muted-foreground">
              Credits are used to access Javari AI's features. Each action (like chat messages, code generation, etc.) costs a certain number of credits.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Do credits expire?</h4>
            <p className="text-sm text-muted-foreground">
              Free plan credits reset monthly. Paid plan credits never expire - they roll over month to month!
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Can I change plans anytime?</h4>
            <p className="text-sm text-muted-foreground">
              Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">What payment methods do you accept?</h4>
            <p className="text-sm text-muted-foreground">
              We accept all major credit cards, PayPal, and ACH transfers for Enterprise plans.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
