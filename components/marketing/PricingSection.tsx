// components/marketing/PricingSection.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// PRICING SECTION - Jan 1 Launch Ready
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:52 PM EST
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, Crown, Building2, X } from 'lucide-react';
import Link from 'next/link';

const PLANS = [
  {
    name: 'Free',
    icon: Sparkles,
    price: { monthly: 0, yearly: 0 },
    credits: 50,
    creditsExpire: true,
    description: 'Perfect for trying out the platform',
    features: [
      'Access to all creative tools',
      'Javari AI assistant',
      '50 credits/month',
      'Community support',
      'Basic templates'
    ],
    notIncluded: [
      'Credits roll over',
      'Priority support',
      'Advanced features'
    ],
    cta: 'Get Started',
    popular: false,
    gradient: 'from-gray-600 to-gray-700'
  },
  {
    name: 'Starter',
    icon: Zap,
    price: { monthly: 9, yearly: 90 },
    credits: 500,
    creditsExpire: false,
    description: 'For individuals getting serious',
    features: [
      'Everything in Free',
      '500 credits/month',
      'Credits never expire',
      'Email support',
      'Premium templates',
      'Export in all formats'
    ],
    notIncluded: [
      'Priority support',
      'API access'
    ],
    cta: 'Start Free Trial',
    popular: false,
    gradient: 'from-blue-600 to-cyan-600'
  },
  {
    name: 'Pro',
    icon: Crown,
    price: { monthly: 29, yearly: 290 },
    credits: 2000,
    creditsExpire: false,
    description: 'For professionals and creators',
    features: [
      'Everything in Starter',
      '2,000 credits/month',
      'Priority support',
      'Advanced AI models',
      'Custom branding',
      'Analytics dashboard',
      'API access (coming soon)'
    ],
    notIncluded: [],
    cta: 'Start Free Trial',
    popular: true,
    gradient: 'from-purple-600 to-indigo-600'
  },
  {
    name: 'Business',
    icon: Building2,
    price: { monthly: 99, yearly: 990 },
    credits: 10000,
    creditsExpire: false,
    description: 'For teams and organizations',
    features: [
      'Everything in Pro',
      '10,000 credits/month',
      'Dedicated support',
      'Team collaboration',
      'Admin controls',
      'SSO integration',
      'Custom AI training',
      'SLA guarantee'
    ],
    notIncluded: [],
    cta: 'Contact Sales',
    popular: false,
    gradient: 'from-amber-600 to-orange-600'
  }
];

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="py-24 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Simple, Transparent Pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto mb-8"
          >
            Start free, upgrade when you need more. No hidden fees, no surprises.
          </motion.p>

          {/* Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-3 p-1 bg-white/5 rounded-full"
          >
            <button
              onClick={() => setIsYearly(false)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition ${
                !isYearly ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
                isYearly ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                Save 17%
              </span>
            </button>
          </motion.div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl p-6 ${
                plan.popular
                  ? 'bg-gradient-to-b from-purple-900/50 to-indigo-900/50 border-2 border-purple-500'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full text-sm font-medium text-white">
                  Most Popular
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <div className={`inline-flex p-2 rounded-lg bg-gradient-to-r ${plan.gradient} mb-3`}>
                  <plan.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">
                    ${isYearly ? plan.price.yearly : plan.price.monthly}
                  </span>
                  <span className="text-gray-400">
                    /{isYearly ? 'year' : 'month'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-sm font-medium ${
                    plan.creditsExpire ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {plan.credits.toLocaleString()} credits/mo
                  </span>
                  {!plan.creditsExpire && plan.credits > 0 && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                      Never expire
                    </span>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                    <X className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.name === 'Business' ? '/contact' : '/signup'}
                className={`block w-full py-3 px-4 text-center font-semibold rounded-xl transition ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-gray-400 mb-4">
            Need more credits? Purchase additional credit packs anytime.
          </p>
          <Link
            href="/credits"
            className="text-purple-400 hover:text-purple-300 font-medium"
          >
            View credit packages →
          </Link>
        </motion.div>

        {/* Trust Elements */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 pt-16 border-t border-white/10"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-2xl font-bold text-white mb-2">7-Day Free Trial</div>
              <p className="text-gray-400">Try any paid plan free. No credit card required to start.</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-white mb-2">Cancel Anytime</div>
              <p className="text-gray-400">No long-term contracts. Cancel with one click.</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-white mb-2">Money-Back Guarantee</div>
              <p className="text-gray-400">Not satisfied? Full refund within 30 days.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default PricingSection;
