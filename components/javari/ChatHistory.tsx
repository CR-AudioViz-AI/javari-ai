'use client';

import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Star, 
  Trash2, 
  Archive, 
  Search,
  ChevronRight,
  Plus,
  Filter,
  Download,
  GitBranch,
  MoreVertical
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  numeric_id: number;
  title: string;
  summary?: string;
  messages: Message[];
  status: 'active' | 'inactive' | 'archived';
  starred: boolean;
  continuation_depth: number;
  message_count: number;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistoryProps {
  userId: string;
  projectId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  onNewChat: () => void;
  onCreateContinuation?: (parentConversation: Conversation) => void;
  currentConversationId?: string;
  refreshTrigger?: number;
}

export function ChatHistory({
  userId,
  projectId,
  onSelectConversation,
  onNewChat,
  onCreateContinuation,
  currentConversationId,
  refreshTrigger = 0
}: ChatHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'active' | 'archived'>('active');
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, [userId, projectId, search, filterStarred, filterStatus, refreshTrigger]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        userId,
        status: filterStatus,
        ...(projectId && { projectId }),
        ...(search && { search }),
        ...(filterStarred && { starred: 'true' }),
      });

      const response = await fetch(`/api/javari/conversations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStar = async (conversationId: string, currentStarred: boolean) => {
    try {
      const response = await fetch(`/api/javari/conversations?id=${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: !currentStarred }),
      });

      if (response.ok) {
        loadConversations();
      }
    } catch (error) {
      console.error('Error toggling star:', error);
    }
  };

  const archiveConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/javari/conversations?id=${conversationId}&archive=true`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadConversations();
      }
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!confirm('Permanently delete this conversation? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/javari/conversations?id=${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadConversations();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const exportConversation = async (conversation: Conversation) => {
    try {
      // Create export data
      const exportData = {
        id: conversation.id,
        numeric_id: conversation.numeric_id,
        title: conversation.title,
        summary: conversation.summary,
        status: conversation.status,
        starred: conversation.starred,
        continuation_depth: conversation.continuation_depth,
        parent_id: conversation.parent_id,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        messages: conversation.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }))
      };

      // Create downloadable file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `javari-conversation-${conversation.numeric_id}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting conversation:', error);
      alert('Failed to export conversation');
    }
  };

  const exportAllConversations = async () => {
    try {
      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: userId,
        total_conversations: conversations.length,
        conversations: conversations.map(conv => ({
          id: conv.id,
          numeric_id: conv.numeric_id,
          title: conv.title,
          summary: conv.summary,
          status: conv.status,
          starred: conv.starred,
          continuation_depth: conv.continuation_depth,
          parent_id: conv.parent_id,
          message_count: conv.message_count,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          messages: conv.messages
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `javari-all-conversations-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting all conversations:', error);
      alert('Failed to export conversations');
    }
  };

  const handleCreateContinuation = async (conversation: Conversation) => {
    if (onCreateContinuation) {
      onCreateContinuation(conversation);
    }
    setActionMenuOpen(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 space-y-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={20} />
          New Chat
        </button>
        
        {conversations.length > 0 && (
          <button
            onClick={exportAllConversations}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Export All
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="p-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilterStarred(!filterStarred)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStarred
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            <Star size={16} className="inline mr-1" />
            Starred
          </button>

          <button
            onClick={() => setFilterStatus(filterStatus === 'active' ? 'archived' : 'active')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'archived'
                ? 'bg-gray-700 text-gray-300 border border-gray-600'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            <Archive size={16} className="inline mr-1" />
            {filterStatus === 'active' ? 'Active' : 'Archived'}
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            {search ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                  currentConversationId === conv.id
                    ? 'bg-blue-600/20 border border-blue-500/30'
                    : 'hover:bg-gray-800 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div 
                    className="flex-1 min-w-0"
                    onClick={() => onSelectConversation(conv)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare size={14} className="text-gray-400 flex-shrink-0" />
                      <h3 className="text-sm font-medium text-white truncate">
                        {conv.title}
                      </h3>
                      {conv.starred && (
                        <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-1">
                      {conv.message_count} messages • {formatDate(conv.updated_at)}
                    </p>
                    {conv.continuation_depth > 0 && (
                      <div className="flex items-center gap-1 text-xs text-blue-400">
                        <ChevronRight size={12} />
                        Continuation #{conv.continuation_depth}
                      </div>
                    )}
                  </div>

                  {/* Actions Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(actionMenuOpen === conv.id ? null : conv.id);
                      }}
                      className="p-1 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical size={16} className="text-gray-400" />
                    </button>

                    {actionMenuOpen === conv.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(conv.id, conv.starred);
                            setActionMenuOpen(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Star size={14} className={conv.starred ? 'fill-yellow-400 text-yellow-400' : ''} />
                          {conv.starred ? 'Unstar' : 'Star'}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateContinuation(conv);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                        >
                          <GitBranch size={14} />
                          Create Continuation
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportConversation(conv);
                            setActionMenuOpen(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Download size={14} />
                          Export
                        </button>

                        <div className="border-t border-gray-700 my-1"></div>

                        {filterStatus === 'active' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveConversation(conv.id);
                              setActionMenuOpen(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Archive size={14} />
                            Archive
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv.id);
                              setActionMenuOpen(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-800 text-xs text-gray-400 text-center">
        {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
