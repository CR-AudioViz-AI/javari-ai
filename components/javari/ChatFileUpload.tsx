"use client"

import { useState, useRef, DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Upload, FileText, X, CheckCircle, Loader2 } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface ChatFileUploadProps {
  onUploadComplete?: (documentId: string) => void
}

export default function ChatFileUpload({ onUploadComplete }: ChatFileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (selectedFile: File) => {
    // Validate file type
    const validTypes = ['text/plain', 'text/markdown', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.md') && !selectedFile.name.endsWith('.txt')) {
      setError('Please upload a text, markdown, PDF, or Word document')
      return
    }

    setFile(selectedFile)
    setError('')
  }

  const uploadDocument = async () => {
    if (!file) return

    setUploading(true)
    setError('')

    try {
      // Read file content
      const reader = new FileReader()
      
      reader.onload = async (event) => {
        const content = event.target?.result as string
        const title = file.name.replace(/\.[^/.]+$/, '')

        // Call upload API
        const response = await fetch('/api/javari/upload-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            content,
            category: 'ai-learning',
            metadata: {
              original_filename: file.name,
              file_size: file.size,
              file_type: file.type,
              uploaded_via: 'chat'
            }
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        setSuccess(true)
        setFile(null)
        
        if (onUploadComplete && data.document?.id) {
          onUploadComplete(data.document.id)
        }

        // Reset after 3 seconds
        setTimeout(() => {
          setSuccess(false)
        }, 3000)
      }

      reader.onerror = () => {
        throw new Error('Failed to read file')
      }

      reader.readAsText(file)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onButtonClick = () => {
    inputRef.current?.click()
  }

  const removeFile = () => {
    setFile(null)
    setError('')
  }

  return (
    <div className="w-full">
      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${file ? 'bg-gray-50' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".txt,.md,.pdf,.doc,.docx"
          onChange={handleChange}
        />

        {!file ? (
          <div className="space-y-4">
            <Upload className="w-12 h-12 mx-auto text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-700">
                Drop a document here for me to learn
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or click to browse files
              </p>
            </div>
            <Button onClick={onButtonClick} variant="outline">
              Browse Files
            </Button>
            <p className="text-xs text-gray-400">
              Supports: .txt, .md, .pdf, .doc, .docx
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              {!success && !uploading && (
                <Button
                  onClick={removeFile}
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {!success && (
              <Button
                onClick={uploadDocument}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Learning...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Learn This Document
                  </>
                )}
              </Button>
            )}

            {success && (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  Got it! I'll learn from this within 4 hours.
                </span>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      {!file && !success && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> I can learn from any document you share. 
            Just drop it here and I'll integrate that knowledge into my responses!
          </p>
        </div>
      )}
    </div>
  )
}
