import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Reply, 
  MoreVertical,
  Pin,
  Lock,
  Trash2,
  Edit,
  Upload,
  Bell,
  Users,
  Clock,
  Eye,
  ChevronDown,
  ChevronRight,
  Send,
  Paperclip,
  Bold,
  Italic,
  Link,
  Code,
  List,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Types
interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  reputation: number;
  role: 'admin' | 'moderator' | 'user';
  is_online: boolean;
  last_seen: string;
}

interface Thread {
  id: string;
  title: string;
  content: string;
  author: User;
  created_at: string;
  updated_at: string;
  reply_count: number;
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  category: string;
  tags: string[];
  votes: {
    upvotes: number;
    downvotes: number;
    user_vote?: 'up' | 'down';
  };
  attachments: Attachment[];
  replies: Reply[];
}

interface Reply {
  id: string;
  content: string;
  author: User;
  created_at: string;
  updated_at: string;
  parent_id?: string;
  thread_id: string;
  votes: {
    upvotes: number;
    downvotes: number;
    user_vote?: 'up' | 'down';
  };
  attachments: Attachment[];
  replies: Reply[];
  depth: number;
}

interface Attachment {
  id: string;
  filename: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

interface ThreadedDiscussionForumProps {
  className?: string;
  currentUser?: User;
  onThreadCreate?: (thread: Omit<Thread, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onReplyCreate?: (reply: Omit<Reply, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onVote?: (type: 'thread' | 'reply', id: string, vote: 'up' | 'down') => Promise<void>;
  onFileUpload?: (file: File) => Promise<Attachment>;
}

// Rich Text Editor Component
const RichTextEditor: React.FC<{
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onFileUpload?: (file: File) => Promise<Attachment>;
}> = ({ content, onChange, placeholder, onFileUpload }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onFileUpload) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const attachment = await onFileUpload(file);
      const fileLink = `[${attachment.filename}](${attachment.file_url})`;
      onChange(content + '\n\n' + fileLink);
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="border border-input rounded-md">
      <div className="flex items-center gap-1 p-2 border-b border-input bg-muted/50">
        <Button variant="ghost" size="sm">
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Link className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Code className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <List className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Clock className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach file</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
      </div>
      {isUploading && (
        <div className="p-2 border-b border-input">
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-1">Uploading...</p>
        </div>
      )}
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-0 min-h-[120px] resize-none focus-visible:ring-0"
      />
    </div>
  );
};

// User Avatar Component
const UserAvatar: React.FC<{
  user: User;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}> = ({ user, size = 'md', showStatus = false }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  return (
    <div className="relative">
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={user.avatar_url} alt={user.username} />
        <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      {showStatus && (
        <div className={cn(
          "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background",
          user.is_online ? "bg-green-500" : "bg-gray-400"
        )} />
      )}
    </div>
  );
};

// Voting System Component
const VotingSystem: React.FC<{
  votes: {
    upvotes: number;
    downvotes: number;
    user_vote?: 'up' | 'down';
  };
  onVote: (vote: 'up' | 'down') => void;
  size?: 'sm' | 'md';
}> = ({ votes, onVote, size = 'md' }) => {
  const totalScore = votes.upvotes - votes.downvotes;
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const buttonSize = size === 'sm' ? 'sm' : 'default';

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant={votes.user_vote === 'up' ? 'default' : 'ghost'}
        size={buttonSize}
        onClick={() => onVote('up')}
        className="p-1"
      >
        <ThumbsUp className={cn(iconSize, votes.user_vote === 'up' && 'text-primary-foreground')} />
      </Button>
      <span className={cn(
        "font-semibold text-center min-w-8",
        totalScore > 0 && "text-green-600",
        totalScore < 0 && "text-red-600"
      )}>
        {totalScore}
      </span>
      <Button
        variant={votes.user_vote === 'down' ? 'destructive' : 'ghost'}
        size={buttonSize}
        onClick={() => onVote('down')}
        className="p-1"
      >
        <ThumbsDown className={cn(iconSize, votes.user_vote === 'down' && 'text-destructive-foreground')} />
      </Button>
    </div>
  );
};

