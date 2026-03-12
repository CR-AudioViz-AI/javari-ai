import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Redis from 'ioredis';
export interface AgentSearchResult {
export interface SearchQuery {
export interface AgentIndexData {
export interface SemanticSearchConfig {
      // Check cache first
      // Generate new embedding
      // Cache the result
      // Create searchable text
      // Generate embedding
      // Store/update agent data
      // Store embedding
      // Process the query
      // Check cache first
      // Generate query embedding
      // Perform vector similarity search
      // Rank and score results
      // Apply final filtering
      // Cache results
      // Add category filter
      // Add tag filter
      // Perform similarity search using pgvector
export default {}
