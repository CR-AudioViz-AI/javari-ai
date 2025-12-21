// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - TEMPLATE LIBRARY
// The Queen's DNA - Templates for building ANY application
// ═══════════════════════════════════════════════════════════════════════════════

export interface AppTemplate {
  type: string;
  name: string;
  description: string;
  pages: PageTemplate[];
  components: ComponentTemplate[];
  features: string[];
}

export interface PageTemplate {
  path: string;
  name: string;
  template: string;
}

export interface ComponentTemplate {
  name: string;
  path: string;
  template: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTION PATTERNS - How Javari understands what you want
// ═══════════════════════════════════════════════════════════════════════════════

export const APP_TYPE_PATTERNS = {
  dashboard: [
    'dashboard', 'admin panel', 'analytics', 'metrics', 'stats', 'charts',
    'overview', 'monitoring', 'kpi', 'data visualization'
  ],
  landing: [
    'landing page', 'home page', 'marketing', 'hero', 'cta', 'call to action',
    'product page', 'startup', 'saas landing', 'coming soon'
  ],
  ecommerce: [
    'ecommerce', 'e-commerce', 'shop', 'store', 'product', 'cart', 'checkout',
    'marketplace', 'catalog', 'inventory', 'shopping'
  ],
  portfolio: [
    'portfolio', 'personal site', 'about me', 'resume', 'cv', 'showcase',
    'gallery', 'projects', 'work samples'
  ],
  blog: [
    'blog', 'articles', 'posts', 'news', 'content', 'writing', 'magazine'
  ],
  pricing: [
    'pricing', 'plans', 'tiers', 'subscription', 'packages', 'billing'
  ],
  contact: [
    'contact', 'form', 'get in touch', 'reach out', 'inquiry', 'support'
  ],
  auth: [
    'login', 'signin', 'sign in', 'signup', 'sign up', 'register', 'authentication'
  ],
  game: [
    'game', 'play', 'interactive', 'quiz', 'trivia', 'puzzle', 'arcade'
  ],
  calculator: [
    'calculator', 'compute', 'convert', 'estimate', 'roi', 'mortgage'
  ],
  social: [
    'social', 'feed', 'profile', 'followers', 'posts', 'timeline', 'community'
  ],
  chat: [
    'chat', 'messenger', 'conversation', 'messaging', 'inbox'
  ],
  table: [
    'table', 'data table', 'grid', 'list', 'records', 'spreadsheet', 'crud'
  ],
  weather: [
    'weather', 'forecast', 'temperature', 'climate'
  ],
  music: [
    'music', 'player', 'playlist', 'audio', 'streaming', 'spotify'
  ],
  video: [
    'video', 'player', 'streaming', 'youtube', 'media'
  ],
  map: [
    'map', 'location', 'directions', 'places', 'geographic'
  ],
  calendar: [
    'calendar', 'schedule', 'events', 'booking', 'appointments'
  ],
  kanban: [
    'kanban', 'board', 'trello', 'tasks', 'project management', 'workflow'
  ],
  settings: [
    'settings', 'preferences', 'configuration', 'options', 'profile settings'
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT TEMPLATES - Reusable building blocks
// ═══════════════════════════════════════════════════════════════════════════════

export const COMPONENT_TEMPLATES = {
  // Navigation Header
  header: `"use client";

import { useState } from 'react';

interface HeaderProps {
  title?: string;
  links?: { label: string; href: string }[];
}

export default function Header({ 
  title = "Javari App", 
  links = [
    { label: "Home", href: "/" },
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Contact", href: "#contact" }
  ] 
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              {title}
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-300 hover:text-cyan-400 transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
            <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-white font-medium hover:opacity-90 transition-opacity">
              Get Started
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-400"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block py-2 text-gray-300 hover:text-cyan-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}`,

  // Footer
  footer: `"use client";

export default function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Features</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Pricing</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">API</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">About</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Blog</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Careers</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Documentation</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Help Center</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Community</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Privacy</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Terms</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Security</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Built with Javari AI. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-gray-400 hover:text-cyan-400">
              <span className="sr-only">Twitter</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-cyan-400">
              <span className="sr-only">GitHub</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}`,

  // Hero Section
  hero: `"use client";

interface HeroProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
}

export default function Hero({
  title = "Build the Future",
  subtitle = "Create stunning applications with the power of AI. No coding required.",
  ctaText = "Get Started Free",
  ctaLink = "#"
}: HeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          <span className="bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
            {title}
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-3xl mx-auto">
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={ctaLink}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl text-white font-semibold text-lg hover:opacity-90 transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/25"
          >
            {ctaText}
          </a>
          <a
            href="#features"
            className="px-8 py-4 border border-gray-700 rounded-xl text-gray-300 font-semibold text-lg hover:bg-gray-800/50 transition-all"
          >
            Learn More
          </a>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "10K+", label: "Users" },
            { value: "50K+", label: "Apps Built" },
            { value: "99.9%", label: "Uptime" },
            { value: "24/7", label: "Support" }
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,

  // Feature Grid
  features: `"use client";

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface FeaturesProps {
  title?: string;
  subtitle?: string;
  features?: Feature[];
}

const defaultFeatures: Feature[] = [
  {
    icon: "⚡",
    title: "Lightning Fast",
    description: "Build and deploy in seconds, not hours. Our AI handles the heavy lifting."
  },
  {
    icon: "🎨",
    title: "Beautiful Design",
    description: "Professional, modern designs that look great on any device."
  },
  {
    icon: "🔒",
    title: "Secure by Default",
    description: "Enterprise-grade security built into every application."
  },
  {
    icon: "🚀",
    title: "Instant Deploy",
    description: "One-click deployment to global edge network."
  },
  {
    icon: "📊",
    title: "Analytics Built-in",
    description: "Track performance and user engagement out of the box."
  },
  {
    icon: "🔧",
    title: "Fully Customizable",
    description: "Modify anything. Export code. No lock-in."
  }
];

export default function Features({
  title = "Everything You Need",
  subtitle = "Powerful features to bring your ideas to life",
  features = defaultFeatures
}: FeaturesProps) {
  return (
    <section id="features" className="py-24 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{title}</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">{subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 bg-gray-800/50 rounded-2xl border border-gray-700/50 hover:border-cyan-500/50 transition-all duration-300 group"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,

  // Pricing Section
  pricing: `"use client";

import { useState } from 'react';

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

interface PricingProps {
  title?: string;
  subtitle?: string;
  tiers?: PricingTier[];
}

const defaultTiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Perfect for getting started",
    features: [
      "Up to 3 projects",
      "Basic analytics",
      "Community support",
      "1GB storage"
    ],
    cta: "Get Started"
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For growing businesses",
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority support",
      "50GB storage",
      "Custom domains",
      "Team collaboration"
    ],
    highlighted: true,
    cta: "Start Free Trial"
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "For large organizations",
    features: [
      "Everything in Pro",
      "Unlimited storage",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Advanced security"
    ],
    cta: "Contact Sales"
  }
];

export default function Pricing({
  title = "Simple, Transparent Pricing",
  subtitle = "Choose the plan that works for you",
  tiers = defaultTiers
}: PricingProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{title}</h2>
          <p className="text-xl text-gray-400">{subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={\`relative p-8 rounded-2xl border transition-all duration-300 \${
                tier.highlighted
                  ? 'bg-gradient-to-b from-cyan-500/10 to-purple-500/10 border-cyan-500/50 scale-105'
                  : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
              }\`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-sm font-medium text-white">
                  Most Popular
                </div>
              )}

              <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
              <p className="text-gray-400 mb-4">{tier.description}</p>
              
              <div className="mb-6">
                <span className="text-5xl font-bold text-white">{tier.price}</span>
                {tier.period && <span className="text-gray-400">{tier.period}</span>}
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-300">
                    <svg className="w-5 h-5 text-cyan-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setSelectedTier(tier.name)}
                className={\`w-full py-3 rounded-xl font-semibold transition-all \${
                  tier.highlighted
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:opacity-90'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }\`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,

  // Testimonials
  testimonials: `"use client";

import { useState, useEffect } from 'react';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar?: string;
}

interface TestimonialsProps {
  title?: string;
  testimonials?: Testimonial[];
}

const defaultTestimonials: Testimonial[] = [
  {
    quote: "Javari AI transformed how we build products. What used to take weeks now takes minutes.",
    author: "Sarah Chen",
    role: "CTO",
    company: "TechStart Inc"
  },
  {
    quote: "The quality of the generated code is incredible. It's like having a senior developer on demand.",
    author: "Marcus Johnson",
    role: "Founder",
    company: "DevFlow"
  },
  {
    quote: "We've 10x'd our output since adopting Javari. It's become essential to our workflow.",
    author: "Emily Rodriguez",
    role: "Product Lead",
    company: "InnovateCo"
  }
];

export default function Testimonials({
  title = "Loved by Developers",
  testimonials = defaultTestimonials
}: TestimonialsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  return (
    <section className="py-24 bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-white text-center mb-16">{title}</h2>

        <div className="relative">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className={\`transition-all duration-500 \${
                index === activeIndex ? 'opacity-100' : 'opacity-0 absolute inset-0'
              }\`}
            >
              <blockquote className="text-center">
                <p className="text-2xl md:text-3xl text-white font-light leading-relaxed mb-8">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center justify-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.author.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="text-white font-semibold">{testimonial.author}</div>
                    <div className="text-gray-400">{testimonial.role} at {testimonial.company}</div>
                  </div>
                </div>
              </blockquote>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-8 space-x-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={\`w-2 h-2 rounded-full transition-all \${
                index === activeIndex ? 'bg-cyan-400 w-8' : 'bg-gray-600'
              }\`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}`,

  // Contact Form
  contact: `"use client";

import { useState } from 'react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section id="contact" className="py-24 bg-gray-800">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="text-6xl mb-4">✓</div>
          <h2 className="text-3xl font-bold text-white mb-4">Thanks for reaching out!</h2>
          <p className="text-gray-400">We'll get back to you within 24 hours.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="py-24 bg-gray-800">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Get in Touch</h2>
          <p className="text-gray-400">Have a question? We'd love to hear from you.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
              Message
            </label>
            <textarea
              id="message"
              rows={5}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
              placeholder="How can we help?"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl text-white font-semibold text-lg hover:opacity-90 transition-all"
          >
            Send Message
          </button>
        </form>
      </div>
    </section>
  );
}`,

  // Dashboard Stats
  dashboardStats: `"use client";

interface Stat {
  label: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

interface DashboardStatsProps {
  stats?: Stat[];
}

const defaultStats: Stat[] = [
  { label: "Total Revenue", value: "$45,231.89", change: "+20.1%", changeType: "positive" },
  { label: "Active Users", value: "2,350", change: "+15.2%", changeType: "positive" },
  { label: "Conversion Rate", value: "3.24%", change: "-0.4%", changeType: "negative" },
  { label: "Avg. Order Value", value: "$124.50", change: "+7.3%", changeType: "positive" }
];

export default function DashboardStats({ stats = defaultStats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="p-6 bg-gray-800 rounded-2xl border border-gray-700"
        >
          <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
          <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
          <span className={\`text-sm \${
            stat.changeType === 'positive' ? 'text-green-400' :
            stat.changeType === 'negative' ? 'text-red-400' : 'text-gray-400'
          }\`}>
            {stat.change} from last month
          </span>
        </div>
      ))}
    </div>
  );
}`,

  // Data Table
  dataTable: `"use client";

import { useState } from 'react';

interface Column {
  key: string;
  label: string;
}

interface DataTableProps {
  columns?: Column[];
  data?: Record<string, unknown>[];
  title?: string;
}

const defaultColumns: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'role', label: 'Role' }
];

const defaultData = [
  { name: 'John Doe', email: 'john@example.com', status: 'Active', role: 'Admin' },
  { name: 'Jane Smith', email: 'jane@example.com', status: 'Active', role: 'User' },
  { name: 'Bob Wilson', email: 'bob@example.com', status: 'Inactive', role: 'User' },
  { name: 'Alice Brown', email: 'alice@example.com', status: 'Active', role: 'Editor' }
];

export default function DataTable({ 
  columns = defaultColumns, 
  data = defaultData,
  title = "Users"
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = data.filter((row) =>
    Object.values(row).some((value) =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-sm font-medium text-gray-300"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-700/30 transition-colors">
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 text-gray-300">
                    {column.key === 'status' ? (
                      <span className={\`px-2 py-1 rounded-full text-xs \${
                        row[column.key] === 'Active' 
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }\`}>
                        {String(row[column.key])}
                      </span>
                    ) : (
                      String(row[column.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}`,

  // Chart Component
  chart: `"use client";

import { useState, useEffect } from 'react';

interface ChartProps {
  title?: string;
  data?: { label: string; value: number }[];
}

const defaultData = [
  { label: 'Jan', value: 65 },
  { label: 'Feb', value: 59 },
  { label: 'Mar', value: 80 },
  { label: 'Apr', value: 81 },
  { label: 'May', value: 56 },
  { label: 'Jun', value: 95 },
  { label: 'Jul', value: 100 }
];

export default function Chart({ title = "Revenue Overview", data = defaultData }: ChartProps) {
  const [mounted, setMounted] = useState(false);
  const maxValue = Math.max(...data.map(d => d.value));

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
      <h3 className="text-xl font-semibold text-white mb-6">{title}</h3>
      
      <div className="flex items-end justify-between h-64 gap-2">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div className="w-full flex flex-col items-center justify-end h-48">
              <div
                className="w-full max-w-[40px] bg-gradient-to-t from-cyan-500 to-purple-500 rounded-t-lg transition-all duration-700"
                style={{
                  height: \`\${(item.value / maxValue) * 100}%\`,
                  opacity: mounted ? 1 : 0
                }}
              />
            </div>
            <span className="text-gray-400 text-sm mt-2">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}`,

  // Product Card (E-commerce)
  productCard: `"use client";

import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  rating: number;
  reviews: number;
}

interface ProductCardProps {
  product?: Product;
}

const defaultProduct: Product = {
  id: '1',
  name: 'Premium Wireless Headphones',
  price: 299.99,
  rating: 4.5,
  reviews: 128
};

export default function ProductCard({ product = defaultProduct }: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden group">
      {/* Image placeholder */}
      <div className="relative h-64 bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center">
        <span className="text-6xl">🎧</span>
        
        <button
          onClick={() => setIsWishlisted(!isWishlisted)}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-900/50 hover:bg-gray-900 transition-colors"
        >
          <svg
            className={\`w-5 h-5 \${isWishlisted ? 'text-red-500 fill-current' : 'text-white'}\`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      </div>

      <div className="p-6">
        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
          {product.name}
        </h3>
        
        <div className="flex items-center mb-4">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={\`w-4 h-4 \${i < Math.floor(product.rating) ? 'fill-current' : 'text-gray-600'}\`}
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-gray-400 text-sm ml-2">({product.reviews} reviews)</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-white">\${product.price}</span>
          <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white font-medium transition-colors">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}`,

  // Kanban Board
  kanban: `"use client";

import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
}

interface Column {
  id: string;
  title: string;
  tasks: Task[];
}

const initialColumns: Column[] = [
  {
    id: 'todo',
    title: 'To Do',
    tasks: [
      { id: '1', title: 'Design new landing page', priority: 'high' },
      { id: '2', title: 'Update documentation', priority: 'low' }
    ]
  },
  {
    id: 'progress',
    title: 'In Progress',
    tasks: [
      { id: '3', title: 'Implement authentication', priority: 'high' },
      { id: '4', title: 'Fix responsive issues', priority: 'medium' }
    ]
  },
  {
    id: 'done',
    title: 'Done',
    tasks: [
      { id: '5', title: 'Setup CI/CD pipeline', priority: 'medium' }
    ]
  }
];

export default function Kanban() {
  const [columns, setColumns] = useState(initialColumns);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-green-500/20 text-green-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Project Board</h1>
      
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80 bg-gray-800 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{column.title}</h2>
              <span className="px-2 py-1 bg-gray-700 rounded-lg text-gray-300 text-sm">
                {column.tasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {column.tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-cyan-500/50 cursor-pointer transition-all"
                >
                  <p className="text-white mb-2">{task.title}</p>
                  <span className={\`px-2 py-1 rounded text-xs \${getPriorityColor(task.priority)}\`}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-cyan-500 hover:text-cyan-400 transition-all">
              + Add Task
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}`
};

// Export everything
export default {
  APP_TYPE_PATTERNS,
  COMPONENT_TEMPLATES
};
