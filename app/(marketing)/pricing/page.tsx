/**
 * CR AudioViz AI - Javari AI Pricing Page
 * ========================================
 */

import Link from 'next/link'
import { Check, Sparkles, X, ArrowRight, HelpCircle } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: 0,
    credits: 50,
    description: 'Perfect for trying out Javari',
    features: [
      { name: '50 credits per month', included: true },
      { name: 'Text commands', included: true },
      { name: 'Basic reports', included: true },
      { name: 'Community support', included: true },
      { name: 'Voice commands', included: false },
      { name: 'Video calls', included: false },
      { name: 'Scheduled tasks', included: false },
      { name: 'API access', included: false },
    ],
    cta: 'Start Free',
    popular: false,
    note: 'Credits expire monthly'
  },
  {
    name: 'Starter',
    price: 9,
    credits: 500,
    description: 'For individuals getting started',
    features: [
      { name: '500 credits per month', included: true },
      { name: 'Text commands', included: true },
      { name: 'All reports', included: true },
      { name: 'Email support', included: true },
      { name: 'Voice commands', included: true },
      { name: 'Video calls', included: false },
      { name: 'Scheduled tasks', included: false },
      { name: 'API access', included: false },
    ],
    cta: 'Start Trial',
    popular: false,
    note: 'Credits never expire'
  },
  {
    name: 'Pro',
    price: 29,
    credits: 2000,
    description: 'For professionals who need more',
    features: [
      { name: '2,000 credits per month', included: true },
      { name: 'Text commands', included: true },
      { name: 'All reports', included: true },
      { name: 'Priority support', included: true },
      { name: 'Voice commands', included: true },
      { name: 'Video calls', included: true },
      { name: 'Scheduled tasks', included: true },
      { name: 'API access', included: true },
    ],
    cta: 'Start Trial',
    popular: true,
    note: 'Credits never expire'
  },
  {
    name: 'Business',
    price: 99,
    credits: 10000,
    description: 'For teams and businesses',
    features: [
      { name: '10,000 credits per month', included: true },
      { name: 'Text commands', included: true },
      { name: 'All reports', included: true },
      { name: 'Dedicated support', included: true },
      { name: 'Voice commands', included: true },
      { name: 'Video calls', included: true },
      { name: 'Scheduled tasks', included: true },
      { name: 'API access', included: true },
    ],
    cta: 'Contact Sales',
    popular: false,
    note: 'Credits never expire + White-label option'
  }
]

const faqs = [
  {
    q: 'What are credits?',
    a: 'Credits are used for AI operations. Simple commands cost 1-5 credits, while complex tasks like video generation may cost more. Most users find the included credits more than enough.'
  },
  {
    q: 'Do credits expire?',
    a: 'On paid plans, credits NEVER expire. On the free plan, unused credits reset monthly.'
  },
  {
    q: 'Can I upgrade or downgrade?',
    a: 'Yes! You can change your plan anytime. When upgrading, you get immediate access to new features. When downgrading, changes take effect at the next billing cycle.'
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards, debit cards, and PayPal. Enterprise customers can also pay by invoice.'
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes! All paid plans include a 7-day free trial. No credit card required to start.'
  },
  {
    q: 'What happens if I run out of credits?',
    a: 'You can purchase additional credit packs anytime, or wait until your next billing cycle for a refresh. We\'ll always warn you before you run out.'
  }
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <nav className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl">Javari AI</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-400 hover:text-white transition">Login</Link>
              <Link href="/signup" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition">
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Hero */}
      <section className="py-20 text-center">
        <h1 className="text-5xl font-bold mb-4">Simple, transparent pricing</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Start free, upgrade when you need more. Credits never expire on paid plans.
        </p>
      </section>
      
      {/* Pricing Grid */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div 
                key={plan.name}
                className={`relative rounded-2xl p-6 ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-purple-900/50 to-gray-900 border-2 border-purple-500' 
                    : 'bg-gray-900 border border-gray-800'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-600 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-gray-400 text-sm mt-1 mb-4">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="text-5xl font-bold">${plan.price}</span>
                  <span className="text-gray-400">/mo</span>
                </div>
                
                <Link 
                  href={plan.name === 'Business' ? '/contact' : '/signup'}
                  className={`block text-center py-3 rounded-xl font-semibold transition mb-6 ${
                    plan.popular 
                      ? 'bg-purple-600 hover:bg-purple-500' 
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {plan.cta}
                </Link>
                
                <p className="text-xs text-gray-500 mb-4">{plan.note}</p>
                
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-gray-600 flex-shrink-0" />
                      )}
                      <span className={feature.included ? 'text-gray-300' : 'text-gray-600'}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Credit Packs */}
      <section className="py-20 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Need more credits?</h2>
          <p className="text-gray-400 mb-10">Purchase additional credit packs anytime</p>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { credits: 100, price: 5, bonus: 0 },
              { credits: 500, price: 20, bonus: 50 },
              { credits: 1000, price: 35, bonus: 150 },
              { credits: 5000, price: 150, bonus: 1000 },
              { credits: 10000, price: 250, bonus: 2500 },
            ].map((pack) => (
              <div key={pack.credits} className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-2xl font-bold">{pack.credits.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">credits</p>
                {pack.bonus > 0 && (
                  <p className="text-green-400 text-xs mt-1">+{pack.bonus} bonus</p>
                )}
                <p className="text-xl font-semibold mt-2">${pack.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* FAQs */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently asked questions</h2>
          
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i} className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                <h3 className="font-semibold flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-purple-400" />
                  {faq.q}
                </h3>
                <p className="text-gray-400 mt-2">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-purple-900/50 to-blue-900/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to get started?</h2>
          <p className="text-xl text-gray-300 mb-10">
            Start free with 50 credits. No credit card required.
          </p>
          <Link 
            href="/signup"
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-gray-900 hover:bg-gray-100 rounded-xl text-xl font-bold transition"
          >
            Start Your Free Trial
            <ArrowRight className="w-6 h-6" />
          </Link>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="max-w-6xl mx-auto px-6 text-center text-gray-500 text-sm">
          © 2026 CR AudioViz AI, LLC. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
