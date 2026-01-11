'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, File, FileText, Image as ImageIcon, Code, Database } from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  content?: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  error?: string;
}

export function FileUploadZone() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map(file => ({
      id: Math.random().toString(36),
      name: file.name,
      size: file.size,
      type: file.type,
      url: '',
      status: 'uploading' as const
    }));

    setFiles(prev => [...prev, ...newFiles]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileData = newFiles[i];

      try {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch('/api/javari/upload', {
          method: 'POST',
          body: formData
        });

        if (!uploadResponse.ok) throw new Error('Upload failed');

        const { url } = await uploadResponse.json();
        
        // Update status to processing
        setFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, url, status: 'processing' } : f
        ));

        // Process file content
        const processResponse = await fetch('/api/javari/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, type: file.type, name: file.name })
        });

        if (!processResponse.ok) throw new Error('Processing failed');

        const { content } = await processResponse.json();

        // Update to ready
        setFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, content, status: 'ready' } : f
        ));

        // Add to Javari context
        await fetch('/api/javari/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'file',
            name: file.name,
            content,
            metadata: { size: file.size, type: file.type }
          })
        });

      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileData.id 
            ? { ...f, status: 'error', error: (error as Error).message } 
            : f
        ));
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('code') || type.includes('javascript') || type.includes('typescript')) {
      return <Code className="h-5 w-5 text-green-500" />;
    }
    if (type.includes('json') || type.includes('csv')) return <Database className="h-5 w-5 text-purple-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragging 
            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 scale-105' 
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleChange}
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.jpg,.jpeg,.png,.gif,.webp,.ts,.tsx,.js,.jsx,.py"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={`p-4 rounded-full ${isDragging ? 'bg-cyan-100 dark:bg-cyan-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <Upload className={`h-8 w-8 ${isDragging ? 'text-cyan-600' : 'text-gray-600'}`} />
          </div>
          
          <div>
            <p className="text-base font-medium text-gray-900 dark:text-gray-100">
              {isDragging ? 'Drop files here' : 'Drop files or click to upload'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              PDF, DOCX, TXT, MD, Images, Code files up to 10MB
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg"
            >
              {getFileIcon(file.type)}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
                  {file.status === 'uploading' && (
                    <span className="text-xs text-blue-600">Uploading...</span>
                  )}
                  {file.status === 'processing' && (
                    <span className="text-xs text-yellow-600">Processing...</span>
                  )}
                  {file.status === 'ready' && (
                    <span className="text-xs text-green-600">✓ Ready</span>
                  )}
                  {file.status === 'error' && (
                    <span className="text-xs text-red-600">Error: {file.error}</span>
                  )}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
