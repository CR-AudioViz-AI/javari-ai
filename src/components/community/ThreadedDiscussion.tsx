```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Edit,
  Trash2,
  Flag,
  Shield,
  MoreHorizontal,
  Pin,
  Lock,
  Eye,
  EyeOff,
  Users,
  TrendingUp,
  Clock,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface User {
  id: string;
  username: string;
  avatar?: string;
  role: 'admin' | 'moderator' | 'user';
  reputation: number;
}

interface Vote {
  id: string;
  userId: string;
  commentId: string;
  type: 'up' | 'down';
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  author: User;
  parentId: string | null;
  threadId: string;
  createdAt: string;
  updatedAt: string;
  score: number;
  userVote?: 'up' | 'down' | null;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  isLocked: boolean;
  isHidden: boolean;
  moderationFlags: string[];
  replies: Comment[];
  depth: number;
}

interface Thread {
  id: string;
  title: string;
  description?: string;
  authorId: string;
  author: User;
  createdAt: string;
  isLocked: boolean;
  isPinned: boolean;
  commentCount: number;
  tags: string[];
}

interface ModerationAction {
  id: string;
  action: 'pin' | 'unpin' | 'lock' | 'unlock' | 'hide' | 'unhide' | 'delete';
  commentId: string;
  moderatorId: string;
  reason?: string;
  createdAt: string;
}

type SortOption = 'best' | 'new' | 'top' | 'controversial';

interface ThreadedDiscussionProps {
  threadId: string;
  currentUser?: User;
  className?: string;
  maxDepth?: number;
  enableModeration?: boolean;
  enableRealtime?: boolean;
  onCommentCreate?: (comment: Comment) => void;
  onCommentUpdate?: (comment: Comment) => void;
  onCommentDelete?: (commentId: string) => void;
  onVote?: (commentId: string, voteType: 'up' | 'down' | null) => void;
  onModerationAction?: (action: ModerationAction) => void;
}

// Comment Skeleton
const CommentSkeleton: React.FC<{ depth?: number }> = ({ depth = 0 }) => (
  <div className={cn("space-y-3", depth > 0 && "ml-8 border-l-2 border-muted pl-4")}>
    <div className="flex items-start space-x-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-16 w-full" />
        <div className="flex items-center space-x-4">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  </div>
);

// Voting Controls
const VotingControls: React.FC<{
  score: number;
  userVote?: 'up' | 'down' | null;
  onVote: (voteType: 'up' | 'down' | null) => void;
  disabled?: boolean;
}> = ({ score, userVote, onVote, disabled = false }) => {
  return (
    <div className="flex flex-col items-center space-y-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 w-6 p-0 hover:bg-orange-100",
          userVote === 'up' && "text-orange-500 bg-orange-50"
        )}
        onClick={() => onVote(userVote === 'up' ? null : 'up')}
        disabled={disabled}
        aria-label="Upvote"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      
      <span className={cn(
        "text-sm font-medium min-w-[2rem] text-center",
        userVote === 'up' && "text-orange-500",
        userVote === 'down' && "text-blue-500",
        score > 0 && !userVote && "text-green-600",
        score < 0 && !userVote && "text-red-600"
      )}>
        {score > 999 ? `${(score / 1000).toFixed(1)}k` : score}
      </span>
      
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 w-6 p-0 hover:bg-blue-100",
          userVote === 'down' && "text-blue-500 bg-blue-50"
        )}
        onClick={() => onVote(userVote === 'down' ? null : 'down')}
        disabled={disabled}
        aria-label="Downvote"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Comment Form
const CommentForm: React.FC<{
  parentId?: string;
  initialContent?: string;
  isEditing?: boolean;
  onSubmit: (content: string) => void;
  onCancel: () => void;
  placeholder?: string;
  disabled?: boolean;
}> = ({ 
  parentId, 
  initialContent = '', 
  isEditing = false, 
  onSubmit, 
  onCancel, 
  placeholder = "Write your comment...",
  disabled = false 
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      if (!isEditing) {
        setContent('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        className="min-h-[100px] resize-none"
        aria-label={isEditing ? "Edit comment" : "Write comment"}
      />
      <div className="flex items-center space-x-2">
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting || disabled}
          size="sm"
        >
          {isSubmitting ? 'Submitting...' : isEditing ? 'Save' : 'Comment'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

// Comment Actions
const CommentActions: React.FC<{
  comment: Comment;
  currentUser?: User;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onPin?: () => void;
  onLock?: () => void;
  onHide?: () => void;
  canModerate?: boolean;
}> = ({ 
  comment, 
  currentUser, 
  onReply, 
  onEdit, 
  onDelete, 
  onReport, 
  onPin, 
  onLock, 
  onHide,
  canModerate = false 
}) => {
  const canEdit = currentUser?.id === comment.authorId;
  const canDelete = canEdit || canModerate;

  return (
    <div className="flex items-center space-x-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onReply}
        className="text-muted-foreground hover:text-foreground"
        disabled={comment.isLocked}
      >
        <MessageSquare className="h-3 w-3 mr-1" />
        Reply
      </Button>

      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="text-muted-foreground hover:text-foreground"
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onReport}>
            <Flag className="h-3 w-3 mr-2" />
            Report
          </DropdownMenuItem>
          
          {canModerate && (
            <>
              <DropdownMenuSeparator />
              {onPin && (
                <DropdownMenuItem onClick={onPin}>
                  <Pin className="h-3 w-3 mr-2" />
                  {comment.isPinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
              )}
              {onLock && (
                <DropdownMenuItem onClick={onLock}>
                  <Lock className="h-3 w-3 mr-2" />
                  {comment.isLocked ? 'Unlock' : 'Lock'}
                </DropdownMenuItem>
              )}
              {onHide && (
                <DropdownMenuItem onClick={onHide}>
                  {comment.isHidden ? <Eye className="h-3 w-3 mr-2" /> : <EyeOff className="h-3 w-3 mr-2" />}
                  {comment.isHidden ? 'Unhide' : 'Hide'}
                </DropdownMenuItem>
              )}
            </>
          )}

          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// Moderation Panel
const ModerationPanel: React.FC<{
  comment: Comment;
  onAction: (action: ModerationAction['action'], reason?: string) => void;
}> = ({ comment, onAction }) => {
  const [selectedAction, setSelectedAction] = useState<ModerationAction['action'] | null>(null);
  const [reason, setReason] = useState('');

  const handleAction = () => {
    if (selectedAction) {
      onAction(selectedAction, reason || undefined);
      setSelectedAction(null);
      setReason('');
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Shield className="h-3 w-3 mr-1" />
          Moderate
        </Button>
      </SheetTrigger>
      <SheetContent>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Moderation Actions</h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Action</label>
            <Select
              value={selectedAction || ''}
              onValueChange={(value) => setSelectedAction(value as ModerationAction['action'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pin">Pin Comment</SelectItem>
                <SelectItem value="unpin">Unpin Comment</SelectItem>
                <SelectItem value="lock">Lock Comment</SelectItem>
                <SelectItem value="unlock">Unlock Comment</SelectItem>
                <SelectItem value="hide">Hide Comment</SelectItem>
                <SelectItem value="unhide">Unhide Comment</SelectItem>
                <SelectItem value="delete">Delete Comment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (Optional)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason for this action..."
            />
          </div>

          <Button onClick={handleAction} disabled={!selectedAction}>
            Apply Action
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Individual Comment
const Comment: React.FC<{
  comment: Comment;
  currentUser?: User;
  onVote: (commentId: string, voteType: 'up' | 'down' | null) => void;
  onReply: (parentId: string, content: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onReport: (commentId: string) => void;
  onModerationAction?: (commentId: string, action: ModerationAction['action'], reason?: string) => void;
  canModerate?: boolean;
  maxDepth: number;
}> = ({ 
  comment, 
  currentUser, 
  onVote, 
  onReply, 
  onEdit, 
  onDelete, 
  onReport, 
  onModerationAction,
  canModerate = false,
  maxDepth 
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleReply = (content: string) => {
    onReply(comment.id, content);
    setShowReplyForm(false);
  };

  const handleEdit = (content: string) => {
    onEdit(comment.id, content);
    setShowEditForm(false);
  };

  const handleDelete = () => {
    onDelete(comment.id);
    setShowDeleteDialog(false);
  };

  const handleModerationAction = (action: ModerationAction['action'], reason?: string) => {
    onModerationAction?.(comment.id, action, reason);
  };

  if (comment.isDeleted) {
    return (
      <div className={cn(
        "space-y-2",
        comment.depth > 0 && "ml-8 border-l-2 border-muted pl-4"
      )}>
        <div className="text-sm text-muted-foreground italic">
          [Comment deleted]
        </div>
        {comment.replies.length > 0 && (
          <CommentThread
            comments={comment.replies}
            currentUser={currentUser}
            onVote={onVote}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onReport={onReport}
            onModerationAction={onModerationAction}
            canModerate={canModerate}
            maxDepth={maxDepth}
          />
        )}
      </div>
    );
  }

  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'moderator':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const timeAgo = useMemo(() => {
    const now = new Date();
    const created = new Date(comment.createdAt);
    const diffInMs = now.getTime() - created.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  }, [comment.createdAt]);

  return (
    <div className={cn(
      "space-y-3",
      comment.depth > 0 && "ml-8 border-l-2 border-muted pl-4"
    )}>
      <Card className={cn(
        comment.isPinned && "border-yellow-200 bg-yellow-50",
        comment.isHidden && "opacity-50"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <VotingControls
              score={comment.score}
              userVote={comment.userVote}
              onVote={(voteType) => onVote(comment.id, voteType)}
              disabled={!currentUser || comment.isLocked}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={comment.author.avatar} />
                  <AvatarFallback>
                    {comment.author.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <span className="font-medium text-sm">
                  {comment.author.username}
                </span>

                {comment.author.role !== 'user' && (
                  <Badge className={cn("text-xs", getRoleColor(comment.author.role))}>
                    {comment.author.role}
                  </Badge>
                )}

                {comment.isPinned && (
                  <Pin className="h-3 w-3 text-yellow-600" />
                )}

                {comment.isLocked && (
                  <Lock className="h-3 w-3 text-gray-600" />
                )}

                <span className="text-xs text-muted-foreground">
                  {timeAgo}
                </span>

                {comment.isEdited && (
                  <span className="text-xs text-muted-foreground">
                    (edited)
                  </span>
                )}

                {comment.replies.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="text-xs text-muted-foreground h-auto p-0"
                  >
                    {isCollapsed ? 'expand' : 'collapse'} ({comment.replies.length})
                  </Button>
                )}
              </div>

              {showEditForm ? (
                <CommentForm
                  initialContent={comment.content}
                  isEditing
                  onSubmit={handleEdit}
                  onCancel={() => setShowEditForm(false)}
                />
              ) : (
                <div className="prose prose-sm max-w-none mb-3">
                  <p className="whitespace-pre-wrap">{comment.content}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <CommentActions
                  comment={comment}
                  currentUser={currentUser}
                  onReply={() => setShowReplyForm(true)}
                  onEdit={() => setShowEditForm(true)}
                  onDelete={() => setShowDeleteDialog(true)}
                  onReport={() => onReport(comment.id)}
                  canModerate={canModerate}
                />

                {canModerate && onModerationAction && (
                  <ModerationPanel
                    comment={comment}
                    onAction={(action, reason) => handleModerationAction(action, reason)}
                  />
                )}
              </div>

              {showReplyForm && (
                <div className="mt-3">
                  <CommentForm
                    parentId={comment.id}
                    onSubmit={handleReply}
                    onCancel={() => setShowReplyForm(false)}
                    placeholder="Write your reply..."
                    disabled={comment.isLocked}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!isCollapsed && comment.replies.length > 0 && comment.depth < maxDepth && (
        <CommentThread
          comments={comment.replies}
          current