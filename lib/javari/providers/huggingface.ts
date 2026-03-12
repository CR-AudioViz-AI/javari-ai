// lib/javari/providers/huggingface.ts
// HuggingFace Inference API Provider Adapter
export interface HuggingFaceConfig {
export interface HuggingFaceRequest {
export interface HuggingFaceResponse {
  // Retry loop
      // Handle HTTP errors
        // Model loading (503) - retry
        // Rate limit (429) - retry
        // Authentication error
        // Other errors
      // Parse response
      // Extract generated text
      // Fallback for different response formats
      // Don't retry on auth errors or client errors
      // Timeout error
      // Retry on network errors
  // All retries exhausted
// Helper function
// Export types
export type { HuggingFaceRequest, HuggingFaceResponse };
export default {}
