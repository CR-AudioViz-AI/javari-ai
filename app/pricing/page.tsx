'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Sparkles, Zap, Crown, MessageSquare, Code, Brain, Globe } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    description: 'Get started with AI assistance',
    price: 0,
    period: 'forever',
    icon: MessageSquare,
    features: [
      '50 messages per day',
      'Basic AI models',
      'Standard response speed',
      'Community support',
      'Basic chat history',
    ],
    cta: 'Start Free',
    popular: false,
    priceId: null,
  },
  {
    name: 'Pro',
    description: 'For power users and professionals',
    price: 20,
    period: 'month',
    icon: Zap,
    features: [
      'Unlimited messages',
      'All AI models (GPT-4, Claude, Gemini)',
      'Priority response speed',
      'Advanced code execution',
      'File uploads & analysis',
      'Extended chat history',
      'Priority support',
      'API access',
    ],
    cta: 'Start Pro Trial',
    popular: true,
    priceId: 'price_javari_pro_monthly',
  },
  {
    name: 'Enterprise',
    description: 'For teams and organizations',
    price: 99,
    period: 'month',
    icon: Crown,
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Admin dashboard',
      'Custom AI training',
      'SSO integration',
      'Dedicated support',
      'SLA guarantee',
      'Custom integrations',
      'Audit logs',
    ],
    cta: 'Contact Sales',
    popular: false,
    priceId: 'price_javari_enterprise_monthly',
  },
];

const features = [
  {
    icon: Brain,
    title: 'Multi-Model AI',
    description: 'Access GPT-4, Claude, Gemini, and more - all in one place',
  },
  {
    icon: Code,
    title: 'Code Execution',
    description: 'Run Python, JavaScript, and more directly in chat',
  },
  {
    icon: Globe,
    title: 'Web Integration',
    description: 'Embed Javari AI in your website with one line of code',
  },
  {
    icon: Sparkles,
    title: 'Smart Routing',
    description: 'Automatically selects the best AI model for each task',
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string | null, planName: string) => {
    if (!priceId) {
      window.location.href = '/signup';
      return;
    }

    if (planName === 'Enterprise') {
      window.location.href = 'mailto:enterprise@craudiovizai.com?subject=Enterprise%20Inquiry';
      return;
    }

    setLoading(planName);
    
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const { url, error } = await response.json();
      
      if (error) {
        console.error('Checkout error:', error);
        alert('Unable to start checkout. Please try again.');
        return;
      }

      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image 
                src="/javariailogo.png" 
                alt="Javari AI" 
                width={40} 
                height={40}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-white">Javari AI</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-300 hover:text-white transition">
                Sign In
              </Link>
              <Link 
                href="/signup" 
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Choose the plan that's right for you. All plans include a 7-day free trial.
          </p>

          {/* Annual Toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-sm ${!annual ? 'text-white' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                annual ? 'bg-purple-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  annual ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${annual ? 'text-white' : 'text-gray-400'}`}>
              Annual <span className="text-green-400">(Save 20%)</span>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16 px-4">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const displayPrice = annual && plan.price > 0 
              ? Math.round(plan.price * 0.8) 
              : plan.price;

            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 ${
                  plan.popular
                    ? 'bg-gradient-to-b from-purple-600/30 to-purple-900/30 border-2 border-purple-500 scale-105'
                    : 'bg-white/10 border border-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-purple-500 text-white text-sm font-semibold rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    plan.popular ? 'bg-purple-500' : 'bg-white/10'
                  }`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="text-sm text-gray-400">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">${displayPrice}</span>
                    {plan.price > 0 && (
                      <span className="text-gray-400">/{annual ? 'mo' : plan.period}</span>
                    )}
                  </div>
                  {annual && plan.price > 0 && (
                    <p className="text-sm text-green-400 mt-1">
                      Billed ${displayPrice * 12}/year
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        plan.popular ? 'text-purple-400' : 'text-green-400'
                      }`} />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.priceId, plan.name)}
                  disabled={loading === plan.name}
                  className={`w-full py-3 rounded-lg font-semibold transition ${
                    plan.popular
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === plan.name ? 'Loading...' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Everything You Need
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="text-center">
                  <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {[
              {
                q: 'Can I cancel anytime?',
                a: 'Yes! You can cancel your subscription at any time. Your access continues until the end of your billing period.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, debit cards, and PayPal through our secure payment system.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes! All paid plans include a 7-day free trial. No credit card required to start.',
              },
              {
                q: 'What AI models are included?',
                a: 'Pro and Enterprise plans include access to GPT-4, Claude 3.5, Gemini Pro, and more. We automatically route to the best model for each task.',
              },
            ].map((faq, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-gray-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-500">
            © 2025 CR AudioViz AI, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
