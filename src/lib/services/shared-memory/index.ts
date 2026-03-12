import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
export interface MemoryEntry<T = any> {
export interface MemoryMetadata {
export interface TeamContext {
export interface MemoryQuery {
export interface MemoryStore {
export interface MemorySync {
export interface MemoryRetrieval {
export interface MemoryPersistence {
export interface MemoryContext {
export interface SharedMemoryConfig {
    // Tables are assumed to be created via migrations
    // This method would verify table existence and create indexes if needed
      // Generate embedding if content is textual
      // Store in database
      // Cache the entry
      // Check cache first
      // Check Redis cache
      // Fetch from database
      // Update caches
      // Apply filters
      // Apply pagination
      // Apply semantic filtering if embedding provided
      // Update caches
      // Remove from caches
      // Sort by relevance score
      // Get agent's team memories
    // This would integrate with your embedding service
    // For now, return a mock embedding
    // Unsubscribe from all subscriptions
    // Close Redis connection
    // Clear caches
    // Store team context in database
// Export default service instance creator
export default {}
