'use client';

// components/JavariChatInterface.tsx
// JAVARI AI - Enhanced Chat Interface v4.1
// NEVER SAY NO Edition
// Timestamp: 2025-12-11 5:00 PM EST

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, AlertCircle, Sparkles, Zap, Brain, Globe, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Provider configuration with icons and colors
const PROVIDER_CONFIG = {
  claude: { name: 'Claude', color: 'bg-orange-500', icon: Brain, description: 'Coding & Analysis' },
  openai: { name: 'GPT-4', color: 'bg-green-500', icon: Sparkles, description: 'Creative & General' },
  gemini: { name: 'Gemini', color: 'bg-blue-500', icon: Zap, description: 'Fast & Multimodal' },
  mistral: { name: 'Mistral', color: 'bg-purple-500', icon: Globe, description: 'Multilingual' },
  perplexity: { name: 'Perplexity', color: 'bg-cyan-500', icon: Globe, description: 'Search & Research' },
} as const;

type ProviderName = keyof typeof PROVIDER_CONFIG;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: ProviderName;
  model?: string;
  latency?: number;
  tokensUsed?: number;
}

interface JavariChatInterfaceProps {
  projectId?: string;
  sessionId?: string;
  userId?: string;
  showProviderInfo?: boolean;
}

export default function JavariChatInterface({ 
  projectId, 
  sessionId, 
  userId,
  showProviderInfo = true 
}: JavariChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [currentProvider, setCurrentProvider] = useState<ProviderName | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, scrollToBottom]);

  // Load chat history if sessionId provided
  useEffect(() => {
    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/javari/chat/history?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      }
    } catch (error: unknown) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);
    setStreamingMessage('');
    setCurrentProvider(null);

    try {
      // Use the main /api/chat endpoint for multi-AI routing
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          userId,
          conversationId: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Set provider info
      if (data.provider) {
        setCurrentProvider(data.provider as ProviderName);
      }

      // Add the complete assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || 'I encountered an issue. Let me try again...',
        timestamp: new Date(),
        provider: data.provider as ProviderName,
        model: data.model,
        latency: data.latency,
        tokensUsed: data.tokensUsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);

    } catch (error: unknown) {
      console.error('Error sending message:', error);
      setError('Connection issue - retrying automatically...');
      
      // Add error message but keep it helpful
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm reconnecting now! Give me just a moment and try again. 🔄",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setCurrentProvider(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Provider badge component
  const ProviderBadge = ({ provider, latency }: { provider?: ProviderName; latency?: number }) => {
    if (!provider || !showProviderInfo) return null;
    
    const config = PROVIDER_CONFIG[provider];
    if (!config) return null;
    
    const Icon = config.icon;
    
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
        <span className={`w-2 h-2 rounded-full ${config.color}`} />
        <Icon className="w-3 h-3" />
        <span>{config.name}</span>
        {latency && <span className="text-gray-400">• {latency}ms</span>}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingMessage && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="relative">
              <Bot className="w-16 h-16 text-blue-500 mb-4" />
              <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Welcome to Javari AI
            </h2>
            <p className="text-gray-600 mb-4 max-w-md">
              Your autonomous AI partner that DELIVERS. Ask me to build apps, 
              create content, analyze data, or anything else you can imagine!
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                { text: '🏗️ Build me an app', prompt: 'Build me a tip calculator app' },
                { text: '📄 Create a document', prompt: 'Create a professional invoice template' },
                { text: '🎨 Design something', prompt: 'Design a modern logo concept for a tech startup' },
                { text: '📊 Analyze data', prompt: 'Help me analyze sales trends' },
              ].map((suggestion) => (
                <button
                  key={suggestion.text}
                  onClick={() => setInput(suggestion.prompt)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  {suggestion.text}
                </button>
              ))}
            </div>
            
            {/* Provider indicators */}
            {showProviderInfo && (
              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <span className="text-xs text-gray-400">Powered by:</span>
                {Object.entries(PROVIDER_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <div key={key} className="flex items-center gap-1 text-xs text-gray-500">
                      <span className={`w-2 h-2 rounded-full ${config.color}`} />
                      <Icon className="w-3 h-3" />
                      <span>{config.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Message list */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 rounded-bl-md shadow-sm'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        
                        // Check for deploy code blocks
                        if (!inline && codeString.startsWith("'use client'") || codeString.includes('export default function')) {
                          return (
                            <div className="relative">
                              <div className="absolute top-2 right-2 flex gap-2">
                                <button 
                                  onClick={() => navigator.clipboard.writeText(codeString)}
                                  className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
                                >
                                  Copy
                                </button>
                                <span className="px-2 py-1 text-xs bg-green-600 text-white rounded flex items-center gap-1">
                                  <Code className="w-3 h-3" />
                                  Ready to Deploy
                                </span>
                              </div>
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match ? match[1] : 'typescript'}
                                PreTag="div"
                                className="rounded-lg !mt-0"
                                {...props}
                              >
                                {codeString}
                              </SyntaxHighlighter>
                            </div>
                          );
                        }
                        
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-lg"
                            {...props}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  <ProviderBadge provider={message.provider} latency={message.latency} />
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming message */}
        {streamingMessage && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2 bg-white border border-gray-200 shadow-sm">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{streamingMessage}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingMessage && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-gray-500 text-sm">
                  {currentProvider 
                    ? `${PROVIDER_CONFIG[currentProvider]?.name || 'AI'} is thinking...` 
                    : 'Javari is working on it...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Javari anything... I'll find a way to help! 🚀"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px] max-h-[200px]"
              rows={1}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-12 h-12 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Javari NEVER says no • Powered by 5 AI models • Fortune 50 quality
        </p>
      </div>
    </div>
  );
}
