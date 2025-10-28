/**
 * JAVARI AI - USE CONVERSATION HOOK
 * State management for conversations with auto-save
 * 
 * Features:
 * - Load conversation by ID
 * - Create new conversation
 * - Auto-save messages
 * - Update conversation metadata
 * - Handle continuation/child conversations
 * 
 * @version 1.0.0
 * @date October 27, 2025 - 9:58 PM ET
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface Conversation {
  id: string;
  numeric_id: number;
  title: string;
  summary?: string;
  status: 'active' | 'inactive' | 'archived';
  starred: boolean;
  model: string;
  message_count: number;
  continuation_depth: number;
  project_id?: string;
  parent_id?: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

interface UseConversationReturn {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  error: string | null;
  createConversation: (data: CreateConversationData) => Promise<Conversation | null>;
  loadConversation: (id: string) => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  updateConversation: (updates: Partial<Conversation>) => Promise<void>;
  clearConversation: () => void;
  generateTitle: (firstMessage: string) => string;
}

interface CreateConversationData {
  user_id: string;
  title?: string;
  project_id?: string;
  subproject_id?: string;
  parent_id?: string;
  model?: string;
  initialMessage?: Message;
}

export function useConversation(conversationId?: string): UseConversationReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load conversation when ID changes
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      clearConversation();
    }
  }, [conversationId]);

  /**
   * Load an existing conversation
   */
  const loadConversation = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/conversations/${id}`);
      const result = await response.json();

      if (result.success && result.data) {
        setConversation(result.data);
        setMessages(result.data.messages || []);
      } else {
        setError(result.error || 'Failed to load conversation');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation');
      console.error('Error loading conversation:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new conversation
   */
  const createConversation = useCallback(async (data: CreateConversationData): Promise<Conversation | null> => {
    try {
      setLoading(true);
      setError(null);

      // Generate title from first message if not provided
      const title = data.title || (
        data.initialMessage 
          ? generateTitle(data.initialMessage.content)
          : 'New Conversation'
      );

      const conversationData = {
        user_id: data.user_id,
        title,
        project_id: data.project_id,
        subproject_id: data.subproject_id,
        parent_id: data.parent_id,
        model: data.model || 'gpt-4',
        messages: data.initialMessage ? [data.initialMessage] : [],
      };

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversationData),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setConversation(result.data);
        setMessages(result.data.messages || []);
        return result.data;
      } else {
        setError(result.error || 'Failed to create conversation');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create conversation');
      console.error('Error creating conversation:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Add a message to the conversation
   * Automatically saves to database
   */
  const addMessage = useCallback(async (message: Message) => {
    if (!conversation) {
      console.error('No active conversation');
      return;
    }

    try {
      // Optimistically update local state
      const newMessages = [...messages, message];
      setMessages(newMessages);

      // Save to database
      const response = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setConversation(result.data);
      } else {
        console.error('Failed to save message:', result.error);
        // Revert optimistic update
        setMessages(messages);
      }
    } catch (err: any) {
      console.error('Error saving message:', err);
      // Revert optimistic update
      setMessages(messages);
    }
  }, [conversation, messages]);

  /**
   * Update conversation metadata
   */
  const updateConversation = useCallback(async (updates: Partial<Conversation>) => {
    if (!conversation) {
      console.error('No active conversation');
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setConversation(result.data);
      } else {
        console.error('Failed to update conversation:', result.error);
      }
    } catch (err: any) {
      console.error('Error updating conversation:', err);
    }
  }, [conversation]);

  /**
   * Clear current conversation
   */
  const clearConversation = useCallback(() => {
    setConversation(null);
    setMessages([]);
    setError(null);
  }, []);

  /**
   * Generate a title from the first message
   */
  const generateTitle = useCallback((firstMessage: string): string => {
    // Take first 60 characters and truncate at word boundary
    let title = firstMessage.slice(0, 60).trim();
    
    if (firstMessage.length > 60) {
      // Find last space to avoid cutting words
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 30) {
        title = title.slice(0, lastSpace);
      }
      title += '...';
    }
    
    return title;
  }, []);

  return {
    conversation,
    messages,
    loading,
    error,
    createConversation,
    loadConversation,
    addMessage,
    updateConversation,
    clearConversation,
    generateTitle,
  };
}
