import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { redis } from '../lib/cache/redis';
import { supabase } from '../lib/database/supabase';
import { AnalyticsService } from './analytics.service';
import type { Agent, AgentCapability, AgentSearchContext } from '../types/agent.types';
      // Generate embedding for the query
      // Perform vector similarity search
      // Score and rank results
      // Track search analytics
      // Extract searchable text from agent capabilities
      // Generate embedding for agent capabilities
      // Store embedding in vector database
      // Check if agent exists in index
        // Index as new agent
      // Generate new embedding
      // Update existing record
      // Clear related cache entries
      // Analyze user patterns
      // Get agents with high usage correlation
      // Check cache first
      // Generate new embedding
      // Cache with TTL
        // Get agent embedding for detailed scoring
        // Calculate similarity score
        // Calculate usage score
        // Calculate context score
        // Find matched capabilities
        // Calculate combined relevance score
        // Generate reasoning
    // Sort by relevance score
    // Project context matching
    // Query history relevance
    // User preference matching
      // Keyword matching
    // Weighted combination of scores
    // Implementation would analyze patterns and generate recommendations
    // This is a simplified version
    // Implementation would compare agent capabilities with previous queries
    // Implementation would match agent properties with user preferences
// Export default instance
// Export types for external use
export type {
export default {}
