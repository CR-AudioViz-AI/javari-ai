import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
export interface PolicyRule {
export interface ComplianceViolation {
export interface ExternalComplianceResult {
export interface ComplianceReport {
export interface ComplianceMetrics {
export type AgentOutput = z.infer<typeof AgentOutputSchema>;
export interface ValidationConfig {
      // This would integrate with AWS SDK in a real implementation
      // For now, simulating the response structure
      // Try to get from cache first
      // Fetch from database
      // Cache for 1 hour
      // Update cache
      // Notify other services about the update
    // Store report in database
    // Score from violations
    // Score from external APIs
    // Normalize to 0-100 scale
      // Store individual violations for detailed tracking
        // Send critical violation webhook
        // Send general violation notification
      // Get cached metrics if available
      // Fetch reports from database
      // Cache for 1 hour
    // Category breakdown
        // Category breakdown
        // Severity distribution
        // Rule violation counts
    // Top violated rules
    // Trends over time (daily aggregation)
export default {}
