/**
 * ConversationList Component
 * Lists conversations with search, filter, and sort capabilities
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ConversationCard } from './ConversationCard';
import { useConversation } from '@/lib/hooks/useConversation';
import { Conversation } from '@/types/conversation';
import { Search, Star, Archive, Loader2, RefreshCw } from 'lucide-react';

interface ConversationListProps {
  userId?: string;
  onSelectConversation?: (conversation: Conversation) => void;
  selectedId?: string;
  showArchived?: boolean;
}

export function ConversationList({
  userId = 'default-user',
  onSelectConversation,
  selectedId,
  showArchived = false,
}: ConversationListProps) {
  const {
    listConversations,
    deleteConversation,
    toggleStar,
    updateConversation,
    exportConversation,
    loading,
    error,
  } = useConversation();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at');
  const [totalCount, setTotalCount] = useState(0);

  // Load conversations
  const loadConversations = async () => {
    const result = await listConversations({
      userId,
      search: searchQuery || undefined,
      starred: showStarredOnly || undefined,
      status: showArchived ? 'archived' : 'active',
      sortBy,
      sortOrder: 'desc',
      limit: 50,
    });

    if (result) {
      setConversations(result.conversations);
      setTotalCount(result.total);
    }
  };

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [userId, showStarredOnly, showArchived, sortBy]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadConversations();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle star toggle
  const handleToggleStar = async (id: string) => {
    await toggleStar(id);
    loadConversations(); // Reload to get updated data
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    const success = await deleteConversation(id, false); // Soft delete (archive)
    if (success) {
      loadConversations();
    }
  };

  // Handle archive
  const handleArchive = async (id: string) => {
    await updateConversation(id, { status: 'archived' });
    loadConversations();
  };

  // Handle export
  const handleExport = async (id: string, format: 'json' | 'markdown') => {
    await exportConversation(id, format);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {showArchived ? 'Archived Conversations' : 'Conversations'}
          </h2>
          <button
            onClick={loadConversations}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={`text-gray-600 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${showStarredOnly 
                ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' 
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }
            `}
          >
            <Star size={14} fill={showStarredOnly ? 'currentColor' : 'none'} />
            Starred
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'updated_at' | 'created_at')}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value="updated_at">Recently Updated</option>
            <option value="created_at">Recently Created</option>
          </select>
        </div>

        {/* Count */}
        <div className="mt-3 text-sm text-gray-500">
          {totalCount} conversation{totalCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-purple-600" size={32} />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            <p>Error loading conversations</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
            <p>No conversations found</p>
            <p className="text-sm mt-1">
              {searchQuery 
                ? 'Try a different search term' 
                : 'Start a new conversation to see it here'
              }
            </p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === selectedId}
              onSelect={onSelectConversation}
              onToggleStar={handleToggleStar}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onExport={handleExport}
            />
          ))
        )}
      </div>
    </div>
  );
}

const MessageSquare = ({ size, className }: { size: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
