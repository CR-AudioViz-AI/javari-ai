// components/chat/ChatInput.tsx
'use client';

import { useState } from 'react';
import { chat as javariChat } from '@/agents/javari';

interface ChatInputProps {
  onMessage?: (message: string, response: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onMessage, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // Call Javari agent (uses knowledge-grounded responses by default)
      const result = await javariChat([
        { role: 'user', content: userMessage }
      ]);

      // Notify parent component
      if (onMessage) {
        onMessage(userMessage, result.message);
      }

      // Log sources if available
      if (result.sources && result.sources.length > 0) {
        console.log('Knowledge sources used:', result.sources);
      }

    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="input-wrapper">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask Javari anything..."
            disabled={disabled || loading}
            rows={1}
            className="chat-textarea"
          />
          
          <button
            type="submit"
            disabled={disabled || loading || !input.trim()}
            className="send-button"
          >
            {loading ? (
              <span className="loading-spinner">⏳</span>
            ) : (
              <span className="send-icon">→</span>
            )}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </form>

      <style jsx>{`
        .chat-input-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        .chat-input-form {
          width: 100%;
        }

        .input-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          padding: 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .chat-textarea {
          flex: 1;
          min-height: 40px;
          max-height: 200px;
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
        }

        .chat-textarea:focus {
          border-color: #3b82f6;
        }

        .chat-textarea:disabled {
          background: #f9fafb;
          cursor: not-allowed;
        }

        .send-button {
          padding: 10px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 18px;
          transition: background 0.2s;
          min-width: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .send-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .send-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .loading-spinner {
          animation: spin 1s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .error-message {
          margin-top: 8px;
          padding: 8px 12px;
          background: #fee2e2;
          color: #991b1b;
          border-radius: 6px;
          font-size: 13px;
        }

        .send-icon {
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}
