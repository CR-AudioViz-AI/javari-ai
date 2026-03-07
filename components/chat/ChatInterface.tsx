// components/chat/ChatInterface.tsx
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

  // Debug mode changes
  const handleModeChange = (newMode: ChatMode) => {
    console.log('[ChatInterface] Mode change requested:', mode, '→', newMode);
    setMode(newMode);
    console.log('[ChatInterface] Mode state updated to:', newMode);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    console.log('[ChatInterface] Mode state changed to:', mode);
  }, [mode]);

  // ── Command classifier ─────────────────────────────────────────────────
  // Maps natural language input to structured /api/javari/execute payloads.
  // Returns null when the message is plain chat (not a command).
  function classifyCommand(text: string): { mode: 'command'; command: string } | null {
    const t = text.toLowerCase().trim();

    // Order matters: check most specific phrases first
    if (t.includes('run next') || t.includes('next task') || t.includes('run task'))
      return { mode: 'command', command: 'run_next_task' };

    if (t.includes('start roadmap') || t.includes('begin roadmap') || t.includes('execute roadmap'))
      return { mode: 'command', command: 'start_roadmap' };

    if (t.includes('pause') && (t.includes('execut') || t.includes('roadmap') || t.includes('queue')))
      return { mode: 'command', command: 'pause_execution' };

    if (t.includes('resume') && (t.includes('execut') || t.includes('roadmap') || t.includes('queue')))
      return { mode: 'command', command: 'resume_execution' };

    if (t.includes('memory') || t.includes('memoryos') || t.includes('knowledge'))
      return { mode: 'command', command: 'memory_status' };

    if (t.includes('queue') || t.includes('queue status') || t.includes('task status'))
      return { mode: 'command', command: 'queue_status' };

    return null; // not a command — route to normal chat
  }

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
      // ── Step 1: Classify — command or chat? ──────────────────────────
      const commandPayload = classifyCommand(content);
      const useAutonomous  = !commandPayload && needsAutonomous(content);

      let endpoint: string;
      let payload: Record<string, unknown>;

      if (commandPayload) {
        // ── Path A: System command via /api/javari/execute ───────────
        endpoint = '/api/javari/execute';
        payload  = {
          ...commandPayload,   // { mode: "command", command: "memory_status" }
          userId: 'system',
        };
        console.log(`[ChatInterface] Command detected → ${commandPayload.command}`);

      } else if (useAutonomous) {
        // ── Path B: Autonomous execution (unchanged) ──────────────────
        endpoint = '/api/autonomous/execute';
        payload  = {
          message: content,
          mode   : 'roadmap',
          provider,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        };
        console.log('[ChatInterface] Autonomous routing');

      } else {
        // ── Path C: Normal chat — mode-aware ─────────────────────────
        // "multi" mode sends to /api/javari/execute for multi-AI collaboration;
        // all other modes use the existing /api/chat endpoint.
        if (mode === 'single' || mode === 'advanced' || mode === 'super') {
          endpoint = '/api/chat';
          payload  = {
            message: content,
            mode,
            provider,
            history: messages.map(m => ({ role: m.role, content: m.content })),
          };
        } else {
          // roadmap / unknown mode — /api/javari/execute chat mode
          endpoint = '/api/javari/execute';
          payload  = {
            mode   : 'chat',
            message: content,
            userId : 'system',
          };
        }
        console.log(`[ChatInterface] Chat routing → ${endpoint} (mode: ${mode})`);
      }

      const res = await fetch(endpoint, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      // ── Step 2: Normalise response across all three paths ─────────
      // /api/javari/execute returns { ok, reply, model, cost }
      // /api/chat returns { response, messages, provider, ... }
      // /api/autonomous/execute returns { response, files, steps, ... }
      const safeSources  = Array.isArray(data?.sources) ? data.sources : [];
      const safeResults  = Array.isArray(data?.results) ? data.results : [];
      const safeMessages = Array.isArray(data?.messages) ? data.messages : [];

      if (safeMessages.length === 0 && (data?.response || data?.content || data?.answer || data?.reply)) {
        safeMessages.push({
          role   : 'assistant',
          content: data.reply || data.response || data.content || data.answer || 'No response available.',
        });
      }

      const responseContent =
        data.reply    ||   // /api/javari/execute
        data.response ||   // /api/chat
        safeMessages[0]?.content ||
        data.content  ||
        data.answer   ||
        'No response received';

      const assistantMessage: ChatMessage = {
        id       : `msg-${Date.now()}-assistant`,
        role     : 'assistant',
        content  : responseContent,
        timestamp: Date.now(),
        provider : commandPayload
                   ? 'javari-execute'
                   : useAutonomous
                   ? 'autonomous'
                   : (data.provider || data.model || provider),
        mode     : (commandPayload ? 'roadmap' : useAutonomous ? 'roadmap' : (data.mode || mode)) as ChatMode,
        metadata : {
          ...(data.metadata || {}),
          sources: safeSources,
          results: safeResults,
          ...(commandPayload ? {
            command    : commandPayload.command,
            commandData: data.data ?? null,
          } : {}),
          ...(useAutonomous ? {
            autonomous    : true,
            files         : data.files  || [],
            executionSteps: data.steps  || [],
          } : {}),
        },
      };

      setMessages([...updatedMessages, assistantMessage]);

    } catch (error: unknown) {
      console.error('[ChatInterface] Error sending message:', error);

      const errorMessage: ChatMessage = {
        id       : `msg-${Date.now()}-error`,
        role     : 'assistant',
        content  : `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
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
          <ModeToggle mode={mode} onChange={handleModeChange} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              sources={Array.isArray(message?.metadata?.sources) ? message.metadata.sources : []}
              results={Array.isArray(message?.metadata?.results) ? message.metadata.results : []}
            />
          ))}
          {isLoading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-75"></div>
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-150"></div>
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
                : 'Type your message...'
            }
          />
          <p className="mt-2 text-xs text-gray-500">
            Current mode: {mode}
            {mode === 'roadmap' && ' • Autonomous builds enabled for file generation requests'}
          </p>
        </div>
      </div>
    </div>
  );
}
