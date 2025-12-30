// components/marketing/CTASection.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// CALL TO ACTION SECTION - Jan 1 Launch Ready
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:56 PM EST
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Check } from 'lucide-react';
import Link from 'next/link';

const BENEFITS = [
  '50 free credits to start',
  'No credit card required',
  'Cancel anytime',
  'All tools included'
];

export function CTASection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent" />
      
      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-sm text-white/80 mb-8">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span>Join the creative revolution</span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Ready to Transform
            <br />
            <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent">
              Your Creative Workflow?
            </span>
          </h2>

          {/* Subheadline */}
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of creators, designers, and businesses already using 
            CR AudioViz AI to bring their ideas to life.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-300">
                <Check className="w-4 h-4 text-green-400" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="group px-8 py-4 bg-white text-gray-900 font-semibold rounded-xl transition-all hover:scale-105 hover:shadow-2xl hover:shadow-white/20 flex items-center gap-2"
            >
              Start Creating for Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/demo"
              className="px-8 py-4 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition"
            >
              Watch Demo
            </Link>
          </div>

          {/* Social Proof */}
          <p className="mt-8 text-sm text-gray-400">
            ⭐ 4.9/5 rating from 10,000+ creators
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default CTASection;
