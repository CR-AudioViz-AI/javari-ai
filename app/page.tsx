/**
 * CR AudioViz AI - Javari AI Marketing Landing Page
 * ==================================================
 * 
 * High-conversion landing page for Javari AI
 * 
 * @version 1.0.0
 * @date January 1, 2026
 */

import Link from 'next/link'
import { 
  Sparkles, 
  Mic, 
  Video, 
  Brain, 
  Zap, 
  Shield,
  Check,
  ArrowRight,
  Star,
  Users,
  Clock,
  DollarSign
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-gray-950 to-blue-900/30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-500/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm mb-8">
              <Sparkles className="w-4 h-4" />
              Meet Your AI Business Partner
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
              Your AI That Actually
              <br />Runs Your Business
            </h1>
            
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
              Javari AI is your autonomous business partner. Voice commands, video calls, 
              and natural language to manage revenue, users, deployments, and more.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/signup"
                className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl text-lg font-semibold transition shadow-lg shadow-purple-500/25"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link 
                href="/video"
                className="flex items-center gap-2 px-8 py-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-lg font-semibold transition"
              >
                <Video className="w-5 h-5" />
                Watch Demo
              </Link>
            </div>
            
            <p className="text-gray-500 text-sm mt-6">
              No credit card required • 50 free credits • Cancel anytime
            </p>
          </div>
        </div>
      </section>
      
      {/* Social Proof */}
      <section className="border-y border-gray-800 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-white">10K+</p>
              <p className="text-gray-400">Commands Processed</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">99.9%</p>
              <p className="text-gray-400">Uptime</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">24/7</p>
              <p className="text-gray-400">Autonomous Operation</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">4.9★</p>
              <p className="text-gray-400">User Rating</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Grid */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">One AI, Endless Capabilities</h2>
            <p className="text-xl text-gray-400">Everything you need to run your business, in natural language</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Mic className="w-8 h-8" />,
                title: 'Voice Commands',
                description: 'Speak naturally. "Show me revenue this month" or "Create a promo code for 20% off"'
              },
              {
                icon: <Video className="w-8 h-8" />,
                title: 'Video Calls',
                description: 'Talk face-to-face with Javari. Get real-time reports and have strategic discussions.'
              },
              {
                icon: <Brain className="w-8 h-8" />,
                title: 'Self-Learning',
                description: 'Javari learns your preferences and gets smarter with every interaction.'
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: 'Instant Actions',
                description: 'Execute business operations in seconds. No more clicking through dashboards.'
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: 'Safe Operations',
                description: 'Dangerous operations require your approval. You stay in control.'
              },
              {
                icon: <Clock className="w-8 h-8" />,
                title: 'Scheduled Tasks',
                description: 'Set up recurring reports and tasks. Javari runs them automatically.'
              }
            ].map((feature, i) => (
              <div key={i} className="p-6 bg-gray-900 border border-gray-800 rounded-2xl hover:border-purple-500/50 transition">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl flex items-center justify-center text-purple-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Use Cases */}
      <section className="py-24 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">What Can Javari Do?</h2>
            <p className="text-xl text-gray-400">Just say it, and it happens</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {[
              '"Run a revenue report for this week"',
              '"Show me all failed deployments"',
              '"Add 1000 credits to john@email.com"',
              '"Create a 30% discount code for holidays"',
              '"Draft an email announcing our new feature"',
              '"What\'s our grant application status?"',
              '"Check if all our sites are healthy"',
              '"Schedule a daily report at 8 AM"'
            ].map((command, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-gray-300 font-mono text-sm">{command}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Pricing */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-400">Credits never expire on paid plans</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { name: 'Free', price: 0, credits: 50, features: ['50 credits/month', 'Text commands', 'Basic reports', 'Community support'], expiry: 'Credits expire monthly' },
              { name: 'Starter', price: 9, credits: 500, features: ['500 credits/month', 'Voice commands', 'All reports', 'Email support', 'Credits never expire'], popular: false },
              { name: 'Pro', price: 29, credits: 2000, features: ['2,000 credits/month', 'Voice + Video', 'Scheduled tasks', 'Priority support', 'API access'], popular: true },
              { name: 'Business', price: 99, credits: 10000, features: ['10,000 credits/month', 'Everything in Pro', 'Custom integrations', 'Dedicated support', 'White-label option'], popular: false }
            ].map((plan, i) => (
              <div key={i} className={`relative p-6 rounded-2xl ${plan.popular ? 'bg-gradient-to-b from-purple-900/50 to-gray-900 border-2 border-purple-500' : 'bg-gray-900 border border-gray-800'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-600 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-gray-400">/month</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link 
                  href="/signup"
                  className={`block text-center py-3 rounded-xl font-semibold transition ${plan.popular ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                  {plan.price === 0 ? 'Start Free' : 'Get Started'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-24 bg-gradient-to-r from-purple-900/50 to-blue-900/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Meet Your AI Partner?</h2>
          <p className="text-xl text-gray-300 mb-10">
            Join thousands of businesses running smarter with Javari AI.
            Start free, no credit card required.
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
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl">Javari AI</span>
            </div>
            <p className="text-gray-500 text-sm">
              © 2026 CR AudioViz AI, LLC. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition">Terms</Link>
              <Link href="/contact" className="hover:text-white transition">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
