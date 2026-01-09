'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CentralServices } from '@/lib/central-services';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: FileAttachment[];
  timestamp: Date;
}

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
  data?: string; // base64
}

/**
 * Javari Chat Interface
 * 
 * Claude/ChatGPT-style chat with drag-and-drop file upload directly in the chat area.
 * Features:
 * - Drag & drop files anywhere in chat
 * - Paste images from clipboard
 * - Multiple file attachments
 * - File previews
 * - Mobile-friendly
 */
export function JavariChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle file processing
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const newAttachments: FileAttachment[] = [];
    
    for (const file of Array.from(files)) {
      const attachment: FileAttachment = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
      };

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        attachment.preview = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        attachment.data = attachment.preview;
      } else {
        // Read as base64 for other files
        const reader = new FileReader();
        attachment.data = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }

      newAttachments.push(attachment);
    }

    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (e.currentTarget === dropZoneRef.current && !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  // Paste handler for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  }, [processFiles]);

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // Send message
  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      // Call Javari API
      const response = await fetch('/api/javari/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          attachments: attachments.map(a => ({
            name: a.name,
            type: a.type,
            data: a.data,
          })),
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || 'I apologize, I encountered an error processing your request.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I apologize, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div 
      ref={dropZoneRef}
      className="flex flex-col h-full bg-white dark:bg-slate-900 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-cyan-500/20 dark:bg-cyan-400/20 
                        border-4 border-dashed border-cyan-500 dark:border-cyan-400 
                        flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-2xl text-center">
            <svg className="w-16 h-16 mx-auto text-cyan-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-xl font-semibold text-slate-900 dark:text-white">Drop files here</p>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Images, PDFs, documents, and more</p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 
                          shadow-lg shadow-cyan-500/30 flex items-center justify-center mb-6">
              <span className="text-4xl text-white font-bold">J</span>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
              Welcome to Javari AI
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              I'm your AI assistant. Ask me anything or drop files here to analyze them.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              {['Analyze a document', 'Generate content', 'Answer questions', 'Code help'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700
                           text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800
                           transition-colors text-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div 
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] md:max-w-[70%] ${
              message.role === 'user' 
                ? 'bg-cyan-600 text-white rounded-2xl rounded-br-md' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl rounded-bl-md'
            } p-4`}>
              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-3 space-y-2">
                  {message.attachments.map((att) => (
                    <div key={att.id} className={`rounded-lg overflow-hidden ${
                      message.role === 'user' ? 'bg-cyan-700' : 'bg-slate-200 dark:bg-slate-700'
                    }`}>
                      {att.preview ? (
                        <img src={att.preview} alt={att.name} className="max-h-48 w-auto" />
                      ) : (
                        <div className="px-3 py-2 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm truncate">{att.name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Message content */}
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Timestamp */}
              <div className={`text-xs mt-2 ${
                message.role === 'user' ? 'text-cyan-200' : 'text-slate-400'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md p-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div 
                key={att.id} 
                className="relative group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 
                           dark:border-slate-700 overflow-hidden"
              >
                {att.preview ? (
                  <img src={att.preview} alt={att.name} className="h-16 w-auto" />
                ) : (
                  <div className="px-3 py-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{att.name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(att.size)}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full 
                           flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 
                           transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-end gap-2">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full
                     text-slate-500 hover:text-cyan-600 hover:bg-slate-100 
                     dark:text-slate-400 dark:hover:text-cyan-400 dark:hover:bg-slate-800
                     transition-colors"
            title="Attach files"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && processFiles(e.target.files)}
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.md"
          />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message Javari... (or drop files here)"
              className="w-full resize-none rounded-2xl border border-slate-200 dark:border-slate-700
                       bg-slate-50 dark:bg-slate-800 px-4 py-3 pr-12
                       text-slate-900 dark:text-white placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                       min-h-[48px] max-h-[200px]"
              rows={1}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full
                     bg-cyan-600 text-white hover:bg-cyan-700 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        
        <p className="text-xs text-slate-400 text-center mt-2">
          Drop files anywhere or paste images • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

export default JavariChatInterface;
