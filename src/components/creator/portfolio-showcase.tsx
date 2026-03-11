"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from '@/components/ui/carousel';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Play,
  Pause,
  Volume2,
  Eye,
  Heart,
  Star,
  Calendar,
  MapPin,
  Award,
  TrendingUp,
  Share2,
  Mail,
  Filter,
  Search,
  ExternalLink,
  Download,
  MessageSquare,
  Users,
  Clock,
  CheckCircle
} from 'lucide-react';

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnail?: string;
  title: string;
  description?: string;
  duration?: number;
  tags: string[];
  views: number;
  likes: number;
  created_at: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  years_experience: number;
  verified: boolean;
}

interface Testimonial {
  id: string;
  client_name: string;
  client_avatar?: string;
  client_company: string;
  rating: number;
  content: string;
  project_title: string;
  created_at: string;
}

interface Collaboration {
  id: string;
  project_title: string;
  client_name: string;
  status: 'completed' | 'in_progress' | 'cancelled';
  start_date: string;
  end_date?: string;
  budget: number;
  rating?: number;
  tags: string[];
  description: string;
}

interface PortfolioStats {
  total_views: number;
  total_likes: number;
  total_projects: number;
  completion_rate: number;
  average_rating: number;
  response_time: number;
}

interface CreatorProfile {
  id: string;
  name: string;
  avatar: string;
  title: string;
  bio: string;
  location: string;
  joined_date: string;
  verified: boolean;
  hourly_rate?: number;
  availability: 'available' | 'busy' | 'unavailable';
}

interface PortfolioShowcaseProps {
  creatorId: string;
  isOwner?: boolean;
  className?: string;
}

