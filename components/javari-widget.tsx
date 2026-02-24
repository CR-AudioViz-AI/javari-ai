// components/javari-widget.tsx
// Enhanced Javari AI Chat Widget with Learning System
// Universal component for all CR AudioViz AI apps

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  feedback?: 'positive' | 'negative';
}

interface JavariWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
  appContext?: string;
  sourceApp?: string;
  enableTickets?: boolean;
  enableEnhancements?: boolean;
  enableLearning?: boolean;
}

// Extract entities from text (stock tickers, crypto, etc.)
function extractEntities(text: string): string[] {
  const entities: string[] = [];
  
  // Stock tickers ($AAPL, $NVDA)
  const stockMatches = text.match(/\$[A-Z]{1,5}/g);
  if (stockMatches) entities.push(...stockMatches.map(s => s.toUpperCase()));
  
  // Crypto mentions
  const cryptoPatterns = ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'dogecoin', 'doge'];
  cryptoPatterns.forEach(crypto => {
    if (text.toLowerCase().includes(crypto)) {
      entities.push(crypto.toUpperCase());
    }
  });
  
  return [...new Set(entities)];
}

// Extract topics from text
function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const lowerText = text.toLowerCase();
  
  const topicPatterns = {
    'stocks': ['stock', 'share', 'equity', 'market', 'trading'],
    'crypto': ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'defi'],
    'support': ['help', 'issue', 'problem', 'error', 'bug', 'broken'],
    'billing': ['payment', 'credit', 'subscription', 'charge', 'refund'],
    'feature': ['feature', 'request', 'suggestion', 'idea', 'would like'],
    'cardverse': ['card', 'collection', 'trade', 'mint', 'nft'],
  };
  
  Object.entries(topicPatterns).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      topics.push(topic);
    }
  });
  
  return topics;
}

// Analyze sentiment
function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase();
  const positiveWords = ['great', 'awesome', 'love', 'thanks', 'helpful', 'amazing', 'perfect'];
  const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'broken', 'frustrated', 'angry'];
  
  const positiveScore = positiveWords.filter(w => lowerText.includes(w)).length;
  const negativeScore = negativeWords.filter(w => lowerText.includes(w)).length;
  
  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

export function JavariWidget({ 
  position = 'bottom-right',
  primaryColor = '#8B5CF6',
  appContext = 'general',
  sourceApp = 'javariai.com',
  enableTickets = true,
  enableEnhancements = true,
  enableLearning = true,
}: JavariWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [view, setView] = useState<'chat' | 'ticket' | 'enhancement'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save conversation to database for learning
  const saveConversation = useCallback(async (role: string, content: string) => {
    if (!enableLearning || !supabase) return;
    
    try {
      const topics = extractTopics(content);
      const entities = extractEntities(content);
      const sentiment = analyzeSentiment(content);
      
      await supabase.from('javari_conversations').insert({
        session_id: sessionId,
        source_app: sourceApp,
        role,
        content,
        extracted_topics: topics,
        extracted_entities: entities,
        sentiment,
      });
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }, [sessionId, sourceApp, enableLearning]);

  // Handle feedback
  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, feedback } : m
    ));
    
    if (supabase) {
      await supabase.from('javari_activity_log').insert({
        activity_type: 'feedback_received',
        description: `User gave ${feedback} feedback on response`,
        success: feedback === 'positive',
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const messageId = `msg_${Date.now()}`;
    setInput('');
    
    const newUserMessage: Message = {
      id: messageId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);
    
    // Save user message for learning
    await saveConversation('user', userMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context: appContext,
          sessionId,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: data.response || data.message || 'I apologize, I encountered an issue. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save assistant response for learning
      await saveConversation('assistant', assistantMessage.content);
      
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, I\'m having trouble connecting. Please try again in a moment.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const positionClasses = position === 'bottom-right' 
    ? 'right-4 sm:right-6' 
    : 'left-4 sm:left-6';

  return (
    <>
      {/* Widget Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-4 sm:bottom-6 ${positionClasses} z-50 w-14 h-14 rounded-full shadow-lg 
            flex items-center justify-center transition-all duration-300 hover:scale-110`}
          style={{ backgroundColor: primaryColor }}
          aria-label="Open Javari AI Assistant"
        >
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed bottom-4 sm:bottom-6 ${positionClasses} z-50 w-[95vw] sm:w-96 
          bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden
          border border-gray-200 dark:border-gray-700`}>
          
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700"
            style={{ backgroundColor: primaryColor }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white text-lg">✨</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">Javari AI</h3>
                <p className="text-xs text-white/80">Your AI Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick Actions */}
          {(enableTickets || enableEnhancements) && (
            <div className="flex gap-2 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setView('chat')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  view === 'chat' 
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                💬 Chat
              </button>
              {enableTickets && (
                <button
                  onClick={() => setView('ticket')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === 'ticket' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  🎫 Support
                </button>
              )}
              {enableEnhancements && (
                <button
                  onClick={() => setView('enhancement')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === 'enhancement' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  💡 Ideas
                </button>
              )}
            </div>
          )}

          {/* Chat Messages */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
                {messages.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="text-lg mb-2">👋 Hi! I'm Javari</p>
                    <p className="text-sm">How can I help you today?</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user' 
                        ? 'bg-purple-600 text-white rounded-br-md' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.role === 'assistant' && !msg.feedback && (
                        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => handleFeedback(msg.id, 'positive')}
                            className="text-xs text-gray-500 hover:text-green-500"
                          >
                            👍
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.id, 'negative')}
                            className="text-xs text-gray-500 hover:text-red-500"
                          >
                            👎
                          </button>
                        </div>
                      )}
                      {msg.feedback && (
                        <p className="text-xs mt-1 opacity-60">
                          {msg.feedback === 'positive' ? '✓ Thanks for the feedback!' : '✓ We\'ll improve!'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Ask me anything..."
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                      placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="px-4 py-2.5 rounded-xl text-white font-medium transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Ticket View - Link to Support */}
          {view === 'ticket' && (
            <div className="p-6 text-center">
              <div className="text-4xl mb-4">🎫</div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Need Support?</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Create a support ticket and our team will help you.
              </p>
              <a
                href="https://craudiovizai.com/support"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-2.5 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                Open Support Center
              </a>
            </div>
          )}

          {/* Enhancement View - Link to Feature Requests */}
          {view === 'enhancement' && (
            <div className="p-6 text-center">
              <div className="text-4xl mb-4">💡</div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Have an Idea?</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Submit feature requests and vote on community ideas.
              </p>
              <a
                href="https://craudiovizai.com/support/enhancements"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-2.5 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                Browse Ideas
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default JavariWidget;
