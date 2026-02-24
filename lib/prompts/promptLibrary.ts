export interface PromptExample {
  id: string;
  title: string;
  prompt: string;
  category: string;
  subcategory: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  expectedOutput: string;
}

export const PROMPT_CATEGORIES = {
  CODE_GENERATION: 'Code Generation',
  DEBUGGING: 'Debugging & Troubleshooting',
  REFACTORING: 'Refactoring & Optimization',
  TESTING: 'Testing & Quality Assurance',
  DOCUMENTATION: 'Documentation',
  API_DEVELOPMENT: 'API Development',
  DATABASE: 'Database Operations',
  DEPLOYMENT: 'Deployment & DevOps',
  SECURITY: 'Security',
  ARCHITECTURE: 'Architecture & Design',
};

export const PROMPT_LIBRARY: PromptExample[] = [
  // CODE GENERATION
  {
    id: 'cg-001',
    title: 'Create React Component',
    prompt: 'Create a React component for a user profile card with props for name, email, avatar, and bio. Include TypeScript types and Tailwind styling.',
    category: 'Code Generation',
    subcategory: 'React Components',
    tags: ['react', 'typescript', 'tailwind', 'component'],
    difficulty: 'beginner',
    expectedOutput: 'TypeScript React component file with props interface and styled JSX',
  },
  {
    id: 'cg-002',
    title: 'API Route with Validation',
    prompt: 'Create a Next.js API route for user registration that validates email format, password strength (8+ chars, uppercase, number), and checks for duplicate emails in Supabase.',
    category: 'Code Generation',
    subcategory: 'API Routes',
    tags: ['nextjs', 'api', 'validation', 'supabase'],
    difficulty: 'intermediate',
    expectedOutput: 'Complete API route with validation logic and error handling',
  },
  {
    id: 'cg-003',
    title: 'Database Schema',
    prompt: 'Generate a Supabase migration for a blog system with tables for posts, authors, comments, and categories. Include proper foreign keys, indexes, and RLS policies.',
    category: 'Code Generation',
    subcategory: 'Database Schema',
    tags: ['supabase', 'database', 'migration', 'rls'],
    difficulty: 'advanced',
    expectedOutput: 'SQL migration file with complete schema and security policies',
  },
  {
    id: 'cg-004',
    title: 'Custom Hook',
    prompt: 'Create a React hook called useDebounce that delays updating a value until the user stops typing for 500ms. Include TypeScript types.',
    category: 'Code Generation',
    subcategory: 'React Hooks',
    tags: ['react', 'hooks', 'typescript', 'utility'],
    difficulty: 'intermediate',
    expectedOutput: 'Custom React hook with TypeScript implementation',
  },
  {
    id: 'cg-005',
    title: 'Form with Validation',
    prompt: 'Build a multi-step form component with client-side validation, progress indicator, and data persistence to localStorage. Use React Hook Form and Zod for validation.',
    category: 'Code Generation',
    subcategory: 'Forms',
    tags: ['react', 'forms', 'validation', 'zod'],
    difficulty: 'advanced',
    expectedOutput: 'Complete form implementation with validation and state management',
  },
  
  // DEBUGGING
  {
    id: 'db-001',
    title: 'Fix TypeScript Error',
    prompt: 'This code throws "Type X is not assignable to type Y". Analyze the error and provide the correct types with explanation.',
    category: 'Debugging & Troubleshooting',
    subcategory: 'TypeScript Issues',
    tags: ['typescript', 'debugging', 'types'],
    difficulty: 'intermediate',
    expectedOutput: 'Corrected code with type definitions and explanation',
  },
  {
    id: 'db-002',
    title: 'Debug API Call Failure',
    prompt: 'My API endpoint returns 500 error intermittently. Check for race conditions, missing error handling, and database connection issues. Here\'s the code: [paste code]',
    category: 'Debugging & Troubleshooting',
    subcategory: 'API Issues',
    tags: ['api', 'debugging', 'errors', 'async'],
    difficulty: 'advanced',
    expectedOutput: 'Root cause analysis with fixes for async issues',
  },
  {
    id: 'db-003',
    title: 'Memory Leak Investigation',
    prompt: 'Application memory usage grows over time. Identify memory leaks in event listeners, closures, and React component lifecycle.',
    category: 'Debugging & Troubleshooting',
    subcategory: 'Performance',
    tags: ['debugging', 'memory', 'performance', 'react'],
    difficulty: 'advanced',
    expectedOutput: 'List of memory leaks with fixes',
  },
  {
    id: 'db-004',
    title: 'Fix Hydration Error',
    prompt: 'Getting "Hydration failed" error in Next.js. The component renders differently on server vs client. Find and fix the issue.',
    category: 'Debugging & Troubleshooting',
    subcategory: 'Next.js Issues',
    tags: ['nextjs', 'ssr', 'hydration', 'debugging'],
    difficulty: 'intermediate',
    expectedOutput: 'Identified hydration mismatch with solution',
  },
  
  // REFACTORING
  {
    id: 'rf-001',
    title: 'Extract Reusable Logic',
    prompt: 'This component has 500 lines with duplicate logic. Extract reusable functions, create custom hooks, and split into smaller components.',
    category: 'Refactoring & Optimization',
    subcategory: 'Code Organization',
    tags: ['refactoring', 'react', 'components', 'hooks'],
    difficulty: 'intermediate',
    expectedOutput: 'Refactored code split into logical modules',
  },
  {
    id: 'rf-002',
    title: 'Optimize Performance',
    prompt: 'Page takes 5 seconds to load. Analyze bundle size, implement code splitting, lazy loading, and optimize images. Generate performance report.',
    category: 'Refactoring & Optimization',
    subcategory: 'Performance',
    tags: ['performance', 'optimization', 'webpack', 'lazy-loading'],
    difficulty: 'advanced',
    expectedOutput: 'Performance optimizations with before/after metrics',
  },
  {
    id: 'rf-003',
    title: 'Convert to TypeScript',
    prompt: 'Convert this JavaScript codebase to TypeScript. Add proper interfaces, types, and fix any type errors. Maintain backward compatibility.',
    category: 'Refactoring & Optimization',
    subcategory: 'TypeScript Migration',
    tags: ['typescript', 'migration', 'types'],
    difficulty: 'advanced',
    expectedOutput: 'Fully typed TypeScript version of code',
  },
  {
    id: 'rf-004',
    title: 'Modernize API Calls',
    prompt: 'Replace all callback-based API calls with async/await. Add proper error handling, loading states, and retry logic.',
    category: 'Refactoring & Optimization',
    subcategory: 'Async Patterns',
    tags: ['async', 'api', 'refactoring', 'error-handling'],
    difficulty: 'intermediate',
    expectedOutput: 'Modern async/await implementation with error handling',
  },
  
  // TESTING
  {
    id: 'ts-001',
    title: 'Unit Tests for Component',
    prompt: 'Write comprehensive unit tests for this React component using Jest and React Testing Library. Test all props, user interactions, and edge cases.',
    category: 'Testing & Quality Assurance',
    subcategory: 'Unit Testing',
    tags: ['testing', 'jest', 'react', 'unit-tests'],
    difficulty: 'intermediate',
    expectedOutput: 'Complete test suite with 90%+ coverage',
  },
  {
    id: 'ts-002',
    title: 'API Integration Tests',
    prompt: 'Create integration tests for authentication API routes. Test successful login, failed login, token refresh, and logout flows.',
    category: 'Testing & Quality Assurance',
    subcategory: 'Integration Testing',
    tags: ['testing', 'api', 'integration', 'auth'],
    difficulty: 'advanced',
    expectedOutput: 'Integration test suite for API endpoints',
  },
  {
    id: 'ts-003',
    title: 'E2E Test Scenario',
    prompt: 'Write Playwright tests for complete user registration flow: form validation, submission, email verification, and first login.',
    category: 'Testing & Quality Assurance',
    subcategory: 'E2E Testing',
    tags: ['testing', 'playwright', 'e2e', 'automation'],
    difficulty: 'advanced',
    expectedOutput: 'E2E test covering full user journey',
  },
  {
    id: 'ts-004',
    title: 'Mock External APIs',
    prompt: 'Create MSW (Mock Service Worker) mocks for all external API calls. Include success responses, error scenarios, and network failures.',
    category: 'Testing & Quality Assurance',
    subcategory: 'Mocking',
    tags: ['testing', 'mocking', 'msw', 'api'],
    difficulty: 'intermediate',
    expectedOutput: 'Complete MSW mock handlers',
  },
  
  // DOCUMENTATION
  {
    id: 'doc-001',
    title: 'API Documentation',
    prompt: 'Generate OpenAPI/Swagger documentation for all API endpoints. Include request/response schemas, authentication, and example calls.',
    category: 'Documentation',
    subcategory: 'API Docs',
    tags: ['documentation', 'api', 'openapi', 'swagger'],
    difficulty: 'intermediate',
    expectedOutput: 'Complete OpenAPI specification',
  },
  {
    id: 'doc-002',
    title: 'Component Storybook',
    prompt: 'Create Storybook stories for design system components. Show all variants, states (loading, error, success), and interactive props.',
    category: 'Documentation',
    subcategory: 'Component Docs',
    tags: ['documentation', 'storybook', 'components', 'design-system'],
    difficulty: 'intermediate',
    expectedOutput: 'Storybook stories with all component variants',
  },
  {
    id: 'doc-003',
    title: 'README Generator',
    prompt: 'Generate a comprehensive README.md with installation instructions, API usage examples, configuration options, and troubleshooting guide.',
    category: 'Documentation',
    subcategory: 'Project Docs',
    tags: ['documentation', 'readme', 'markdown'],
    difficulty: 'beginner',
    expectedOutput: 'Well-structured README with all sections',
  },
  {
    id: 'doc-004',
    title: 'Code Comments',
    prompt: 'Add JSDoc comments to all functions, classes, and complex logic. Include param types, return types, and usage examples.',
    category: 'Documentation',
    subcategory: 'Code Comments',
    tags: ['documentation', 'jsdoc', 'comments'],
    difficulty: 'beginner',
    expectedOutput: 'Code with comprehensive JSDoc comments',
  },
  
  // API DEVELOPMENT
  {
    id: 'api-001',
    title: 'RESTful CRUD API',
    prompt: 'Create complete CRUD API for [resource] with GET (list & single), POST, PATCH, DELETE. Include pagination, filtering, and sorting.',
    category: 'API Development',
    subcategory: 'REST APIs',
    tags: ['api', 'crud', 'rest', 'pagination'],
    difficulty: 'intermediate',
    expectedOutput: 'Complete REST API with all CRUD operations',
  },
  {
    id: 'api-002',
    title: 'API Rate Limiting',
    prompt: 'Implement rate limiting middleware for API routes. Allow 100 requests per minute per IP, return 429 with retry-after header.',
    category: 'API Development',
    subcategory: 'Security',
    tags: ['api', 'rate-limiting', 'security', 'middleware'],
    difficulty: 'advanced',
    expectedOutput: 'Rate limiting middleware implementation',
  },
  {
    id: 'api-003',
    title: 'Webhook Handler',
    prompt: 'Create webhook endpoint for Stripe payments. Verify signature, handle all event types (payment_intent.succeeded, failed, etc), and update database.',
    category: 'API Development',
    subcategory: 'Webhooks',
    tags: ['api', 'webhooks', 'stripe', 'payments'],
    difficulty: 'advanced',
    expectedOutput: 'Secure webhook handler with event processing',
  },
  {
    id: 'api-004',
    title: 'GraphQL API',
    prompt: 'Convert REST API to GraphQL using Apollo Server. Create schemas, resolvers, and implement DataLoader for N+1 query optimization.',
    category: 'API Development',
    subcategory: 'GraphQL',
    tags: ['api', 'graphql', 'apollo', 'optimization'],
    difficulty: 'advanced',
    expectedOutput: 'Complete GraphQL API with optimized queries',
  },
  
  // DATABASE
  {
    id: 'db-schema-001',
    title: 'Database Migration',
    prompt: 'Create migration to add user_preferences table with JSONB column. Include indexes for performance and update existing users with default preferences.',
    category: 'Database Operations',
    subcategory: 'Migrations',
    tags: ['database', 'migration', 'postgresql', 'supabase'],
    difficulty: 'intermediate',
    expectedOutput: 'SQL migration with rollback script',
  },
  {
    id: 'db-schema-002',
    title: 'Complex Query Optimization',
    prompt: 'This query takes 30 seconds. Add indexes, rewrite joins, and optimize the query plan. Show EXPLAIN ANALYZE before and after.',
    category: 'Database Operations',
    subcategory: 'Optimization',
    tags: ['database', 'sql', 'optimization', 'performance'],
    difficulty: 'advanced',
    expectedOutput: 'Optimized query with performance comparison',
  },
  {
    id: 'db-schema-003',
    title: 'Row Level Security',
    prompt: 'Implement RLS policies for multi-tenant SaaS. Users should only see their organization\'s data. Include policies for read, insert, update, delete.',
    category: 'Database Operations',
    subcategory: 'Security',
    tags: ['database', 'rls', 'security', 'supabase'],
    difficulty: 'advanced',
    expectedOutput: 'Complete RLS policy setup',
  },
  
  // DEPLOYMENT
  {
    id: 'deploy-001',
    title: 'CI/CD Pipeline',
    prompt: 'Create GitHub Actions workflow for automated testing, building, and deployment to Vercel. Run tests on PR, deploy preview for branches, production for main.',
    category: 'Deployment & DevOps',
    subcategory: 'CI/CD',
    tags: ['deployment', 'github-actions', 'cicd', 'vercel'],
    difficulty: 'advanced',
    expectedOutput: 'Complete GitHub Actions workflow file',
  },
  {
    id: 'deploy-002',
    title: 'Environment Variables',
    prompt: 'Set up environment variable management for dev, staging, production. Create .env.example, document all variables, and add validation.',
    category: 'Deployment & DevOps',
    subcategory: 'Configuration',
    tags: ['deployment', 'env-vars', 'configuration'],
    difficulty: 'beginner',
    expectedOutput: 'Environment setup with validation',
  },
  {
    id: 'deploy-003',
    title: 'Docker Configuration',
    prompt: 'Create Dockerfile and docker-compose.yml for local development. Include hot reload, database, and environment setup.',
    category: 'Deployment & DevOps',
    subcategory: 'Docker',
    tags: ['deployment', 'docker', 'devops', 'containers'],
    difficulty: 'advanced',
    expectedOutput: 'Complete Docker setup for development',
  },
  
  // SECURITY
  {
    id: 'sec-001',
    title: 'Authentication System',
    prompt: 'Implement JWT-based authentication with refresh tokens. Include login, logout, token refresh, and protected route middleware.',
    category: 'Security',
    subcategory: 'Authentication',
    tags: ['security', 'authentication', 'jwt', 'tokens'],
    difficulty: 'advanced',
    expectedOutput: 'Complete auth system with JWT',
  },
  {
    id: 'sec-002',
    title: 'Input Sanitization',
    prompt: 'Add input sanitization to prevent XSS attacks. Sanitize all user inputs, validate against whitelist, and escape output.',
    category: 'Security',
    subcategory: 'XSS Prevention',
    tags: ['security', 'xss', 'validation', 'sanitization'],
    difficulty: 'intermediate',
    expectedOutput: 'Input sanitization implementation',
  },
  {
    id: 'sec-003',
    title: 'CSRF Protection',
    prompt: 'Implement CSRF token generation and validation for all POST/PUT/DELETE requests. Use double-submit cookie pattern.',
    category: 'Security',
    subcategory: 'CSRF Prevention',
    tags: ['security', 'csrf', 'tokens', 'protection'],
    difficulty: 'advanced',
    expectedOutput: 'CSRF protection middleware',
  },
  
  // ARCHITECTURE
  {
    id: 'arch-001',
    title: 'Microservices Design',
    prompt: 'Design microservices architecture for e-commerce platform. Define services (products, orders, users, payments), APIs, and data flow.',
    category: 'Architecture & Design',
    subcategory: 'System Design',
    tags: ['architecture', 'microservices', 'design', 'system'],
    difficulty: 'advanced',
    expectedOutput: 'Architecture diagram and service definitions',
  },
  {
    id: 'arch-002',
    title: 'State Management',
    prompt: 'Design state management solution using Zustand. Define stores, actions, selectors, and persistence strategy.',
    category: 'Architecture & Design',
    subcategory: 'State Management',
    tags: ['architecture', 'state', 'zustand', 'react'],
    difficulty: 'intermediate',
    expectedOutput: 'Complete state management setup',
  },
  {
    id: 'arch-003',
    title: 'Scalability Plan',
    prompt: 'Create scalability plan for app expecting 10x traffic growth. Include caching strategy, database scaling, CDN setup, and load balancing.',
    category: 'Architecture & Design',
    subcategory: 'Scalability',
    tags: ['architecture', 'scalability', 'performance', 'infrastructure'],
    difficulty: 'advanced',
    expectedOutput: 'Comprehensive scalability roadmap',
  },
];

// Helper function to get prompts by category
export function getPromptsByCategory(category: string): PromptExample[] {
  return PROMPT_LIBRARY.filter(prompt => prompt.category === category);
}

// Helper function to search prompts
export function searchPrompts(query: string): PromptExample[] {
  const lowerQuery = query.toLowerCase();
  return PROMPT_LIBRARY.filter(prompt =>
    prompt.title.toLowerCase().includes(lowerQuery) ||
    prompt.prompt.toLowerCase().includes(lowerQuery) ||
    prompt.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

// Helper function to get random prompts for the scrolling bar
export function getRandomPrompts(count: number = 10): PromptExample[] {
  const shuffled = [...PROMPT_LIBRARY].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
