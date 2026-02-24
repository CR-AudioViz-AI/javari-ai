/**
 * ConversationCard Component
 * Displays a single conversation in a card format
 */

'use client';

import React from 'react';
import { Conversation } from '@/types/conversation';
import { Star, MessageSquare, Calendar, Trash2, Download, Archive } from 'lucide-react';

interface ConversationCardProps {
  conversation: Conversation;
  onSelect?: (conversation: Conversation) => void;
  onToggleStar?: (id: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onExport?: (id: string, format: 'json' | 'markdown') => void;
  selected?: boolean;
}

export function ConversationCard({
  conversation,
  onSelect,
  onToggleStar,
  onDelete,
  onArchive,
  onExport,
  selected = false,
}: ConversationCardProps) {
  const formattedDate = new Date(conversation.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = new Date(conversation.updated_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className={`
        group relative p-4 rounded-lg border transition-all cursor-pointer
        ${selected 
          ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-300 shadow-md' 
          : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
        }
      `}
      onClick={() => onSelect?.(conversation)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {conversation.title}
          </h3>
          {conversation.continuation_depth > 0 && (
            <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded mt-1">
              Continuation Level {conversation.continuation_depth}
            </span>
          )}
        </div>

        {/* Star Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar?.(conversation.id);
          }}
          className={`
            p-1 rounded hover:bg-gray-100 transition-colors
            ${conversation.starred ? 'text-yellow-500' : 'text-gray-400'}
          `}
          title={conversation.starred ? 'Unstar' : 'Star'}
        >
          <Star
            size={18}
            fill={conversation.starred ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      {/* Summary */}
      {conversation.summary && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {conversation.summary}
        </p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <MessageSquare size={14} />
          <span>{conversation.message_count} messages</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar size={14} />
          <span title={formattedTime}>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-gray-100 rounded">
            {conversation.model}
          </span>
        </div>
      </div>

      {/* Action Buttons (shown on hover) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {onExport && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExport(conversation.id, 'markdown');
            }}
            className="p-1.5 bg-white rounded shadow-sm hover:bg-gray-50 transition-colors"
            title="Export as Markdown"
          >
            <Download size={14} className="text-gray-600" />
          </button>
        )}
        {onArchive && conversation.status !== 'archived' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive(conversation.id);
            }}
            className="p-1.5 bg-white rounded shadow-sm hover:bg-orange-50 transition-colors"
            title="Archive"
          >
            <Archive size={14} className="text-orange-600" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Are you sure you want to delete this conversation?')) {
                onDelete(conversation.id);
              }
            }}
            className="p-1.5 bg-white rounded shadow-sm hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} className="text-red-600" />
          </button>
        )}
      </div>

      {/* Cost Badge (if exists) */}
      {conversation.cost_usd > 0 && (
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          ${conversation.cost_usd.toFixed(4)}
        </div>
      )}
    </div>
  );
}
