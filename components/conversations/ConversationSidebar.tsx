/**
 * ConversationSidebar Component
 * Sidebar with conversation history for the chat interface
 */

'use client';

import React, { useState } from 'react';
import { ConversationList } from './ConversationList';
import { Conversation } from '@/types/conversation';
import { X, Plus, Archive } from 'lucide-react';

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation?: (conversation: Conversation) => void;
  onNewConversation?: () => void;
  currentConversationId?: string;
  userId?: string;
}

export function ConversationSidebar({
  isOpen,
  onClose,
  onSelectConversation,
  onNewConversation,
  currentConversationId,
  userId,
}: ConversationSidebarProps) {
  const [showArchived, setShowArchived] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`
          fixed lg:relative top-0 left-0 h-full bg-white shadow-2xl z-50
          w-80 lg:w-96 flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <h2 className="text-xl font-bold text-gray-900">Chat History</h2>
          <div className="flex items-center gap-2">
            {onNewConversation && (
              <button
                onClick={onNewConversation}
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                title="New Conversation"
              >
                <Plus size={18} />
              </button>
            )}
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`
                p-2 rounded-lg transition-colors
                ${showArchived 
                  ? 'bg-orange-100 text-orange-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
              title={showArchived ? 'Show Active' : 'Show Archived'}
            >
              <Archive size={18} />
            </button>
            <button
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-hidden">
          <ConversationList
            userId={userId}
            onSelectConversation={(conversation) => {
              onSelectConversation?.(conversation);
              onClose(); // Close sidebar on mobile after selection
            }}
            selectedId={currentConversationId}
            showArchived={showArchived}
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 text-center">
          {showArchived ? 'Viewing Archived Conversations' : 'Active Conversations'}
        </div>
      </div>
    </>
  );
}
