import { create } from 'zustand';
// Type Definitions
export type ChatMode = 'single' | 'advanced' | 'super' | 'roadmap';
export interface ChatMessage {
export interface ChatSession {
  // Session management
  // Current chat state
  // Actions
  // Message management
  // Session management
  // Send message
  // Initial state
  // Simple setters
  // Message management
  // Session management
  // Send message function
    // Add user message
      // Save session
      // Show council if SuperMode
      // Save error session
export default {}
