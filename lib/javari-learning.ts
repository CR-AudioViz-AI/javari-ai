// lib/javari-learning.ts
// Javari AI Learning System - Saves insights to javari_knowledge table
// Timestamp: 2025-11-29 15:15 UTC
// Fixed: Added comprehensive error handling and logging
import { createClient } from '@supabase/supabase-js';
// Types matching javari_knowledge table schema
export interface KnowledgeEntry {
export interface ConversationLearning {
    // Validate inputs
    // Only learn from helpful/successful conversations
    // Analyze the conversation to extract knowledge
    // Check if similar knowledge already exists
      // Continue with insert anyway
      // Update existing knowledge with new insights
          // Merge examples if new ones found
          // Update confidence if this was a successful resolution
    // Prepare insert data with all null checks
    // Insert new knowledge
    // Classify the problem type
    // Skip generic greetings or simple questions
    // Determine topic based on problem type
    // Extract key concepts from the response
    // Create a summary explanation
    // Skip if explanation is too short (lowered threshold from 50 to 20)
    // Extract keywords from both user message and response
    // Determine skill level based on complexity
    // First try exact concept match
    // Try partial match on keywords
    // Find best match by keyword overlap
  // Greetings - don't learn from these
  // Simple factual questions (very short and basic)
  // Technical problems
  // Business/Platform
  // Create a descriptive concept name
  // Capitalize first letter and clean up
  // Add problem type prefix for clarity
  // Take first 500 characters as explanation
  // Remove code blocks for cleaner explanation
  // Try to break at sentence boundary
  // Look for code blocks
  // Look for patterns indicating best practices
  // Look for patterns indicating common mistakes
  // Remove code blocks
  // Common technical keywords to look for
  // Count complexity indicators
  // Advanced patterns
  // Intermediate patterns
  // Beginner patterns (negative score)
      // Count by topic
      // Count verified
      // Count auto-learned
export default {}
