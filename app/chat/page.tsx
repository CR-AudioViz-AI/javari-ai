/**
 * Javari AI - Production Chat Interface
 * Clean implementation - no terms gating, no demo UI
 * 
 * @version 2.0.0
 * @date 2026-01-28
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Download, 
  Trash2,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    source: string;
    similarity: number;
  }>;
  timestamp?: string;
}

export default function ChatPage() {
  const { toast } = useToast();
  
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewMessage = (
    userMessage: string, 
    assistantMessage: string, 
    sources?: Array<{ source: string; similarity: number }>
  ) => {
    const timestamp = new Date().toISOString();
    
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp,
      },
      {
        role: 'assistant',
        content: assistantMessage,
        sources,
        timestamp,
      },
    ]);
  };

  const handleClearChat = () => {
    if (confirm('Clear all messages?')) {
      setMessages([]);
      toast({
        title: 'Chat Cleared',
        description: 'All messages have been removed',
      });
    }
  };

  const handleExportChat = () => {
    const chatText = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `javari-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Chat Exported',
      description: 'Downloaded as text file',
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg flex items-center gap-2">
              Javari AI
              <Badge variant="outline" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                Production
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Your intelligent AI assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportChat}
            disabled={messages.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearChat}
            disabled={messages.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </header>

      {/* Chat Container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Brain className="w-10 h-10 text-white" />
            </div>
            
            <div className="space-y-2 max-w-md">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                Welcome to Javari AI
              </h2>
              <p className="text-muted-foreground text-lg">
                Your intelligent AI assistant is ready to help.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
              <Badge variant="secondary" className="px-3 py-1">
                💬 Natural conversations
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                🎯 Context-aware responses
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                ⚡ Fast & reliable
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                🔒 Secure & private
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground max-w-lg">
              Start a conversation by typing a message below. Javari understands context 
              and can help with a wide range of tasks.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <ChatMessage
                key={index}
                role={message.role}
                content={message.content}
                sources={message.sources}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Chat Input - Fixed at bottom */}
      <div className="border-t bg-card px-4 py-4">
        <ChatInput
          onMessage={handleNewMessage}
          disabled={isLoading}
        />
        
        <p className="text-xs text-muted-foreground text-center mt-2">
          Powered by Javari AI • Intelligent • Secure • Reliable
        </p>
      </div>
    </div>
  );
}
