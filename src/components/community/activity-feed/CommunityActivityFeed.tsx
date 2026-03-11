```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  Eye, 
  TrendingUp,
  Filter,
  Loader2,
  Wifi,
  WifiOff,
  MoreHorizontal,
  Reply,
  ChevronDown,
  ChevronUp,
  Users,
  Clock,
  Hash
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Types
interface User {
  id: string;
  name: string;
  avatar_url?: string;
  username: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: User;
  created_at: string;
  updated_at: string;
  type: 'text' | 'audio' | 'project' | 'collaboration';
  tags: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  engagement_rate: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  is_shared: boolean;
}

interface Comment {
  id: string;
  content: string;
  author: User;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
  replies?: Comment[];
  parent_id?: string;
}

interface ActivityFilter {
  type: 'all' | 'posts' | 'comments' | 'likes' | 'follows';
  timeRange: 'today' | 'week' | 'month' | 'all';
  userFilter?: string;
}

interface CommunityActivityFeedProps {
  userId?: string;
  initialFilters?: ActivityFilter;
  className?: string;
  onPostInteraction?: (postId: string, type: string) => void;
  onCommentCreate?: (postId: string, content: string, parentId?: string) => void;
}

// Hooks
const useCommunityFeed = (filters: ActivityFilter) => {
  return useInfiniteQuery({
    queryKey: ['community-feed', filters],
    queryFn: async ({ pageParam = null }) => {
      const params = new URLSearchParams({
        limit: '10',
        ...(pageParam && { cursor: pageParam }),
        type: filters.type,
        timeRange: filters.timeRange,
        ...(filters.userFilter && { userFilter: filters.userFilter }),
      });

      const response = await fetch(`/api/community/feed?${params}`);
      if (!response.ok) throw new Error('Failed to fetch feed');
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
  });
};

const useRealTimeUpdates = (onUpdate: (data: any) => void) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulate Supabase real-time connection
    setIsConnected(true);
    
    const interval = setInterval(() => {
      if (Math.random() > 0.95) {
        onUpdate({
          type: 'activity_update',
          data: { /* mock update data */ }
        });
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [onUpdate]);

  return { isConnected };
};

// Components
const RealTimeIndicator: React.FC<{ isConnected: boolean }> = ({ isConnected }) => (
  <div className={cn(
    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
    isConnected 
      ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
      : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
  )}>
    {isConnected ? (
      <>
        <Wifi className="w-3 h-3" />
        Live
      </>
    ) : (
      <>
        <WifiOff className="w-3 h-3" />
        Offline
      </>
    )}
  </div>
);

const LoadingFeedSkeleton: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <Card key={i}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-4 mt-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const EngagementMetrics: React.FC<{ post: Post }> = ({ post }) => (
  <div className="flex items-center gap-4 text-sm text-muted-foreground">
    <div className="flex items-center gap-1">
      <Eye className="w-4 h-4" />
      {post.views_count.toLocaleString()}
    </div>
    <div className="flex items-center gap-1">
      <TrendingUp className="w-4 h-4" />
      {(post.engagement_rate * 100).toFixed(1)}%
    </div>
  </div>
);

const PostInteractions: React.FC<{
  post: Post;
  onLike: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onComment: () => void;
}> = ({ post, onLike, onShare, onBookmark, onComment }) => (
  <div className="flex items-center justify-between pt-3 border-t">
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onLike}
        className={cn(
          "gap-2 transition-colors",
          post.is_liked && "text-red-500 hover:text-red-600"
        )}
      >
        <Heart className={cn("w-4 h-4", post.is_liked && "fill-current")} />
        {post.likes_count}
      </Button>
      
      <Button variant="ghost" size="sm" onClick={onComment} className="gap-2">
        <MessageCircle className="w-4 h-4" />
        {post.comments_count}
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onShare}
        className={cn(
          "gap-2 transition-colors",
          post.is_shared && "text-blue-500"
        )}
      >
        <Share2 className="w-4 h-4" />
        {post.shares_count}
      </Button>
    </div>

    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBookmark}
        className={cn(
          "transition-colors",
          post.is_bookmarked && "text-yellow-500"
        )}
      >
        <Bookmark className={cn("w-4 h-4", post.is_bookmarked && "fill-current")} />
      </Button>
      
      <Button variant="ghost" size="sm">
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

const CommentThread: React.FC<{
  postId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCommentSubmit: (content: string, parentId?: string) => void;
}> = ({ postId, isExpanded, onToggle, onCommentSubmit }) => {
  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<string | undefined>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!newComment.trim()) return;
    
    onCommentSubmit(newComment, replyToId);
    setNewComment('');
    setReplyToId(undefined);
  }, [newComment, replyToId, onCommentSubmit]);

  const CommentItem: React.FC<{ comment: Comment; depth?: number }> = ({ comment, depth = 0 }) => (
    <div className={cn("space-y-3", depth > 0 && "ml-6 pl-4 border-l-2")}>
      <div className="flex gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={comment.author.avatar_url} />
          <AvatarFallback>{comment.author.name.charAt(0)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{comment.author.name}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
          </div>
          
          <p className="text-sm">{comment.content}</p>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <Heart className="w-3 h-3 mr-1" />
              {comment.likes_count}
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs"
              onClick={() => setReplyToId(comment.id)}
            >
              <Reply className="w-3 h-3 mr-1" />
              Reply
            </Button>
          </div>
        </div>
      </div>
      
      {comment.replies?.map(reply => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  );

  if (!isExpanded) {
    return (
      <Button variant="ghost" onClick={onToggle} className="w-full justify-start gap-2 mt-2">
        <ChevronDown className="w-4 h-4" />
        Show comments
      </Button>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t">
      <Button variant="ghost" onClick={onToggle} className="gap-2 mb-2">
        <ChevronUp className="w-4 h-4" />
        Hide comments
      </Button>

      <div className="space-y-4">
        <div className="flex gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder={replyToId ? "Write a reply..." : "Write a comment..."}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px]"
            />
            
            <div className="flex justify-between items-center">
              {replyToId && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setReplyToId(undefined)}
                >
                  Cancel reply
                </Button>
              )}
              
              <Button 
                onClick={handleSubmit}
                disabled={!newComment.trim() || isLoading}
                size="sm"
                className="ml-auto"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {replyToId ? 'Reply' : 'Comment'}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      </div>
    </div>
  );
};

const ActivityFeedItem: React.FC<{
  post: Post;
  onInteraction: (type: string) => void;
  onCommentSubmit: (content: string, parentId?: string) => void;
}> = ({ post, onInteraction, onCommentSubmit }) => {
  const [showComments, setShowComments] = useState(false);

  const getPostTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'audio': return '🎵';
      case 'project': return '🚀';
      case 'collaboration': return '🤝';
      default: return '📝';
    }
  }, []);

  const getPostTypeBadge = useCallback((type: string) => {
    const variants = {
      audio: 'secondary',
      project: 'default',
      collaboration: 'outline',
      text: 'secondary'
    } as const;
    
    return (
      <Badge variant={variants[type as keyof typeof variants] || 'secondary'}>
        {getPostTypeIcon(type)} {type}
      </Badge>
    );
  }, [getPostTypeIcon]);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={post.author.avatar_url} />
              <AvatarFallback>{post.author.name.charAt(0)}</AvatarFallback>
            </Avatar>
            
            <div>
              <h4 className="font-semibold">{post.author.name}</h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>@{post.author.username}</span>
                <span>•</span>
                <Clock className="w-3 h-3" />
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getPostTypeBadge(post.type)}
          </div>
        </div>
        
        {post.title && (
          <h3 className="text-lg font-semibold">{post.title}</h3>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed">{post.content}</p>
        
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Hash className="w-3 h-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <EngagementMetrics post={post} />

        <PostInteractions
          post={post}
          onLike={() => onInteraction('like')}
          onShare={() => onInteraction('share')}
          onBookmark={() => onInteraction('bookmark')}
          onComment={() => setShowComments(!showComments)}
        />

        <CommentThread
          postId={post.id}
          isExpanded={showComments}
          onToggle={() => setShowComments(!showComments)}
          onCommentSubmit={onCommentSubmit}
        />
      </CardContent>
    </Card>
  );
};

const FeedFilters: React.FC<{
  filters: ActivityFilter;
  onFiltersChange: (filters: ActivityFilter) => void;
}> = ({ filters, onFiltersChange }) => (
  <Card className="p-4">
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters:</span>
      </div>

      <Select
        value={filters.type}
        onValueChange={(value) => onFiltersChange({ ...filters, type: value as any })}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="posts">Posts</SelectItem>
          <SelectItem value="comments">Comments</SelectItem>
          <SelectItem value="likes">Likes</SelectItem>
          <SelectItem value="follows">Follows</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.timeRange}
        onValueChange={(value) => onFiltersChange({ ...filters, timeRange: value as any })}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
          <SelectItem value="all">All Time</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </Card>
);

// Main Component
const CommunityActivityFeed: React.FC<CommunityActivityFeedProps> = ({
  userId,
  initialFilters = { type: 'all', timeRange: 'week' },
  className,
  onPostInteraction,
  onCommentCreate
}) => {
  const [filters, setFilters] = useState<ActivityFilter>(initialFilters);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useCommunityFeed(filters);

  const { isConnected } = useRealTimeUpdates(
    useCallback((update) => {
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      toast({
        title: "New Activity",
        description: "Your feed has been updated with new content.",
        duration: 3000,
      });
    }, [queryClient, toast])
  );

  const interactionMutation = useMutation({
    mutationFn: async ({ postId, type }: { postId: string; type: string }) => {
      const response = await fetch(`/api/community/posts/${postId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!response.ok) throw new Error('Failed to interact with post');
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      onPostInteraction?.(variables.postId, variables.type);
      toast({
        title: "Success",
        description: `Post ${variables.type}d successfully.`,
        duration: 2000,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to interact with post. Please try again.",
        variant: "destructive",
      });
    }
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content, parentId }: { 
      postId: string; 
      content: string; 
      parentId?: string; 
    }) => {
      const response = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parent_id: parentId }),
      });
      if (!response.ok) throw new Error('Failed to create comment');
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      onCommentCreate?.(variables.postId, variables.content, variables.parentId);
      toast({
        title: "Comment posted",
        description: "Your comment has been added successfully.",
        duration: 2000,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to post comment. Please try again.",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, fetchNextPage, hasNextPage, isFetchingNextPage]);

  const allPosts = useMemo(() => 
    data?.pages.flatMap(page => page.posts) || [], 
    [data]
  );

  const handlePostInteraction = useCallback((postId: string, type: string) => {
    interactionMutation.mutate({ postId, type });
  }, [interactionMutation]);

  const handleCommentSubmit = useCallback((postId: string) => 
    (content: string, parentId?: string) => {
      commentMutation