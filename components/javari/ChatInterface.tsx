'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Code, Copy, Check, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  loading?: boolean;
}

interface ChatInterfaceProps {
  projectId?: string;
}

export function ChatInterface({ projectId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Add placeholder for assistant response
    const assistantId = (Date.now() + 1).toString();
    const placeholderMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true
    };
    setMessages(prev => [...prev, placeholderMessage]);

    try {
      const response = await fetch('/api/javari/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          projectId,
          sessionId,
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  assistantContent += parsed.content;
                  // Update the placeholder message with streaming content
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantId
                        ? { ...m, content: assistantContent, loading: false }
                        : m
                    )
                  );
                }
                if (parsed.sessionId && !sessionId) {
                  setSessionId(parsed.sessionId);
                }
              } catch (e) {
                console.error('Failed to parse chunk:', e);
              }
            }
          }
        }
      }

      if (!assistantContent) {
        throw new Error('No content received');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content: 'Sorry, I encountered an error. Please try again.',
                loading: false
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyCode = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    
    // Simple code block detection
    const hasCodeBlock = message.content.includes('```');
    
    if (hasCodeBlock) {
      const parts = message.content.split('```');
      return (
        <div className="space-y-2">
          {parts.map((part, index) => {
            if (index % 2 === 0) {
              // Regular text
              return part.trim() && (
                <div key={index} className="prose prose-invert max-w-none">
                  {part.split('\n').map((line, i) => (
                    <p key={i} className="text-sm">
                      {line}
                    </p>
                  ))}
                </div>
              );
            } else {
              // Code block
              const lines = part.split('\n');
              const language = lines[0].trim();
              const code = lines.slice(1).join('\n');
              
              return (
                <div key={index} className="relative">
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    {language && (
                      <span className="text-xs text-gray-400 bg-slate-700 px-2 py-1 rounded">
                        {language}
                      </span>
                    )}
                    <button
                      onClick={() => copyCode(code, message.id)}
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-300">{code}</code>
                  </pre>
                </div>
              );
            }
          })}
        </div>
      );
    }

    // Regular text message
    return (
      <div className="prose prose-invert max-w-none">
        {message.content.split('\n').map((line, i) => (
          <p key={i} className="text-sm mb-2">
            {line}
          </p>
        ))}
      </div>
    );
  };

  const quickPrompts = [
    {
      icon: '📊',
      text: 'Show me project health status',
      prompt: 'Show me the health of all my projects'
    },
    {
      icon: '🔧',
      text: 'What builds failed recently?',
      prompt: 'What builds failed recently?'
    },
    {
      icon: '✨',
      text: 'Create a new project',
      prompt: 'Help me create a new Next.js project with TypeScript'
    },
    {
      icon: '💡',
      text: 'Suggest improvements',
      prompt: 'Analyze my codebase and suggest improvements'
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] bg-slate-800/30 backdrop-blur-sm rounded-xl border border-blue-500/20 overflow-hidden">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-white" />
          <div>
            <h2 className="text-lg font-semibold text-white">Chat with Javari AI</h2>
            <p className="text-xs text-blue-100">
              {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : 'Initializing...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm text-white">Online</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-7xl mb-6 animate-bounce">🤖</div>
            <h3 className="text-2xl font-bold text-white mb-3">
              Welcome to Javari AI!
            </h3>
            <p className="text-gray-400 text-center max-w-md mb-8">
              I'm your autonomous development assistant. Ask me anything about your
              projects, builds, or get help with development.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setInput(prompt.prompt)}
                  className="bg-slate-700/50 hover:bg-slate-700 text-left p-4 rounded-lg transition-all hover:scale-105 border border-slate-600 hover:border-blue-500"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{prompt.icon}</span>
                    <span className="text-sm text-gray-300">{prompt.text}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700/50 text-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {message.role === 'assistant' && (
                      <div className="text-2xl flex-shrink-0">🤖</div>
                    )}
                    <div className="flex-1 min-w-0">
                      {message.loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Thinking...</span>
                        </div>
                      ) : (
                        renderMessage(message)
                      )}
                      <div
                        className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="text-2xl flex-shrink-0">👤</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700 p-4 bg-slate-800/50">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your projects..."
              className="w-full bg-slate-700/50 text-white placeholder-gray-400 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[52px] max-h-32"
              rows={1}
              disabled={loading}
            />
            {input.length > 0 && (
              <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                {input.length} chars
              </div>
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors flex-shrink-0"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">Enter</kbd> to send •{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
}
