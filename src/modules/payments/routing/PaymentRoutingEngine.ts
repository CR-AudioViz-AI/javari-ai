import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
export interface PaymentProcessor {
export interface PaymentRoutingRequest {
export interface PaymentRoutingResult {
export interface RoutingRule {
export interface SuccessRateMetric {
export interface CostCalculation {
      // Invalidate cache
    // North America
    // Europe
    // Asia Pacific
    // Latin America
    // Middle East & Africa
        // Apply exclusions
        // Apply preferences
    // Select next backup processor
      // Get available processors
      // Filter by currency support
      // Filter by amount limits
      // Apply routing rules
      // Calculate costs
      // Get success rates
      // Sort by score (higher is better)
export default {}
