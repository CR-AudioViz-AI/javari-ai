'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat session
  useEffect(() => {
    async function initSession() {
      try {
        const response = await fetch('/api/javari/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'init' })
        });
        const data = await response.json();
        setSessionId(data.sessionId);
      } catch (error) {
        console.error('Failed to initialize session:', error);
      }
    }
    initSession();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/javari/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          sessionId,
          message: input
        })
      });

      const data = await response.json();

      if (data.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-300px)]">
      {/* Chat Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-t-xl border border-blue-500/20 p-4">
        <h2 className="text-xl font-semibold text-white">Chat with Javari AI</h2>
        <p className="text-sm text-gray-400 mt-1">
          Ask me anything about your projects, builds, or get help with development
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 bg-slate-800/30 backdrop-blur-sm border-x border-blue-500/20 p-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Welcome to Javari AI!
            </h3>
            <p className="text-gray-400 max-w-md">
              I'm your autonomous development assistant. Ask me to help with builds, 
              monitor health, suggest improvements, or anything else!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 max-w-2xl">
              <button
                onClick={() => setInput('Show me the health of all my projects')}
                className="bg-slate-700/50 hover:bg-slate-700 text-left p-3 rounded-lg transition-colors"
              >
                <div className="text-sm text-gray-300">
                  📊 Show me project health status
                </div>
              </button>
              <button
                onClick={() => setInput('What builds failed recently?')}
                className="bg-slate-700/50 hover:bg-slate-700 text-left p-3 rounded-lg transition-colors"
              >
                <div className="text-sm text-gray-300">
                  🔧 What builds failed recently?
                </div>
              </button>
              <button
                onClick={() => setInput('Help me create a new Next.js project')}
                className="bg-slate-700/50 hover:bg-slate-700 text-left p-3 rounded-lg transition-colors"
              >
                <div className="text-sm text-gray-300">
                  ✨ Help me create a new project
                </div>
              </button>
              <button
                onClick={() => setInput('Suggest improvements for my codebase')}
                className="bg-slate-700/50 hover:bg-slate-700 text-left p-3 rounded-lg transition-colors"
              >
                <div className="text-sm text-gray-300">
                  💡 Suggest code improvements
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700/50 text-gray-100'
                  }`}
                >
                  <div className="text-sm opacity-75 mb-1">
                    {message.role === 'user' ? 'You' : 'Javari AI'}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className="text-xs opacity-50 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-700/50 text-gray-100 rounded-lg p-4">
                  <div className="text-sm opacity-75 mb-1">Javari AI</div>
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-b-xl border border-blue-500/20 p-4">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Javari anything... (Press Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-slate-700/50 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            disabled={loading || !sessionId}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || !sessionId}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Powered by OpenAI GPT-4 • Session ID: {sessionId?.slice(0, 8)}...
        </div>
      </div>
    </div>
  );
}
