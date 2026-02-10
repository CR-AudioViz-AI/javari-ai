'use client';

import { ChatMessage } from '@/lib/chat/ai-providers';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
}

export default function MessageList({ messages, loading }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.length === 0 && !loading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-bold mb-2">Start a Conversation</h2>
            <p>Select a mode and ask anything!</p>
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-3xl rounded-lg p-4 ${
              msg.role === 'user'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-slate-800 border border-purple-500/30 text-gray-100'
            }`}
          >
            {msg.role === 'assistant' && msg.provider && (
              <div className="text-xs text-purple-400 mb-2">
                {msg.provider} • {msg.mode || 'single'}
              </div>
            )}
            
            <div className="whitespace-pre-wrap">{msg.content}</div>

            {msg.metadata?.reasoning && (
              <div className="mt-3 pt-3 border-t border-purple-500/30">
                <div className="text-xs text-purple-300 mb-1">Reasoning:</div>
                <div className="text-sm text-gray-300">{msg.metadata.reasoning}</div>
              </div>
            )}

            {msg.metadata?.steps && (
              <div className="mt-3 pt-3 border-t border-purple-500/30">
                <div className="text-xs text-purple-300 mb-2">Reasoning Steps:</div>
                <div className="space-y-2">
                  {msg.metadata.steps.map((step, idx) => (
                    <div key={idx} className="text-sm bg-slate-900/50 p-2 rounded">
                      <div className="text-purple-400">Step {step.step}: {step.action}</div>
                      <div className="text-gray-300 text-xs mt-1">{step.result}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex justify-start">
          <div className="bg-slate-800 border border-purple-500/30 rounded-lg p-4">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
