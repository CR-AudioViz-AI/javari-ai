import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  ThumbsUp,
  Share2,
  TrendingUp,
  Calendar,
  Users,
  Bookmark,
  Filter,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  Sparkles
} from 'lucide-react';

// Types
export interface Activity {
  id: string;
  type: 'post' | 'discussion' | 'event' | 'opportunity' | 'achievement' | 'collaboration';
  title: string;
  content?: string;
  excerpt?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  };
  timestamp: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  tags: string[];
  relevanceScore: number;
  isBookmarked: boolean;
  isLiked: boolean;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  metadata?: Record<string, any>;
}

export interface FeedFilters {
  activityTypes: string[];
  timeRange: 'today' | 'week' | 'month' | 'all';
  sortBy: 'relevance' | 'recent' | 'popular' | 'trending';
  categories: string[];
  priority: string[];
  showBookmarked: boolean;
}

export interface PersonalizedActivityFeedProps {
  className?: string;
  initialFilters?: Partial<FeedFilters>;
  maxItems?: number;
  enableRealtime?: boolean;
  showFilters?: boolean;
  showEngagementMetrics?: boolean;
  onActivityClick?: (activity: Activity) => void;
  onEngagement?: (activityId: string, type: 'like' | 'bookmark' | 'share') => void;
}

// Activity Type Selector Component
const ActivityTypeSelector: React.FC<{
  selectedTypes: string[];
  onSelectionChange: (types: string[]) => void;
  className?: string;
}> = ({ selectedTypes, onSelectionChange, className }) => {
  const activityTypes = [
    { value: 'post', label: 'Posts', icon: MessageSquare },
    { value: 'discussion', label: 'Discussions', icon: Users },
    { value: 'event', label: 'Events', icon: Calendar },
    { value: 'opportunity', label: 'Opportunities', icon: TrendingUp },
    { value: 'achievement', label: 'Achievements', icon: Sparkles },
    { value: 'collaboration', label: 'Collaborations', icon: Share2 }
  ];

  const handleTypeToggle = (type: string) => {
    const newSelection = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    onSelectionChange(newSelection);
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {activityTypes.map(({ value, label, icon: Icon }) => (
        <Badge
          key={value}
          variant={selectedTypes.includes(value) ? "default" : "outline"}
          className="cursor-pointer hover:scale-105 transition-transform"
          onClick={() => handleTypeToggle(value)}
        >
          <Icon className="w-3 h-3 mr-1" />
          {label}
        </Badge>
      ))}
    </div>
  );
};

