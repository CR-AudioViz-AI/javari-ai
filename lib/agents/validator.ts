import { executeWithRouting } from "@/lib/router/executeWithRouting";
export interface ValidationRequest {
export interface ValidationResult {
    // Parse response
        // Try to extract JSON
  // Try with Claude Sonnet first
  // Retry once with same model
  // Escalate to GPT-4o for second opinion
export default {}