const PortfolioShowcase: React.FC<PortfolioShowcaseProps> = ({
  creatorId,
  isOwner = false,
  className = ''
}) => {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('gallery');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [collaborationFilter, setCollaborationFilter] = useState<string>('all');
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolioData = async () => {
      try {
        setLoading(true);
        
        // Simulate API calls - replace with actual Supabase queries
        const [
          profileResponse,
          mediaResponse,
          skillsResponse,
          testimonialsResponse,
          collaborationsResponse,
          statsResponse
        ] = await Promise.all([
          fetch(`/api/creators/${creatorId}/profile`),
          fetch(`/api/creators/${creatorId}/media`),
          fetch(`/api/creators/${creatorId}/skills`),
          fetch(`/api/creators/${creatorId}/testimonials`),
          fetch(`/api/creators/${creatorId}/collaborations`),
          fetch(`/api/creators/${creatorId}/stats`)
        ]);

        // Mock data for demonstration
        setProfile({
          id: creatorId,
          name: "Alex Johnson",
          avatar: "/api/placeholder/120/120",
          title: "Music Producer & Sound Designer",
          bio: "Passionate audio creator with 8+ years of experience in music production, sound design, and audio post-production. Specialized in electronic music, film scoring, and podcast production.",
          location: "Los Angeles, CA",
          joined_date: "2019-03-15",
          verified: true,
          hourly_rate: 75,
          availability: 'available'
        });

        setMediaItems([
          {
            id: '1',
            type: 'audio',
            url: '/audio/track1.mp3',
            thumbnail: '/api/placeholder/300/200',
            title: 'Electronic Dreamscape',
            description: 'Ambient electronic track with synthesized textures',
            duration: 240,
            tags: ['electronic', 'ambient', 'synthesizer'],
            views: 1250,
            likes: 89,
            created_at: '2024-01-15'
          },
          {
            id: '2',
            type: 'video',
            url: '/video/studio-session.mp4',
            thumbnail: '/api/placeholder/300/200',
            title: 'Studio Session Behind the Scenes',
            description: 'Production process of creating a cinematic score',
            duration: 180,
            tags: ['behind-the-scenes', 'production', 'cinematic'],
            views: 890,
            likes: 67,
            created_at: '2024-01-20'
          },
          {
            id: '3',
            type: 'image',
            url: '/api/placeholder/600/400',
            title: 'Home Studio Setup',
            description: 'Professional home studio configuration',
            tags: ['studio', 'equipment', 'workspace'],
            views: 456,
            likes: 34,
            created_at: '2024-01-25'
          }
        ]);

        setSkills([
          {
            id: '1',
            name: 'Music Production',
            category: 'Audio',
            level: 'expert',
            years_experience: 8,
            verified: true
          },
          {
            id: '2',
            name: 'Sound Design',
            category: 'Audio',
            level: 'advanced',
            years_experience: 6,
            verified: true
          },
          {
            id: '3',
            name: 'Pro Tools',
            category: 'Software',
            level: 'expert',
            years_experience: 8,
            verified: false
          },
          {
            id: '4',
            name: 'Ableton Live',
            category: 'Software',
            level: 'advanced',
            years_experience: 5,
            verified: true
          }
        ]);

        setTestimonials([
          {
            id: '1',
            client_name: 'Sarah Chen',
            client_avatar: '/api/placeholder/50/50',
            client_company: 'Indie Films Studio',
            rating: 5,
            content: 'Alex delivered an incredible soundtrack for our short film. The music perfectly captured the emotional depth we were looking for.',
            project_title: 'Short Film Score',
            created_at: '2024-01-10'
          },
          {
            id: '2',
            client_name: 'Mike Rodriguez',
            client_avatar: '/api/placeholder/50/50',
            client_company: 'Podcast Network',
            rating: 5,
            content: 'Professional, creative, and delivered on time. The podcast intro music exceeded our expectations.',
            project_title: 'Podcast Intro Music',
            created_at: '2024-01-05'
          }
        ]);

        setCollaborations([
          {
            id: '1',
            project_title: 'Documentary Soundtrack',
            client_name: 'Discovery Channel',
            status: 'completed',
            start_date: '2023-11-01',
            end_date: '2023-12-15',
            budget: 5000,
            rating: 5,
            tags: ['documentary', 'orchestral', 'cinematic'],
            description: 'Full soundtrack composition for nature documentary series'
          },
          {
            id: '2',
            project_title: 'Album Production',
            client_name: 'Rising Artist Records',
            status: 'in_progress',
            start_date: '2024-01-15',
            budget: 8000,
            tags: ['production', 'mixing', 'mastering'],
            description: 'Full album production including mixing and mastering'
          }
        ]);

        setStats({
          total_views: 12450,
          total_likes: 890,
          total_projects: 47,
          completion_rate: 98,
          average_rating: 4.9,
          response_time: 2
        });

      } catch (error) {
        console.error('Error fetching portfolio data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioData();
  }, [creatorId]);

  const filteredMediaItems = mediaItems.filter(item => {
    const matchesFilter = mediaFilter === 'all' || item.type === mediaFilter;
    const matchesSearch = searchQuery === '' || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const filteredSkills = skills.filter(skill => 
    skillFilter === 'all' || skill.category === skillFilter
  );

  const filteredCollaborations = collaborations.filter(collab => 
    collaborationFilter === 'all' || collab.status === collaborationFilter
  );

  const handleSharePortfolio = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.name}'s Portfolio`,
          text: `Check out ${profile?.name}'s creative portfolio`,
          url: window.location.href,
        });
      } catch (error) {
        // Fallback to clipboard
        navigator.clipboard.writeText(window.location.href);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'expert': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'advanced': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'intermediate': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${className}`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-muted-foreground">Portfolio not found</p>
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto p-6 space-y-8 ${className}`}>
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary/20 to-secondary/20" />
          <CardContent className="relative -mt-16 pb-6">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
              <div className="relative">
                <Image
                  src={profile.avatar}
                  alt={`${profile.name}'s avatar`}
                  width={120}
                  height={120}
                  className="rounded-full border-4 border-background shadow-lg"
                />
                {profile.verified && (
                  <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold">{profile.name}</h1>
                    <p className="text-xl text-muted-foreground">{profile.title}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {profile.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Joined {new Date(profile.joined_date).getFullYear()}
                      </span>
                      {profile.hourly_rate && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          ${profile.hourly_rate}/hour
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button onClick={handleSharePortfolio} variant="outline" size="sm">
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                    {!isOwner && (
                      <Button size="sm">
                        <Mail className="w-4 h-4 mr-2" />
                        Hire Me
                      </Button>
                    )}
                  </div>
                </div>
                
                <p className="text-muted-foreground leading-relaxed">{profile.bio}</p>
                
                <div className="flex items-center gap-1">
                  <Badge 
                    variant={profile.availability === 'available' ? 'default' : 'secondary'}
                    className={profile.availability === 'available' ? 'bg-green-100 text-green-800' : ''}
                  >
                    {profile.availability === 'available' ? 'Available for work' : 
                     profile.availability === 'busy' ? 'Busy' : 'Unavailable'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Portfolio Stats */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Eye className="w-6 h-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{stats.total_views.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Views</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Heart className="w-6 h-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{stats.total_likes.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Likes</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{stats.total_projects}</div>
                <p className="text-sm text-muted-foreground">Projects</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{stats.completion_rate}%</div>
                <p className="text-sm text-muted-foreground">Completion</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Star className="w-6 h-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{stats.average_rating.toFixed(1)}</div>
                <p className="text-sm text-muted-foreground">Rating</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <Clock className="w-6 h-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{stats.response_time}h</div>
                <p className="text-sm text-muted-foreground">Response</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Main Content Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
            <TabsTrigger value="collaborations">Projects</TabsTrigger>
          </TabsList>

          {/* Media Gallery Tab */}
          <TabsContent value="gallery" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  icon={<Search className="w-4 h-4" />}
                />
              </div>
              <Select value={mediaFilter} onValueChange={(value: any) => setMediaFilter(value)}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Media</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredMediaItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="group hover:shadow-lg transition-all cursor-pointer">
                      <div className="relative aspect-video overflow-hidden rounded-t-lg">
                        <Image
                          src={item.thumbnail || item.url}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedMedia(item)}
                          >
                            {item.type === 'audio' ? (
                              <Volume