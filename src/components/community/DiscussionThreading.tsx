```tsx
'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { 
  ChevronUp, 
  ChevronDown, 
  MessageCircle, 
  Share2, 
  Flag, 
  MoreHorizontal,
  Image as ImageIcon,
  Link2,
  Play,
  Download,
  Eye,
  EyeOff,
  Heart,
  Reply,
  Bookmark
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Types
interface User {
  id: string
  username: string
  avatar_url?: string
  display_name?: string
  reputation?: number
  is_verified?: boolean
}

interface MediaAttachment {
  id: string
  type: 'image' | 'video' | 'audio' | 'link' | 'file'
  url: string
  thumbnail_url?: string
  title?: string
  description?: string
  file_size?: number
  duration?: number
  width?: number
  height?: number
}

interface Post {
  id: string
  content: string
  author: User
  created_at: string
  updated_at?: string
  vote_score: number
  user_vote?: 'up' | 'down' | null
  reply_count: number
  is_pinned?: boolean
  is_locked?: boolean
  is_deleted?: boolean
  depth: number
  parent_id?: string
  thread_id: string
  media_attachments?: MediaAttachment[]
  mentions?: User[]
  is_solution?: boolean
  is_edited?: boolean
}

interface Thread {
  id: string
  title: string
  description?: string
  category: string
  tags: string[]
  author: User
  created_at: string
  updated_at: string
  posts: Post[]
  is_locked: boolean
  is_pinned: boolean
  view_count: number
  subscriber_count: number
  is_subscribed: boolean
}

// Form schemas
const replySchema = z.object({
  content: z.string().min(1, 'Reply cannot be empty').max(10000, 'Reply too long'),
  media_attachments: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional()
})

type ReplyFormData = z.infer<typeof replySchema>

// Props interfaces
interface DiscussionThreadingProps {
  thread: Thread
  currentUserId?: string
  onVote?: (postId: string, voteType: 'up' | 'down' | null) => Promise<void>
  onReply?: (postId: string, content: string, attachments?: string[]) => Promise<void>
  onSubscribe?: (threadId: string, subscribe: boolean) => Promise<void>
  onReport?: (postId: string, reason: string) => Promise<void>
  onBookmark?: (postId: string) => Promise<void>
  onLoadMore?: (postId: string, cursor?: string) => Promise<Post[]>
  onMediaUpload?: (file: File) => Promise<MediaAttachment>
  maxDepth?: number
  enableRealtime?: boolean
  className?: string
}

interface PostItemProps {
  post: Post
  currentUserId?: string
  onVote?: (postId: string, voteType: 'up' | 'down' | null) => Promise<void>
  onReply?: (postId: string, content: string, attachments?: string[]) => Promise<void>
  onReport?: (postId: string, reason: string) => Promise<void>
  onBookmark?: (postId: string) => Promise<void>
  maxDepth: number
  depth?: number
  isHighlighted?: boolean
  className?: string
}

interface VoteButtonsProps {
  postId: string
  voteScore: number
  userVote?: 'up' | 'down' | null
  onVote?: (postId: string, voteType: 'up' | 'down' | null) => Promise<void>
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

interface MediaAttachmentProps {
  attachment: MediaAttachment
  className?: string
}

interface ReplyEditorProps {
  postId: string
  onSubmit: (content: string, attachments?: string[]) => Promise<void>
  onCancel: () => void
  placeholder?: string
  maxLength?: number
  className?: string
}

// Utility functions
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  
  return date.toLocaleDateString()
}

const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Vote Buttons Component
const VoteButtons: React.FC<VoteButtonsProps> = ({ 
  postId, 
  voteScore, 
  userVote, 
  onVote, 
  disabled = false,
  size = 'md' 
}) => {
  const [isVoting, setIsVoting] = useState(false)
  const [optimisticScore, setOptimisticScore] = useState(voteScore)
  const [optimisticVote, setOptimisticVote] = useState(userVote)

  const handleVote = useCallback(async (voteType: 'up' | 'down' | null) => {
    if (isVoting || !onVote) return

    setIsVoting(true)
    
    // Optimistic update
    const prevVote = optimisticVote
    const newVote = prevVote === voteType ? null : voteType
    
    let scoreChange = 0
    if (prevVote === 'up' && newVote === null) scoreChange = -1
    else if (prevVote === 'down' && newVote === null) scoreChange = 1
    else if (prevVote === 'up' && newVote === 'down') scoreChange = -2
    else if (prevVote === 'down' && newVote === 'up') scoreChange = 2
    else if (prevVote === null && newVote === 'up') scoreChange = 1
    else if (prevVote === null && newVote === 'down') scoreChange = -1

    setOptimisticScore(prev => prev + scoreChange)
    setOptimisticVote(newVote)

    try {
      await onVote(postId, newVote)
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticScore(voteScore)
      setOptimisticVote(userVote)
    } finally {
      setIsVoting(false)
    }
  }, [postId, onVote, isVoting, optimisticVote, voteScore, userVote])

  const buttonSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'

  return (
    <div className="flex flex-col items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={optimisticVote === 'up' ? 'default' : 'ghost'}
              size={buttonSize}
              onClick={() => handleVote('up')}
              disabled={disabled || isVoting}
              className={cn(
                "h-8 w-8 p-0",
                optimisticVote === 'up' && "text-orange-500 bg-orange-50 border-orange-200"
              )}
              aria-label="Upvote"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Upvote</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <span className={cn(
        "text-sm font-medium tabular-nums",
        optimisticScore > 0 && "text-green-600",
        optimisticScore < 0 && "text-red-600"
      )}>
        {optimisticScore > 0 ? '+' : ''}{optimisticScore}
      </span>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={optimisticVote === 'down' ? 'default' : 'ghost'}
              size={buttonSize}
              onClick={() => handleVote('down')}
              disabled={disabled || isVoting}
              className={cn(
                "h-8 w-8 p-0",
                optimisticVote === 'down' && "text-blue-500 bg-blue-50 border-blue-200"
              )}
              aria-label="Downvote"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Downvote</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

// Media Attachment Component
const MediaAttachment: React.FC<MediaAttachmentProps> = ({ attachment, className }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
  }, [])

  const handleError = useCallback(() => {
    setHasError(true)
  }, [])

  if (hasError) {
    return (
      <div className={cn("p-4 border border-dashed border-gray-300 rounded-lg text-center", className)}>
        <p className="text-sm text-muted-foreground">Failed to load media</p>
      </div>
    )
  }

  switch (attachment.type) {
    case 'image':
      return (
        <div className={cn("relative overflow-hidden rounded-lg", className)}>
          <img
            src={attachment.url}
            alt={attachment.title || 'Attachment'}
            className="max-w-full h-auto"
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
          />
          {!isLoaded && (
            <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-gray-400" />
            </div>
          )}
        </div>
      )

    case 'video':
      return (
        <div className={cn("relative overflow-hidden rounded-lg bg-black", className)}>
          <video
            src={attachment.url}
            poster={attachment.thumbnail_url}
            controls
            className="max-w-full h-auto"
            onLoadedData={handleLoad}
            onError={handleError}
          >
            Your browser does not support the video tag.
          </video>
          {!isLoaded && (
            <div className="absolute inset-0 bg-gray-900 animate-pulse flex items-center justify-center">
              <Play className="h-12 w-12 text-white" />
            </div>
          )}
        </div>
      )

    case 'link':
      return (
        <Card className={cn("border-l-4 border-l-blue-500", className)}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Link2 className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">
                  {attachment.title || 'Link'}
                </h4>
                {attachment.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {attachment.description}
                  </p>
                )}
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline mt-1 block truncate"
                >
                  {attachment.url}
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )

    case 'file':
      return (
        <Card className={cn("border-dashed", className)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded">
                <Download className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {attachment.title || 'File'}
                </p>
                {attachment.file_size && (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file_size)}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={attachment.url} download>
                  Download
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )

    default:
      return null
  }
}

// Reply Editor Component
const ReplyEditor: React.FC<ReplyEditorProps> = ({ 
  postId, 
  onSubmit, 
  onCancel, 
  placeholder = "Write your reply...",
  maxLength = 10000,
  className 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<ReplyFormData>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      content: '',
      media_attachments: [],
      mentions: []
    }
  })

  const content = watch('content')

  const handleFormSubmit = useCallback(async (data: ReplyFormData) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(data.content, data.media_attachments)
      reset()
    } catch (error) {
      console.error('Failed to submit reply:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [onSubmit, isSubmitting, reset])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit(handleFormSubmit)()
    }
  }, [handleSubmit, handleFormSubmit])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Textarea
              {...register('content')}
              ref={textareaRef}
              placeholder={placeholder}
              rows={3}
              maxLength={maxLength}
              onKeyDown={handleKeyDown}
              className="resize-none"
              aria-describedby={errors.content ? `${postId}-content-error` : undefined}
            />
            {errors.content && (
              <p id={`${postId}-content-error`} className="text-sm text-red-600">
                {errors.content.message}
              </p>
            )}
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Cmd/Ctrl + Enter to submit</span>
              <span>{content?.length || 0}/{maxLength}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !content?.trim()}
              className="min-w-[80px]"
            >
              {isSubmitting ? 'Posting...' : 'Reply'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Post Item Component
const PostItem: React.FC<PostItemProps> = ({ 
  post, 
  currentUserId, 
  onVote, 
  onReply, 
  onReport, 
  onBookmark,
  maxDepth,
  depth = 0,
  isHighlighted = false,
  className 
}) => {
  const [showReplyEditor, setShowReplyEditor] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)

  const canReply = depth < maxDepth && !post.is_deleted
  const isAuthor = currentUserId === post.author.id

  const handleReplySubmit = useCallback(async (content: string, attachments?: string[]) => {
    if (onReply) {
      await onReply(post.id, content, attachments)
      setShowReplyEditor(false)
    }
  }, [post.id, onReply])

  const handleBookmark = useCallback(async () => {
    if (onBookmark) {
      await onBookmark(post.id)
      setIsBookmarked(!isBookmarked)
    }
  }, [post.id, onBookmark, isBookmarked])

  if (post.is_deleted) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground italic">
            [This post has been deleted]
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      "transition-colors",
      isHighlighted && "ring-2 ring-blue-500 ring-opacity-50",
      depth > 0 && "ml-6",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Vote buttons */}
          <div className="flex-shrink-0">
            <VoteButtons
              postId={post.id}
              voteScore={post.vote_score}
              userVote={post.user_vote}
              onVote={onVote}
              size="sm"
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <Avatar className="h-6 w-6">
                <AvatarImage src={post.author.avatar_url} alt={post.author.username} />
                <AvatarFallback className="text-xs">
                  {getInitials(post.author.display_name || post.author.username)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {post.author.display_name || post.author.username}
                </span>
                {post.author.is_verified && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                    Verified
                  </Badge>
                )}
                {post.author.reputation && (
                  <span className="text-muted-foreground">
                    {post.author.reputation} rep
                  </span>
                )}
              </div>

              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(post.created_at)}
              </span>

              {post.is_edited && (
                <Badge variant="outline" className="text-xs">
                  Edited
                </Badge>
              )}

              {post.is_solution && (
                <Badge className="text-xs bg-green-100 text-green-800">
                  Solution
                </Badge>
              )}

              {post.is_pinned && (
                <Badge className="text-xs bg-blue-100 text-blue-800">
                  Pinned
                </Badge>
              )}

              {/* Actions dropdown */}
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleBookmark}>
                      <Bookmark