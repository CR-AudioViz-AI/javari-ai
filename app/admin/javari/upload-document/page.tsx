"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function UploadDocumentPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('ai-learning')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClientComponentClient()

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Insert into documentation_system_docs table
      const { data, error: insertError } = await supabase
        .from('documentation_system_docs')
        .insert({
          title,
          content,
          category,
          file_path: file ? `uploads/${file.name}` : null,
          metadata: {
            uploaded_via: 'admin',
            file_size: file?.size || content.length,
            upload_timestamp: new Date().toISOString()
          }
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Database trigger will automatically add to javari_document_queue
      setSuccess(true)
      setTitle('')
      setContent('')
      setFile(null)
      setCategory('ai-learning')

      // Show success for 3 seconds
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-6 h-6" />
              Upload Document for Javari Learning
            </CardTitle>
            <CardDescription>
              Upload documents that Javari should learn from. She'll automatically process and integrate this knowledge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="file">Upload File (Optional)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={loading}
                />
                {file && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {file.name} ({Math.round(file.size / 1024)}KB)
                  </p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Document Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Javari AI Capabilities Guide"
                  required
                  disabled={loading}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai-learning">AI Learning (Highest Priority)</SelectItem>
                    <SelectItem value="platform-docs">Platform Documentation</SelectItem>
                    <SelectItem value="api-reference">API Reference</SelectItem>
                    <SelectItem value="user-guides">User Guides</SelectItem>
                    <SelectItem value="technical-specs">Technical Specifications</SelectItem>
                    <SelectItem value="business-docs">Business Documents</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Document Content *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste document content here or upload a file above..."
                  rows={12}
                  required
                  disabled={loading}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  {content.length.toLocaleString()} characters
                </p>
              </div>

              {/* Status Messages */}
              {success && (
                <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <div>
                    <p className="font-semibold">Document uploaded successfully!</p>
                    <p className="text-sm">Javari will learn from this within 4 hours.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                  <AlertCircle className="w-5 h-5" />
                  <div>
                    <p className="font-semibold">Upload failed</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !title || !content}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload for Javari to Learn
                  </>
                )}
              </Button>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
