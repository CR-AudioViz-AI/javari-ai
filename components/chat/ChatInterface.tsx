// components/chat/ChatInterface.tsx
// FIXED: Corrected ModeToggle prop from onModeChange to onChange
'use client';

import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ModeToggle from './ModeToggle';

// Type Definitions
export type ChatMode = 'single' | 'advanced' | 'super' | 'roadmap';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  provider?: string;
  mode?: ChatMode;
  metadata?: {
    councilVotes?: Array<{
      provider: string;
      vote: string;
      confidence: number;
      reasoning: string;
    }>;
    files?: Array<{ name: string; content: string }>;
    autonomous?: boolean;
    executionSteps?: any[];
  };
}

interface ChatInterfaceProps {
  initialMode?: ChatMode;
}

// SMART ROUTER - Determines if message needs autonomous execution
function needsAutonomous(message: string): boolean {
  const autonomousKeywords = [
    'create', 'build', 'generate', 'make',
    'file', 'files', 'system', 'application',
    'component', 'api', 'database',
    'orchestrate', 'scaffold', 'develop',
    'implement', 'setup', 'configure'
  ];

  const lowerMessage = message.toLowerCase();
  
  // Check if message contains autonomous keywords
  const hasKeyword = autonomousKeywords.some(keyword => 
    lowerMessage.includes(keyword)
  );

  // Additional context checks
  const hasCodeIntent = lowerMessage.includes('code') || 
                        lowerMessage.includes('script') ||
                        lowerMessage.includes('function');

  const hasFileIntent = lowerMessage.includes('file') ||
                        lowerMessage.includes('project') ||
                        lowerMessage.includes('folder');

  return hasKeyword && (hasCodeIntent || hasFileIntent || lowerMessage.split(' ').length > 5);
}

export default function ChatInterface({ initialMode = 'single' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ChatMode>(initialMode);
  const [provider, setProvider] = useState('openai');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // FIXED: Properly typed mode change handler
  const handleModeChange = (newMode: ChatMode) => {
    console.log('[ChatInterface] Mode changed:', mode, '→', newMode);
    setMode(newMode);
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    try {
      // SMART ROUTING: Determine endpoint
      const useAutonomous = needsAutonomous(content);
      const endpoint = useAutonomous ? '/api/autonomous/execute' : '/api/chat';

      console.log(`[ChatInterface] Routing to ${endpoint}`, {
        autonomous: useAutonomous,
        mode,
        provider
      });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          mode: useAutonomous ? 'autonomous' : mode,
          provider,
          history: messages,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error('[ChatInterface] API error:', {
          status: res.status,
          statusText: res.statusText,
          error: errorText
        });
        throw new Error(`API error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();

      // Ensure we always have a response string
      const responseContent = data.response || data.message || 'No response received';

      console.log('[ChatInterface] Response received:', {
        provider: data.provider,
        mode: data.mode,
        responseLength: responseContent.length
      });

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
        provider: useAutonomous ? 'autonomous' : (data.provider || provider),
        mode: useAutonomous ? 'roadmap' : (data.mode || mode),
        metadata: {
          ...(data.metadata || {}),
          ...(useAutonomous ? {
            autonomous: true,
            files: data.files || [],
            executionSteps: data.steps || []
          } : {})
        }
      };

      setMessages([...updatedMessages, assistantMessage]);

    } catch (error: any) {
      console.error('[ChatInterface] Error sending message:', {
        error: error.message,
        stack: error.stack
      });

      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response'}. Please try again.`,
        timestamp: Date.now(),
      };

      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Javari AI Chat</h1>
          {/* FIXED: Changed onModeChange to onChange */}
          <ModeToggle mode={mode} onChange={handleModeChange} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg mb-2">Welcome to Javari AI!</p>
              <p className="text-sm">
                {mode === 'single' && 'Ask me anything. I\'ll respond using a single AI model.'}
                {mode === 'super' && 'Super mode activated! I\'ll use multiple AI models for enhanced responses.'}
                {mode === 'advanced' && 'Advanced mode ready. I\'ll provide comprehensive multi-model analysis.'}
                {mode === 'roadmap' && 'Roadmap mode enabled. I can autonomously build systems and generate files.'}
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {isLoading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-75"></div>
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-150"></div>
              <span className="ml-2 text-sm">Thinking...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading}
            placeholder={
              mode === 'roadmap' 
                ? 'Describe what you want to build...'
                : mode === 'advanced'
                ? 'Ask for comprehensive analysis...'
                : mode === 'super'
                ? 'Ask a complex question...'
                : 'Type your message...'
            }
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              <span className="font-medium">Mode:</span> {mode.charAt(0).toUpperCase() + mode.slice(1)}
              {mode === 'roadmap' && ' • Autonomous builds enabled'}
              {mode === 'super' && ' • Multi-AI council active'}
              {mode === 'advanced' && ' • Advanced analysis enabled'}
            </p>
            <p className="text-xs text-gray-400">
              Provider: {provider}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
