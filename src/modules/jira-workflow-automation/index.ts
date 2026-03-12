import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { Queue, Worker } from 'bullmq';
export interface JiraTicket {
export interface TicketAnalysis {
export interface WorkflowRule {
export interface RuleCondition {
export interface RuleAction {
export interface AutomationMetrics {
export interface WorkflowEvent {
      // Fallback analysis
    // Use AI analysis category if available and valid
    // Fallback to rule-based categorization
    // Urgency factor (40% weight)
    // Complexity factor (20% weight)
    // Sentiment factor (15% weight)
    // Issue type factor (15% weight)
    // Age factor (10% weight)
      // Get team members and their current workload
      // Get current workload for each team member
          // Calculate workload from active tickets
      // Score each member based on expertise and availability
      // Sort by score and return best match
    // Expertise matching (50% weight)
    // Workload factor (30% weight) - prefer less busy members
    // Historical success rate (20% weight)
    // This would typically query JIRA API for active tickets
    // For now, return a placeholder calculation
    // Get field value based on condition type
    // Evaluate condition based on operator
      // Reload rules to include the new one
      // Generate mock analysis for testing
        // Find user by display name or email
export default {}
