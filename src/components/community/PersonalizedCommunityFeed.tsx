'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  Filter,
  Users,
  TrendingUp,
  Clock,
  Star,
  Volume2,
  Play,
  Pause,
  ChevronUp,
  Settings,
  RefreshCw,
  Bell,
  Eye,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  verified: boolean;
  followerCount: number;
}

interface Engagement {
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  views: number;
  userLiked: boolean;
  userBookmarked: boolean;
  userShared: boolean;
}

interface AudioContent {
  id: string;
  url: string;
  duration: number;
  waveform?: number[];
  transcript?: string;
}

interface FeedItem {
  id: string;
  type: 'audio' | 'text' | 'image' | 'video' | 'poll';
  content: string;
  audioContent?: AudioContent;
  mediaUrl?: string;
  user: User;
  timestamp: Date;
  engagement: Engagement;
  tags: string[];
  relevanceScore: number;
  category: string;
  isSponsored?: boolean;
  communityId?: string;
  communityName?: string;
}

interface FilterOptions {
  categories: string[];
  contentTypes: ('audio' | 'text' | 'image' | 'video' | 'poll')[];
  timeRange: 'hour' | 'day' | 'week' | 'month' | 'all';
  sortBy: 'relevance' | 'recent' | 'trending' | 'engagement';
  showSponsored: boolean;
  minRelevanceScore: number;
}

interface PersonalizedCommunityFeedProps {
  userId: string;
  initialFeed?: FeedItem[];
  onItemClick?: (item: FeedItem) => void;
  onEngagement?: (itemId: string, action: 'like' | 'comment' | 'share' | 'bookmark') => void;
  className?: string;
}

