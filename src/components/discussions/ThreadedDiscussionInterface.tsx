'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { 
  MessageSquare, 
  Reply, 
  Heart, 
  Share, 
  MoreHorizontal, 
  Pin, 
  Flag, 
  Edit3,
  Send,
  Image,
  Link,
  AtSign,
  Hash,
  Clock,
  Users,
  Eye,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  SortAsc,
  SortDesc
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface User {
  id: string;
  username: string;
  avatar_url?: string;
  display_name: string;
  is_online?: boolean;
}

interface Topic {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name: string;
  size?: number;
  thumbnail_url?: string;
}

interface Mention {
  id: string;
  user_id: string;
  start_index: number;
  end_index: number;
}

interface Comment {
  id: string;
  content: string;
  html_content?: string;
  author: User;
  created_at: string;
  updated_at?: string;
  parent_id?: string;
  thread_id: string;
  replies?: Comment[];
  likes_count: number;
  is_liked: boolean;
  is_pinned: boolean;
  is_edited: boolean;
  media_attachments?: MediaAttachment[];
  mentions?: Mention[];
  depth: number;
  is_deleted: boolean;
}

interface DiscussionThread {
  id: string;
  title: string;
  description?: string;
  author: User;
  created_at: string;
  updated_at?: string;
  topic?: Topic;
  comments_count: number;
  participants_count: number;
  last_activity: string;
  is_pinned: boolean;
  is_locked: boolean;
  is_archived: boolean;
  tags?: string[];
  views_count: number;
  comments: Comment[];
}

interface RealtimeUpdate {
  type: 'comment_added' | 'comment_updated' | 'comment_deleted' | 'thread_updated' | 'user_typing';
  data: any;
  user_id: string;
  timestamp: string;
}

interface ThreadedDiscussionInterfaceProps {
  threadId?: string;
  topicId?: string;
  currentUserId: string;
  maxDepth?: number;
  showTopics?: boolean;
  allowMediaUploads?: boolean;
  enableMentions?: boolean;
  enableCollaboration?: boolean;
  className?: string;
  onCommentAdded?: (comment: Comment) => void;
  onThreadUpdated?: (thread: DiscussionThread) => void;
}

interface CommentFormData {
  content: string;
  parent_id?: string;
  mentions?: string[];
  media_attachments?: File[];
}

interface RichTextEditorProps {
  content: string;
  onChange: (content: string, html?: string) => void;
  onMention?: (query: string) => User[];
  placeholder?: string;
  disabled?: boolean;
  showToolbar?: boolean;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionSelect: (user: User) => void;
  users: User[];
  placeholder?: string;
  disabled?: boolean;
}

interface MediaEmbedPreviewProps {
  attachments: MediaAttachment[];
  onRemove?: (id: string) => void;
  readonly?: boolean;
}

interface TopicFilterProps {
  topics: Topic[];
  selectedTopic?: string;
  onTopicSelect: (topicId: string | undefined) => void;
}

interface RealtimeIndicatorProps {
  isConnected: boolean;
  activeUsers: User[];
  typingUsers: User[];
}

