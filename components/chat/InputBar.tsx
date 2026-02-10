'use client';

import { useState, KeyboardEvent } from 'react';
import { ChatMode } from '@/lib/chat/ai-providers';

interface Props {
  onSendMessage: (message: string) => void;
  disabled: boolean;
  mode: ChatMode;
}

export default function InputBar({ onSendMessage, disabled, mode }: Props) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getModeIndicator = () => {
    switch (mode) {
      case 'super':
        return '🎯 SuperMode: AI Council';
      case 'advanced':
        return '🧠 Advanced: Javari Orchestrator';
      case 'roadmap':
        return '🗺️ Roadmap Builder';
      default:
        return '💬 Single Mode';
    }
  };

  return (
    <div className="bg-slate-800/50 border-t border-purple-500/30 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-xs text-purple-400 mb-2">{getModeIndicator()}</div>
        <div className="flex space-x-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={disabled}
            className="flex-1 bg-slate-900 border border-purple-500/30 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
            rows={3}
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
