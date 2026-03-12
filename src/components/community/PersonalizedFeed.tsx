```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  TrendingUp,
  Filter,
  Search,
  Users,
  Calendar,
  MapPin,
  ExternalLink,
  MoreHorizontal,
  Bell,
  Settings,
  ChevronDown,
  Sparkles,
  MessageSquare,
  Briefcase,
  Megaphone,
  Activity,
  X,
} from "lucide-react";

interface FeedItem {
  id: string;
  type: "discussion" | "opportunity" | "announcement" | "user_activity";
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
    verified?: boolean;
  };
  timestamp: Date;
  tags: string[];
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    isLiked?: boolean;
    isBookmarked?: boolean;
  };
  metadata?: {
    location?: string;
    deadline?: Date;
    url?: string;
    images?: string[];
  };
  relevanceScore: number;
  trending?: boolean;
}

interface FeedFilters {
  contentTypes: string[];
  interests: string[];
  timeRange: "1h" | "24h" | "7d" | "30d" | "all";
  location?: string;
  sortBy: "relevance" | "recent" | "trending" | "engagement";
}

interface RecommendedTopic {
  id: string;
  name: string;
  category: string;
  engagement: number;
  trend: "up" | "down" | "stable";
}

interface SuggestedConnection {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  mutualConnections: number;
  commonInterests: string[];
}

interface PersonalizedFeedProps {
  userId: string;
  initialFilters?: Partial<FeedFilters>;
  className?: string;
  showRecommendations?: boolean;
  enableRealtime?: boolean;
  onEngagement?: (itemId: string, action: string) => void;
  onFilterChange?: (filters: FeedFilters) => void;
}

const PersonalizedFeed = ({
  userId,
  initialFilters = {},
  className = "",
  showRecommendations = true,
  enableRealtime = true,
  onEngagement,
  onFilterChange,
}: PersonalizedFeedProps) => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [filters, setFilters] = useState<FeedFilters>({
    contentTypes: ["discussion", "opportunity", "announcement", "user_activity"],
    interests: [],
    timeRange: "24h",
    sortBy: "relevance",
    ...initialFilters,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [recommendedTopics, setRecommendedTopics] = useState<RecommendedTopic[]>([]);
  const [suggestedConnections, setSuggestedConnections] = useState<SuggestedConnection[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [optimisticEngagement, setOptimisticEngagement] = useState<Record<string, any>>({});

  const observerRef = useRef<IntersectionObserver>();
  const lastItemRef = useRef<HTMLDivElement>(null);

  // Mock data for demonstration
  const mockFeedItems: FeedItem[] = [
    {
      id: "1",
      type: "discussion",
      title: "Best practices for AI-driven community engagement",
      content: "I've been experimenting with different approaches to using AI for better community management. What strategies have worked well for your communities? I'm particularly interested in balancing automation with authentic human interaction...",
      author: {
        id: "user1",
        name: "Sarah Chen",
        avatar: "/avatars/sarah.jpg",
        role: "Community Manager",
        verified: true,
      },
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      tags: ["AI", "Community Management", "Engagement"],
      engagement: {
        likes: 24,
        comments: 12,
        shares: 8,
        saves: 15,
        isLiked: false,
        isBookmarked: true,
      },
      relevanceScore: 0.92,
      trending: true,
    },
    {
      id: "2",
      type: "opportunity",
      title: "Frontend Developer Position - Remote",
      content: "We're looking for a passionate Frontend Developer to join our growing team. Experience with React, TypeScript, and modern web technologies required. Competitive salary and full remote work.",
      author: {
        id: "company1",
        name: "TechCorp Inc.",
        avatar: "/avatars/techcorp.jpg",
        role: "Recruiter",
      },
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      tags: ["Frontend", "React", "Remote", "JavaScript"],
      engagement: {
        likes: 45,
        comments: 23,
        shares: 18,
        saves: 67,
        isLiked: true,
        isBookmarked: false,
      },
      metadata: {
        location: "Remote",
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        url: "https://techcorp.com/careers/frontend-dev",
      },
      relevanceScore: 0.88,
    },
    {
      id: "3",
      type: "announcement",
      title: "New Community Features Coming Soon!",
      content: "We're excited to announce several new features coming to our platform next month, including enhanced messaging, project collaboration tools, and improved search functionality.",
      author: {
        id: "admin",
        name: "CR AudioViz Team",
        avatar: "/avatars/cr-team.jpg",
        role: "Platform Team",
        verified: true,
      },
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      tags: ["Platform Update", "Features", "Community"],
      engagement: {
        likes: 128,
        comments: 34,
        shares: 45,
        saves: 23,
        isLiked: false,
        isBookmarked: false,
      },
      relevanceScore: 0.85,
    },
  ];

  const mockRecommendedTopics: RecommendedTopic[] = [
    {
      id: "1",
      name: "Machine Learning",
      category: "Technology",
      engagement: 1250,
      trend: "up",
    },
    {
      id: "2",
      name: "Remote Work",
      category: "Lifestyle",
      engagement: 980,
      trend: "up",
    },
    {
      id: "3",
      name: "Web Development",
      category: "Technology",
      engagement: 750,
      trend: "stable",
    },
  ];

  const mockSuggestedConnections: SuggestedConnection[] = [
    {
      id: "1",
      name: "Alex Rodriguez",
      avatar: "/avatars/alex.jpg",
      role: "Senior Developer",
      mutualConnections: 12,
      commonInterests: ["React", "TypeScript", "AI"],
    },
    {
      id: "2",
      name: "Emma Thompson",
      avatar: "/avatars/emma.jpg",
      role: "Product Designer",
      mutualConnections: 8,
      commonInterests: ["UX Design", "Community", "Remote Work"],
    },
  ];

  // Load feed items
  const loadFeedItems = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setFeedItems([]);
    } else {
      setLoadingMore(true);
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Apply filters and search
      let filteredItems = mockFeedItems.filter(item => {
        if (filters.contentTypes.length > 0 && !filters.contentTypes.includes(item.type)) {
          return false;
        }
        
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return item.title.toLowerCase().includes(query) ||
                 item.content.toLowerCase().includes(query) ||
                 item.tags.some(tag => tag.toLowerCase().includes(query));
        }
        
        return true;
      });

      // Sort items
      filteredItems.sort((a, b) => {
        switch (filters.sortBy) {
          case "recent":
            return b.timestamp.getTime() - a.timestamp.getTime();
          case "trending":
            return (b.trending ? 1 : 0) - (a.trending ? 1 : 0);
          case "engagement":
            return (b.engagement.likes + b.engagement.comments) - 
                   (a.engagement.likes + a.engagement.comments);
          case "relevance":
          default:
            return b.relevanceScore - a.relevanceScore;
        }
      });

      if (reset) {
        setFeedItems(filteredItems);
      } else {
        setFeedItems(prev => [...prev, ...filteredItems.slice(prev.length)]);
      }
      
      setHasMore(filteredItems.length > feedItems.length);
    } catch (error) {
      console.error("Failed to load feed items:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, searchQuery, feedItems.length]);

  // Load recommendations
  useEffect(() => {
    if (showRecommendations) {
      setRecommendedTopics(mockRecommendedTopics);
      setSuggestedConnections(mockSuggestedConnections);
    }
  }, [showRecommendations]);

  // Initialize feed
  useEffect(() => {
    loadFeedItems(true);
  }, [filters, searchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    const currentObserver = observerRef.current;
    
    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loadingMore) {
        loadFeedItems(false);
      }
    };

    if (currentObserver) currentObserver.disconnect();

    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });

    if (lastItemRef.current) {
      observerRef.current.observe(lastItemRef.current);
    }

    return () => {
      if (currentObserver) currentObserver.disconnect();
    };
  }, [hasMore, loadingMore, loadFeedItems]);

  // Handle engagement actions
  const handleEngagement = async (itemId: string, action: "like" | "comment" | "share" | "save") => {
    // Optimistic update
    setOptimisticEngagement(prev => ({
      ...prev,
      [`${itemId}-${action}`]: true,
    }));

    setFeedItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item };
        switch (action) {
          case "like":
            updatedItem.engagement.isLiked = !updatedItem.engagement.isLiked;
            updatedItem.engagement.likes += updatedItem.engagement.isLiked ? 1 : -1;
            break;
          case "save":
            updatedItem.engagement.isBookmarked = !updatedItem.engagement.isBookmarked;
            updatedItem.engagement.saves += updatedItem.engagement.isBookmarked ? 1 : -1;
            break;
          case "share":
            updatedItem.engagement.shares += 1;
            break;
        }
        return updatedItem;
      }
      return item;
    }));

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      onEngagement?.(itemId, action);
    } catch (error) {
      console.error("Failed to update engagement:", error);
      // Revert optimistic update on error
      setOptimisticEngagement(prev => {
        const updated = { ...prev };
        delete updated[`${itemId}-${action}`];
        return updated;
      });
    }
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<FeedFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange?.(updatedFilters);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  // Get content type icon
  const getContentTypeIcon = (type: FeedItem["type"]) => {
    switch (type) {
      case "discussion":
        return <MessageSquare className="h-4 w-4" />;
      case "opportunity":
        return <Briefcase className="h-4 w-4" />;
      case "announcement":
        return <Megaphone className="h-4 w-4" />;
      case "user_activity":
        return <Activity className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  // Render feed card
  const renderFeedCard = (item: FeedItem) => (
    <Card key={item.id} className="mb-4 transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={item.author.avatar} alt={item.author.name} />
              <AvatarFallback>
                {item.author.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.author.name}
                </p>
                {item.author.verified && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <span>{item.author.role}</span>
                <span>•</span>
                <span>{formatTimestamp(item.timestamp)}</span>
                <div className="flex items-center space-x-1">
                  {getContentTypeIcon(item.type)}
                  <span className="capitalize">{item.type.replace("_", " ")}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {item.trending && (
              <Badge variant="outline" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                Trending
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Bell className="h-4 w-4 mr-2" />
                  Follow conversation
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Hide similar content
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <h3 className="text-lg font-semibold mb-2 text-foreground">{item.title}</h3>
        <p className="text-muted-foreground mb-3 line-clamp-3">{item.content}</p>
        
        {item.metadata?.deadline && (
          <div className="flex items-center space-x-1 text-sm text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            <span>Deadline: {item.metadata.deadline.toLocaleDateString()}</span>
          </div>
        )}
        
        {item.metadata?.location && (
          <div className="flex items-center space-x-1 text-sm text-muted-foreground mb-2">
            <MapPin className="h-4 w-4" />
            <span>{item.metadata.location}</span>
          </div>
        )}
        
        {item.metadata?.url && (
          <Button variant="outline" size="sm" className="mb-3" asChild>
            <a href={item.metadata.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Details
            </a>
          </Button>
        )}
        
        <div className="flex flex-wrap gap-1 mb-3">
          {item.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="pt-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEngagement(item.id, "like")}
              className={`${item.engagement.isLiked ? "text-red-500" : ""} hover:text-red-500`}
            >
              <Heart className={`h-4 w-4 mr-1 ${item.engagement.isLiked ? "fill-current" : ""}`} />
              {item.engagement.likes}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEngagement(item.id, "comment")}
              className="hover:text-blue-500"
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              {item.engagement.comments}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEngagement(item.id, "share")}
              className="hover:text-green-500"
            >
              <Share2 className="h-4 w-4 mr-1" />
              {item.engagement.shares}
            </Button>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEngagement(item.id, "save")}
            className={`${item.engagement.isBookmarked ? "text-yellow-600" : ""} hover:text-yellow-600`}
          >
            <Bookmark className={`h-4 w-4 ${item.engagement.isBookmarked ? "fill-current" : ""}`} />
            <span className="sr-only">Save</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );

  // Render loading skeleton
  const renderSkeleton = () => (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3 mb-3" />
        <div className="flex space-x-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-14" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with search and filters */}
      <div className="flex flex-col space-y-4 sm:flex-