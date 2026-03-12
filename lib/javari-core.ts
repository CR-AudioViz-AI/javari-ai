// lib/javari-core.ts
// JAVARI CORE BOUNDARY - v12.1 with Tool Access
// Single entry point for all requests with GitHub read capability
import { javariLearning } from './javari-learning-system';
import { javariOrchestrator } from './javari-multi-model-orchestrator';
import { javariRoadmap } from './javari-roadmap-system';
import { getGuardrails, isActionAllowed } from './javari-guardrails';
import { toolRegistry } from './javari-tools-init'; // Import initialized registry
// Core request/response types
export interface JavariRequest {
export interface JavariResponse {
export type JavariMode = 'BUILD' | 'ANALYZE' | 'EXECUTE' | 'RECOVER';
// Mode selection engine
    // Error/failure context → RECOVER
    // Build keywords → BUILD
    // Analysis keywords → ANALYZE
    // Action keywords → EXECUTE
    // Default to BUILD (Javari's primary mode)
// Memory-first retrieval
  // Check if this exact query has been answered before
  // For now, stub - will integrate with actual memory store
// Cost-aware model routing
  // Cost table (per 1M tokens)
  // Route based on mode + complexity
  // Default: gpt-4 for general tasks
// Self-healing retry logic
      // On final retry, try fallback if available
// Detect if user is asking for repo structure
// JAVARI CORE
      // Check if user needs repo access
      // 1. Check memory first
      // 2. Select mode
      // 3. Determine complexity
      // 4. Select cheapest capable model
      // 5. Execute with self-healing
          // Primary execution
          // Fallback to next model
      // 6. Track learning
      // RECOVER mode
    // Check if GitHub tool is available
    // Fetch repo tree
    // Format tree for display
    // Group by top-level directories
    // Stub - will connect to actual model providers
// Global instance
export default {}
