```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, parseISO, startOfDay, endOfDay } from 'date-fns';
import { 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  MessageSquare, 
  CheckCircle, 
  ArrowRight, 
  Download,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Handshake,
  AlertCircle,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  email: string;
}

export interface TimelineEvent {
  id: string;
  type: 'communication' | 'decision' | 'handoff' | 'milestone' | 'task_update';
  title: string;
  description: string;
  content?: string;
  timestamp: string;
  participants: TeamMember[];
  author: TeamMember;
  project_id?: string;
  project_name?: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'completed' | 'cancelled';
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
  }>;
  related_task_id?: string;
  handoff_from?: TeamMember;
  handoff_to?: TeamMember;
  decision_impact?: 'low' | 'medium' | 'high';
}

export interface TimelineFilters {
  type?: string;
  participant?: string;
  project?: string;
  priority?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
}

export interface TeamCommunicationTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onEventSelect?: (event: TimelineEvent) => void;
  onExport?: (format: 'json' | 'csv') => void;
  className?: string;
  realTimeUpdates?: boolean;
  maxHeight?: string;
}

const EventTypeIcon = ({ type, priority }: { type: TimelineEvent['type']; priority: TimelineEvent['priority'] }) => {
  const iconClass = `w-4 h-4 ${
    priority === 'urgent' ? 'text-red-500' :
    priority === 'high' ? 'text-orange-500' :
    priority === 'medium' ? 'text-yellow-500' :
    'text-blue-500'
  }`;

  switch (type) {
    case 'communication':
      return <MessageSquare className={iconClass} />;
    case 'decision':
      return <CheckCircle className={iconClass} />;
    case 'handoff':
      return <Handshake className={iconClass} />;
    case 'milestone':
      return <AlertCircle className={iconClass} />;
    case 'task_update':
      return <FileText className={iconClass} />;
    default:
      return <Clock className={iconClass} />;
  }
};

const ParticipantAvatar = ({ participant, size = 'sm' }: { participant: TeamMember; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClass = size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-8 h-8' : 'w-10 h-10';
  const textSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base';
  
  return (
    <Avatar className={sizeClass}>
      <AvatarImage src={participant.avatar} alt={participant.name} />
      <AvatarFallback className={textSize}>
        {participant.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  );
};

const TaskHandoffBadge = ({ from, to }: { from?: TeamMember; to?: TeamMember }) => {
  if (!from || !to) return null;
  
  return (
    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
      <ParticipantAvatar participant={from} size="sm" />
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
      <ParticipantAvatar participant={to} size="sm" />
      <span className="text-xs text-muted-foreground">
        Handed off from {from.name} to {to.name}
      </span>
    </div>
  );
};

const DecisionMarker = ({ impact }: { impact?: 'low' | 'medium' | 'high' }) => {
  if (!impact) return null;
  
  const impactColor = {
    low: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
    high: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
  };
  
  return (
    <Badge variant="secondary" className={`${impactColor[impact]} text-xs`}>
      {impact.toUpperCase()} IMPACT
    </Badge>
  );
};

const EventCard = ({ 
  event, 
  onSelect 
}: { 
  event: TimelineEvent; 
  onSelect?: (event: TimelineEvent) => void;
}) => {
  const formatTime = (timestamp: string) => {
    const date = parseISO(timestamp);
    return format(date, 'HH:mm');
  };

  const getPriorityColor = (priority: TimelineEvent['priority']) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-yellow-500';
      default: return 'border-l-blue-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className={`mb-4 border-l-4 ${getPriorityColor(event.priority)} hover:shadow-md transition-shadow cursor-pointer`}
        onClick={() => onSelect?.(event)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <EventTypeIcon type={event.type} priority={event.priority} />
              <h3 className="font-medium text-sm">{event.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatTime(event.timestamp)}
              </span>
              {event.decision_impact && <DecisionMarker impact={event.decision_impact} />}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ParticipantAvatar participant={event.author} size="sm" />
            <span className="text-xs text-muted-foreground">{event.author.name}</span>
            {event.project_name && (
              <Badge variant="outline" className="text-xs">
                {event.project_name}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
          
          {event.type === 'handoff' && (
            <TaskHandoffBadge from={event.handoff_from} to={event.handoff_to} />
          )}
          
          {event.participants.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">Participants:</span>
              <div className="flex -space-x-2">
                {event.participants.slice(0, 5).map((participant, index) => (
                  <ParticipantAvatar 
                    key={participant.id} 
                    participant={participant} 
                    size="sm" 
                  />
                ))}
                {event.participants.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                    +{event.participants.length - 5}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {event.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
          
          {event.attachments && event.attachments.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-3 h-3" />
              <span>{event.attachments.length} attachment(s)</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const TimelineSearch = ({ 
  value, 
  onChange, 
  onClear 
}: { 
  value: string; 
  onChange: (value: string) => void;
  onClear: () => void;
}) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Search communications, decisions, participants..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10"
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};

const TimelineFilter = ({
  filters,
  onChange,
  onClear,
  availableProjects = [],
  availableParticipants = [],
  availableTags = []
}: {
  filters: TimelineFilters;
  onChange: (filters: TimelineFilters) => void;
  onClear: () => void;
  availableProjects?: Array<{ id: string; name: string }>;
  availableParticipants?: TeamMember[];
  availableTags?: string[];
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {Object.keys(filters).length}
            </Badge>
          )}
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear All
          </Button>
        )}
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            <Select 
              value={filters.type || ''} 
              onValueChange={(value) => onChange({ ...filters, type: value || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="communication">Communication</SelectItem>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="handoff">Handoff</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
                <SelectItem value="task_update">Task Update</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.priority || ''} 
              onValueChange={(value) => onChange({ ...filters, priority: value || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.project || ''} 
              onValueChange={(value) => onChange({ ...filters, project: value || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TimelineNavigation = ({
  currentDate,
  onDateChange,
  onExport,
  hasEvents
}: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onExport?: (format: 'json' | 'csv') => void;
  hasEvents: boolean;
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Input
          type="date"
          value={format(currentDate, 'yyyy-MM-dd')}
          onChange={(e) => onDateChange(new Date(e.target.value))}
          className="w-auto"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDateChange(new Date())}
        >
          Today
        </Button>
      </div>
      
      {onExport && hasEvents && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport('json')}
          >
            <Download className="w-4 h-4 mr-1" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport('csv')}
          >
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
        </div>
      )}
    </div>
  );
};

export const TeamCommunicationTimeline = ({
  events = [],
  loading = false,
  onLoadMore,
  hasMore = false,
  onEventSelect,
  onExport,
  className,
  realTimeUpdates = false,
  maxHeight = '600px'
}: TeamCommunicationTimelineProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TimelineFilters>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter and search logic
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.content?.toLowerCase().includes(query) ||
        event.author.name.toLowerCase().includes(query) ||
        event.participants.some(p => p.name.toLowerCase().includes(query)) ||
        event.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (filters.type) {
      filtered = filtered.filter(event => event.type === filters.type);
    }
    if (filters.priority) {
      filtered = filtered.filter(event => event.priority === filters.priority);
    }
    if (filters.project) {
      filtered = filtered.filter(event => event.project_id === filters.project);
    }
    if (filters.participant) {
      filtered = filtered.filter(event =>
        event.author.id === filters.participant ||
        event.participants.some(p => p.id === filters.participant)
      );
    }
    if (filters.dateRange) {
      const start = startOfDay(parseISO(filters.dateRange.start));
      const end = endOfDay(parseISO(filters.dateRange.end));
      filtered = filtered.filter(event => {
        const eventDate = parseISO(event.timestamp);
        return eventDate >= start && eventDate <= end;
      });
    }

    return filtered.sort((a, b) => 
      parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()
    );
  }, [events, searchQuery, filters]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    
    filteredEvents.forEach(event => {
      const date = format(parseISO(event.timestamp), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(event);
    });
    
    return groups;
  }, [filteredEvents]);

  // Get available filter options
  const availableProjects = useMemo(() => {
    const projects = new Map();
    events.forEach(event => {
      if (event.project_id && event.project_name) {
        projects.set(event.project_id, { id: event.project_id, name: event.project_name });
      }
    });
    return Array.from(projects.values());
  }, [events]);

  const availableParticipants = useMemo(() => {
    const participants = new Map();
    events.forEach(event => {
      participants.set(event.author.id, event.author);
      event.participants.forEach(p => participants.set(p.id, p));
    });
    return Array.from(participants.values());
  }, [events]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    events.forEach(event => event.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags);
  }, [events]);

  // Format date headers
  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr + 'T00:00:00');
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  // Toggle date section collapse
  const toggleDateCollapse = (date: string) => {
    const newCollapsed = new Set(collapsedDates);
    if (newCollapsed.has(date)) {
      newCollapsed.delete(date);
    } else {
      newCollapsed.add(date);
    }
    setCollapsedDates(newCollapsed);
  };

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && onLoadMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  // Clear search and filters
  const clearSearch = () => setSearchQuery('');
  const clearFilters = () => setFilters({});

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Controls */}
      <div className="space-y-4">
        <TimelineNavigation
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onExport={onExport}
          hasEvents={filteredEvents.length > 0}
        />
        
        <TimelineSearch
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={clearSearch}
        />
        
        <TimelineFilter
          filters={filters}
          onChange={setFilters}
          onClear={clearFilters}
          availableProjects={availableProjects}
          availableParticipants={availableParticipants}
          availableTags={availableTags}
        />
      </div>

      {/* Timeline Content */}
      <div