// Reply Item Component
const ReplyItem: React.FC<{
  reply: Reply;
  onReply: (parentId: string) => void;
  onVote: (id: string, vote: 'up' | 'down') => void;
  currentUser?: User;
}> = ({ reply, onReply, onVote, currentUser }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <div className={cn(
      "border-l-2 border-muted pl-4 ml-4",
      reply.depth > 0 && "mt-4"
    )}>
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <VotingSystem
              votes={reply.votes}
              onVote={(vote) => onVote(reply.id, vote)}
              size="sm"
            />
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserAvatar user={reply.author} size="sm" showStatus />
                  <span className="font-medium">{reply.author.username}</span>
                  <Badge variant="outline" className="text-xs">
                    {reply.author.reputation} rep
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(reply.created_at).toLocaleDateString()}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onReply(reply.id)}>
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </DropdownMenuItem>
                    {currentUser?.id === reply.author.id && (
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="prose prose-sm max-w-none">
                {reply.content}
              </div>

              {reply.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {reply.attachments.map((attachment) => (
                    <Badge key={attachment.id} variant="secondary" className="gap-1">
                      <Paperclip className="h-3 w-3" />
                      {attachment.filename}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReplyForm(!showReplyForm)}
                >
                  <Reply className="h-4 w-4 mr-1" />
                  Reply
                </Button>
                {reply.replies.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {reply.replies.length} replies
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isExpanded && reply.replies.map((childReply) => (
        <ReplyItem
          key={childReply.id}
          reply={childReply}
          onReply={onReply}
          onVote={onVote}
          currentUser={currentUser}
        />
      ))}
    </div>
  );
};

// Thread Item Component
const ThreadItem: React.FC<{
  thread: Thread;
  onThreadClick: (thread: Thread) => void;
  onVote: (id: string, vote: 'up' | 'down') => void;
  currentUser?: User;
}> = ({ thread, onThreadClick, onVote, currentUser }) => {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onThreadClick(thread)}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <VotingSystem
            votes={thread.votes}
            onVote={(vote) => onVote(thread.id, vote)}
          />
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {thread.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                  {thread.is_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                  <h3 className="font-semibold text-lg">{thread.title}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{thread.category}</Badge>
                  {thread.tags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
                    <>
                      <DropdownMenuItem>
                        <Pin className="h-4 w-4 mr-2" />
                        {thread.is_pinned ? 'Unpin' : 'Pin'}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Lock className="h-4 w-4 mr-2" />
                        {thread.is_locked ? 'Unlock' : 'Lock'}
                      </DropdownMenuItem>
                    </>
                  )}
                  {currentUser?.id === thread.author.id && (
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {(currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="text-muted-foreground line-clamp-2">{thread.content}</p>

            {thread.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {thread.attachments.map((attachment) => (
                  <Badge key={attachment.id} variant="secondary" className="gap-1">
                    <Paperclip className="h-3 w-3" />
                    {attachment.filename}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <UserAvatar user={thread.author} size="sm" />
                  <span>{thread.author.username}</span>
                </div>
                <span>{new Date(thread.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  <span>{thread.reply_count}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span>{thread.view_count}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Thread Composer Component
const ThreadComposer: React.FC<{
  onSubmit: (thread: Omit<Thread, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onFileUpload?: (file: File) => Promise<Attachment>;
  currentUser?: User;
}> = ({ onSubmit, onFileUpload, currentUser }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        author: currentUser,
        category: category || 'General',
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        attachments,
        reply_count: 0,
        view_count: 0,
        is_pinned: false,
        is_locked: false,
        votes: { upvotes: 0, downvotes: 0 },
        replies: []
      });
      
      // Reset form
      setTitle('');
      setContent('');
      setCategory('');
      setTags('');
      setAttachments([]);
    } catch (error) {
      console.error('Failed to create thread:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Start a New Discussion</h3>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="thread-title">Title</Label>
            <Input
              id="thread-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your question or topic?"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="thread-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Technical">Technical</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                  <SelectItem value="Feature Request">Feature Request</SelectItem>
                  <SelectItem value="Bug Report">Bug Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="thread-tags">Tags</Label>
              <Input
                id="thread-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="javascript, react, help (comma separated)"
              />