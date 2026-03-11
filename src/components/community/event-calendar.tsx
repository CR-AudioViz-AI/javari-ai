```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, formatInTimeZone, zonedTimeToUtc, utcToZonedTime } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  Users, 
  Plus, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Settings,
  Check,
  X,
  UserPlus,
  UserMinus,
  Globe,
  Workshop,
  Code,
  Coffee
} from 'lucide-react';

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  type: 'workshop' | 'hackathon' | 'social';
  start_time: string;
  end_time: string;
  location: string;
  timezone: string;
  max_attendees?: number;
  created_by: string;
  image_url?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface EventRSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: 'attending' | 'maybe' | 'not_attending';
  created_at: string;
  user_profile?: {
    id: string;
    username: string;
    avatar_url?: string;
    display_name?: string;
  };
}

interface CommunityEventCalendarProps {
  className?: string;
  defaultView?: 'month' | 'week' | 'day';
  showCreateForm?: boolean;
  onEventSelect?: (event: CommunityEvent) => void;
}

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Australia/Sydney', label: 'Sydney' }
];

const EVENT_TYPE_CONFIG = {
  workshop: { icon: Workshop, color: 'bg-blue-500', label: 'Workshop' },
  hackathon: { icon: Code, color: 'bg-purple-500', label: 'Hackathon' },
  social: { icon: Coffee, color: 'bg-green-500', label: 'Social' }
};

export function CommunityEventCalendar({
  className,
  defaultView = 'month',
  showCreateForm = false,
  onEventSelect
}: CommunityEventCalendarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>(defaultView);
  const [selectedEvent, setSelectedEvent] = useState<CommunityEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userTimezone, setUserTimezone] = useState('UTC');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  // Detect user timezone
  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(detectedTimezone);
  }, []);

  // Fetch events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['community-events', currentDate.getFullYear(), currentDate.getMonth()],
    queryFn: async () => {
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      
      const { data, error } = await supabase
        .from('community_events')
        .select('*')
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as CommunityEvent[];
    }
  });

  // Fetch RSVPs
  const { data: rsvps = [] } = useQuery({
    queryKey: ['event-rsvps', events.map(e => e.id)],
    queryFn: async () => {
      if (events.length === 0) return [];
      
      const { data, error } = await supabase
        .from('event_rsvps')
        .select(`
          *,
          user_profile:profiles(id, username, avatar_url, display_name)
        `)
        .in('event_id', events.map(e => e.id));

      if (error) throw error;
      return data as EventRSVP[];
    },
    enabled: events.length > 0
  });

  // RSVP mutation
  const rsvpMutation = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: 'attending' | 'maybe' | 'not_attending' }) => {
      if (!user) throw new Error('Must be logged in to RSVP');

      const existingRSVP = rsvps.find(r => r.event_id === eventId && r.user_id === user.id);

      if (existingRSVP) {
        if (existingRSVP.status === status) {
          // Remove RSVP if same status clicked
          const { error } = await supabase
            .from('event_rsvps')
            .delete()
            .eq('id', existingRSVP.id);
          if (error) throw error;
          return null;
        } else {
          // Update existing RSVP
          const { data, error } = await supabase
            .from('event_rsvps')
            .update({ status })
            .eq('id', existingRSVP.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        }
      } else {
        // Create new RSVP
        const { data, error } = await supabase
          .from('event_rsvps')
          .insert({ event_id: eventId, user_id: user.id, status })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-rsvps'] });
    }
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: Omit<CommunityEvent, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Must be logged in to create events');

      const { data, error } = await supabase
        .from('community_events')
        .insert({ ...eventData, created_by: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-events'] });
      setShowCreateModal(false);
    }
  });

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (eventTypeFilter !== 'all' && event.type !== eventTypeFilter) return false;
      return true;
    });
  }, [events, eventTypeFilter]);

  // Get events for specific date
  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => 
      isSameDay(parseISO(event.start_time), date)
    );
  };

  // Get RSVP status for user and event
  const getUserRSVPStatus = (eventId: string) => {
    if (!user) return null;
    return rsvps.find(r => r.event_id === eventId && r.user_id === user.id);
  };

  // Get attendee count
  const getAttendeeCount = (eventId: string) => {
    return rsvps.filter(r => r.event_id === eventId && r.status === 'attending').length;
  };

  // Format time in user timezone
  const formatEventTime = (dateTime: string, timezone: string) => {
    const date = parseISO(dateTime);
    return formatInTimeZone(date, userTimezone, 'MMM dd, yyyy h:mm a zzz');
  };

  // Calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  return (
    <div className={cn('flex flex-col space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-3xl font-bold">Community Events</h2>
          <Badge variant="outline" className="flex items-center space-x-1">
            <Globe className="h-3 w-3" />
            <span>{userTimezone}</span>
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Timezone Selector */}
          <Select value={userTimezone} onValueChange={setUserTimezone}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Create Event Button */}
          {showCreateForm && user && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          )}
        </div>
      </div>

      {/* Filters and View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Event Type Filter */}
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="workshop">Workshops</SelectItem>
              <SelectItem value="hackathon">Hackathons</SelectItem>
              <SelectItem value="social">Social</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          {/* Month Navigation */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[150px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* View Tabs */}
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 bg-muted/50 p-4 rounded-lg">
        {/* Days of week header */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center font-medium text-sm text-muted-foreground">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map(day => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <motion.div
              key={day.toISOString()}
              className={cn(
                'min-h-[120px] p-2 border rounded-md bg-background cursor-pointer hover:bg-accent/50 transition-colors',
                !isCurrentMonth && 'opacity-50',
                isToday && 'ring-2 ring-primary'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="font-medium text-sm mb-2">
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => {
                  const EventIcon = EVENT_TYPE_CONFIG[event.type].icon;
                  const attendeeCount = getAttendeeCount(event.id);
                  
                  return (
                    <motion.div
                      key={event.id}
                      className="p-1 rounded text-xs bg-accent cursor-pointer hover:bg-accent/80"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventModal(true);
                        onEventSelect?.(event);
                      }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="flex items-center space-x-1 truncate">
                        <EventIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium truncate">{event.title}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-muted-foreground">
                          {format(parseISO(event.start_time), 'h:mm a')}
                        </span>
                        {attendeeCount > 0 && (
                          <span className="flex items-center space-x-1 text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{attendeeCount}</span>
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Event Details Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center space-x-2">
                  {React.createElement(EVENT_TYPE_CONFIG[selectedEvent.type].icon, {
                    className: "h-5 w-5"
                  })}
                  <DialogTitle className="text-xl">{selectedEvent.title}</DialogTitle>
                  <Badge variant="outline">{EVENT_TYPE_CONFIG[selectedEvent.type].label}</Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Event Image */}
                {selectedEvent.image_url && (
                  <img
                    src={selectedEvent.image_url}
                    alt={selectedEvent.title}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}

                {/* Event Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{formatEventTime(selectedEvent.start_time, selectedEvent.timezone)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{getAttendeeCount(selectedEvent.id)} attending</span>
                    </div>
                    {selectedEvent.max_attendees && (
                      <div className="text-sm text-muted-foreground">
                        Max: {selectedEvent.max_attendees} attendees
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                </div>

                {/* Tags */}
                {selectedEvent.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.tags.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* RSVP Section */}
                {user && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">RSVP</h4>
                    <div className="flex space-x-2">
                      <RSVPButton
                        eventId={selectedEvent.id}
                        status="attending"
                        currentStatus={getUserRSVPStatus(selectedEvent.id)?.status}
                        onRSVP={(status) => rsvpMutation.mutate({ eventId: selectedEvent.id, status })}
                        isLoading={rsvpMutation.isPending}
                      />
                      <RSVPButton
                        eventId={selectedEvent.id}
                        status="maybe"
                        currentStatus={getUserRSVPStatus(selectedEvent.id)?.status}
                        onRSVP={(status) => rsvpMutation.mutate({ eventId: selectedEvent.id, status })}
                        isLoading={rsvpMutation.isPending}
                      />
                      <RSVPButton
                        eventId={selectedEvent.id}
                        status="not_attending"
                        currentStatus={getUserRSVPStatus(selectedEvent.id)?.status}
                        onRSVP={(status) => rsvpMutation.mutate({ eventId: selectedEvent.id, status })}
                        isLoading={rsvpMutation.isPending}
                      />
                    </div>
                  </div>
                )}

                {/* Attendees List */}
                <AttendeeList eventId={selectedEvent.id} rsvps={rsvps} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Event Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
          </DialogHeader>
          
          <EventCreateForm
            onSubmit={(data) => createEventMutation.mutate(data)}
            isLoading={createEventMutation.isPending}
            onCancel={() => setShowCreateModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// RSVP Button Component
function RSVPButton({
  eventId,
  status,
  currentStatus,
  onRSVP,
  isLoading
}: {
  eventId: string;
  status: 'attending' | 'maybe' | 'not_attending';
  currentStatus?: string;
  onRSVP: (status: 'attending' | 'maybe' | 'not_attending') => void;
  isLoading: boolean;
}) {
  const isSelected = currentStatus === status;
  
  const config