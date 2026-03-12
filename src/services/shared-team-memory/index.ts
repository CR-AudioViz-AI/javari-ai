import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
export interface MemoryNode {
export interface TeamContext {
export interface ConflictResolution {
export interface MemorySearchOptions {
export interface MemoryOperationResult {
export interface CompressionConfig {
    // Prioritize based on confidence and recency
    // Fetch recent insights
    // Sort memories by importance score
    // Preserve high-priority memories
    // Compress remaining memories
    // Combine content
    // Merge metadata
export default {}