// Mock Supabase client for demonstration
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  onMention,
  placeholder = 'Write your message...',
  disabled = false,
  showToolbar = true
}) => {
  const [localContent, setLocalContent] = useState(content);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionUsers, setMentionUsers] = useState<User[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = useCallback((value: string) => {
    setLocalContent(value);
    onChange(value);

    // Check for mentions
    const mentionMatch = value.match(/@(\w*)$/);
    if (mentionMatch && onMention) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setMentionUsers(onMention(query));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  }, [onChange, onMention]);

  return (
    <div className="relative">
      {showToolbar && (
        <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
          <Button variant="ghost" size="sm">
            <Image className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Link className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <AtSign className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Hash className="h-4 w-4" />
          </Button>
        </div>
      )}
      <Textarea
        ref={textareaRef}
        value={localContent}
        onChange={(e) => handleContentChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[100px] resize-none border-0 focus-visible:ring-0"
      />
      
      {showMentions && mentionUsers.length > 0 && (
        <Card className="absolute bottom-full mb-2 w-full z-50">
          <CardContent className="p-2">
            {mentionUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                onClick={() => {
                  const newContent = localContent.replace(
                    `@${mentionQuery}`,
                    `@${user.username} `
                  );
                  setLocalContent(newContent);
                  onChange(newContent);
                  setShowMentions(false);
                }}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const MediaEmbedPreview: React.FC<MediaEmbedPreviewProps> = ({
  attachments,
  onRemove,
  readonly = false
}) => {
  if (!attachments.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="relative group">
          {attachment.type === 'image' ? (
            <img
              src={attachment.thumbnail_url || attachment.url}
              alt={attachment.name}
              className="w-full h-24 object-cover rounded border"
            />
          ) : (
            <div className="w-full h-24 bg-muted rounded border flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-medium truncate">{attachment.name}</p>
                <Badge variant="secondary" className="text-xs">
                  {attachment.type.toUpperCase()}
                </Badge>
              </div>
            </div>
          )}
          
          {!readonly && onRemove && (
            <Button
              size="sm"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(attachment.id)}
            >
              ×
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

const TopicFilter: React.FC<TopicFilterProps> = ({
  topics,
  selectedTopic,
  onTopicSelect
}) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge
        variant={!selectedTopic ? "default" : "secondary"}
        className="cursor-pointer"
        onClick={() => onTopicSelect(undefined)}
      >
        All Topics
      </Badge>
      {topics.map((topic) => (
        <Badge
          key={topic.id}
          variant={selectedTopic === topic.id ? "default" : "secondary"}
          className="cursor-pointer"
          style={{ backgroundColor: selectedTopic === topic.id ? topic.color : undefined }}
          onClick={() => onTopicSelect(topic.id)}
        >
          {topic.icon && <span className="mr-1">{topic.icon}</span>}
          {topic.name}
        </Badge>
      ))}
    </div>
  );
};

const RealtimeIndicator: React.FC<RealtimeIndicatorProps> = ({
  isConnected,
  activeUsers,
  typingUsers
}) => {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        {activeUsers.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{activeUsers.length} online</span>
            </div>
          </>
        )}
      </div>
      
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            {typingUsers.slice(0, 3).map((user) => (
              <Avatar key={user.id} className="h-4 w-4 border">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="text-xs">
                  {user.username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span>
            {typingUsers.length === 1
              ? `${typingUsers[0].display_name} is typing...`
              : `${typingUsers.length} people are typing...`}
          </span>
        </div>
      )}
    </div>
  );
};

const CommentNode: React.FC<{
  comment: Comment;
  maxDepth: number;
  currentUserId: string;
  onReply: (parentId: string) => void;
  onLike: (commentId: string) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
}> = ({
  comment,
  maxDepth,
  currentUserId,
  onReply,
  onLike,
  onEdit,
  onDelete
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showReplies, setShowReplies] = useState(true);

  const canReply = comment.depth < maxDepth;
  const hasReplies = comment.replies && comment.replies.length > 0;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (comment.is_deleted) {
    return (
      <div className="flex gap-3 py-2 opacity-60">
        <div className="w-8 h-8 bg-muted rounded-full" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground italic">
            This comment has been deleted
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group"
    >
      <div className="flex gap-3">
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.author.avatar_url} />
            <AvatarFallback>
              {comment.author.username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {comment.author.is_online && (
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.author.display_name}</span>
            <span className="text-xs text-muted-foreground">@{comment.author.username}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">
                    {formatTimeAgo(comment.created_at)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {new Date(comment.created_at).toLocaleString()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {comment.is_edited && (
              <Badge variant="outline" className="text-xs h-4 px-1">
                edited
              </Badge>
            )}
            {comment.is_pinned && (
              <Pin className="h-3 w-3 text-muted-foreground" />
            )}
          </div>

          <div className="prose prose-sm max-w-none mb-2">
            {comment.html_content ? (
              <div dangerouslySetInnerHTML={{ __html: comment.html_content }} />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            )}
          </div>

          {comment.media_attachments && (
            <MediaEmbedPreview 
              attachments={comment.media_attachments}
              readonly
            />
          )}

          <div className="flex items-center gap-4 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2 ${comment.is_liked ? 'text-red-500' : ''}`}
              onClick={() => onLike(comment.id)}
            >
              <Heart className={`h-3 w-3 mr-1 ${comment.is_liked ? 'fill-current' : ''}`} />
              {comment.likes_count > 0 && (
                <span className="text-xs">{comment.likes_count}</span>
              )}
            </Button>

            {canReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => onReply(comment.id)}
              >
                <Reply className="h-3 w-3 mr-1" />
                <span className="text-xs">Reply</span>
              </Button>
            )}

            <Button variant="ghost" size="sm" className="h-8 px-2">
              <Share className="h-3 w-3 mr-1" />
              <span className="text-xs">Share</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {comment.author.id === currentUserId && (
                  <>
                    <DropdownMenuItem onClick={() => onEdit(comment)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(comment.id)}
                      className="text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem>
                  <Flag className="h-4 w-4 mr-2" />
                  Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {hasReplies && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1 mb-2 text-muted-foreground"
                onClick={() => setShowReplies(!showReplies)}
              >
                {showReplies ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                <span className="text-xs">
                  {comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}
                </span>
              </Button>

              <AnimatePresence>
                {showReplies && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-4 border-l-2 border-muted space-y-3"
                  >
                    {comment.replies!.map((reply) => (
                      <CommentNode
                        key={reply.id}
                        comment={reply}
                        maxDepth={maxDepth}
                        currentUserId={currentUserId}
                        onReply={onReply}
                        onLike={onLike}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const DiscussionThread: React.FC<{
  thread: DiscussionThread;
  isExpanded?: boolean;
  onToggle?: () => void;
}> = ({
  thread,
  isExpanded = false,
  onToggle
}) => {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <Card className={`transition-colors ${isExpanded ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="