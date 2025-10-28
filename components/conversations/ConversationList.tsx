/**
 * JAVARI AI - CONVERSATION LIST COMPONENT
 * Sidebar showing all conversations with filtering and search
 * 
 * Features:
 * - List all active/starred conversations
 * - Search and filter
 * - Group by projects
 * - Star/unstar conversations
 * - Quick actions (archive, delete, export)
 * - Create new conversation
 * 
 * @version 1.0.0
 * @date October 27, 2025 - 9:57 PM ET
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Star,
  StarOff,
  Archive,
  Trash2,
  Download,
  Plus,
  FolderKanban,
  MessageSquare,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

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
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

interface Project {
  id: string;
  name: string;
  conversations: Conversation[];
}

interface ConversationListProps {
  userId: string;
  currentConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  onCreateConversation: () => void;
  className?: string;
}

export default function ConversationList({
  userId,
  currentConversationId,
  onSelectConversation,
  onCreateConversation,
  className = '',
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'starred'>('all');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showActions, setShowActions] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, [filterStatus, searchQuery]);

  async function loadConversations() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filterStatus === 'active') {
        params.append('status', 'active');
      } else if (filterStatus === 'starred') {
        params.append('starred', 'true');
      }
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/conversations?${params}`);
      const result = await response.json();

      if (result.success) {
        setConversations(result.data);
        groupByProjects(result.data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  function groupByProjects(convos: Conversation[]) {
    // Group conversations by project
    const grouped = new Map<string, Conversation[]>();
    const noProject: Conversation[] = [];

    convos.forEach(conv => {
      if (conv.project_id) {
        if (!grouped.has(conv.project_id)) {
          grouped.set(conv.project_id, []);
        }
        grouped.get(conv.project_id)!.push(conv);
      } else {
        noProject.push(conv);
      }
    });

    // Convert to project array
    const projectList: Project[] = [];
    
    // Add "No Project" group if there are ungrouped conversations
    if (noProject.length > 0) {
      projectList.push({
        id: 'no-project',
        name: 'Ungrouped',
        conversations: noProject,
      });
    }

    // Add other projects (in real app, fetch project names from API)
    grouped.forEach((convos, projectId) => {
      projectList.push({
        id: projectId,
        name: `Project ${projectId.slice(0, 8)}...`,
        conversations: convos,
      });
    });

    setProjects(projectList);
  }

  async function toggleStar(conversation: Conversation, e: React.MouseEvent) {
    e.stopPropagation();
    
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/star`, {
        method: 'POST',
      });
      
      if (response.ok) {
        loadConversations();
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  }

  async function archiveConversation(conversation: Conversation, e: React.MouseEvent) {
    e.stopPropagation();
    setShowActions(null);
    
    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      
      if (response.ok) {
        loadConversations();
      }
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  }

  async function deleteConversation(conversation: Conversation, e: React.MouseEvent) {
    e.stopPropagation();
    setShowActions(null);
    
    if (!confirm(`Delete "${conversation.title}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/conversations/${conversation.id}?soft=false`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        loadConversations();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }

  function toggleProject(projectId: string) {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  }

  function formatDate(dateString: string): string {
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
    return date.toLocaleDateString();
  }

  return (
    <div className={`flex flex-col h-full bg-[#0a0a0a] border-r border-zinc-800 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Conversations</h2>
          <button
            onClick={onCreateConversation}
            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
            title="New Conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              filterStatus === 'all'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              filterStatus === 'active'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterStatus('starred')}
            className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              filterStatus === 'starred'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <Star className="w-3 h-3 inline mr-1" />
            Starred
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-zinc-500">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="p-4 text-center text-zinc-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No conversations yet</p>
            <p className="text-xs mt-1">Start a new conversation!</p>
          </div>
        ) : (
          <div className="p-2">
            {projects.map(project => (
              <div key={project.id} className="mb-2">
                {/* Project Header */}
                <button
                  onClick={() => toggleProject(project.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
                >
                  {expandedProjects.has(project.id) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <FolderKanban className="w-4 h-4" />
                  <span className="flex-1 text-left truncate">{project.name}</span>
                  <span className="text-xs text-zinc-600">{project.conversations.length}</span>
                </button>

                {/* Conversations */}
                {expandedProjects.has(project.id) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {project.conversations.map(conversation => (
                      <div
                        key={conversation.id}
                        onClick={() => onSelectConversation(conversation)}
                        className={`relative group px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          currentConversationId === conversation.id
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'hover:bg-zinc-900 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 mt-0.5 text-zinc-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium text-white truncate flex-1">
                                {conversation.title}
                              </h3>
                              <button
                                onClick={(e) => toggleStar(conversation, e)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {conversation.starred ? (
                                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                ) : (
                                  <StarOff className="w-4 h-4 text-zinc-600 hover:text-yellow-400" />
                                )}
                              </button>
                            </div>
                            {conversation.summary && (
                              <p className="text-xs text-zinc-500 truncate mt-1">
                                {conversation.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-600">
                              <span>{conversation.message_count} msgs</span>
                              <span>•</span>
                              <span>{formatDate(conversation.last_message_at || conversation.updated_at)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        {showActions === conversation.id && (
                          <div className="absolute right-2 top-2 flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 shadow-lg z-10">
                            <button
                              onClick={(e) => archiveConversation(conversation, e)}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                              title="Archive"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => deleteConversation(conversation, e)}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-zinc-800 flex gap-2">
        <button
          onClick={() => window.location.href = '/api/conversations/export?format=json'}
          className="flex-1 px-3 py-2 text-sm bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>
    </div>
  );
}
