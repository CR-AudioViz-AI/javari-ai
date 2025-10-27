/**
 * JavariEmbed Component
 * Full-page and widget embedding for Javari AI assistant
 * 
 * @version 4.0.0
 * @last-updated 2025-10-27
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Minimize2, Maximize2, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';
import { CompactModelSelector } from './ModelSelector';
import type { AIModel } from '@/lib/javari-multi-model';

interface JavariEmbedProps {
  mode: 'full' | 'widget';
  initialModel?: AIModel;
  apiEndpoint?: string;
  userId?: string;
  theme?: 'light' | 'dark' | 'auto';
  placeholder?: string;
  greeting?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  interactionId?: string;
}

export default function JavariEmbed({
  mode = 'widget',
  initialModel = 'claude-3-5-sonnet-20241022',
  apiEndpoint = '/api/javari/chat',
  userId,
  theme = 'auto',
  placeholder = 'Ask Javari anything...',
  greeting
}: JavariEmbedProps) {
  const [isOpen, setIsOpen] = useState(mode === 'full');
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>(initialModel);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load greeting message
  useEffect(() => {
    if (greeting && messages.length === 0) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: greeting,
        timestamp: new Date()
      }]);
    }
  }, [greeting]);

  // Handle sending message
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          model: selectedModel,
          conversationHistory: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          userId,
          sessionId,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        interactionId: data.interactionId
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle feedback
  const handleFeedback = async (messageId: string, wasHelpful: boolean) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.interactionId) return;

    try {
      await fetch(apiEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactionId: message.interactionId,
          wasHelpful
        })
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  // Widget mode
  if (mode === 'widget' && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-center group z-50"
        aria-label="Open Javari AI Assistant"
      >
        <Sparkles className="w-7 h-7 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  // Chat Interface
  const chatContent = (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Javari AI</h3>
            <p className="text-xs text-white/80">Your Creative Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'widget' && (
            <>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label={isMinimized ? 'Maximize' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Feedback buttons for assistant messages */}
                  {message.role === 'assistant' && message.interactionId && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handleFeedback(message.id, true)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        aria-label="Helpful"
                      >
                        <ThumbsUp className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleFeedback(message.id, false)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        aria-label="Not helpful"
                      >
                        <ThumbsDown className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <span className="text-xs text-gray-400 ml-auto">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            {/* Model Selector */}
            <div className="mb-3">
              <CompactModelSelector
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
            </div>

            {/* Text Input */}
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={placeholder}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Powered by CR AudioViz AI • Javari can make mistakes
            </p>
          </div>
        </>
      )}
    </div>
  );

  // Full-page mode
  if (mode === 'full') {
    return (
      <div className="w-full h-screen">
        {chatContent}
      </div>
    );
  }

  // Widget mode (open)
  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50 border border-gray-200 dark:border-gray-700">
      {chatContent}
    </div>
  );
}
