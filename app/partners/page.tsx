'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Handshake, DollarSign, Users, Zap, Gift, Trophy,
  ArrowRight, Check, Star, TrendingUp, Globe, Mail
} from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// PARTNERS & AFFILIATE PAGE
// CR AudioViz AI | Henderson Standard | December 31, 2025
// =============================================================================

const PARTNER_PROGRAMS = [
  {
    id: 'affiliate',
    title: 'Affiliate Program',
    subtitle: 'Earn 30% recurring commission',
    description: 'Promote Javari and earn 30% of every sale for the lifetime of the customer.',
    icon: DollarSign,
    benefits: [
      '30% recurring commission',
      '90-day cookie duration',
      'Real-time tracking dashboard',
      'Monthly payouts via PayPal/Stripe',
      'Marketing materials provided',
      'Dedicated affiliate manager'
    ],
    cta: 'Join Affiliate Program'
  },
  {
    id: 'reseller',
    title: 'Reseller Program',
    subtitle: 'White-label reselling rights',
    description: 'Resell Javari services under your own brand with wholesale pricing.',
    icon: Users,
    benefits: [
      'Up to 40% wholesale discount',
      'Co-branded solutions',
      'Sales training & support',
      'Priority feature access',
      'Custom integrations',
      'Volume bonuses'
    ],
    cta: 'Apply for Reseller'
  },
  {
    id: 'technology',
    title: 'Technology Partners',
    subtitle: 'Build on our platform',
    description: 'Integrate your product with Javari or build apps on our platform.',
    icon: Zap,
    benefits: [
      'Full API access',
      'Developer documentation',
      'Technical support',
      'Co-marketing opportunities',
      'Revenue sharing options',
      'Featured in marketplace'
    ],
    cta: 'Become Tech Partner'
  }
];

const STATS = [
  { value: '$2.4M+', label: 'Paid to Partners' },
  { value: '1,500+', label: 'Active Partners' },
  { value: '30%', label: 'Commission Rate' },
  { value: '90', label: 'Day Cookie' }
];

const TOP_PARTNERS = [
  { name: 'DesignPro Academy', earnings: '$45,000', avatar: 'DP' },
  { name: 'TechReview Hub', earnings: '$38,500', avatar: 'TR' },
  { name: 'Creative Toolkit', earnings: '$32,000', avatar: 'CT' },
  { name: 'AI Insights Blog', earnings: '$28,750', avatar: 'AI' },
  { name: 'StartupGrowth.io', earnings: '$24,200', avatar: 'SG' }
];

export default function PartnersPage() {
  const [selectedProgram, setSelectedProgram] = useState('affiliate');
  const [showApply, setShowApply] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    website: '',
    audience: '',
    program: 'affiliate',
    message: ''
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production, send to your partner management system
    await new Promise(resolve => setTimeout(resolve, 1000));
    alert('Application submitted! We\'ll review and get back to you within 48 hours.');
    setShowApply(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Hero */}
      <section className="pt-20 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm mb-6">
              <Handshake className="w-4 h-4" />
              Partner Program
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Grow Together.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                Earn More.
              </span>
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
              Join our partner ecosystem and earn recurring commissions, access exclusive resources, 
              and grow your business alongside ours.
            </p>
            <button
              onClick={() => setShowApply(true)}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-green-500/25 transition-all inline-flex items-center gap-2"
            >
              Apply Now
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-4xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-slate-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Programs */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Choose Your Path
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {PARTNER_PROGRAMS.map((program, i) => (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`bg-slate-800 border rounded-xl p-6 cursor-pointer transition-all ${
                  selectedProgram === program.id
                    ? 'border-green-500 ring-2 ring-green-500/20'
                    : 'border-slate-700 hover:border-green-500/50'
                }`}
                onClick={() => setSelectedProgram(program.id)}
              >
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4">
                  <program.icon className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{program.title}</h3>
                <p className="text-green-400 text-sm font-medium mb-3">{program.subtitle}</p>
                <p className="text-slate-400 text-sm mb-4">{program.description}</p>
                <ul className="space-y-2 mb-6">
                  {program.benefits.slice(0, 4).map((benefit, j) => (
                    <li key={j} className="flex items-center gap-2 text-slate-300 text-sm">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormData({...formData, program: program.id});
                    setShowApply(true);
                  }}
                  className="w-full py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                >
                  {program.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Partners Leaderboard */}
      <section className="py-16 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h2 className="text-3xl font-bold text-white">Top Partners This Month</h2>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {TOP_PARTNERS.map((partner, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-4 ${
                  i !== TOP_PARTNERS.length - 1 ? 'border-b border-slate-700' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                    i === 0 ? 'bg-yellow-500 text-black' :
                    i === 1 ? 'bg-slate-400 text-black' :
                    i === 2 ? 'bg-amber-600 text-white' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-semibold">
                    {partner.avatar}
                  </div>
                  <span className="font-medium text-white">{partner.name}</span>
                </div>
                <span className="text-green-400 font-bold">{partner.earnings}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-400 text-sm mt-4">
            Updated in real-time. Your earnings could be here too!
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: 1, title: 'Apply', desc: 'Fill out our simple application form. We review within 48 hours.' },
              { step: 2, title: 'Promote', desc: 'Get your unique link and marketing materials. Share with your audience.' },
              { step: 3, title: 'Earn', desc: 'Earn 30% recurring commission for every customer you refer.' }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-400">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Start Earning?
            </h2>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
              Join 1,500+ partners already earning recurring commissions with Javari.
            </p>
            <button
              onClick={() => setShowApply(true)}
              className="px-8 py-4 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
            >
              Apply Now — It's Free
            </button>
          </div>
        </div>
      </section>

      {/* Application Modal */}
      {showApply && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Partner Application</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Website/Social</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                  placeholder="https://"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Program *</label>
                <select
                  value={formData.program}
                  onChange={(e) => setFormData({...formData, program: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                >
                  <option value="affiliate">Affiliate Program</option>
                  <option value="reseller">Reseller Program</option>
                  <option value="technology">Technology Partner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tell us about your audience</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApply(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
