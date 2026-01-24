// components/chat/ChatMessage.tsx
'use client';

import Image from 'next/image';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    source: string;
    similarity: number;
  }>;
}

export default function ChatMessage({ role, content, sources }: ChatMessageProps) {
  const isJavari = role === 'assistant';

  return (
    <div className={`message-container ${isJavari ? 'javari' : 'user'}`}>
      <div className="message-content">
        {isJavari && (
          <div className="avatar">
            <Image
              src="/javari-avatar.png"
              alt="Javari AI"
              width={40}
              height={40}
              className="avatar-image"
            />
          </div>
        )}

        <div className="message-bubble">
          <div className="message-text">{content}</div>

          {sources && sources.length > 0 && (
            <div className="sources">
              <details>
                <summary>📚 Knowledge Sources ({sources.length})</summary>
                <ul className="source-list">
                  {sources.map((source, idx) => (
                    <li key={idx} className="source-item">
                      <span className="source-file">{source.source.split('/').pop()}</span>
                      <span className="source-similarity">
                        {(source.similarity * 100).toFixed(1)}% relevant
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>

        {!isJavari && (
          <div className="avatar user-avatar">
            <span className="user-initial">You</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .message-container {
          width: 100%;
          display: flex;
          margin-bottom: 16px;
        }

        .message-container.javari .message-content {
          justify-content: flex-start;
        }

        .message-container.user .message-content {
          justify-content: flex-end;
        }

        .message-content {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          max-width: 80%;
        }

        .avatar {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-avatar {
          background: #3b82f6;
          color: white;
          font-size: 12px;
          font-weight: 600;
        }

        .message-bubble {
          flex: 1;
          padding: 12px 16px;
          border-radius: 12px;
          background: #f3f4f6;
        }

        .message-container.user .message-bubble {
          background: #3b82f6;
          color: white;
        }

        .message-text {
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.5;
        }

        .sources {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }

        .message-container.user .sources {
          border-top-color: rgba(255, 255, 255, 0.2);
        }

        details {
          cursor: pointer;
        }

        summary {
          font-size: 13px;
          opacity: 0.8;
          user-select: none;
        }

        summary:hover {
          opacity: 1;
        }

        .source-list {
          margin: 8px 0 0 0;
          padding: 0;
          list-style: none;
        }

        .source-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          font-size: 12px;
          opacity: 0.7;
        }

        .source-file {
          flex: 1;
          font-family: monospace;
        }

        .source-similarity {
          font-size: 11px;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}
