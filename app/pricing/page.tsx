// =============================================================================
// JAVARI AI - PRICING PAGE WITH STRIPE CHECKOUT
// =============================================================================
// Production Ready - Sunday, December 14, 2025
// =============================================================================

'use client';

import { useState } from 'react';
import { 
  Check, Zap, Crown, Building2, Loader2,
  MessageSquare, Brain, Shield, Clock, Sparkles,
  ArrowRight, Star
} from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  highlighted?: boolean;
  badge?: string;
  stripeProductId?: string;
  stripePriceId?: string;
}

const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out Javari',
    price: 0,
    interval: 'month',
    features: [
      '50 AI messages per day',
      'Basic chat interface',
      'GPT-4 access',
      'Standard response time',
      'Community support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For individuals and power users',
    price: 29,
    interval: 'month',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      'Unlimited AI messages',
      'All AI models (Claude, GPT-4, Gemini)',
      'Priority response time',
      'Advanced tools access',
      'Custom prompts & templates',
      'Conversation history',
      'Export & download',
      'Email support'
    ]
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For teams and organizations',
    price: 99,
    interval: 'month',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Admin dashboard',
      'Usage analytics',
      'API access',
      'Custom integrations',
      'SSO authentication',
      'Priority support',
      'SLA guarantee'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large teams',
    price: -1, // Custom pricing
    interval: 'month',
    features: [
      'Everything in Business',
      'Dedicated infrastructure',
      'Custom model fine-tuning',
      'On-premise deployment',
      'Dedicated account manager',
      'Custom contracts',
      '24/7 phone support',
      'Compliance & security audits'
    ]
  }
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  const handleSubscribe = async (plan: PricingPlan) => {
    if (plan.id === 'free') {
      window.location.href = '/auth/signup';
      return;
    }

    if (plan.id === 'enterprise') {
      window.location.href = 'mailto:sales@craudiovizai.com?subject=Enterprise Inquiry';
      return;
    }

    setLoading(plan.id);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.stripePriceId || `price_${plan.id}_${billingInterval}`,
          planId: plan.id,
          interval: billingInterval,
          successUrl: `${window.location.origin}/dashboard?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`
        })
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const getYearlyPrice = (monthlyPrice: number) => {
    const yearlyTotal = monthlyPrice * 12 * 0.8; // 20% discount
    return Math.round(yearlyTotal / 12);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20" />
        <div className="max-w-7xl mx-auto px-4 py-20 relative">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              Simple, transparent pricing
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Start free, upgrade when you need more. All plans include access to our powerful AI assistant.
            </p>

            {/* Billing Toggle */}
            <div className="mt-8 inline-flex items-center gap-4 p-1 bg-gray-800 rounded-full">
              <button
                onClick={() => setBillingInterval('month')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  billingInterval === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('year')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  billingInterval === 'year'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Yearly
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-20 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const displayPrice = billingInterval === 'year' && plan.price > 0
              ? getYearlyPrice(plan.price)
              : plan.price;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl overflow-hidden ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-blue-600/20 to-gray-800/50 border-2 border-blue-500 scale-105 z-10'
                    : 'bg-gray-800/50 border border-gray-700'
                }`}
              >
                {plan.badge && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-bl-lg">
                    {plan.badge}
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    {plan.id === 'free' && <Zap className="w-6 h-6 text-gray-400" />}
                    {plan.id === 'pro' && <Star className="w-6 h-6 text-yellow-400" />}
                    {plan.id === 'business' && <Crown className="w-6 h-6 text-purple-400" />}
                    {plan.id === 'enterprise' && <Building2 className="w-6 h-6 text-blue-400" />}
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  </div>

                  <p className="text-gray-400 text-sm mb-6">{plan.description}</p>

                  <div className="mb-6">
                    {plan.price === -1 ? (
                      <div className="text-3xl font-bold text-white">Custom</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white">${displayPrice}</span>
                        <span className="text-gray-400">/{billingInterval === 'year' ? 'mo' : 'month'}</span>
                      </div>
                    )}
                    {billingInterval === 'year' && plan.price > 0 && (
                      <p className="text-sm text-green-400 mt-1">
                        Billed ${displayPrice * 12}/year
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={loading === plan.id}
                    className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                      plan.highlighted
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : plan.id === 'enterprise'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    {loading === plan.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {plan.id === 'free' && 'Get Started Free'}
                        {plan.id === 'pro' && 'Start Pro Trial'}
                        {plan.id === 'business' && 'Start Business Trial'}
                        {plan.id === 'enterprise' && 'Contact Sales'}
                        {plan.id !== 'free' && plan.id !== 'enterprise' && (
                          <ArrowRight className="w-4 h-4" />
                        )}
                      </>
                    )}
                  </button>
                </div>

                <div className="px-6 pb-6">
                  <div className="border-t border-gray-700 pt-6">
                    <p className="text-sm font-medium text-gray-300 mb-4">What's included:</p>
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-400">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Why Choose Javari?</h2>
          <p className="text-gray-400">Powerful features to supercharge your productivity</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={Brain}
            title="Multiple AI Models"
            description="Access Claude, GPT-4, Gemini and more from one interface"
          />
          <FeatureCard
            icon={MessageSquare}
            title="Smart Conversations"
            description="Context-aware chat with memory and follow-up capabilities"
          />
          <FeatureCard
            icon={Shield}
            title="Enterprise Security"
            description="SOC 2 compliant with end-to-end encryption"
          />
          <FeatureCard
            icon={Clock}
            title="Fast Response"
            description="Sub-second response times with priority queuing"
          />
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <FAQItem
            question="Can I change plans at any time?"
            answer="Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate your billing accordingly."
          />
          <FAQItem
            question="What payment methods do you accept?"
            answer="We accept all major credit cards (Visa, Mastercard, American Express) and PayPal. Enterprise customers can also pay via invoice."
          />
          <FAQItem
            question="Is there a free trial?"
            answer="Yes! Pro and Business plans include a 14-day free trial. No credit card required to start."
          />
          <FAQItem
            question="What happens if I exceed my message limit?"
            answer="Free plan users will need to wait until the next day or upgrade. Paid plans have unlimited messages."
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700">
      <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-medium text-white">{question}</span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-gray-400 text-sm">
          {answer}
        </div>
      )}
    </div>
  );
}
