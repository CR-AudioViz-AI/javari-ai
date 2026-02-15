// lib/javari/utils/preprocessPrompt.ts
// FIXED: Updated to use current OpenAI model names (gpt-4o, not gpt-4-turbo-preview)

export interface PreprocessResult {
  rewrittenPrompt: string;
  modelToUse: 'gpt-4o' | 'gpt-4o-mini';  // FIXED: Updated model names
  nounTrigger: boolean;
}

// Deep codegen trigger nouns that benefit from lighter model
const DEEP_CODEGEN_NOUNS = [
  'screen', 'app', 'page', 'platform', 'system', 'dashboard',
  'ui', 'component', 'frontend', 'authentication', 'auth',
  'registration', 'full-stack', 'builder', 'interface',
  'website', 'site', 'portal', 'application', 'form'
];

/**
 * Centralized prompt preprocessing for all execution paths
 * Rewrites slow triggers and selects optimal model
 * 
 * Model Selection Logic:
 * - Deep codegen (UI, apps, systems) → gpt-4o-mini (faster, cheaper)
 * - Everything else → gpt-4o (higher quality, reasoning)
 */
export function preprocessPrompt(message: string): PreprocessResult {
  let rewritten = message;
  
  // Remove polite prefixes that add no value
  rewritten = rewritten.replace(/^(can you|could you|please|would you|will you|may you)\s+/gi, '');
  
  // Rewrite slow verb triggers to more direct commands
  rewritten = rewritten.replace(/\bcreate\s+/gi, 'build ');
  rewritten = rewritten.replace(/\bmake\s+/gi, 'develop ');
  rewritten = rewritten.replace(/\bgenerate\s+a\s+full\s+/gi, 'produce a ');
  rewritten = rewritten.replace(/\bwrite\s+me\s+/gi, 'write ');
  rewritten = rewritten.replace(/\bhelp\s+me\s+/gi, '');
  
  // Remove redundant words
  rewritten = rewritten.replace(/\s+that\s+can\s+/gi, ' that ');
  rewritten = rewritten.replace(/\s+which\s+will\s+/gi, ' to ');
  
  rewritten = rewritten.trim();
  
  // Detect deep codegen trigger nouns
  const lowerPrompt = rewritten.toLowerCase();
  const nounTrigger = DEEP_CODEGEN_NOUNS.some(noun => lowerPrompt.includes(noun));
  
  // Choose model based on noun detection
  // FIXED: Use current OpenAI model names
  const modelToUse = nounTrigger ? 'gpt-4o-mini' : 'gpt-4o';
  
  console.log('[preprocessPrompt] Analysis:', {
    original: message.substring(0, 50),
    rewritten: rewritten.substring(0, 50),
    nounTrigger,
    modelSelected: modelToUse
  });
  
  return {
    rewrittenPrompt: rewritten,
    modelToUse,
    nounTrigger
  };
}
