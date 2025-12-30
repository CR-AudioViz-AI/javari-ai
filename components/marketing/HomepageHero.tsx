// components/marketing/HomepageHero.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED HOMEPAGE HERO - Jan 1 Launch Ready
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:50 PM EST
// Henderson Standard - Fortune 50 Quality
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, ArrowRight, Play, CheckCircle2, Zap, Shield, 
  Users, Globe, Star, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

const ROTATING_WORDS = [
  'Create stunning visuals',
  'Build professional documents',
  'Generate AI content',
  'Design with intelligence',
  'Transform your workflow'
];

const TRUST_BADGES = [
  { icon: Shield, text: 'Enterprise Security' },
  { icon: Zap, text: 'Lightning Fast' },
  { icon: Users, text: '24/7 Support' },
  { icon: Globe, text: 'Global CDN' }
];

const QUICK_STATS = [
  { value: '50+', label: 'AI-Powered Tools' },
  { value: '99.9%', label: 'Uptime' },
  { value: '500K+', label: 'Creations Made' },
  { value: '4.9★', label: 'User Rating' }
];

export function HomepageHero() {
  const [wordIndex, setWordIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        {/* Top Badge */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-full text-sm text-purple-200">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Launching January 2025</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </motion.div>

        {/* Main Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-6">
            Your Story.
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              {' '}Our Design.
            </span>
          </h1>
          
          {/* Rotating Subheadline */}
          <div className="h-12 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={wordIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="text-xl sm:text-2xl text-gray-300 absolute inset-x-0"
              >
                {ROTATING_WORDS[wordIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center text-lg text-gray-400 max-w-2xl mx-auto mb-10"
        >
          The comprehensive AI-powered creative platform. Access professional tools, 
          connect with Javari AI, and bring your vision to life.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link
            href="/signup"
            className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Creating Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          
          <button
            onClick={() => setIsVideoPlaying(true)}
            className="group flex items-center gap-3 px-6 py-4 text-white/90 hover:text-white transition"
          >
            <div className="p-3 bg-white/10 rounded-full group-hover:bg-white/20 transition">
              <Play className="w-5 h-5" />
            </div>
            <span className="font-medium">Watch Demo</span>
          </button>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-16"
        >
          {QUICK_STATS.map((stat, i) => (
            <div key={i} className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap justify-center gap-6"
        >
          {TRUST_BADGES.map((badge, i) => (
            <div key={i} className="flex items-center gap-2 text-gray-400">
              <badge.icon className="w-4 h-4" />
              <span className="text-sm">{badge.text}</span>
            </div>
          ))}
        </motion.div>

        {/* Feature Preview Cards */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <FeatureCard
            icon="🎨"
            title="Creative Tools"
            description="Professional design tools powered by AI. Create logos, graphics, documents, and more."
            gradient="from-pink-500 to-rose-500"
          />
          <FeatureCard
            icon="🤖"
            title="Javari AI Assistant"
            description="Your personal AI companion. Get help with any creative task, anytime."
            gradient="from-purple-500 to-indigo-500"
            featured
          />
          <FeatureCard
            icon="🚀"
            title="Scale Without Limits"
            description="Enterprise-grade infrastructure. Build and deploy at any scale."
            gradient="from-blue-500 to-cyan-500"
          />
        </motion.div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {isVideoPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setIsVideoPlaying(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Replace with actual video */}
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white">Demo video coming soon</p>
              </div>
              <button
                onClick={() => setIsVideoPlaying(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description, 
  gradient,
  featured = false 
}: { 
  icon: string; 
  title: string; 
  description: string; 
  gradient: string;
  featured?: boolean;
}) {
  return (
    <div className={`relative p-6 rounded-2xl border transition-all hover:scale-105 ${
      featured 
        ? 'bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border-purple-500/50' 
        : 'bg-white/5 border-white/10 hover:border-white/20'
    }`}>
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full text-xs font-medium text-white">
          Most Popular
        </div>
      )}
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${gradient} mb-4`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

export default HomepageHero;
