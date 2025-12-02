// lib/javari-product-catalog.ts
// JAVARI PRODUCT CATALOG - Complete knowledge of CR AudioViz AI platform
// Timestamp: 2025-11-30 06:45 AM EST

// =====================================================
// ALL CR AUDIOVIZ AI PRODUCTS
// =====================================================

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  features: string[];
  pricing: {
    type: 'free' | 'credits' | 'subscription' | 'one-time';
    credits?: number;
    price?: number;
    interval?: 'month' | 'year' | 'once';
  };
  status: 'live' | 'development' | 'planned';
  url?: string;
  techStack?: string[];
}

export const PRODUCTS: Product[] = [
  // ==================== CORE PLATFORM ====================
  {
    id: 'javari-ai',
    name: 'Javari AI',
    slug: 'javari',
    category: 'Core',
    description: 'Autonomous AI assistant that can build, code, research, and execute tasks',
    features: [
      'Multi-AI routing (Claude, GPT-4, Gemini, Perplexity)',
      'Code generation and execution',
      'Real-time research',
      'File creation and deployment',
      'Credential management for customer APIs',
      'Continuous learning from interactions'
    ],
    pricing: { type: 'credits', credits: 1 },
    status: 'live',
    url: 'https://javariai.com'
  },
  {
    id: 'craudioviz-website',
    name: 'CR AudioViz AI Platform',
    slug: 'platform',
    category: 'Core',
    description: 'Main platform with all tools, apps, and services',
    features: ['60+ professional tools', 'User dashboard', 'Credit management', 'App marketplace'],
    pricing: { type: 'subscription', price: 0, interval: 'month' },
    status: 'live',
    url: 'https://craudiovizai.com'
  },

  // ==================== BUSINESS TOOLS ====================
  {
    id: 'invoice-generator',
    name: 'Invoice Generator',
    slug: 'invoice-generator',
    category: 'Business',
    description: 'Create professional invoices in seconds',
    features: ['Custom branding', 'Multiple currencies', 'PDF export', 'Payment link integration', 'Recurring invoices'],
    pricing: { type: 'credits', credits: 1 },
    status: 'live'
  },
  {
    id: 'proposal-builder',
    name: 'Proposal Builder',
    slug: 'proposal-builder',
    category: 'Business',
    description: 'Create winning business proposals',
    features: ['Professional templates', 'Custom sections', 'E-signature ready', 'Analytics tracking'],
    pricing: { type: 'credits', credits: 2 },
    status: 'live'
  },
  {
    id: 'contract-generator',
    name: 'Contract Generator',
    slug: 'contract-generator',
    category: 'Business',
    description: 'Generate legal contracts and agreements',
    features: ['Multiple contract types', 'Customizable clauses', 'State-specific templates', 'PDF export'],
    pricing: { type: 'credits', credits: 2 },
    status: 'live'
  },
  {
    id: 'business-plan-creator',
    name: 'Business Plan Creator',
    slug: 'business-plan',
    category: 'Business',
    description: 'Create comprehensive business plans',
    features: ['Financial projections', 'Market analysis templates', 'Investor-ready format', 'Export options'],
    pricing: { type: 'credits', credits: 5 },
    status: 'development'
  },

  // ==================== CREATIVE TOOLS ====================
  {
    id: 'logo-studio',
    name: 'Logo Studio',
    slug: 'logo-studio',
    category: 'Creative',
    description: 'AI-powered logo design',
    features: ['AI generation', 'Multiple variations', 'Vector export', 'Brand kit creation'],
    pricing: { type: 'credits', credits: 3 },
    status: 'live'
  },
  {
    id: 'social-graphics',
    name: 'Social Graphics',
    slug: 'social-graphics',
    category: 'Creative',
    description: 'Create social media graphics for all platforms',
    features: ['Platform-optimized sizes', 'Templates library', 'Brand consistency', 'Bulk creation'],
    pricing: { type: 'credits', credits: 1 },
    status: 'live'
  },
  {
    id: 'ebook-creator',
    name: 'eBook Creator',
    slug: 'ebook-creator',
    category: 'Creative',
    description: 'Create and publish professional eBooks',
    features: ['Chapter organization', 'Cover design', 'Multiple formats (PDF, ePub)', 'Table of contents'],
    pricing: { type: 'credits', credits: 5 },
    status: 'live'
  },
  {
    id: 'presentation-maker',
    name: 'Presentation Maker',
    slug: 'presentations',
    category: 'Creative',
    description: 'Create stunning presentations',
    features: ['AI slide generation', 'Professional themes', 'Animation effects', 'Export to PPTX/PDF'],
    pricing: { type: 'credits', credits: 2 },
    status: 'development'
  },
  {
    id: 'video-editor',
    name: 'Video Editor',
    slug: 'video-editor',
    category: 'Creative',
    description: 'Edit videos with AI assistance',
    features: ['Trim and cut', 'Add text and effects', 'AI captions', 'Multiple export formats'],
    pricing: { type: 'credits', credits: 5 },
    status: 'planned'
  },
  {
    id: 'thumbnail-generator',
    name: 'Thumbnail Generator',
    slug: 'thumbnails',
    category: 'Creative',
    description: 'Create eye-catching thumbnails for YouTube and social',
    features: ['AI-optimized designs', 'A/B testing templates', 'Custom text', 'Platform presets'],
    pricing: { type: 'credits', credits: 1 },
    status: 'development'
  },

  // ==================== DOCUMENT TOOLS ====================
  {
    id: 'pdf-builder',
    name: 'PDF Builder',
    slug: 'pdf-builder',
    category: 'Documents',
    description: 'Create, edit, and convert PDFs',
    features: ['Merge PDFs', 'Split pages', 'Add annotations', 'Form filling', 'OCR text extraction'],
    pricing: { type: 'credits', credits: 1 },
    status: 'live'
  },
  {
    id: 'legalease',
    name: 'LegalEase',
    slug: 'legalease',
    category: 'Documents',
    description: 'Simplify legal document creation',
    features: ['NDA generator', 'Terms of service', 'Privacy policy', 'Employment contracts'],
    pricing: { type: 'credits', credits: 2 },
    status: 'live'
  },
  {
    id: 'resume-builder',
    name: 'Resume Builder',
    slug: 'resume',
    category: 'Documents',
    description: 'Create ATS-optimized resumes',
    features: ['Professional templates', 'ATS optimization', 'Cover letter generator', 'PDF export'],
    pricing: { type: 'credits', credits: 2 },
    status: 'development'
  },

  // ==================== MARKETING TOOLS ====================
  {
    id: 'email-writer',
    name: 'Email Writer',
    slug: 'email-writer',
    category: 'Marketing',
    description: 'AI-powered email copywriting',
    features: ['Subject line optimization', 'Multiple tones', 'A/B variations', 'Template library'],
    pricing: { type: 'credits', credits: 1 },
    status: 'live'
  },
  {
    id: 'ad-copy-generator',
    name: 'Ad Copy Generator',
    slug: 'ad-copy',
    category: 'Marketing',
    description: 'Create high-converting ad copy',
    features: ['Google Ads', 'Facebook Ads', 'LinkedIn Ads', 'Multiple variations'],
    pricing: { type: 'credits', credits: 1 },
    status: 'development'
  },
  {
    id: 'seo-content-writer',
    name: 'SEO Content Writer',
    slug: 'seo-writer',
    category: 'Marketing',
    description: 'Create SEO-optimized content',
    features: ['Keyword optimization', 'Meta descriptions', 'Content structure', 'Readability analysis'],
    pricing: { type: 'credits', credits: 3 },
    status: 'development'
  },
  {
    id: 'social-scheduler',
    name: 'Social Media Scheduler',
    slug: 'social-scheduler',
    category: 'Marketing',
    description: 'Schedule and automate social posts',
    features: ['Multi-platform posting', 'Content calendar', 'Analytics', 'Best time suggestions'],
    pricing: { type: 'subscription', price: 19, interval: 'month' },
    status: 'planned'
  },

  // ==================== REAL ESTATE ====================
  {
    id: 'cr-realtor',
    name: 'CR Realtor Platform',
    slug: 'cr-realtor',
    category: 'Real Estate',
    description: 'Complete real estate professional toolkit',
    features: ['Listing presentations', 'CMA reports', 'Client management', 'Document templates'],
    pricing: { type: 'subscription', price: 49, interval: 'month' },
    status: 'live'
  },
  {
    id: 'property-flyer',
    name: 'Property Flyer Creator',
    slug: 'property-flyer',
    category: 'Real Estate',
    description: 'Create stunning property flyers',
    features: ['Professional templates', 'MLS integration', 'QR codes', 'Print-ready output'],
    pricing: { type: 'credits', credits: 1 },
    status: 'live'
  },
  {
    id: 'open-house-sign-in',
    name: 'Open House Sign-In',
    slug: 'open-house',
    category: 'Real Estate',
    description: 'Digital open house registration',
    features: ['Digital sign-in', 'Lead capture', 'Auto follow-up', 'Analytics'],
    pricing: { type: 'credits', credits: 1 },
    status: 'development'
  },

  // ==================== ANALYTICS & INTEL ====================
  {
    id: 'market-oracle',
    name: 'Market Oracle',
    slug: 'market-oracle',
    category: 'Analytics',
    description: 'AI-powered market intelligence',
    features: ['Market trends', 'Competitor analysis', 'Industry reports', 'Custom alerts'],
    pricing: { type: 'credits', credits: 5 },
    status: 'live'
  },
  {
    id: 'competitive-intel',
    name: 'Competitive Intelligence',
    slug: 'competitive-intel',
    category: 'Analytics',
    description: 'Track and analyze competitors',
    features: ['Website monitoring', 'Pricing tracking', 'Feature comparison', 'Alert system'],
    pricing: { type: 'credits', credits: 3 },
    status: 'live'
  },

  // ==================== DEVELOPMENT TOOLS ====================
  {
    id: 'site-builder',
    name: 'Website Builder',
    slug: 'site-builder',
    category: 'Development',
    description: 'Build websites without code',
    features: ['Drag-and-drop', 'Responsive design', 'Custom domains', 'SEO tools'],
    pricing: { type: 'subscription', price: 29, interval: 'month' },
    status: 'development'
  },
  {
    id: 'api-builder',
    name: 'API Builder',
    slug: 'api-builder',
    category: 'Development',
    description: 'Create REST APIs without code',
    features: ['Visual editor', 'Database integration', 'Authentication', 'Documentation'],
    pricing: { type: 'credits', credits: 5 },
    status: 'planned'
  },

  // ==================== VERIFICATION & COMPLIANCE ====================
  {
    id: 'verifyforge',
    name: 'VerifyForge',
    slug: 'verifyforge',
    category: 'Compliance',
    description: 'Identity and document verification',
    features: ['ID verification', 'Document authentication', 'Background checks', 'Compliance reports'],
    pricing: { type: 'credits', credits: 3 },
    status: 'live'
  },

  // ==================== ENTERTAINMENT ====================
  {
    id: 'disney-tracker',
    name: 'Disney Deal Tracker',
    slug: 'disney-tracker',
    category: 'Entertainment',
    description: 'Track Disney vacation deals and prices',
    features: ['Price alerts', 'Deal notifications', 'Package comparisons', 'Booking assistance'],
    pricing: { type: 'free' },
    status: 'live'
  },
  {
    id: 'barrelverse',
    name: 'Barrelverse',
    slug: 'barrelverse',
    category: 'Entertainment',
    description: 'Bourbon and whiskey community platform',
    features: ['Tasting notes', 'Collection tracking', 'Community reviews', 'Bottle finder'],
    pricing: { type: 'free' },
    status: 'live'
  },
  {
    id: 'games-platform',
    name: 'Games Platform',
    slug: 'games',
    category: 'Entertainment',
    description: '1,200+ games with rewards',
    features: ['Casual games', 'Earn credits', 'Leaderboards', 'Achievements'],
    pricing: { type: 'free' },
    status: 'development'
  },

  // ==================== CRAIVERSE ====================
  {
    id: 'craiverse',
    name: 'CRAIverse',
    slug: 'craiverse',
    category: 'Virtual World',
    description: 'Virtual world with social impact modules',
    features: [
      'Avatar-based AI assistants',
      'Veterans support module',
      'First responders module',
      'Faith-based community module',
      'Mental health resources',
      'Job training programs'
    ],
    pricing: { type: 'free' },
    status: 'planned'
  }
];

