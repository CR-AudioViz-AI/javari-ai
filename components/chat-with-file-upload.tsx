"use client"

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Send, FileText, X } from 'lucide-react'

export default function ChatWithFileUpload() {
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('text/')) {
      setFile(droppedFile)
      setMessage(`Please learn this document: ${droppedFile.name}`)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setMessage(`Please learn this document: ${selectedFile.name}`)
    }
  }

  const handleSubmit = async () => {
    if (!file && !message.trim()) return

    setUploading(true)

    try {
      if (file) {
        // Upload file
        const formData = new FormData()
        formData.append('file', file)
        formData.append('userId', 'current-user-id') // Replace with actual user ID
        formData.append('sessionId', 'current-session-id') // Replace with actual session ID

        const response = await fetch('/api/javari/chat/upload-file', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (result.success) {
          // Add Javari's response to chat
          console.log('Javari response:', result.response)
          
          // Clear form
          setFile(null)
          setMessage('')
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }
      } else {
        // Send regular message
        // Your existing chat submission logic here
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative">
      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 mb-4 transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : file
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.json,.csv"
          onChange={handleFileSelect}
          className="hidden"
          id="chat-file-upload"
        />

        {!file ? (
          <label
            htmlFor="chat-file-upload"
            className="cursor-pointer flex flex-col items-center py-4"
          >
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">
              Drop a document here or click to upload
            </span>
            <span className="text-xs text-gray-500 mt-1">
              I'll learn from any text file you share
            </span>
          </label>
        ) : (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFile(null)
                setMessage('')
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            file
              ? 'Add a message about this document...'
              : 'Type your message or drop a document above...'
          }
          className="flex-1"
          rows={3}
        />
        <Button
          onClick={handleSubmit}
          disabled={uploading || (!file && !message.trim())}
          className="self-end"
        >
          {uploading ? (
            <span>Processing...</span>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </div>

      {file && (
        <p className="text-xs text-gray-600 mt-2">
          💡 Tip: I'll automatically learn this document and be able to answer
          questions about it within 4 hours!
        </p>
      )}
    </div>
  )
}
