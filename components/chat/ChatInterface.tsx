'use client';

import { useState, useEffect } from 'react';
import { create } from 'zustand';
import MessageList from './MessageList';
import InputBar from './InputBar';
import ConversationHistory from './ConversationHistory';
import CouncilPanel from './CouncilPanel';
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
    [key: string]: any;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  mode: ChatMode;
  provider: string;
  createdAt: number;
  updatedAt: number;
}

// Zustand Store (in-memory, no localStorage)
interface ChatStore {
  sessions: ChatSession[];
  currentSessionId: string;
  addSession: (session: ChatSession) => void;
  updateSession: (id: string, session: ChatSession) => void;
  setCurrentSessionId: (id: string) => void;
  clearSessions: () => void;
}

const useChatStore = create<ChatStore>((set) => ({
  sessions: [],
  currentSessionId: '',
  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions.filter((s) => s.id !== session.id), session],
    })),
  updateSession: (id, session) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? session : s)),
    })),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  clearSessions: () => set({ sessions: [], currentSessionId: '' }),
}));

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ChatMode>('single');
  const [provider, setProvider] = useState('openai');
  const [loading, setLoading] = useState(false);
  const [showCouncil, setShowCouncil] = useState(false);

  const { sessions, currentSessionId, addSession, setCurrentSessionId } = useChatStore();

  useEffect(() => {
    // Initialize new session
    const newSessionId = `session-${Date.now()}`;
    setCurrentSessionId(newSessionId);
  }, [setCurrentSessionId]);

  const saveSession = (updatedMessages: ChatMessage[]) => {
    const session: ChatSession = {
      id: currentSessionId,
      title: updatedMessages[0]?.content.slice(0, 50) || 'New Chat',
      messages: updatedMessages,
      mode,
      provider,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    addSession(session);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    setLoading(true);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          mode,
          provider,
          history: messages,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: data.response || 'No response received',
        provider: data.provider,
        mode,
        timestamp: Date.now(),
        metadata: data.metadata,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveSession(finalMessages);

      if (mode === 'super' && data.metadata?.councilVotes) {
        setShowCouncil(true);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      const errorMessages = [...updatedMessages, errorMessage];
      setMessages(errorMessages);
      saveSession(errorMessages);
    } finally {
      setLoading(false);
    }
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setMode(session.mode);
    setProvider(session.provider);
    setShowCouncil(false);
  };

  const newChat = () => {
    const newSessionId = `session-${Date.now()}`;
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setShowCouncil(false);
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Conversation History */}
      <ConversationHistory
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={loadSession}
        onNewChat={newChat}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-slate-800/50 border-b border-purple-500/30 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
              Javari AI Chat
            </h1>
            <ModeToggle
              mode={mode}
              onModeChange={setMode}
              provider={provider}
              onProviderChange={setProvider}
            />
          </div>
        </div>

        {/* Messages */}
        <MessageList messages={messages} loading={loading} />

        {/* Input */}
        <InputBar onSendMessage={sendMessage} disabled={loading} mode={mode} />
      </div>

      {/* Right Sidebar - Council Panel (SuperMode) */}
      {showCouncil && mode === 'super' && (
        <CouncilPanel
          votes={messages[messages.length - 1]?.metadata?.councilVotes || []}
          onClose={() => setShowCouncil(false)}
        />
      )}
    </div>
  );
}
