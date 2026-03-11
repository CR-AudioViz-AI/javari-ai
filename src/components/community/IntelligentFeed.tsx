```tsx
'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  BookmarkCheck,
  TrendingUp,
  Clock,
  Target,
  Filter,
  Settings,
  ThumbsUp,
  Eye,
  Users,
  Sparkles,
  RefreshCw,
  ChevronDown,
  AlertCircle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

// Types
interface FeedItem {
  id: string
  type: 'post' | 'discussion' | 'opportunity' | 'announcement'
  title: string
  content: string
  author: {
    id: string
    name: string
    avatar?: string
    role?: string
    verified?: boolean
  }
  timestamp: Date
  engagement: {
    likes: number
    comments: number
    shares: number
    views: number
    bookmarks: number
  }
  userEngagement: {
    liked: boolean
    bookmarked: boolean
    viewed: boolean
  }
  tags: string[]
  relevanceScore: number
  confidenceScore: number
  trending: boolean
  pinned: boolean
  category: string
}

interface UserPreferences {
  interests: string[]
  categories: Record<string, number>
  engagementWeight: number
  recencyWeight: number
  trendinessWeight: number
  diversityEnabled: boolean
  notificationsEnabled: boolean
}

interface IntelligentFeedProps {
  userId?: string
  initialFeed?: FeedItem[]
  className?: string
  onItemClick?: (item: FeedItem) => void
  onEngagement?: (itemId: string, action: string) => void
  enablePersonalization?: boolean
  maxItems?: number
}

const FeedSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="p-4">
        <div className="flex items-start space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <div className="flex space-x-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      </Card>
    ))}
  </div>
)

const EmptyFeedState: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
      <Users className="h-6 w-6 text-muted-foreground" />
    </div>
    <h3 className="mb-2 text-lg font-semibold">No content yet</h3>
    <p className="mb-4 text-sm text-muted-foreground max-w-sm">
      We're learning your preferences. Interact with content to improve your personalized feed.
    </p>
    <Button onClick={onRefresh} variant="outline">
      <RefreshCw className="mr-2 h-4 w-4" />
      Refresh Feed
    </Button>
  </div>
)

const FeedCard: React.FC<{
  item: FeedItem
  onEngagement: (action: string) => void
  onClick: () => void
}> = ({ item, onEngagement, onClick }) => {
  const handleEngagement = (e: React.MouseEvent, action: string) => {
    e.stopPropagation()
    onEngagement(action)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getTypeColor = (type: FeedItem['type']) => {
    const colors = {
      post: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      discussion: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      opportunity: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      announcement: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    }
    return colors[type]
  }

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md relative overflow-hidden"
      onClick={onClick}
    >
      {item.trending && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-orange-500 to-orange-400 text-white px-2 py-1 text-xs rounded-bl-md">
          <TrendingUp className="inline h-3 w-3 mr-1" />
          Trending
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <Avatar className="h-10 w-10">
              <AvatarImage src={item.author.avatar} alt={item.author.name} />
              <AvatarFallback>{item.author.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h4 className="font-semibold text-sm truncate">{item.author.name}</h4>
                {item.author.verified && (
                  <Badge variant="secondary" className="h-4 text-xs">
                    Verified
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <span>{item.author.role}</span>
                <span>•</span>
                <span>{new Date(item.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {item.confidenceScore > 0.8 && (
              <Badge variant="outline" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                {Math.round(item.confidenceScore * 100)}%
              </Badge>
            )}
            <Badge className={cn('text-xs', getTypeColor(item.type))}>
              {item.type}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <h3 className="font-semibold text-base leading-tight">{item.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-3">{item.content}</p>
          
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleEngagement(e, 'like')}
                className={cn(
                  'h-8 px-2',
                  item.userEngagement.liked && 'text-red-500'
                )}
              >
                <Heart className={cn(
                  'h-4 w-4 mr-1',
                  item.userEngagement.liked && 'fill-current'
                )} />
                {formatNumber(item.engagement.likes)}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleEngagement(e, 'comment')}
                className="h-8 px-2"
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                {formatNumber(item.engagement.comments)}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleEngagement(e, 'share')}
                className="h-8 px-2"
              >
                <Share2 className="h-4 w-4 mr-1" />
                {formatNumber(item.engagement.shares)}
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground flex items-center">
                <Eye className="h-3 w-3 mr-1" />
                {formatNumber(item.engagement.views)}
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleEngagement(e, 'bookmark')}
                className="h-8 w-8 p-0"
              >
                {item.userEngagement.bookmarked ? (
                  <BookmarkCheck className="h-4 w-4 text-blue-500" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const FeedFilters: React.FC<{
  activeFilter: string
  onFilterChange: (filter: string) => void
  onRefresh: () => void
  loading: boolean
}> = ({ activeFilter, onFilterChange, onRefresh, loading }) => (
  <div className="flex items-center justify-between mb-6">
    <Tabs value={activeFilter} onValueChange={onFilterChange} className="flex-1">
      <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-none lg:flex">
        <TabsTrigger value="relevant" className="flex items-center space-x-2">
          <Target className="h-4 w-4" />
          <span>For You</span>
        </TabsTrigger>
        <TabsTrigger value="trending" className="flex items-center space-x-2">
          <TrendingUp className="h-4 w-4" />
          <span>Trending</span>
        </TabsTrigger>
        <TabsTrigger value="recent" className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span>Recent</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div className="flex items-center space-x-2 ml-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
      </Button>
    </div>
  </div>
)

const PersonalizationPanel: React.FC<{
  preferences: UserPreferences
  onPreferencesChange: (preferences: Partial<UserPreferences>) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}> = ({ preferences, onPreferencesChange, open, onOpenChange }) => (
  <DropdownMenu open={open} onOpenChange={onOpenChange}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <Settings className="h-4 w-4 mr-2" />
        Personalize
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-80 p-4" align="end">
      <DropdownMenuLabel>Feed Preferences</DropdownMenuLabel>
      <DropdownMenuSeparator />
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Content Relevance</Label>
          <Slider
            value={[preferences.engagementWeight * 100]}
            onValueChange={([value]) => 
              onPreferencesChange({ engagementWeight: value / 100 })
            }
            max={100}
            step={10}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Higher values prioritize content based on your interactions
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Recency Weight</Label>
          <Slider
            value={[preferences.recencyWeight * 100]}
            onValueChange={([value]) => 
              onPreferencesChange({ recencyWeight: value / 100 })
            }
            max={100}
            step={10}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Higher values show more recent content
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="diversity" className="text-sm font-medium">
            Content Diversity
          </Label>
          <Switch
            id="diversity"
            checked={preferences.diversityEnabled}
            onCheckedChange={(checked) => 
              onPreferencesChange({ diversityEnabled: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="notifications" className="text-sm font-medium">
            Smart Notifications
          </Label>
          <Switch
            id="notifications"
            checked={preferences.notificationsEnabled}
            onCheckedChange={(checked) => 
              onPreferencesChange({ notificationsEnabled: checked })
            }
          />
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
)

export const IntelligentFeed: React.FC<IntelligentFeedProps> = ({
  userId,
  initialFeed = [],
  className,
  onItemClick,
  onEngagement,
  enablePersonalization = true,
  maxItems = 50
}) => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>(initialFeed)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [activeFilter, setActiveFilter] = useState('relevant')
  const [personalizationOpen, setPersonalizationOpen] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences>({
    interests: [],
    categories: {},
    engagementWeight: 0.7,
    recencyWeight: 0.3,
    trendinessWeight: 0.5,
    diversityEnabled: true,
    notificationsEnabled: true
  })

  const observer = useRef<IntersectionObserver | null>(null)
  const lastItemRef = useRef<HTMLDivElement>(null)

  const fetchFeedItems = useCallback(async (
    filter: string = activeFilter,
    offset: number = 0,
    limit: number = 20
  ) => {
    if (!userId) return []

    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        userId,
        filter,
        offset: offset.toString(),
        limit: limit.toString(),
        preferences: JSON.stringify(preferences)
      })

      const response = await fetch(`/api/ml/recommendations?${params}`)
      if (!response.ok) throw new Error('Failed to fetch recommendations')
      
      const data = await response.json()
      return data.items || []
    } catch (error) {
      console.error('Error fetching feed:', error)
      toast.error('Failed to load feed content')
      return []
    } finally {
      setLoading(false)
    }
  }, [userId, activeFilter, preferences])

  const loadMoreItems = useCallback(async () => {
    if (loading || !hasMore || feedItems.length >= maxItems) return

    const newItems = await fetchFeedItems(activeFilter, feedItems.length)
    if (newItems.length === 0) {
      setHasMore(false)
      return
    }

    setFeedItems(prev => [...prev, ...newItems])
  }, [loading, hasMore, feedItems.length, maxItems, fetchFeedItems, activeFilter])

  const refreshFeed = useCallback(async () => {
    const newItems = await fetchFeedItems(activeFilter, 0)
    setFeedItems(newItems)
    setHasMore(newItems.length === 20)
  }, [fetchFeedItems, activeFilter])

  const handleEngagement = useCallback(async (itemId: string, action: string) => {
    try {
      // Optimistic update
      setFeedItems(prev => prev.map(item => {
        if (item.id !== itemId) return item

        const updatedItem = { ...item }
        
        switch (action) {
          case 'like':
            updatedItem.userEngagement.liked = !item.userEngagement.liked
            updatedItem.engagement.likes += updatedItem.userEngagement.liked ? 1 : -1
            break
          case 'bookmark':
            updatedItem.userEngagement.bookmarked = !item.userEngagement.bookmarked
            updatedItem.engagement.bookmarks += updatedItem.userEngagement.bookmarked ? 1 : -1
            break
          case 'share':
            updatedItem.engagement.shares += 1
            break
          case 'comment':
            // Handle comment navigation
            break
        }
        
        return updatedItem
      }))

      // Track engagement for ML
      await fetch('/api/user/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, itemId, action, timestamp: new Date() })
      })

      onEngagement?.(itemId, action)
    } catch (error) {
      console.error('Error tracking engagement:', error)
      // Revert optimistic update on error
      await refreshFeed()
    }
  }, [userId, onEngagement, refreshFeed])

  const handleFilterChange = useCallback(async (filter: string) => {
    setActiveFilter(filter)
    setLoading(true)
    const newItems = await fetchFeedItems(filter, 0)
    setFeedItems(newItems)
    setHasMore(newItems.length === 20)
  }, [fetchFeedItems])

  const handlePreferencesChange = useCallback((newPreferences: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...newPreferences }))
    // Debounced refresh will be handled by useEffect
  }, [])

  // Intersection Observer for infinite scroll
  const lastItemRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (loading) return
    if (observer.current) observer.current.disconnect()
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreItems()
      }
    }, { threshold: 0.1 })
    
    if (node) observer.current.observe(node)
  }, [loading, hasMore, loadMoreItems])

  // Initial load
  useEffect(() => {
    if (userId && feedItems.length === 0) {
      refreshFeed()
    }
  }, [userId, refreshFeed, feedItems.length])

  // Debounced preferences update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (feedItems.length > 0) {
        refreshFeed()
      }
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [preferences, refreshFeed, feedItems.length])

  if (!userId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
          <p className="text-muted-foreground">Please sign in to view your personalized feed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Community Feed</h2>
          <p className="text-muted-foreground">
            Personalized content based on your interests and activity
          </p>
        </div>
        
        {enablePersonalization && (
          <PersonalizationPanel
            preferences={preferences}
            onPreferencesChange={handlePreferencesChange}
            open={personalizationOpen}
            onOpenChange={setPersonalizationOpen}
          />
        )}
      </div>

      <FeedFilters
        activeFilter={active