const FeedItemComponent: React.FC<{
  item: FeedItem;
  onItemClick?: (item: FeedItem) => void;
  onEngagement?: (itemId: string, action: 'like' | 'comment' | 'share' | 'bookmark') => void;
}> = ({ item, onItemClick, onEngagement }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAudioPlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleEngagementAction = useCallback((action: 'like' | 'comment' | 'share' | 'bookmark') => {
    onEngagement?.(item.id, action);
  }, [item.id, onEngagement]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  return (
    <Card className="w-full transition-all duration-200 hover:shadow-md border-l-4 border-l-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={item.user.avatar} alt={item.user.name} />
              <AvatarFallback>{item.user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{item.user.name}</span>
                {item.user.verified && (
                  <Badge variant="secondary" className="h-4 px-1 text-xs">
                    ✓
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>@{item.user.username}</span>
                <span>•</span>
                <span>{formatTimeAgo(item.timestamp)}</span>
                {item.communityName && (
                  <>
                    <span>•</span>
                    <span className="text-primary">{item.communityName}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              {Math.round(item.relevanceScore * 100)}%
            </Badge>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div 
          className="cursor-pointer"
          onClick={() => onItemClick?.(item)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onItemClick?.(item);
            }
          }}
        >
          <p className="text-sm mb-3 leading-relaxed">{item.content}</p>
          
          {item.audioContent && (
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 mb-3">
              <div className="flex items-center gap-3 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAudioPlay();
                  }}
                  className="h-8 w-8 p-0"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(item.audioContent.duration)}</span>
                  </div>
                  <div className="w-full bg-secondary/30 rounded-full h-1">
                    <div 
                      className="bg-primary h-1 rounded-full transition-all duration-300" 
                      style={{ width: `${(currentTime / item.audioContent.duration) * 100}%` }}
                    />
                  </div>
                </div>
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <audio
                ref={audioRef}
                src={item.audioContent.url}
                onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </div>
          )}
          
          {item.mediaUrl && (
            <div className="rounded-lg overflow-hidden mb-3">
              <img 
                src={item.mediaUrl} 
                alt="Post media" 
                className="w-full h-auto max-h-96 object-cover"
              />
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1 mb-3">
          {item.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEngagementAction('like')}
              className={cn(
                "gap-2 text-xs",
                item.engagement.userLiked && "text-red-500 hover:text-red-600"
              )}
            >
              <Heart className={cn("h-4 w-4", item.engagement.userLiked && "fill-current")} />
              {item.engagement.likes}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEngagementAction('comment')}
              className="gap-2 text-xs"
            >
              <MessageCircle className="h-4 w-4" />
              {item.engagement.comments}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEngagementAction('share')}
              className="gap-2 text-xs"
            >
              <Share2 className="h-4 w-4" />
              {item.engagement.shares}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEngagementAction('bookmark')}
              className={cn(
                "gap-2 text-xs",
                item.engagement.userBookmarked && "text-yellow-500 hover:text-yellow-600"
              )}
            >
              <Bookmark className={cn("h-4 w-4", item.engagement.userBookmarked && "fill-current")} />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            <span>{item.engagement.views.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const FeedFilters: React.FC<{
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableCategories: string[];
}> = ({ filters, onFiltersChange, availableCategories }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = useCallback(<K extends keyof FilterOptions>(
    key: K, 
    value: FilterOptions[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-semibold text-sm">Filters</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            <ChevronUp className={cn("h-4 w-4 transition-transform", !isExpanded && "rotate-180")} />
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Sort By</label>
            <Select
              value={filters.sortBy}
              onValueChange={(value) => updateFilter('sortBy', value as FilterOptions['sortBy'])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="trending">Trending</SelectItem>
                <SelectItem value="engagement">Most Engaged</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Time Range</label>
            <Select
              value={filters.timeRange}
              onValueChange={(value) => updateFilter('timeRange', value as FilterOptions['timeRange'])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Last Hour</SelectItem>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-3 block">Content Types</label>
            <div className="grid grid-cols-2 gap-2">
              {(['audio', 'text', 'image', 'video', 'poll'] as const).map((type) => (
                <Toggle
                  key={type}
                  pressed={filters.contentTypes.includes(type)}
                  onPressedChange={(pressed) => {
                    const newTypes = pressed
                      ? [...filters.contentTypes, type]
                      : filters.contentTypes.filter(t => t !== type);
                    updateFilter('contentTypes', newTypes);
                  }}
                  className="capitalize text-xs"
                >
                  {type}
                </Toggle>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-3 block">Categories</label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {availableCategories.map((category) => (
                <Toggle
                  key={category}
                  pressed={filters.categories.includes(category)}
                  onPressedChange={(pressed) => {
                    const newCategories = pressed
                      ? [...filters.categories, category]
                      : filters.categories.filter(c => c !== category);
                    updateFilter('categories', newCategories);
                  }}
                  className="w-full justify-start text-xs"
                >
                  {category}
                </Toggle>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-3 block">
              Relevance Score: {Math.round(filters.minRelevanceScore * 100)}%
            </label>
            <Slider
              value={[filters.minRelevanceScore]}
              onValueChange={([value]) => updateFilter('minRelevanceScore', value)}
              max={1}
              min={0}
              step={0.1}
              className="w-full"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Show Sponsored</label>
            <Toggle
              pressed={filters.showSponsored}
              onPressedChange={(pressed) => updateFilter('showSponsored', pressed)}
            />
          </div>
          
          <Separator />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFiltersChange({
              categories: [],
              contentTypes: ['audio', 'text', 'image', 'video', 'poll'],
              timeRange: 'all',
              sortBy: 'relevance',
              showSponsored: true,
              minRelevanceScore: 0
            })}
            className="w-full"
          >
            Reset Filters
          </Button>
        </CardContent>
      )}
    </Card>
  );
};

export const PersonalizedCommunityFeed: React.FC<PersonalizedCommunityFeedProps> = ({
  userId,
  initialFeed = [],
  onItemClick,
  onEngagement,
  className
}) => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>(initialFeed);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    contentTypes: ['audio', 'text', 'image', 'video', 'poll'],
    timeRange: 'all',
    sortBy: 'relevance',
    showSponsored: true,
    minRelevanceScore: 0
  });
  
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Mock data for demonstration
  const mockFeedItems: FeedItem[] = [
    {
      id: '1',
      type: 'audio',
      content: 'Just discovered this amazing AI-generated melody that perfectly captures the essence of a rainy morning. The way it builds from gentle drops to a full orchestral storm is incredible! 🌧️🎵',
      audioContent: {
        id: 'audio-1',
        url: '/mock-audio.mp3',
        duration: 180,
        waveform: Array.from({ length: 100 }, () => Math.random())
      },
      user: {
        id: 'user-1',
        name: 'Sarah Chen',
        username: 'sarahmusic',
        avatar: '/avatars/sarah.jpg',
        verified: true,
        followerCount: 12400
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      engagement: {
        likes: 247,
        comments: 45,
        shares: 23,
        bookmarks: 89,
        views: 1250,
        userLiked: false,
        userBookmarked: true,
        userShared: false
      },
      tags: ['ai-music', 'ambient', 'generative'],
      relevanceScore: 0.92,
      category: 'AI Music',
      communityName: 'AI Composers'
    },
    {
      id: '2',
      type: 'text',
      content: 'Hot take: The future of music isn\'t just AI-generated compositions, but AI that collaborates with human musicians to push creative boundaries we never thought possible. What do you think? 🤖🎼',
      user: {
        id: 'user-2',
        name: 'Marcus Rodriguez',
        username: 'musicfuturist',
        avatar: '/avatars/marcus.jpg',
        verified: false,
        followerCount: 3200
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      engagement: {
        likes: 156,
        comments: 78,
        shares: 34,
        bookmarks: 45,
        views: 890,
        userLiked: true,
        userBookmarked: false,
        userShared: false
      },
      tags: ['ai-collaboration', 'future-music', 'discussion'],
      relevanceScore: 0.88,
      category: 'Discussion',
      communityName: 'Music Tech'
    },
    {
      id: '3',
      type: 'image',
      content: 'Visualization of my latest AI composition - each color represents a different instrument, and the patterns show how they interact over time. Beautiful complexity! 🎨🎼',
      mediaUrl: '/mock-visualization.jpg',
      user: {
        id: 'user-3',
        name: 'Alex Kim',
        username: 'alexvisualmusic',
        avatar: '/avatars/alex.jpg',
        verified: true,
        followerCount: 8700
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      engagement: {
        likes: 320,
        comments: 29,
        shares: 56,
        bookmarks: 123,
        views: 1800,
        userLiked: false,
        userBookmarked: false,
        userShared: true
      },
      tags: ['visualization', 'data-art', 'composition'],
      relevanceScore: 0.85,
      category: 'Visual Art',
      communityName: 'Music Visualization'
    }
  ];

  const availableCategories = useMemo(() => {
    const categories = new Set(feedItems.map(item => item.category));
    return Array.from(categories).sort();
  }, [feedItems]);

  const filteredFeedItems = useMemo(() => {
    return feedItems.filter(item => {
      // Category filter
      if (filters.categories.length > 0 && !filters.categories.includes(item.category)) {
        return false;
      }
      
      // Content type filter
      if (!filters.contentTypes.includes(item.type)) {
        return false;
      }
      
      // Sponsored filter
      if (!filters.showSponsored && item.isSponsored) {
        return false;
      }
      
      // Relevance score filter
      if (item.relevanceScore < filters.minRelevanceScore) {
        return false;
      }
      
      // Time range filter
      const now = new