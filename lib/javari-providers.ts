// lib/javari-providers.ts
// Unified provider adapters with identity enforcement
import { getJavariSystemPrompt } from './javari-system-prompt';
export interface ProviderConfig {
export interface ProviderResponse {
// Generic provider responses that indicate identity failure
// OpenAI Provider
  // Ensure system prompt is FIRST message
  // IDENTITY ENFORCEMENT
// Anthropic Provider  
  // Claude uses system param, not system message
  // IDENTITY ENFORCEMENT
// Perplexity Provider (OpenAI-compatible)
  // IDENTITY ENFORCEMENT
// Unified provider interface
export default {}
