'use client';

import { useState } from 'react';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    source: string;
    similarity: number;
  }>;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m Javari AI. I can answer questions about your documentation using knowledge-grounded responses. Ask me anything about the MRS naming system, surfaces, modules, or any other topic in the knowledge base.',
    }
  ]);

  const handleNewMessage = (userMessage: string, assistantResponse: string, sources?: Array<{ source: string; similarity: number }>) => {
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
      },
      {
        role: 'assistant',
        content: assistantResponse,
        sources,
      }
    ]);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center">
            <img 
              src="/javari-avatar.png" 
              alt="Javari AI"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback if avatar doesn't exist
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = `
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                  </svg>
                `;
              }}
            />
          </div>
          <div>
            <h1 className="font-bold text-lg">Javari AI</h1>
            <p className="text-xs text-muted-foreground">
              Knowledge-Grounded Assistant • {messages.length} messages
            </p>
          </div>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              role={message.role}
              content={message.content}
              sources={message.sources}
            />
          ))}
        </div>
      </div>

      {/* Chat Input (Fixed at bottom) */}
      <div className="border-t bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <ChatInput
            onMessage={(userMsg, assistantMsg, sources) => {
              handleNewMessage(userMsg, assistantMsg, sources);
            }}
            disabled={false}
          />
        </div>
      </div>
    </div>
  );
}
