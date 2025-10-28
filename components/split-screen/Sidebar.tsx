'use client';

import React from 'react';
import { X, Code, FileText, GitCompare, Image as ImageIcon, FileJson, AlertTriangle, Lightbulb } from 'lucide-react';
import { useSplitScreen } from '@/components/split-screen/split-screen-context';

// ============================================================================
// SIDEBAR COMPONENT - Displays code, files, diffs, images, etc.
// ============================================================================

export function Sidebar() {
  const { isOpen, content, closeSidebar } = useSplitScreen();

  if (!isOpen || !content) {
    return null;
  }

  const getIcon = () => {
    switch (content.type) {
      case 'code':
        return <Code className="w-5 h-5" />;
      case 'file':
        return <FileText className="w-5 h-5" />;
      case 'diff':
        return <GitCompare className="w-5 h-5" />;
      case 'image':
        return <ImageIcon className="w-5 h-5" />;
      case 'json':
        return <FileJson className="w-5 h-5" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'suggestion':
        return <Lightbulb className="w-5 h-5 text-yellow-500" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getBgColor = () => {
    switch (content.type) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'suggestion':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${getBgColor()}`}>
        <div className="flex items-center gap-2">
          {getIcon()}
          <div>
            <h3 className="font-semibold text-sm">{content.title}</h3>
            {content.fileName && (
              <p className="text-xs text-gray-500">{content.fileName}</p>
            )}
          </div>
        </div>
        <button
          onClick={closeSidebar}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {content.type === 'image' ? (
          <img 
            src={content.content} 
            alt={content.title}
            className="max-w-full h-auto rounded-lg shadow-lg"
          />
        ) : content.type === 'markdown' ? (
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content.content }}
          />
        ) : content.type === 'json' ? (
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
            <code>{JSON.stringify(JSON.parse(content.content), null, 2)}</code>
          </pre>
        ) : (
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
            <code className={content.language ? `language-${content.language}` : ''}>
              {content.content}
            </code>
          </pre>
        )}

        {/* Metadata */}
        {content.metadata && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Metadata
            </h4>
            <dl className="space-y-1">
              {Object.entries(content.metadata).map(([key, value]) => (
                <div key={key} className="flex text-xs">
                  <dt className="font-medium text-gray-600 w-24">{key}:</dt>
                  <dd className="text-gray-900">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
