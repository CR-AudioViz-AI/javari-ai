// lib/javari/utils/preprocessPrompt.ts

export interface PreprocessResult {
  rewrittenPrompt: string;
  modelToUse: 'gpt-4-turbo-preview' | 'gpt-4o-mini';
  nounTrigger: boolean;
}

// Deep codegen trigger nouns that cause GPT-4 Turbo to stall
const DEEP_CODEGEN_NOUNS = [
  'screen', 'app', 'page', 'platform', 'system', 'dashboard',
  'ui', 'component', 'frontend', 'authentication', 'auth',
  'registration', 'full-stack', 'builder', 'interface'
];

/**
 * Centralized prompt preprocessing for all execution paths
 * Rewrites slow triggers and selects optimal model
 */
export function preprocessPrompt(message: string): PreprocessResult {
  let rewritten = message;
  
  // Remove polite prefixes that add no value
  rewritten = rewritten.replace(/^(can you|could you|please|would you)\s+/gi, '');
  
  // Rewrite slow verb triggers
  rewritten = rewritten.replace(/\bcreate\s+/gi, 'build ');
  rewritten = rewritten.replace(/\bmake\s+/gi, 'develop ');
  rewritten = rewritten.replace(/\bgenerate\s+a\s+full\s+/gi, 'produce a ');
  rewritten = rewritten.replace(/\bwrite\s+me\s+/gi, 'write ');
  
  rewritten = rewritten.trim();
  
  // Detect deep codegen trigger nouns
  const lowerPrompt = rewritten.toLowerCase();
  const nounTrigger = DEEP_CODEGEN_NOUNS.some(noun => lowerPrompt.includes(noun));
  
  // Choose model based on noun detection
  const modelToUse = nounTrigger ? 'gpt-4o-mini' : 'gpt-4-turbo-preview';
  
  return {
    rewrittenPrompt: rewritten,
    modelToUse,
    nounTrigger
  };
}
