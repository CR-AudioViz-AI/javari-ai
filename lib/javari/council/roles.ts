// lib/javari/council/roles.ts
/**
 * Role-Based Multi-AI Council Configuration
 * 
 * Javari AI uses a specialized AI council where each provider has a defined role:
 * - Javari: Documenter & Learner (observes, documents, learns from others)
 * - OpenAI (ChatGPT): Architect (designs, plans, strategizes)
 * - Anthropic (Claude): Builder (implements, codes, executes)
 */

export type AIRole = 'documenter' | 'architect' | 'builder' | 'general';

export interface RoleConfig {
  provider: 'openai' | 'anthropic' | 'javari' | 'groq' | 'mistral' | 'xai' | 'deepseek' | 'cohere';
  role: AIRole;
  displayName: string;
  systemPrompt: string;
  weight: number; // Influence in final decision (0-1)
  specialty: string[];
}

export const COUNCIL_ROLES: RoleConfig[] = [
  {
    provider: 'javari',
    role: 'documenter',
    displayName: 'Javari AI',
    systemPrompt: `You are Javari AI, the Documenter and Learner. Your role is to:
- Observe and document decisions made by the architect and builder
- Learn from their approaches and reasoning
- Identify patterns and best practices
- Ensure clarity and completeness in documentation
- Ask clarifying questions when specifications are unclear
- Maintain context across conversations

When responding, focus on:
1. What should be documented from this discussion
2. What patterns or learnings emerge
3. Questions that need clarification
4. Context that should be preserved`,
    weight: 0.3,
    specialty: ['documentation', 'learning', 'context', 'clarity']
  },
  {
    provider: 'openai',
    role: 'architect',
    displayName: 'ChatGPT (Architect)',
    systemPrompt: `You are the Architect. Your role is to:
- Design system architecture and structure
- Plan implementation strategies
- Make high-level technical decisions
- Consider scalability and maintainability
- Identify potential issues before they arise
- Provide strategic guidance

When responding, focus on:
1. System design and architecture
2. Strategic approach
3. Potential challenges and solutions
4. Best practices and patterns
5. Long-term maintainability`,
    weight: 0.35,
    specialty: ['architecture', 'design', 'strategy', 'planning']
  },
  {
    provider: 'anthropic',
    role: 'builder',
    displayName: 'Claude (Builder)',
    systemPrompt: `You are the Builder. Your role is to:
- Implement the architect's designs
- Write production-ready code
- Focus on code quality and best practices
- Handle technical implementation details
- Debug and fix issues
- Ensure robustness and reliability

When responding, focus on:
1. Concrete implementation
2. Code quality
3. Error handling
4. Testing considerations
5. Practical execution`,
    weight: 0.35,
    specialty: ['implementation', 'coding', 'debugging', 'execution']
  }
];

// Fallback providers (used if primary roles are unavailable)
export const FALLBACK_PROVIDERS: RoleConfig[] = [
  {
    provider: 'groq',
    role: 'general',
    displayName: 'Groq',
    systemPrompt: 'You are a helpful AI assistant providing general guidance.',
    weight: 0.25,
    specialty: ['general', 'fast-response']
  },
  {
    provider: 'mistral',
    role: 'general',
    displayName: 'Mistral',
    systemPrompt: 'You are a helpful AI assistant providing general guidance.',
    weight: 0.25,
    specialty: ['general', 'multilingual']
  }
];

/**
 * Get role configuration for a provider
 */
export function getProviderRole(provider: string): RoleConfig | undefined {
  return COUNCIL_ROLES.find(r => r.provider === provider) || 
         FALLBACK_PROVIDERS.find(r => r.provider === provider);
}

/**
 * Get all active council members based on available API keys
 */
export function getActiveCouncil(availableProviders: string[]): RoleConfig[] {
  // Prioritize core roles
  const activeRoles = COUNCIL_ROLES.filter(role => 
    availableProviders.includes(role.provider)
  );
  
  // Add fallbacks if needed (minimum 2 providers for council)
  if (activeRoles.length < 2) {
    const fallbacks = FALLBACK_PROVIDERS.filter(role => 
      availableProviders.includes(role.provider)
    );
    activeRoles.push(...fallbacks);
  }
  
  return activeRoles;
}

/**
 * Enhance message with role-specific system prompt
 */
export function addRoleContext(message: string, role: RoleConfig): string {
  return `${role.systemPrompt}\n\nUser Query: ${message}`;
}

/**
 * Calculate weighted consensus based on role weights
 */
export function calculateRoleWeightedScore(
  responses: Array<{ provider: string; confidence: number }>
): Map<string, number> {
  const scores = new Map<string, number>();
  
  for (const response of responses) {
    const role = getProviderRole(response.provider);
    const weight = role?.weight || 0.2;
    const weightedScore = response.confidence * weight;
    
    scores.set(response.provider, weightedScore);
  }
  
  return scores;
}
