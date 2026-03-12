import { createClient } from '@supabase/supabase-js';
// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════
export type ValidationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SafetyRisk = 'low' | 'medium' | 'high' | 'critical';
export interface ValidationIssue {
export interface ValidationResult {
export interface RoadmapTask {
export interface Roadmap {
// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// CORE VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════
  // Check roadmap exists
  // Check required fields
  // Check tasks array
  // Validate task IDs are unique
    // Check each prerequisite exists
    // Detect circular dependencies (basic check)
    // Only check pending tasks
  // Collect all required secrets
    // Check each secret via Secret Authority
          // Find which tasks require this secret
    // Skip completed tasks
      // Check per-task limit
  // Check total cost
    // Skip completed tasks
    // Block critical safety risks
    // Warn on high safety risks
// ═══════════════════════════════════════════════════════════════════════════
// MASTER VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════
  // 1. Structure validation
  // If structure is broken, abort further validation
  // 2. Dependency validation
  // 3. Prerequisites validation
  // 4. Secret validation
  // 5. Cost validation
  // 6. Safety validation
  // Categorize issues
export default {}
