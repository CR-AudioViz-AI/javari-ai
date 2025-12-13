'use client';

// components/ChatListWithStatus.tsx
// Javari AI Enhanced Chat List - Status, Progress, Breadcrumbs
// Version: 1.0.0
// Timestamp: 2025-12-13 9:50 AM EST

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  Star,
  Trash2,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Zap,
  Clock,
  Link2,
  CheckCircle,
  Circle,
  Activity,
} from 'lucide-react';

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
  messageCount: number;
}

interface ChatListWithStatusProps {
  userId: string;
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onContinueChat: (chatId: string) => void;
}

// Progress bar component
function ProgressBar({ 
  percentage, 
  warningLevel,
  showLabel = true,
  height = 'h-1.5'
}: { 
  percentage: number; 
  warningLevel: 'none' | 'warning' | 'critical';
  showLabel?: boolean;
  height?: string;
}) {
  const getColor = () => {
    if (warningLevel === 'critical') return 'bg-red-500';
    if (warningLevel === 'warning') return 'bg-yellow-500';
    if (percentage > 50) return 'bg-cyan-500';
    return 'bg-green-500';
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-slate-700 rounded-full ${height} overflow-hidden`}>
        <div
          className={`${height} ${getColor()} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-0.5 text-[10px]">
          <span className={warningLevel === 'critical' ? 'text-red-400' : 'text-slate-500'}>
            {percentage}% used
          </span>
          {warningLevel === 'critical' && (
            <span className="text-red-400 flex items-center gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" />
              Continue soon
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Build progress indicator
function BuildIndicator({ progress, status }: { progress: number; status: string }) {
  if (status === 'idle' || progress === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      {status === 'building' && (
        <>
          <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
          <span className="text-[10px] text-cyan-400">Building {progress}%</span>
        </>
      )}
      {status === 'complete' && (
        <>
          <CheckCircle className="w-3 h-3 text-green-400" />
          <span className="text-[10px] text-green-400">Built</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertTriangle className="w-3 h-3 text-red-400" />
          <span className="text-[10px] text-red-400">Build failed</span>
        </>
      )}
    </div>
  );
}

// Status dot
function StatusDot({ isActive, warningLevel }: { isActive: boolean; warningLevel: string }) {
  if (isActive) {
    return (
      <div className="relative">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75" />
      </div>
    );
  }
  
  if (warningLevel === 'critical') {
    return <div className="w-2 h-2 bg-red-500 rounded-full" />;
  }
  
  if (warningLevel === 'warning') {
    return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
  }
  
  return <div className="w-2 h-2 bg-slate-500 rounded-full" />;
}

// Breadcrumbs component
function Breadcrumbs({ 
  items, 
  onSelect 
}: { 
  items: BreadcrumbItem[]; 
  onSelect: (id: string) => void;
}) {
  if (items.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/50 border-b border-slate-700 text-[10px] overflow-x-auto">
      <Link2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <button
            onClick={() => onSelect(item.id)}
            className={`flex-shrink-0 px-1.5 py-0.5 rounded transition-colors ${
              item.isCurrent
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            Part {item.position + 1}
            <span className="text-slate-500 ml-1">({item.messageCount})</span>
          </button>
          {index < items.length - 1 && (
            <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// Single chat item
function ChatItem({
  chat,
  isSelected,
  onSelect,
  onDelete,
  onContinue,
}: {
  chat: ChatStatus;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onContinue: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`relative group cursor-pointer transition-all ${
        isSelected
          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-l-2 border-cyan-500'
          : 'hover:bg-slate-800/50 border-l-2 border-transparent'
      }`}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <StatusDot isActive={chat.isActive} warningLevel={chat.warningLevel} />
            <span className="text-sm text-white truncate font-medium">
              {chat.title}
            </span>
          </div>
          
          {/* Chain indicator */}
          {chat.continuationDepth > 0 && (
            <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
              Part {chat.continuationDepth + 1}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {chat.messageCount}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(chat.lastActivityAt)}
          </span>
          {chat.isActive && (
            <span className="flex items-center gap-1 text-green-400">
              <Activity className="w-3 h-3" />
              Active
            </span>
          )}
        </div>

        {/* Context usage bar */}
        <div className="mt-2">
          <ProgressBar 
            percentage={chat.contextPercentage} 
            warningLevel={chat.warningLevel}
            height="h-1"
          />
        </div>

        {/* Build indicator */}
        <BuildIndicator progress={chat.buildProgress} status={chat.buildStatus} />

        {/* Continuation warning */}
        {chat.needsContinuation && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContinue();
            }}
            className="mt-2 w-full py-1.5 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded text-[10px] text-orange-400 hover:bg-orange-500/30 transition-colors flex items-center justify-center gap-1"
          >
            <Zap className="w-3 h-3" />
            Continue in new chat
          </button>
        )}
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors"
            title="Delete chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// Format time helper
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

// Main component
export default function ChatListWithStatus({
  userId,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onContinueChat,
}: ChatListWithStatusProps) {
  const [chats, setChats] = useState<ChatStatus[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch chat statuses
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

  // Fetch breadcrumbs for current chat
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

  // Initial fetch and polling
  useEffect(() => {
    fetchChats();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchChats, 5000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  // Fetch breadcrumbs when current chat changes
  useEffect(() => {
    fetchBreadcrumbs();
  }, [fetchBreadcrumbs]);

  // Filter chats
  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate active and inactive
  const activeChats = filteredChats.filter(c => c.isActive);
  const recentChats = filteredChats.filter(c => !c.isActive);

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-3 border-b border-slate-700">
        <button
          onClick={onNewChat}
          className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
        
        {/* Search */}
        <input
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full mt-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <Breadcrumbs items={breadcrumbs} onSelect={onSelectChat} />
      )}

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start a new chat above</p>
          </div>
        ) : (
          <>
            {/* Active chats section */}
            {activeChats.length > 0 && (
              <div>
                <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Active ({activeChats.length})
                </div>
                {activeChats.map(chat => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isSelected={chat.id === currentChatId}
                    onSelect={() => onSelectChat(chat.id)}
                    onDelete={() => onDeleteChat(chat.id)}
                    onContinue={() => onContinueChat(chat.id)}
                  />
                ))}
              </div>
            )}

            {/* Recent chats section */}
            {recentChats.length > 0 && (
              <div>
                <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Recent ({recentChats.length})
                </div>
                {recentChats.map(chat => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isSelected={chat.id === currentChatId}
                    onSelect={() => onSelectChat(chat.id)}
                    onDelete={() => onDeleteChat(chat.id)}
                    onContinue={() => onContinueChat(chat.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer stats */}
      <div className="p-3 border-t border-slate-700 bg-slate-800/50">
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="text-center">
            <div className="text-cyan-400 font-bold">{chats.length}</div>
            <div className="text-slate-500">Total Chats</div>
          </div>
          <div className="text-center">
            <div className="text-green-400 font-bold">{activeChats.length}</div>
            <div className="text-slate-500">Active</div>
          </div>
        </div>
      </div>
    </div>
  );
}
