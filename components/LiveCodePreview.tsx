'use client';

// components/LiveCodePreview.tsx
// Javari AI Live Code Preview - Renders React components in real-time
// Version: 1.0.0
// Timestamp: 2025-12-13 8:15 AM EST

import React, { useState, useEffect, useMemo } from 'react';
import { Play, Code, Eye, Copy, Check, AlertCircle, Maximize2, Minimize2, Download, ExternalLink } from 'lucide-react';

interface LiveCodePreviewProps {
  code: string;
  language?: string;
  title?: string;
  showCode?: boolean;
  maxHeight?: number;
}

// Safe component renderer using iframe sandbox
function SafePreview({ code, title }: { code: string; title?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create HTML document for iframe
  const htmlContent = useMemo(() => {
    // Extract component code and transform for browser
    const transformedCode = transformCodeForBrowser(code);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Preview'}</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 16px; 
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      min-height: 100vh;
    }
    .error-display {
      color: #ef4444;
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 14px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${transformedCode}
    
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(<App />);
      window.parent.postMessage({ type: 'preview-ready' }, '*');
    } catch (error) {
      document.getElementById('root').innerHTML = '<div class="error-display">Error: ' + error.message + '</div>';
      window.parent.postMessage({ type: 'preview-error', error: error.message }, '*');
    }
  </script>
</body>
</html>`;
  }, [code, title]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'preview-ready') {
        setIsLoading(false);
        setError(null);
      } else if (event.data?.type === 'preview-error') {
        setIsLoading(false);
        setError(event.data.error);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Reset loading state when code changes
  useEffect(() => {
    setIsLoading(true);
    setError(null);
  }, [code]);

  return (
    <div className="relative w-full h-full min-h-[300px]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-cyan-500 rounded-full animate-spin" />
            <span>Rendering preview...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg p-4">
          <div className="text-red-600 text-sm">
            <AlertCircle className="w-5 h-5 mb-2" />
            <p className="font-medium">Preview Error</p>
            <p className="text-red-500 mt-1">{error}</p>
          </div>
        </div>
      )}
      <iframe
        srcDoc={htmlContent}
        className={`w-full h-full min-h-[300px] border-0 rounded-lg bg-white ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        sandbox="allow-scripts allow-same-origin"
        title={title || 'Live Preview'}
      />
    </div>
  );
}

/**
 * Transform code for browser execution
 */
function transformCodeForBrowser(code: string): string {
  let transformed = code;
  
  // Remove 'use client' directive
  transformed = transformed.replace(/['"]use client['"];?\s*/g, '');
  
  // Remove import statements (we load from CDN)
  transformed = transformed.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');
  transformed = transformed.replace(/import\s+['"].*?['"];?\s*/g, '');
  
  // Replace export default with const App =
  transformed = transformed.replace(/export\s+default\s+function\s+(\w+)/g, 'const App = function $1');
  transformed = transformed.replace(/export\s+default\s+/g, 'const App = ');
  
  // Remove other exports
  transformed = transformed.replace(/export\s+/g, '');
  
  // Handle lucide-react icons by replacing with simple SVG or emoji
  const iconReplacements: Record<string, string> = {
    'Calculator': '"🧮"',
    'DollarSign': '"💵"',
    'Home': '"🏠"',
    'TrendingUp': '"📈"',
    'TrendingDown': '"📉"',
    'Check': '"✓"',
    'X': '"✕"',
    'Plus': '"+"',
    'Minus': '"-"',
    'Search': '"🔍"',
    'Settings': '"⚙️"',
    'User': '"👤"',
    'Mail': '"📧"',
    'Phone': '"📞"',
    'Calendar': '"📅"',
    'Clock': '"🕐"',
    'Star': '"⭐"',
    'Heart': '"❤️"',
    'Send': '"➤"',
    'Download': '"⬇️"',
    'Upload': '"⬆️"',
    'Trash': '"🗑️"',
    'Edit': '"✏️"',
    'Save': '"💾"',
    'Copy': '"📋"',
    'Share': '"↗️"',
    'Info': '"ℹ️"',
    'AlertCircle': '"⚠️"',
    'ChevronRight': '"›"',
    'ChevronLeft': '"‹"',
    'ChevronDown': '"▼"',
    'ChevronUp': '"▲"',
  };
  
  for (const [icon, replacement] of Object.entries(iconReplacements)) {
    // Replace icon component usage with span containing emoji
    const iconRegex = new RegExp(`<${icon}[^>]*/>`, 'g');
    transformed = transformed.replace(iconRegex, `<span>${replacement}</span>`);
  }
  
  // Handle recharts by using simple divs as placeholders
  transformed = transformed.replace(/<(LineChart|BarChart|PieChart|AreaChart)[^>]*>[\s\S]*?<\/\1>/g, 
    '<div className="w-full h-48 bg-slate-100 rounded flex items-center justify-center text-slate-400">[Chart Placeholder]</div>');
  
  // Ensure there's an App component
  if (!transformed.includes('const App') && !transformed.includes('function App')) {
    // Wrap in App component
    const componentMatch = transformed.match(/function\s+(\w+)\s*\(/);
    if (componentMatch) {
      transformed += `\nconst App = ${componentMatch[1]};`;
    } else {
      // Wrap entire code in App
      transformed = `const App = () => {\n${transformed}\n};`;
    }
  }
  
  return transformed;
}

/**
 * Extract code blocks from markdown content
 */
export function extractCodeBlocks(content: string): { code: string; language: string; title?: string }[] {
  const codeBlockRegex = /```(\w+)?(?::(\w+\.tsx?))?\n([\s\S]*?)```/g;
  const blocks: { code: string; language: string; title?: string }[] = [];
  
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] || 'tsx';
    const title = match[2];
    const code = match[3].trim();
    
    // Only include React/TSX components
    if ((language === 'tsx' || language === 'jsx' || language === 'typescript' || language === 'javascript') &&
        (code.includes('function') || code.includes('const') || code.includes('export')) &&
        (code.includes('return') || code.includes('=>'))) {
      blocks.push({ code, language, title });
    }
  }
  
  return blocks;
}

/**
 * Check if code is previewable
 */
export function isPreviewable(code: string): boolean {
  // Must be a React component
  const hasReactPatterns = 
    code.includes('return') &&
    (code.includes('<') && code.includes('>')) &&
    (code.includes('function') || code.includes('=>') || code.includes('const'));
  
  // Should have JSX
  const hasJSX = /<[A-Z][a-zA-Z]*|<div|<span|<button|<input|<form/i.test(code);
  
  return hasReactPatterns && hasJSX;
}

/**
 * Main Live Code Preview Component
 */
export default function LiveCodePreview({
  code,
  language = 'tsx',
  title,
  showCode: initialShowCode = false,
  maxHeight = 500,
}: LiveCodePreviewProps) {
  const [view, setView] = useState<'preview' | 'code' | 'split'>('preview');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const canPreview = isPreviewable(code);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title || 'component.tsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!canPreview) {
    // Fallback to code-only view for non-previewable code
    return (
      <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-900">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">{title || language}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <pre className="p-4 overflow-auto text-sm" style={{ maxHeight }}>
          <code className="text-slate-300">{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-700 overflow-hidden bg-slate-900 ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-slate-300 ml-2">{title || 'Live Preview'}</span>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-0.5">
          <button
            onClick={() => setView('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors ${
              view === 'preview' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
          <button
            onClick={() => setView('code')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors ${
              view === 'code' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Code
          </button>
          <button
            onClick={() => setView('split')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors ${
              view === 'split' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Split
          </button>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className={`${view === 'split' ? 'grid grid-cols-2' : ''}`} style={{ maxHeight: isFullscreen ? 'calc(100vh - 120px)' : maxHeight }}>
        {/* Preview Panel */}
        {(view === 'preview' || view === 'split') && (
          <div className={`${view === 'split' ? 'border-r border-slate-700' : ''} overflow-auto`} style={{ height: isFullscreen ? 'calc(100vh - 60px)' : maxHeight }}>
            <SafePreview code={code} title={title} />
          </div>
        )}
        
        {/* Code Panel */}
        {(view === 'code' || view === 'split') && (
          <div className="overflow-auto bg-slate-950" style={{ height: isFullscreen ? 'calc(100vh - 60px)' : maxHeight }}>
            <pre className="p-4 text-sm">
              <code className="text-slate-300 whitespace-pre-wrap">{code}</code>
            </pre>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {code.split('\n').length} lines • {language.toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-400 flex items-center gap-1">
            <Play className="w-3 h-3" />
            Live
          </span>
        </div>
      </div>
    </div>
  );
}

// Named exports for utilities
export { transformCodeForBrowser, SafePreview };
