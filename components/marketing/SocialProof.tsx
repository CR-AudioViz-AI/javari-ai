// components/marketing/SocialProof.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL PROOF & TESTIMONIALS - Jan 1 Launch Ready
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:54 PM EST
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: "Javari AI has transformed how our team creates content. What used to take hours now takes minutes.",
    author: "Sarah Chen",
    role: "Marketing Director",
    company: "TechStart Inc",
    avatar: "/avatars/sarah.jpg",
    rating: 5
  },
  {
    quote: "The best AI platform I've used. The credit system is fair, and the tools are genuinely useful.",
    author: "Marcus Johnson",
    role: "Freelance Designer",
    company: "Self-employed",
    avatar: "/avatars/marcus.jpg",
    rating: 5
  },
  {
    quote: "Finally, an AI tool that doesn't nickel and dime you. Transparent pricing and amazing results.",
    author: "Emily Rodriguez",
    role: "Content Creator",
    company: "Creative Studio",
    avatar: "/avatars/emily.jpg",
    rating: 5
  },
  {
    quote: "The document generation alone has saved us thousands in legal fees. Incredible value.",
    author: "David Park",
    role: "Startup Founder",
    company: "LaunchPad Ventures",
    avatar: "/avatars/david.jpg",
    rating: 5
  }
];

const LOGOS = [
  { name: 'TechCorp', opacity: 0.6 },
  { name: 'StartupX', opacity: 0.6 },
  { name: 'DesignCo', opacity: 0.6 },
  { name: 'MediaHub', opacity: 0.6 },
  { name: 'AgencyPro', opacity: 0.6 },
  { name: 'BrandLab', opacity: 0.6 }
];

export function SocialProof() {
  return (
    <section className="py-24 bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20"
        >
          <StatCard value="10,000+" label="Happy Creators" />
          <StatCard value="500K+" label="Projects Created" />
          <StatCard value="4.9/5" label="Average Rating" />
          <StatCard value="99.9%" label="Uptime" />
        </motion.div>

        {/* Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Loved by Creators Worldwide
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto"
          >
            Join thousands of professionals who trust CR AudioViz AI for their creative needs.
          </motion.p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative p-6 bg-white/5 border border-white/10 rounded-2xl"
            >
              <Quote className="absolute top-6 right-6 w-8 h-8 text-purple-500/20" />
              
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-gray-300 mb-6 relative z-10">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {testimonial.author.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-medium text-white">{testimonial.author}</div>
                  <div className="text-sm text-gray-400">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trusted By */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm text-gray-500 uppercase tracking-wider mb-8">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {LOGOS.map((logo, index) => (
              <div
                key={index}
                className="text-2xl font-bold text-gray-600"
                style={{ opacity: logo.opacity }}
              >
                {logo.name}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
        {value}
      </div>
      <div className="text-gray-400">{label}</div>
    </div>
  );
}

export default SocialProof;