// =====================================================
// SEARCH & FILTER
// =====================================================

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.features.some(f => f.toLowerCase().includes(q))
  );
}

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter(p => p.category.toLowerCase() === category.toLowerCase());
}

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find(p => p.slug === slug);
}

export function getLiveProducts(): Product[] {
  return PRODUCTS.filter(p => p.status === 'live');
}

export function getProductCategories(): string[] {
  return [...new Set(PRODUCTS.map(p => p.category))];
}

// =====================================================
// PRODUCT KNOWLEDGE FOR AI
// =====================================================

export function getProductKnowledgeForAI(): string {
  let knowledge = '## CR AUDIOVIZ AI PRODUCT CATALOG\n\n';
  
  const categories = getProductCategories();
  
  for (const category of categories) {
    knowledge += `### ${category}\n\n`;
    const products = getProductsByCategory(category);
    
    for (const p of products) {
      knowledge += `**${p.name}** (${p.status})\n`;
      knowledge += `${p.description}\n`;
      knowledge += `Features: ${p.features.slice(0, 3).join(', ')}\n`;
      knowledge += `Pricing: ${p.pricing.type === 'free' ? 'Free' : p.pricing.type === 'credits' ? `${p.pricing.credits} credits` : `$${p.pricing.price}/${p.pricing.interval}`}\n\n`;
    }
  }
  
  return knowledge;
}

export default {
  PRODUCTS,
  searchProducts,
  getProductsByCategory,
  getProductBySlug,
  getLiveProducts,
  getProductCategories,
  getProductKnowledgeForAI
};
