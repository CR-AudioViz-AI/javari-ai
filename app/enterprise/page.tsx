'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Shield, Zap, Users, Globe, Lock, Server, 
  HeadphonesIcon, BarChart3, Palette, Code, ArrowRight,
  Check, Star, Calendar, Mail, Phone, ChevronDown
} from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// WHITE-LABEL ENTERPRISE PAGE
// CR AudioViz AI | Henderson Standard | December 31, 2025
// =============================================================================

const ENTERPRISE_FEATURES = [
  {
    icon: Palette,
    title: 'Full White-Label',
    description: 'Your brand, your domain, your colors. Customers never see our name.'
  },
  {
    icon: Server,
    title: 'Dedicated Infrastructure',
    description: 'Isolated cloud environment with guaranteed uptime SLA.'
  },
  {
    icon: Lock,
    title: 'Enterprise Security',
    description: 'SOC2 Type II ready, SSO/SAML, audit logs, data encryption.'
  },
  {
    icon: Users,
    title: 'Unlimited Users',
    description: 'No per-seat pricing. Scale your team without scaling costs.'
  },
  {
    icon: Code,
    title: 'API Access',
    description: 'Full REST API with webhooks for deep integrations.'
  },
  {
    icon: HeadphonesIcon,
    title: 'Dedicated Support',
    description: '24/7 priority support with dedicated success manager.'
  }
];

const SOLUTIONS = [
  {
    id: 'creative-agency',
    title: 'Creative Agencies',
    description: 'Offer AI-powered creative tools to your clients under your brand.',
    features: ['Client workspaces', 'Usage analytics', 'Branded exports', 'Team collaboration'],
    icon: Palette
  },
  {
    id: 'real-estate',
    title: 'Real Estate Brokerages',
    description: 'Give your agents the ultimate property marketing toolkit.',
    features: ['Listing automation', 'Virtual staging', 'Lead capture', 'CRM integration'],
    icon: Building2
  },
  {
    id: 'education',
    title: 'Educational Institutions',
    description: 'AI-powered learning tools for students and educators.',
    features: ['Student portals', 'Progress tracking', 'Content moderation', 'LMS integration'],
    icon: Users
  },
  {
    id: 'enterprise',
    title: 'Enterprise Teams',
    description: 'Centralized AI assistant for your entire organization.',
    features: ['SSO integration', 'Department workspaces', 'Usage controls', 'Compliance tools'],
    icon: Globe
  }
];

const PRICING_TIERS = [
  {
    name: 'Starter',
    price: '$499',
    period: '/month',
    description: 'Perfect for small agencies',
    features: [
      'Up to 50 users',
      'Basic white-labeling',
      'Email support',
      '99.5% uptime SLA',
      'API access (10k calls/mo)'
    ],
    cta: 'Start Free Trial'
  },
  {
    name: 'Professional',
    price: '$1,499',
    period: '/month',
    description: 'For growing organizations',
    features: [
      'Up to 250 users',
      'Full white-labeling',
      'Priority support',
      '99.9% uptime SLA',
      'API access (100k calls/mo)',
      'Custom integrations',
      'Dedicated success manager'
    ],
    popular: true,
    cta: 'Start Free Trial'
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    features: [
      'Unlimited users',
      'Full white-labeling',
      '24/7 dedicated support',
      '99.99% uptime SLA',
      'Unlimited API access',
      'Custom development',
      'On-premise option',
      'SOC2 compliance'
    ],
    cta: 'Contact Sales'
  }
];

const TESTIMONIALS = [
  {
    quote: "We rebranded Javari as our own platform and our clients love it. The AI tools have transformed our agency.",
    author: "Sarah Chen",
    role: "CEO, PixelCraft Studios",
    avatar: "SC"
  },
  {
    quote: "The white-label solution paid for itself in the first month. Our agents close deals faster than ever.",
    author: "Michael Torres",
    role: "Broker, Premier Realty",
    avatar: "MT"
  },
  {
    quote: "Enterprise-grade security with startup-speed innovation. Exactly what we needed.",
    author: "Jennifer Park",
    role: "CTO, TechFlow Inc",
    avatar: "JP"
  }
];

