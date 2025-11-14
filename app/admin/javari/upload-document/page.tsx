"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'

export default function UploadDocumentPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('ai-learning')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''))

    // Read file content
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setContent(text)
    }
    reader.readAsText(selectedFile)
  }

  const handleSubmit = async () => {
    if (!title || !content) {
      setError('Title and content are required')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/javari/upload-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          category,
          tags: ['manual-upload', 'admin'],
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(true)
        setTitle('')
        setContent('')
        setFile(null)
        
        // Reset after 3 seconds
        setTimeout(() => {
          setSuccess(false)
        }, 3000)
      } else {
        setError(result.error || 'Failed to upload document')
      }
    } catch (err) {
      setError('Error uploading document: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Upload Document for Javari</h1>
        <p className="text-gray-600 mt-2">
          Upload documents for Javari to learn from. Documents are automatically queued for processing.
        </p>
      </div>

      <div className="grid gap-6">
        {/* File Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Upload a text file (.txt, .md, .json) for Javari to learn
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Input
                type="file"
                accept=".txt,.md,.json,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-12 w-12 text-gray-400 mb-4" />
                <span className="text-sm text-gray-600">
                  Click to upload or drag and drop
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  TXT, MD, JSON, CSV up to 10MB
                </span>
              </label>
              {file && (
                <div className="mt-4 flex items-center justify-center text-sm text-green-600">
                  <FileText className="h-4 w-4 mr-2" />
                  {file.name}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Manual Entry Card */}
        <Card>
          <CardHeader>
            <CardTitle>Document Details</CardTitle>
            <CardDescription>
              Or paste content directly below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Document Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Platform Feature Specification"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai-learning">AI Learning (Highest Priority)</SelectItem>
                  <SelectItem value="technical">Technical Documentation</SelectItem>
                  <SelectItem value="business">Business Information</SelectItem>
                  <SelectItem value="product">Product Specifications</SelectItem>
                  <SelectItem value="support">Support Documentation</SelectItem>
                  <SelectItem value="customer">Customer Help</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste document content here..."
                className="mt-1 min-h-[300px] font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                {content.length.toLocaleString()} characters
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                <CheckCircle className="h-4 w-4" />
                Document uploaded successfully! Javari will learn it within 4 hours.
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={loading || !title || !content}
              className="w-full"
            >
              {loading ? 'Uploading...' : 'Upload & Queue for Learning'}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm">How it Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-2">
            <p>1. Upload your document using the form above</p>
            <p>2. Document is automatically saved to the database</p>
            <p>3. Database trigger queues it for Javari's learning</p>
            <p>4. Cron job processes queue every 4 hours</p>
            <p>5. Javari generates embeddings and learns the content</p>
            <p>6. Knowledge is available for questions within 4 hours</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
