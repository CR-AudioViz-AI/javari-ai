'use client';

import { useState, useEffect } from 'react';
import MessageList from './MessageList';
import InputBar from './InputBar';
import ConversationHistory from './ConversationHistory';
import CouncilPanel from './CouncilPanel';
import ModeToggle from './ModeToggle';
import { ChatMessage, ChatMode, ChatSession } from '@/lib/chat/ai-providers';

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ChatMode>('single');
  const [provider, setProvider] = useState('openai');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showCouncil, setShowCouncil] = useState(false);

  useEffect(() => {
    // Initialize new session
    const newSessionId = `session-${Date.now()}`;
    setSessionId(newSessionId);
    loadSessions();
  }, []);

  const loadSessions = () => {
    try {
      const stored = localStorage.getItem('chat-sessions');
      if (stored) {
        setSessions(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  };

  const saveSession = (updatedMessages: ChatMessage[]) => {
    try {
      const session: ChatSession = {
        id: sessionId,
        title: updatedMessages[0]?.content.slice(0, 50) || 'New Chat',
        messages: updatedMessages,
        mode,
        provider,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const allSessions = [...sessions.filter(s => s.id !== sessionId), session];
      setSessions(allSessions);
      localStorage.setItem('chat-sessions', JSON.stringify(allSessions));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  };

  const sendMessage = async (content: string) => {
    setLoading(true);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now()
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
          history: messages
        })
      });

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: data.response || 'No response',
        provider: data.provider,
        mode,
        timestamp: Date.now(),
        metadata: data.metadata
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
        content: 'Error: Failed to get response',
        timestamp: Date.now()
      };
      setMessages([...updatedMessages, errorMessage]);
    }

    setLoading(false);
  };

  const loadSession = (session: ChatSession) => {
    setSessionId(session.id);
    setMessages(session.messages);
    setMode(session.mode);
    setProvider(session.provider);
  };

  const newChat = () => {
    const newSessionId = `session-${Date.now()}`;
    setSessionId(newSessionId);
    setMessages([]);
    setShowCouncil(false);
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Conversation History */}
      <ConversationHistory 
        sessions={sessions}
        currentSessionId={sessionId}
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
        <InputBar 
          onSendMessage={sendMessage} 
          disabled={loading}
          mode={mode}
        />
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
