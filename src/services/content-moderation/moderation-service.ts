import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';
import { EventEmitter } from 'events';
export interface ContentSubmission {
export interface MLAnalysisResult {
export interface HumanReviewDecision {
export interface ModerationResult {
export interface AppealSubmission {
export interface AppealDecision {
export interface ModerationConfig {
export interface ModerationMetrics {
    // Assign to reviewer
      // Check if content is eligible for appeal
      // Insert appeal
      // Notify moderators
      // Update appeal status
      // If appeal approved, update original moderation result
          // Notify user of successful appeal
      // Get user email
export default {}