export default function EnterprisePage() {
  const [selectedSolution, setSelectedSolution] = useState('creative-agency');
  const [showContactForm, setShowContactForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    employees: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    
    // In production, this would send to your CRM/email system
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    alert('Thank you! Our enterprise team will contact you within 24 hours.');
    setShowContactForm(false);
    setFormData({ name: '', email: '', company: '', phone: '', employees: '', message: '' });
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-sm mb-6">
              <Building2 className="w-4 h-4" />
              Enterprise Solutions
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Your Brand. Our Platform.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                Unlimited Possibilities.
              </span>
            </h1>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-8">
              Launch your own AI-powered creative platform in days, not months. 
              Full white-label solution with enterprise security, dedicated support, and unlimited scale.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowContactForm(true)}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
              >
                Talk to Sales
                <ArrowRight className="w-5 h-5" />
              </button>
              <Link
                href="#demo"
                className="px-8 py-4 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold text-lg hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                Schedule Demo
              </Link>
            </div>
          </motion.div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-slate-500">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span>SOC2 Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              <span>99.99% Uptime</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <span>Global CDN</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <span>GDPR Compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 bg-slate-800/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Enterprise-Grade Platform
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Everything you need to launch and scale a white-label AI platform
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ENTERPRISE_FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-purple-500/50 transition-colors"
              >
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Built for Your Industry
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Pre-configured solutions for the industries we serve best
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {SOLUTIONS.map((sol) => (
              <button
                key={sol.id}
                onClick={() => setSelectedSolution(sol.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedSolution === sol.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {sol.title}
              </button>
            ))}
          </div>
          
          {SOLUTIONS.filter(s => s.id === selectedSolution).map((solution) => (
            <motion.div
              key={solution.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-8"
            >
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                  <solution.icon className="w-12 h-12 text-purple-400 mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-4">{solution.title}</h3>
                  <p className="text-slate-300 mb-6">{solution.description}</p>
                  <ul className="grid grid-cols-2 gap-3">
                    {solution.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-slate-300">
                        <Check className="w-4 h-4 text-green-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:w-80 flex flex-col justify-center">
                  <button
                    onClick={() => setShowContactForm(true)}
                    className="w-full px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors"
                  >
                    Get Custom Quote
                  </button>
                  <p className="text-center text-slate-400 text-sm mt-3">
                    Usually deploys in 2-3 weeks
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4 bg-slate-800/30" id="pricing">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Transparent Pricing
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            No hidden fees. No per-seat charges. Scale without surprises.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {PRICING_TIERS.map((tier, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`relative bg-slate-800 rounded-2xl p-6 ${
                  tier.popular 
                    ? 'border-2 border-purple-500 ring-4 ring-purple-500/10' 
                    : 'border border-slate-700'
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-500 text-white text-xs font-semibold rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-white">{tier.price}</span>
                  <span className="text-slate-400">{tier.period}</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">{tier.description}</p>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-slate-300 text-sm">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => tier.name === 'Enterprise' ? setShowContactForm(true) : null}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    tier.popular
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {tier.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Trusted by Industry Leaders
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{testimonial.author}</p>
                    <p className="text-sm text-slate-400">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Launch Your Platform?
            </h2>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
              Join 50+ organizations who have launched their own AI-powered platforms with our white-label solution.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowContactForm(true)}
                className="px-8 py-4 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                Contact Sales
              </button>
              <a
                href="tel:+1-888-JAVARI"
                className="px-8 py-4 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" />
                Call Us Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-white mb-2">Contact Enterprise Sales</h2>
            <p className="text-slate-400 mb-6">Fill out the form and we'll get back to you within 24 hours.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Company *</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Work Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Team Size</label>
                  <select
                    value={formData.employees}
                    onChange={(e) => setFormData({...formData, employees: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select...</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="201-500">201-500</option>
                    <option value="500+">500+</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">How can we help?</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                  placeholder="Tell us about your use case..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContactForm(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
