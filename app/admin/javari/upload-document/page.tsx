"use client"

import { useState } from 'react'

export default function UploadDocumentPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('ai-learning')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''))
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setContent(text)
    }
    reader.readAsText(selectedFile)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/javari/upload-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          category,
          metadata: {
            uploaded_via: 'admin',
            upload_timestamp: new Date().toISOString()
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setSuccess(true)
      setTitle('')
      setContent('')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to upload document')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            📤 Upload Document for Javari Learning
          </h1>
          <p className="text-gray-600 mb-6">
            Upload documents that Javari should learn from. She'll automatically process and integrate this knowledge.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
                Upload File (Optional)
              </label>
              <input
                id="file"
                type="file"
                accept=".txt,.md,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                disabled={loading}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none p-2"
              />
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Document Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Javari AI Capabilities Guide"
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ai-learning">AI Learning (Highest Priority)</option>
                <option value="platform-docs">Platform Documentation</option>
                <option value="api-reference">API Reference</option>
                <option value="user-guides">User Guides</option>
                <option value="technical-specs">Technical Specifications</option>
                <option value="business-docs">Business Documents</option>
              </select>
            </div>

            {/* Content */}
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                Document Content *
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste document content here or upload a file above..."
                rows={12}
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-sm text-gray-500 mt-1">
                {content.length.toLocaleString()} characters
              </p>
            </div>

            {/* Status Messages */}
            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
                <p className="font-semibold">✅ Document uploaded successfully!</p>
                <p className="text-sm">Javari will learn from this within 4 hours.</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                <p className="font-semibold">❌ Upload failed</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !title || !content}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '⏳ Uploading...' : '📤 Upload for Javari to Learn'}
            </button>
          </form>

          {/* Info Section */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-semibold text-blue-900 mb-2">How It Works</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Documents are queued automatically for learning</li>
              <li>• Javari processes documents every 4 hours via cron job</li>
              <li>• AI-learning category gets highest priority</li>
              <li>• Embeddings are generated for semantic search</li>
              <li>• Javari's knowledge updates continuously</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
