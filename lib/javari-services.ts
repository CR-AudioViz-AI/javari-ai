// lib/javari-services.ts
// Updated: December 23, 2025 - Session-based conversations (no auth required)
// Timestamp: 2025-12-23 02:58 PM EST
import { createClient } from '@supabase/supabase-js';
// Get or create a session ID for this browser
export interface Conversation {
export interface Message {
      // Try to get authenticated user first
      // Filter by user_id if logged in, otherwise by session_id
    // Only trigger autonomous build for EXPLICIT build requests
    // Must include specific trigger words AND app-like context
    // For messages that mention "build" but aren't explicit app requests,
    // let the AI handle it conversationally
      // Use absolute URL - get base URL from environment
      // Add auth token if provided
import { Inter } from 'next/font/google';
import './globals.css';
// ═══════════════════════════════════════════════════════════════════════════════
// AUTONOMOUS CONTINUATION METHODS
// ═══════════════════════════════════════════════════════════════════════════════
  // Create a new project (for autonomous work)
  // Get active project for session
  // Update project progress
  // Link conversation to project
  // Create continuation conversation
      // Get project name
export default {}
