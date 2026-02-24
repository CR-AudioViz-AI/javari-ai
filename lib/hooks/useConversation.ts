/**
 * useConversation Hook
 * React hook for managing conversations (CRUD operations)
 */

import { useState, useCallback } from 'react';
import {
  Conversation,
  ConversationListResponse,
  ConversationResponse,
  ConversationSearchResponse,
  CreateConversationInput,
  UpdateConversationInput,
} from '@/types/conversation';

export function useConversation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List conversations
  const listConversations = useCallback(
    async (params?: {
      userId?: string;
      search?: string;
      starred?: boolean;
      projectId?: string;
      status?: string;
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }): Promise<ConversationListResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        if (params?.userId) queryParams.append('userId', params.userId);
        if (params?.search) queryParams.append('search', params.search);
        if (params?.starred !== undefined) queryParams.append('starred', String(params.starred));
        if (params?.projectId) queryParams.append('projectId', params.projectId);
        if (params?.status) queryParams.append('status', params.status);
        if (params?.limit) queryParams.append('limit', String(params.limit));
        if (params?.offset) queryParams.append('offset', String(params.offset));
        if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
        if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

        const response = await fetch(`/api/conversations?${queryParams}`);
        const data: ConversationListResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch conversations');
        }

        return data;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Get single conversation
  const getConversation = useCallback(
    async (id: string): Promise<Conversation | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/conversations/${id}`);
        const data: ConversationResponse = await response.json();

        if (!data.success || !data.conversation) {
          throw new Error(data.error || 'Conversation not found');
        }

        return data.conversation;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Create conversation
  const createConversation = useCallback(
    async (input: CreateConversationInput): Promise<Conversation | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        const data: ConversationResponse = await response.json();

        if (!data.success || !data.conversation) {
          throw new Error(data.error || 'Failed to create conversation');
        }

        return data.conversation;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Update conversation
  const updateConversation = useCallback(
    async (id: string, updates: UpdateConversationInput): Promise<Conversation | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        const data: ConversationResponse = await response.json();

        if (!data.success || !data.conversation) {
          throw new Error(data.error || 'Failed to update conversation');
        }

        return data.conversation;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Delete/Archive conversation
  const deleteConversation = useCallback(
    async (id: string, hardDelete = false): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const url = hardDelete 
          ? `/api/conversations/${id}?hard=true`
          : `/api/conversations/${id}`;

        const response = await fetch(url, { method: 'DELETE' });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to delete conversation');
        }

        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Toggle star
  const toggleStar = useCallback(
    async (id: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/conversations/${id}/star`, {
          method: 'PATCH',
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to toggle star');
        }

        return data.starred;
      } catch (err: any) {
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Search conversations
  const searchConversations = useCallback(
    async (query: string, userId?: string, limit?: number): Promise<ConversationSearchResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        queryParams.append('q', query);
        if (userId) queryParams.append('userId', userId);
        if (limit) queryParams.append('limit', String(limit));

        const response = await fetch(`/api/conversations/search?${queryParams}`);
        const data: ConversationSearchResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Search failed');
        }

        return data;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Export conversation
  const exportConversation = useCallback(
    async (id: string, format: 'json' | 'markdown' = 'json'): Promise<void> => {
      try {
        const response = await fetch(`/api/conversations/${id}/export?format=${format}`);
        
        if (!response.ok) {
          throw new Error('Export failed');
        }

        // Trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation.${format === 'markdown' ? 'md' : 'json'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    []
  );

  return {
    loading,
    error,
    listConversations,
    getConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    toggleStar,
    searchConversations,
    exportConversation,
  };
}