// Feed Filters Component
const FeedFilters: React.FC<{
  filters: FeedFilters;
  onFiltersChange: (filters: Partial<FeedFilters>) => void;
  className?: string;
}> = ({ filters, onFiltersChange, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={cn("mb-6", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Personalized Feed Filters</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Activity Types</label>
              <ActivityTypeSelector
                selectedTypes={filters.activityTypes}
                onSelectionChange={(types) => onFiltersChange({ activityTypes: types })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Time Range</label>
                <Select
                  value={filters.timeRange}
                  onValueChange={(value) => onFiltersChange({ timeRange: value as FeedFilters['timeRange'] })}
                >
                  <SelectTrigger>
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

              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => onFiltersChange({ sortBy: value as FeedFilters['sortBy'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Most Relevant</SelectItem>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="trending">Trending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select
                  value={filters.priority.length === 1 ? filters.priority[0] : "all"}
                  onValueChange={(value) => onFiltersChange({ 
                    priority: value === "all" ? [] : [value] 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="low">Low Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Badge
                variant={filters.showBookmarked ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onFiltersChange({ showBookmarked: !filters.showBookmarked })}
              >
                <Bookmark className="w-3 h-3 mr-1" />
                Bookmarked Only
              </Badge>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
};

// Engagement Metrics Component
const EngagementMetrics: React.FC<{
  engagement: Activity['engagement'];
  isLiked: boolean;
  isBookmarked: boolean;
  onLike: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onComment: () => void;
  className?: string;
}> = ({ engagement, isLiked, isBookmarked, onLike, onBookmark, onShare, onComment, className }) => {
  return (
    <div className={cn("flex items-center justify-between pt-3 border-t", className)}>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLike}
          className={cn("gap-1", isLiked && "text-red-500")}
        >
          <ThumbsUp className="w-4 h-4" />
          {engagement.likes}
        </Button>
        
        <Button variant="ghost" size="sm" onClick={onComment} className="gap-1">
          <MessageSquare className="w-4 h-4" />
          {engagement.comments}
        </Button>
        
        <Button variant="ghost" size="sm" onClick={onShare} className="gap-1">
          <Share2 className="w-4 h-4" />
          {engagement.shares}
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onBookmark}
        className={cn(isBookmarked && "text-blue-500")}
      >
        <Bookmark className="w-4 h-4" />
      </Button>
    </div>
  );
};

// Activity Card Component
const ActivityCard: React.FC<{
  activity: Activity;
  onClick?: () => void;
  onEngagement?: (type: 'like' | 'bookmark' | 'share') => void;
  showEngagementMetrics?: boolean;
  className?: string;
}> = ({ activity, onClick, onEngagement, showEngagementMetrics = true, className }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'post': return MessageSquare;
      case 'discussion': return Users;
      case 'event': return Calendar;
      case 'opportunity': return TrendingUp;
      case 'achievement': return Sparkles;
      case 'collaboration': return Share2;
      default: return MessageSquare;
    }
  };

  const TypeIcon = getTypeIcon(activity.type);

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all duration-200 border-l-4",
        getPriorityColor(activity.priority),
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={activity.author.avatar} alt={activity.author.name} />
              <AvatarFallback>
                {activity.author.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{activity.author.name}</span>
                {activity.author.role && (
                  <Badge variant="secondary" className="text-xs">
                    {activity.author.role}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TypeIcon className="w-3 h-3" />
                <span className="capitalize">{activity.type}</span>
                <span>•</span>
                <time>{new Date(activity.timestamp).toLocaleDateString()}</time>
                {activity.relevanceScore > 0.8 && (
                  <>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Sparkles className="w-2 h-2" />
                      Highly Relevant
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
          <Badge variant="outline" className={cn(
            "text-xs",
            activity.priority === 'high' && "border-red-200 text-red-700",
            activity.priority === 'medium' && "border-yellow-200 text-yellow-700",
            activity.priority === 'low' && "border-green-200 text-green-700"
          )}>
            {activity.priority} priority
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg leading-tight">{activity.title}</h3>
            {activity.excerpt && (
              <p className="text-muted-foreground mt-2 line-clamp-3">{activity.excerpt}</p>
            )}
          </div>

          {activity.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activity.tags.slice(0, 5).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {activity.tags.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{activity.tags.length - 5} more
                </Badge>
              )}
            </div>
          )}

          {showEngagementMetrics && (
            <EngagementMetrics
              engagement={activity.engagement}
              isLiked={activity.isLiked}
              isBookmarked={activity.isBookmarked}
              onLike={() => onEngagement?.('like')}
              onBookmark={() => onEngagement?.('bookmark')}
              onShare={() => onEngagement?.('share')}
              onComment={() => {}}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Activity Skeleton Component
const ActivitySkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <Card className={cn("border-l-4 border-l-gray-200", className)}>
    <CardHeader className="pb-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-16 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-3 h-3" />
            <Skeleton className="w-20 h-3" />
            <Skeleton className="w-20 h-3" />
          </div>
        </div>
        <Skeleton className="w-20 h-5" />
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="space-y-3">
        <div>
          <Skeleton className="w-full h-5" />
          <Skeleton className="w-3/4 h-4 mt-2" />
          <Skeleton className="w-1/2 h-4 mt-1" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="w-12 h-5" />
          <Skeleton className="w-16 h-5" />
          <Skeleton className="w-14 h-5" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex gap-4">
            <Skeleton className="w-12 h-8" />
            <Skeleton className="w-12 h-8" />
            <Skeleton className="w-12 h-8" />
          </div>
          <Skeleton className="w-8 h-8" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Empty Feed State Component
const EmptyFeedState: React.FC<{ 
  onRefresh?: () => void;
  message?: string;
  className?: string;
}> = ({ onRefresh, message, className }) => (
  <div className={cn("text-center py-12", className)}>
    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
    <h3 className="text-lg font-semibold mb-2">No Activities Found</h3>
    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
      {message || "We couldn't find any activities matching your current preferences. Try adjusting your filters or check back later."}
    </p>
    {onRefresh && (
      <Button onClick={onRefresh} variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Refresh Feed
      </Button>
    )}
  </div>
);

// Load More Button Component
const LoadMoreButton: React.FC<{
  onLoadMore: () => void;
  isLoading: boolean;
  hasNextPage: boolean;
  className?: string;
}> = ({ onLoadMore, isLoading, hasNextPage, className }) => {
  if (!hasNextPage) return null;

  return (
    <div className={cn("text-center py-6", className)}>
      <Button 
        onClick={onLoadMore}
        disabled={isLoading}
        variant="outline"
        className="gap-2"
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading...
          </>
        ) : (
          'Load More Activities'
        )}
      </Button>
    </div>
  );
};

// Main Component
const PersonalizedActivityFeed: React.FC<PersonalizedActivityFeedProps> = ({
  className,
  initialFilters,
  maxItems = 20,
  enableRealtime = true,
  showFilters = true,
  showEngagementMetrics = true,
  onActivityClick,
  onEngagement
}) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState<FeedFilters>({
    activityTypes: ['post', 'discussion', 'event', 'opportunity'],
    timeRange: 'week',
    sortBy: 'relevance',
    categories: [],
    priority: [],
    showBookmarked: false,
    ...initialFilters
  });

  // Fetch personalized feed data
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch
  } = useInfiniteQuery({
    queryKey: ['personalizedFeed', user?.id, filters],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .rpc('get_personalized_feed', {
          user_id: user?.id,
          filter_types: filters.activityTypes,
          time_range: filters.timeRange,
          sort_by: filters.sortBy,
          show_bookmarked: filters.showBookmarked,
          priority_filter: filters.priority,
          limit_count: maxItems,
          offset_count: pageParam * maxItems
        });

      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.length === maxItems ? pages.length : undefined;
    },
    enabled: !!user?.id
  });

  // Real-time subscription for live updates
  useEffect(() => {
    if (!enableRealtime || !user?.id) return;

    const channel = supabase
      .channel('activity_feed')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activities'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['personalizedFeed'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enableRealtime, user?.id, queryClient]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: Partial<FeedFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Handle activity engagement
  const handleEngagement = useCallback(async (activityId: string, type: 'like' | 'bookmark' | 'share') => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .rpc('handle_activity_engagement', {
          activity_id: activityId,
          user_id: user.id,
          engagement_type: type
        });

      if (error) throw error;

      // Optimistic update
      queryClient.invalidateQueries({ queryKey: ['personalizedFeed'] });
      onEngagement?.(activityId, type);
    } catch (error) {
      console.error('Engagement error:', error);
    }
  }, [user?.id, queryClient, onEngagement]);

  // Handle activity click
  const handleActivityClick = useCallback((activity: Activity) => {
    onActivityClick?.(activity);
  }, [onActivityClick]);

  // Memoized activities list
  const activities = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data?.pages]);

  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        {showFilters && <Skeleton className="w-full h-24" />}
        {Array.from({ length: