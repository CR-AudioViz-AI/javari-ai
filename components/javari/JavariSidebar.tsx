'use client';

// components/javari/JavariSidebar.tsx
// Complete Sidebar with Chat Tracking, Status, Breadcrumbs
// Version: 1.0.0
// Timestamp: 2025-12-13 10:15 AM EST

import React, { useState, useCallback, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  Star,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  Zap,
  Clock,
  Link2,
  CheckCircle,
  Circle,
  Activity,
  Search,
  Settings,
  Sparkles,
  Home,
  FolderOpen,
  X,
  ExternalLink,
} from 'lucide-react';

// Colors matching the Javari theme
const COLORS = {
  navy: '#0a1628',
  darkNavy: '#060d18',
  cyan: '#00d4ff',
  purple: '#a855f7',
  white: '#ffffff',
  slate: '#94a3b8',
};

// Types
interface ChatStatus {
  id: string;
  title: string;
  isActive: boolean;
  contextPercentage: number;
  buildProgress: number;
  buildStatus: 'idle' | 'building' | 'complete' | 'error';
  continuationDepth: number;
  parentId: string | null;
  rootConversationId: string | null;
  messageCount: number;
  lastActivityAt: string;
  needsContinuation: boolean;
  warningLevel: 'none' | 'warning' | 'critical';
}

interface BreadcrumbItem {
  id: string;
  title: string;
  position: number;
  isCurrent: boolean;
  isActive: boolean;
  messageCount: number;
}

interface JavariSidebarProps {
  userId: string;
  currentChatId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Context usage progress bar
function ContextBar({ 
  percentage, 
  warningLevel,
  size = 'small'
}: { 
  percentage: number; 
  warningLevel: 'none' | 'warning' | 'critical';
  size?: 'small' | 'large';
}) {
  const getColor = () => {
    if (warningLevel === 'critical') return 'bg-red-500';
    if (warningLevel === 'warning') return 'bg-yellow-500';
    if (percentage > 50) return 'bg-cyan-500';
    return 'bg-emerald-500';
  };

  const height = size === 'large' ? 'h-2' : 'h-1';

  return (
    <div className="w-full">
      <div className={`w-full bg-slate-700/50 rounded-full ${height} overflow-hidden`}>
        <div
          className={`${height} ${getColor()} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}

// Build progress indicator
function BuildBadge({ progress, status }: { progress: number; status: string }) {
  if (status === 'idle' || progress === 0) return null;

  if (status === 'building') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/20 rounded-full">
        <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
        <span className="text-[9px] text-cyan-400 font-medium">{progress}%</span>
      </div>
    );
  }
  
  if (status === 'complete') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 rounded-full">
        <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
        <span className="text-[9px] text-emerald-400 font-medium">Built</span>
      </div>
    );
  }
  
  if (status === 'error') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 rounded-full">
        <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
        <span className="text-[9px] text-red-400 font-medium">Error</span>
      </div>
    );
  }
  
  return null;
}

// Status indicator dot
function StatusDot({ isActive, warningLevel }: { isActive: boolean; warningLevel: string }) {
  if (isActive) {
    return (
      <div className="relative flex-shrink-0">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-75" />
      </div>
    );
  }
  
  if (warningLevel === 'critical') {
    return <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />;
  }
  
  if (warningLevel === 'warning') {
    return <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" />;
  }
  
  return <div className="w-2 h-2 bg-slate-500 rounded-full flex-shrink-0" />;
}

// Chat item component
function ChatItem({
  chat,
  isSelected,
  isCollapsed,
  onSelect,
  onDelete,
  onContinue,
}: {
  chat: ChatStatus;
  isSelected: boolean;
  isCollapsed: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onContinue: () => void;
}) {
  const [hovering, setHovering] = useState(false);

  if (isCollapsed) {
    // Collapsed view - just show status dot
    return (
      <button
        onClick={onSelect}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={`relative w-full p-2 flex justify-center transition-colors ${
          isSelected 
            ? 'bg-cyan-500/20' 
            : 'hover:bg-slate-800/50'
        }`}
        title={`${chat.title} (${chat.contextPercentage}% used)`}
      >
        <StatusDot isActive={chat.isActive} warningLevel={chat.warningLevel} />
        
        {/* Tooltip on hover */}
        {hovering && (
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-lg p-2 shadow-xl whitespace-nowrap">
            <div className="text-xs text-white font-medium">{chat.title}</div>
            <div className="text-[10px] text-slate-400 mt-1">
              {chat.contextPercentage}% context • {chat.messageCount} msgs
            </div>
          </div>
        )}
      </button>
    );
  }

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`group cursor-pointer transition-all border-l-2 ${
        isSelected
          ? 'bg-gradient-to-r from-cyan-500/10 to-transparent border-cyan-500'
          : 'hover:bg-slate-800/30 border-transparent'
      }`}
    >
      <div className="p-3">
        {/* Top row: Status + Title + Build badge */}
        <div className="flex items-start gap-2">
          <StatusDot isActive={chat.isActive} warningLevel={chat.warningLevel} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white truncate font-medium flex-1">
                {chat.title}
              </span>
              <BuildBadge progress={chat.buildProgress} status={chat.buildStatus} />
            </div>
            
            {/* Stats row */}
            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
              <span className="flex items-center gap-0.5">
                <MessageSquare className="w-3 h-3" />
                {chat.messageCount}
              </span>
              <span>•</span>
              <span className={chat.warningLevel === 'critical' ? 'text-red-400' : ''}>
                {chat.contextPercentage}%
              </span>
              {chat.continuationDepth > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Link2 className="w-3 h-3" />
                    Part {chat.continuationDepth + 1}
                  </span>
                </>
              )}
            </div>
          </div>
          
          {/* Delete button */}
          {hovering && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        {/* Context bar */}
        <div className="mt-2">
          <ContextBar 
            percentage={chat.contextPercentage} 
            warningLevel={chat.warningLevel}
          />
        </div>
        
        {/* Continuation button */}
        {chat.needsContinuation && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContinue();
            }}
            className="mt-2 w-full py-1.5 bg-gradient-to-r from-amber-500/10 to-red-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-400 hover:border-amber-500/50 transition-all flex items-center justify-center gap-1.5"
          >
            <Zap className="w-3 h-3" />
            Context full — Continue in new chat
          </button>
        )}
      </div>
    </div>
  );
}

// Breadcrumbs component
function ConversationBreadcrumbs({ 
  items, 
  onSelect,
  isCollapsed,
}: { 
  items: BreadcrumbItem[]; 
  onSelect: (id: string) => void;
  isCollapsed: boolean;
}) {
  if (items.length <= 1 || isCollapsed) return null;

  return (
    <div className="px-3 py-2 bg-slate-800/30 border-b border-slate-700/50">
      <div className="flex items-center gap-1 text-[10px] overflow-x-auto scrollbar-hide">
        <Link2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <button
              onClick={() => onSelect(item.id)}
              className={`flex-shrink-0 px-2 py-0.5 rounded-full transition-all ${
                item.isCurrent
                  ? 'bg-cyan-500/20 text-cyan-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {index + 1}
            </button>
            {index < items.length - 1 && (
              <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Format relative time
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function JavariSidebar({
  userId,
  currentChatId,
  isCollapsed,
  onToggleCollapse,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: JavariSidebarProps) {
  const [chats, setChats] = useState<ChatStatus[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch chats
  const fetchChats = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/javari/chat-status?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch breadcrumbs
  const fetchBreadcrumbs = useCallback(async () => {
    if (!currentChatId) {
      setBreadcrumbs([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/javari/chat-chain?conversationId=${currentChatId}`);
      if (response.ok) {
        const data = await response.json();
        setBreadcrumbs(data.chain || []);
      }
    } catch (error) {
      console.error('Failed to fetch breadcrumbs:', error);
    }
  }, [currentChatId]);

  // Create continuation
  const handleContinue = async (chatId: string) => {
    try {
      const response = await fetch('/api/javari/chat-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentConversationId: chatId,
          userId,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        onSelectChat(data.newConversationId);
        fetchChats();
      }
    } catch (error) {
      console.error('Failed to create continuation:', error);
    }
  };

  // Polling
  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 3000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  useEffect(() => {
    fetchBreadcrumbs();
  }, [fetchBreadcrumbs]);

  // Filter chats
  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const activeChats = filteredChats.filter(c => c.isActive);
  const recentChats = filteredChats.filter(c => !c.isActive);

  // Stats
  const totalContextUsed = chats.reduce((sum, c) => sum + c.contextPercentage, 0);
  const avgContextUsed = chats.length ? Math.round(totalContextUsed / chats.length) : 0;

  return (
    <div 
      className={`h-full flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-14' : 'w-72'
      }`}
      style={{ backgroundColor: COLORS.darkNavy }}
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span className="font-semibold text-white">Javari AI</span>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className={`w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/20 ${
            isCollapsed ? 'px-2' : 'px-4'
          }`}
        >
          <Plus className="w-4 h-4" />
          {!isCollapsed && 'New Chat'}
        </button>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <ConversationBreadcrumbs 
        items={breadcrumbs} 
        onSelect={onSelectChat}
        isCollapsed={isCollapsed}
      />

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            {!isCollapsed && (
              <>
                <p className="text-sm text-slate-400">No conversations</p>
                <p className="text-xs text-slate-500 mt-1">Start a new chat above</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Active Section */}
            {activeChats.length > 0 && (
              <div>
                {!isCollapsed && (
                  <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    Active ({activeChats.length})
                  </div>
                )}
                {activeChats.map(chat => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isSelected={chat.id === currentChatId}
                    isCollapsed={isCollapsed}
                    onSelect={() => onSelectChat(chat.id)}
                    onDelete={() => onDeleteChat(chat.id)}
                    onContinue={() => handleContinue(chat.id)}
                  />
                ))}
              </div>
            )}

            {/* Recent Section */}
            {recentChats.length > 0 && (
              <div>
                {!isCollapsed && (
                  <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Recent ({recentChats.length})
                  </div>
                )}
                {recentChats.slice(0, 20).map(chat => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isSelected={chat.id === currentChatId}
                    isCollapsed={isCollapsed}
                    onSelect={() => onSelectChat(chat.id)}
                    onDelete={() => onDeleteChat(chat.id)}
                    onContinue={() => handleContinue(chat.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Stats */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            <div>
              <div className="text-cyan-400 font-bold text-sm">{chats.length}</div>
              <div className="text-slate-500">Chats</div>
            </div>
            <div>
              <div className="text-emerald-400 font-bold text-sm">{activeChats.length}</div>
              <div className="text-slate-500">Active</div>
            </div>
            <div>
              <div className={`font-bold text-sm ${avgContextUsed > 70 ? 'text-amber-400' : 'text-slate-400'}`}>
                {avgContextUsed}%
              </div>
              <div className="text-slate-500">Avg Use</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
