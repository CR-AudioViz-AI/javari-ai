'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/lib/store/chat-store';
import MessageList from './MessageList';
import InputBar from './InputBar';
import ConversationHistory from './ConversationHistory';
import CouncilPanel from './CouncilPanel';
import ModeToggle from './ModeToggle';

export default function ChatInterface() {
  const {
    messages,
    mode,
    provider,
    loading,
    showCouncil,
    sessions,
    currentSessionId,
    setMode,
    setProvider,
    setCurrentSessionId,
    setShowCouncil,
    loadSession,
    newSession,
    sendMessage,
  } = useChatStore();

  useEffect(() => {
    // Initialize new session on mount
    const newSessionId = `session-${Date.now()}`;
    setCurrentSessionId(newSessionId);
  }, [setCurrentSessionId]);

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Conversation History */}
      <ConversationHistory
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={loadSession}
        onNewChat={newSession}
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
