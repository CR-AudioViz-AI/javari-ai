/**
 * Conversation Types
 * TypeScript definitions for conversation data structures
 */

export type ConversationStatus = 'active' | 'inactive' | 'archived';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  tokens?: number;
}

export interface Conversation {
  // IDs
  id: string;
  numeric_id: number;
  
  // Relationships
  user_id: string;
  project_id?: string | null;
  subproject_id?: string | null;
  parent_id?: string | null;
  
  // Content
  title: string;
  summary?: string | null;
  messages: Message[] | string; // Can be string from DB or parsed array
  
  // Status & Organization
  status: ConversationStatus;
  starred: boolean;
  continuation_depth: number;
  message_count: number;
  
  // AI Context
  model: string;
  total_tokens: number;
  cost_usd: number;
  
  // Metadata
  tags?: string[];
  metadata?: Record<string, any> | string;
  
  // Audit Trail
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  last_message_at?: string | null;
}

export interface ConversationListResponse {
  success: boolean;
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
  error?: string;
}

export interface ConversationResponse {
  success: boolean;
  conversation?: Conversation;
  error?: string;
}

export interface ConversationSearchResponse {
  success: boolean;
  query: string;
  results: Partial<Conversation>[];
  count: number;
  error?: string;
}

export interface CreateConversationInput {
  userId?: string;
  title: string;
  projectId?: string;
  subprojectId?: string;
  parentId?: string;
  model?: string;
  messages?: Message[];
  metadata?: Record<string, any>;
}

export interface UpdateConversationInput {
  title?: string;
  summary?: string;
  messages?: Message[];
  starred?: boolean;
  status?: ConversationStatus;
  projectId?: string;
  subprojectId?: string;
  metadata?: Record<string, any>;
  totalTokens?: number;
  costUsd?: number;
}
