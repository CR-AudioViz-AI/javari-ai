// components/javari-widget.tsx
// Universal Javari AI Chat Widget - Embed in any CR AudioViz AI app
// Drop-in component that connects to Javari API

'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface JavariWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
  appContext?: string; // e.g., "logo-studio", "pdf-builder"
}

export function JavariWidget({ 
  position = 'bottom-right',
  primaryColor = '#8B5CF6',
  appContext = 'general'
}: JavariWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('https://javariai.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          provider: 'openai',
          context: appContext,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }]);
      }
    } catch {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Unable to connect to Javari. Please check your connection.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const positionClasses = position === 'bottom-right' 
    ? 'right-4 bottom-4' 
    : 'left-4 bottom-4';

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed ${positionClasses} z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110`}
        style={{ backgroundColor: primaryColor }}
        title="Chat with Javari"
      >
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    );
  }

  return (
    <div className={`fixed ${positionClasses} z-50 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden border`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
        <div className="flex items-center gap-2 text-white">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            🧠
          </div>
          <div>
            <h3 className="font-semibold">Javari AI</h3>
            <p className="text-xs opacity-80">Powered by CR AudioViz AI</p>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-white/80 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-2xl mb-2">👋</p>
            <p>Hi! I'm Javari, your AI assistant.</p>
            <p className="text-sm">How can I help you today?</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg rounded-bl-none">
              <p className="text-sm text-gray-500">Javari is thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default JavariWidget;
