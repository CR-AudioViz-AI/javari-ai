// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - INTELLIGENT APP ARCHITECT
// The Queen's Brain - Analyzes requests and designs complete applications
// ═══════════════════════════════════════════════════════════════════════════════

import { APP_TYPE_PATTERNS, COMPONENT_TEMPLATES } from './templates';

export interface AppArchitecture {
  appType: string;
  appName: string;
  description: string;
  pages: PageSpec[];
  components: ComponentSpec[];
  hasAuth: boolean;
  hasDatabase: boolean;
  hasDarkMode: boolean;
  features: string[];
}

export interface PageSpec {
  path: string;
  name: string;
  components: string[];
  layout?: string;
}

export interface ComponentSpec {
  name: string;
  type: string;
  customCode?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP TYPE DETECTION - Understand what the user wants
// ═══════════════════════════════════════════════════════════════════════════════

export function detectAppType(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  let bestMatch = 'landing'; // Default to landing page
  let highestScore = 0;
  
  for (const [appType, patterns] of Object.entries(APP_TYPE_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      if (lowerPrompt.includes(pattern)) {
        score += pattern.split(' ').length; // Weight multi-word matches higher
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = appType;
    }
  }
  
  return bestMatch;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE EXTRACTION - What features does the app need?
// ═══════════════════════════════════════════════════════════════════════════════

export function extractFeatures(prompt: string): string[] {
  const features: string[] = [];
  const lowerPrompt = prompt.toLowerCase();
  
  // Feature detection patterns
  const featurePatterns = {
    search: ['search', 'find', 'filter', 'lookup'],
    auth: ['login', 'signup', 'authentication', 'account', 'user'],
    cart: ['cart', 'checkout', 'purchase', 'buy'],
    analytics: ['analytics', 'charts', 'graphs', 'metrics', 'data'],
    responsive: ['responsive', 'mobile', 'tablet'],
    animation: ['animate', 'animation', 'motion', 'transition'],
    forms: ['form', 'input', 'submit', 'contact'],
    api: ['api', 'data', 'fetch', 'backend'],
    realtime: ['realtime', 'real-time', 'live', 'websocket'],
    export: ['export', 'download', 'pdf', 'csv'],
    notification: ['notification', 'alert', 'toast'],
    dark: ['dark', 'dark mode', 'night mode'],
    multilingual: ['multilingual', 'i18n', 'translation', 'language']
  };
  
  for (const [feature, patterns] of Object.entries(featurePatterns)) {
    if (patterns.some(p => lowerPrompt.includes(p))) {
      features.push(feature);
    }
  }
  
  // Always include dark mode - Javari's signature
  if (!features.includes('dark')) {
    features.push('dark');
  }
  
  return features;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ARCHITECTURE DESIGN - Design the complete application structure
// ═══════════════════════════════════════════════════════════════════════════════

export function designArchitecture(prompt: string, appName: string): AppArchitecture {
  const appType = detectAppType(prompt);
  const features = extractFeatures(prompt);
  
  const architecture: AppArchitecture = {
    appType,
    appName,
    description: prompt,
    pages: [],
    components: [],
    hasAuth: features.includes('auth'),
    hasDatabase: features.includes('api') || appType === 'ecommerce',
    hasDarkMode: true, // Always dark - Javari's signature style
    features
  };
  
  // Design pages and components based on app type
  switch (appType) {
    case 'dashboard':
      architecture.pages = [
        { path: '/', name: 'Dashboard', components: ['DashboardStats', 'Chart', 'DataTable'] }
      ];
      architecture.components = [
        { name: 'DashboardStats', type: 'dashboardStats' },
        { name: 'Chart', type: 'chart' },
        { name: 'DataTable', type: 'dataTable' }
      ];
      break;
      
    case 'landing':
      architecture.pages = [
        { path: '/', name: 'Home', components: ['Header', 'Hero', 'Features', 'Testimonials', 'Pricing', 'Contact', 'Footer'] }
      ];
      architecture.components = [
        { name: 'Header', type: 'header' },
        { name: 'Hero', type: 'hero' },
        { name: 'Features', type: 'features' },
        { name: 'Testimonials', type: 'testimonials' },
        { name: 'Pricing', type: 'pricing' },
        { name: 'Contact', type: 'contact' },
        { name: 'Footer', type: 'footer' }
      ];
      break;
      
    case 'ecommerce':
      architecture.pages = [
        { path: '/', name: 'Shop', components: ['Header', 'ProductGrid', 'Footer'] }
      ];
      architecture.components = [
        { name: 'Header', type: 'header' },
        { name: 'ProductCard', type: 'productCard' },
        { name: 'ProductGrid', type: 'custom' },
        { name: 'Footer', type: 'footer' }
      ];
      break;
      
    case 'pricing':
      architecture.pages = [
        { path: '/', name: 'Pricing', components: ['Header', 'Pricing', 'Footer'] }
      ];
      architecture.components = [
        { name: 'Header', type: 'header' },
        { name: 'Pricing', type: 'pricing' },
        { name: 'Footer', type: 'footer' }
      ];
      break;
      
    case 'kanban':
      architecture.pages = [
        { path: '/', name: 'Board', components: ['Kanban'] }
      ];
      architecture.components = [
        { name: 'Kanban', type: 'kanban' }
      ];
      break;
      
    case 'contact':
      architecture.pages = [
        { path: '/', name: 'Contact', components: ['Header', 'Contact', 'Footer'] }
      ];
      architecture.components = [
        { name: 'Header', type: 'header' },
        { name: 'Contact', type: 'contact' },
        { name: 'Footer', type: 'footer' }
      ];
      break;
      
    case 'table':
      architecture.pages = [
        { path: '/', name: 'Data', components: ['DataTable'] }
      ];
      architecture.components = [
        { name: 'DataTable', type: 'dataTable' }
      ];
      break;
      
    default:
      // For unknown types, create a landing page with hero
      architecture.pages = [
        { path: '/', name: 'Home', components: ['Header', 'Hero', 'Features', 'Footer'] }
      ];
      architecture.components = [
        { name: 'Header', type: 'header' },
        { name: 'Hero', type: 'hero' },
        { name: 'Features', type: 'features' },
        { name: 'Footer', type: 'footer' }
      ];
  }
  
  return architecture;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT GENERATION - Get the code for each component
// ═══════════════════════════════════════════════════════════════════════════════

export function getComponentCode(componentType: string): string {
  return COMPONENT_TEMPLATES[componentType as keyof typeof COMPONENT_TEMPLATES] || '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE GENERATION - Generate page code that uses components
// ═══════════════════════════════════════════════════════════════════════════════

export function generatePageCode(page: PageSpec, components: ComponentSpec[]): string {
  const imports = components
    .filter(c => page.components.includes(c.name))
    .map(c => `import ${c.name} from '@/components/${c.name}';`)
    .join('\n');
  
  const componentTags = page.components
    .map(name => `        <${name} />`)
    .join('\n');
  
  return `import type { Metadata } from 'next';
${imports}

export const metadata: Metadata = {
  title: '${page.name}',
  description: 'Built with Javari AI'
};

export default function ${page.name.replace(/\s/g, '')}Page() {
  return (
    <main className="min-h-screen bg-gray-900">
${componentTags}
    </main>
  );
}
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL PROJECT GENERATION - Generate all files for the project
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProjectFile {
  path: string;
  content: string;
}

export function generateFullProject(architecture: AppArchitecture): ProjectFile[] {
  const files: ProjectFile[] = [];
  const sanitizedName = architecture.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  // Package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name: sanitizedName,
      version: '1.0.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint'
      },
      dependencies: {
        next: '14.2.35',
        react: '^18',
        'react-dom': '^18'
      },
      devDependencies: {
        '@types/node': '^20',
        '@types/react': '^18',
        '@types/react-dom': '^18',
        typescript: '^5',
        tailwindcss: '^3.4.1',
        postcss: '^8',
        autoprefixer: '^10'
      }
    }, null, 2)
  });
  
  // TypeScript config
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: {
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] }
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules']
    }, null, 2)
  });
  
  // Tailwind config
  files.push({
    path: 'tailwind.config.ts',
    content: `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          900: '#0f1419',
          800: '#1a1f2e',
          700: '#2d3548',
        }
      }
    },
  },
  plugins: [],
};

export default config;
`
  });
  
  // PostCSS config
  files.push({
    path: 'postcss.config.mjs',
    content: `const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`
  });
  
  // Next.js config
  files.push({
    path: 'next.config.mjs',
    content: `/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`
  });
  
  // .gitignore
  files.push({
    path: '.gitignore',
    content: `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`
  });
  
  // next-env.d.ts
  files.push({
    path: 'next-env.d.ts',
    content: `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`
  });
  
  // README
  files.push({
    path: 'README.md',
    content: `# ${architecture.appName}

${architecture.description}

## Built with Javari AI 🚀

This application was autonomously generated by Javari AI.

### Features
${architecture.features.map(f => `- ${f}`).join('\n')}

### Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000)

---

*Built with ❤️ by Javari AI - The Queen of Autonomous Development*
`
  });
  
  // Global CSS
  files.push({
    path: 'app/globals.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 255, 255, 255;
  --background-start-rgb: 15, 20, 25;
  --background-end-rgb: 15, 20, 25;
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
    to bottom,
    transparent,
    rgb(var(--background-end-rgb))
  )
  rgb(var(--background-start-rgb));
}

/* Javari AI Signature Dark Theme */
html {
  color-scheme: dark;
}

* {
  scrollbar-width: thin;
  scrollbar-color: #374151 #1f2937;
}

*::-webkit-scrollbar {
  width: 8px;
}

*::-webkit-scrollbar-track {
  background: #1f2937;
}

*::-webkit-scrollbar-thumb {
  background-color: #374151;
  border-radius: 4px;
}
`
  });
  
  // Layout
  files.push({
    path: 'app/layout.tsx',
    content: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '${architecture.appName}',
  description: '${architecture.description}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`
  });
  
  // Generate components
  for (const component of architecture.components) {
    const code = component.type === 'custom' 
      ? generateCustomComponent(component.name, architecture)
      : getComponentCode(component.type);
    
    if (code) {
      files.push({
        path: `components/${component.name}.tsx`,
        content: code
      });
    }
  }
  
  // Generate pages
  for (const page of architecture.pages) {
    const pageCode = generatePageCode(page, architecture.components);
    const pagePath = page.path === '/' ? 'app/page.tsx' : `app${page.path}/page.tsx`;
    files.push({
      path: pagePath,
      content: pageCode
    });
  }
  
  return files;
}

// Generate custom components for specific patterns
function generateCustomComponent(name: string, architecture: AppArchitecture): string {
  if (name === 'ProductGrid') {
    return `"use client";

import ProductCard from './ProductCard';

const products = [
  { id: '1', name: 'Premium Wireless Headphones', price: 299.99, rating: 4.5, reviews: 128 },
  { id: '2', name: 'Smart Watch Pro', price: 399.99, rating: 4.8, reviews: 256 },
  { id: '3', name: 'Bluetooth Speaker', price: 149.99, rating: 4.3, reviews: 89 },
  { id: '4', name: 'Noise Cancelling Earbuds', price: 199.99, rating: 4.6, reviews: 203 },
  { id: '5', name: 'Portable Charger', price: 49.99, rating: 4.4, reviews: 412 },
  { id: '6', name: 'USB-C Hub', price: 79.99, rating: 4.2, reviews: 156 }
];

export default function ProductGrid() {
  return (
    <section className="py-16 px-4 md:px-8 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-8">Featured Products</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
`;
  }
  
  return '';
}

export default {
  detectAppType,
  extractFeatures,
  designArchitecture,
  getComponentCode,
  generatePageCode,
  generateFullProject
};
