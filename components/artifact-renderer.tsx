// components/artifact-renderer.tsx
// Renders code, HTML, React components live in the chat
// Timestamp: 2025-11-30 06:55 AM EST

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Check, Copy, Download, ExternalLink, Code, FileText, Image } from 'lucide-react';

interface ArtifactRendererProps {
  content: string;
}

interface ParsedArtifact {
  type: 'code' | 'html' | 'react' | 'image' | 'text';
  filename?: string;
  language?: string;
  content: string;
}

export default function ArtifactRenderer({ content }: ArtifactRendererProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

  // Parse artifacts from content
  const artifacts = useMemo(() => {
    const parsed: ParsedArtifact[] = [];
    
    // Match code blocks with filenames
    const codeBlockRegex = /```(\w+)?(?::(\S+))?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const [, lang, filename, code] = match;
      
      let type: ParsedArtifact['type'] = 'code';
      if (filename?.endsWith('.html') || lang === 'html') type = 'html';
      if (filename?.endsWith('.tsx') || filename?.endsWith('.jsx')) type = 'react';
      
      parsed.push({
        type,
        language: lang || detectLanguage(filename || ''),
        filename: filename || `file.${lang || 'txt'}`,
        content: code.trim()
      });
    }
    
    return parsed;
  }, [content]);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (artifacts.length === 0) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Text before artifacts */}
      {content.split('```')[0].trim() && (
        <div className="whitespace-pre-wrap">{content.split('```')[0].trim()}</div>
      )}

      {/* Render each artifact */}
      {artifacts.map((artifact, index) => (
        <div key={index} className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              {artifact.type === 'html' && <FileText className="w-4 h-4 text-orange-400" />}
              {artifact.type === 'react' && <Code className="w-4 h-4 text-blue-400" />}
              {artifact.type === 'code' && <Code className="w-4 h-4 text-green-400" />}
              <span className="text-sm font-medium">{artifact.filename}</span>
              <span className="text-xs text-gray-500">{artifact.language}</span>
            </div>
            <div className="flex items-center gap-2">
              {(artifact.type === 'html' || artifact.type === 'react') && (
                <div className="flex rounded-lg overflow-hidden border border-gray-600">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 text-xs ${activeTab === 'preview' ? 'bg-purple-600' : 'bg-gray-700'}`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setActiveTab('code')}
                    className={`px-3 py-1 text-xs ${activeTab === 'code' ? 'bg-purple-600' : 'bg-gray-700'}`}
                  >
                    Code
                  </button>
                </div>
              )}
              <button
                onClick={() => copyToClipboard(artifact.content)}
                className="p-1.5 hover:bg-gray-700 rounded"
                title="Copy code"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => downloadFile(artifact.content, artifact.filename || 'file.txt')}
                className="p-1.5 hover:bg-gray-700 rounded"
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'code' || artifact.type === 'code' ? (
            <pre className="p-4 overflow-x-auto text-sm">
              <code className={`language-${artifact.language}`}>{artifact.content}</code>
            </pre>
          ) : artifact.type === 'html' ? (
            <HTMLPreview html={artifact.content} />
          ) : artifact.type === 'react' ? (
            <ReactPreview code={artifact.content} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// HTML Preview Component
function HTMLPreview({ html }: { html: string }) {
  const [iframeHeight, setIframeHeight] = useState(400);
  
  const srcDoc = html.includes('<!DOCTYPE') ? html : `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>body { margin: 0; }</style>
    </head>
    <body>${html}</body>
    </html>
  `;

  return (
    <div className="bg-white">
      <iframe
        srcDoc={srcDoc}
        className="w-full border-0"
        style={{ height: iframeHeight }}
        sandbox="allow-scripts"
        onLoad={(e) => {
          const iframe = e.target as HTMLIFrameElement;
          const height = iframe.contentDocument?.body?.scrollHeight;
          if (height) setIframeHeight(Math.min(Math.max(height + 20, 200), 800));
        }}
      />
    </div>
  );
}

// React Preview Component (simplified - renders static)
function ReactPreview({ code }: { code: string }) {
  const [error, setError] = useState<string | null>(null);

  // For now, show as HTML with a note
  // Full React rendering would require babel transpilation
  return (
    <div className="p-4">
      <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
        <p className="text-blue-300 text-sm">
          React component preview. Copy the code and use in your project, or click "Open in Sandbox" to test live.
        </p>
        <a
          href={`https://codesandbox.io/api/v1/sandboxes/define?parameters=${encodeURIComponent(btoa(JSON.stringify({ files: { 'App.tsx': { content: code } } })))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-blue-400 hover:text-blue-300 text-sm"
        >
          <ExternalLink className="w-3 h-3" /> Open in CodeSandbox
        </a>
      </div>
      <pre className="text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go',
    html: 'html', css: 'css', json: 'json',
    md: 'markdown', sql: 'sql', sh: 'bash'
  };
  return map[ext || ''] || 'text';
}
