import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  Calendar, 
  Video, 
  Users, 
  Mic, 
  MicOff, 
  VideoOff, 
  Share, 
  Record, 
  Settings, 
  Clock, 
  MapPin, 
  Star,
  Play,
  Pause,
  StopCircle,
  UserPlus,
  MessageCircle,
  BarChart3,
  Download,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Camera,
  Monitor,
  Headphones,
  Volume2,
  VolumeX,
  MoreVertical,
  Grid,
  List,
  Filter,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  Maximize,
  Minimize,
  RotateCcw,
  Send,
  Heart,
  ThumbsUp,
  Eye,
  UserCheck,
  Crown,
  Shield,
  Zap,
  Globe,
  Lock,
  Unlock,
  RefreshCw,
  PieChart,
  TrendingUp
} from 'lucide-react';

/**
 * Virtual Events Module - Complete platform for hosting virtual community events
 * Supports live streaming, breakout rooms, networking, and recording capabilities
 */

// Types and Interfaces
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'host' | 'speaker' | 'attendee' | 'moderator';
  isOnline: boolean;
  joinedAt: Date;
  permissions: string[];
}

interface Event {
  id: string;
  title: string;
  description: string;
  type: 'meetup' | 'workshop' | 'conference' | 'webinar';
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  startTime: Date;
  endTime: Date;
  timezone: string;
  host: User;
  speakers: User[];
  attendees: User[];
  maxAttendees: number;
  isPublic: boolean;
  requiresTicket: boolean;
  ticketPrice?: number;
  streamUrl?: string;
  recordingUrl?: string;
  tags: string[];
  category: string;
  thumbnail?: string;
  settings: EventSettings;
  analytics: EventAnalytics;
  breakoutRooms: BreakoutRoom[];
}

interface EventSettings {
  allowRecording: boolean;
  enableBreakoutRooms: boolean;
  enableNetworking: boolean;
  enableChat: boolean;
  enableQA: boolean;
  enablePolls: boolean;
  requireRegistration: boolean;
  allowScreenSharing: boolean;
  maxBreakoutRooms: number;
  waitingRoomEnabled: boolean;
}

interface EventAnalytics {
  totalAttendees: number;
  peakConcurrent: number;
  averageDuration: number;
  engagementScore: number;
  chatMessages: number;
  pollResponses: number;
  networkingConnections: number;
  recordingViews: number;
}

interface BreakoutRoom {
  id: string;
  name: string;
  participants: User[];
  maxParticipants: number;
  isActive: boolean;
  topic?: string;
  duration?: number;
  moderator?: User;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'system' | 'announcement';
  reactions: Record<string, string[]>;
}

interface StreamState {
  isLive: boolean;
  isRecording: boolean;
  viewerCount: number;
  quality: 'auto' | '720p' | '1080p' | '4k';
  bitrate: number;
  latency: number;
}

interface NetworkingMatch {
  id: string;
  users: [User, User];
  interests: string[];
  matchScore: number;
  connectedAt: Date;
  duration: number;
  status: 'pending' | 'connected' | 'completed';
}

// Context
interface EventsContextValue {
  events: Event[];
  currentEvent: Event | null;
  streamState: StreamState;
  chatMessages: ChatMessage[];
  breakoutRooms: BreakoutRoom[];
  networkingMatches: NetworkingMatch[];
  isLoading: boolean;
  error: string | null;
  createEvent: (eventData: Partial<Event>) => Promise<void>;
  updateEvent: (eventId: string, updates: Partial<Event>) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  joinEvent: (eventId: string) => Promise<void>;
  leaveEvent: (eventId: string) => Promise<void>;
  startStream: (eventId: string) => Promise<void>;
  stopStream: (eventId: string) => Promise<void>;
  startRecording: (eventId: string) => Promise<void>;
  stopRecording: (eventId: string) => Promise<void>;
  sendChatMessage: (message: string) => Promise<void>;
  createBreakoutRoom: (roomData: Partial<BreakoutRoom>) => Promise<void>;
  joinBreakoutRoom: (roomId: string) => Promise<void>;
  leaveBreakoutRoom: (roomId: string) => Promise<void>;
  startNetworking: () => Promise<void>;
  acceptNetworkingMatch: (matchId: string) => Promise<void>;
}

const EventsContext = createContext<EventsContextValue | undefined>(undefined);

// Events Provider Component
export const EventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [streamState, setStreamState] = useState<StreamState>({
    isLive: false,
    isRecording: false,
    viewerCount: 0,
    quality: 'auto',
    bitrate: 0,
    latency: 0
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [breakoutRooms, setBreakoutRooms] = useState<BreakoutRoom[]>([]);
  const [networkingMatches, setNetworkingMatches] = useState<NetworkingMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingRef = useRef<MediaRecorder | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = () => {
      try {
        wsRef.current = new WebSocket(process.env.REACT_APP_WS_URL || 'ws://localhost:8080');
        
        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
        };
        
        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        };
        
        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          // Reconnect after 3 seconds
          setTimeout(initializeWebSocket, 3000);
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error. Please refresh the page.');
        };
      } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        setError('Failed to establish connection.');
      }
    };

    initializeWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'event_update':
        setEvents(prev => prev.map(event => 
          event.id === data.eventId ? { ...event, ...data.updates } : event
        ));
        break;
      case 'chat_message':
        setChatMessages(prev => [...prev, data.message]);
        break;
      case 'stream_update':
        setStreamState(prev => ({ ...prev, ...data.state }));
        break;
      case 'breakout_update':
        setBreakoutRooms(prev => prev.map(room =>
          room.id === data.roomId ? { ...room, ...data.updates } : room
        ));
        break;
      case 'networking_match':
        setNetworkingMatches(prev => [...prev, data.match]);
        break;
    }
  };

  const createEvent = useCallback(async (eventData: Partial<Event>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      if (!response.ok) throw new Error('Failed to create event');
      
      const newEvent = await response.json();
      setEvents(prev => [...prev, newEvent]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateEvent = useCallback(async (eventId: string, updates: Partial<Event>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error('Failed to update event');
      
      const updatedEvent = await response.json();
      setEvents(prev => prev.map(event => 
        event.id === eventId ? updatedEvent : event
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete event');
      
      setEvents(prev => prev.filter(event => event.id !== eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const joinEvent = useCallback(async (eventId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/events/${eventId}/join`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to join event');
      
      const event = await response.json();
      setCurrentEvent(event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join event');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const leaveEvent = useCallback(async (eventId: string) => {
    try {
      await fetch(`/api/events/${eventId}/leave`, {
        method: 'POST'
      });
      
      setCurrentEvent(null);
      setChatMessages([]);
      setBreakoutRooms([]);
    } catch (err) {
      console.error('Failed to leave event:', err);
    }
  }, []);

  const startStream = useCallback(async (eventId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1920, height: 1080 },
        audio: true
      });
      
      streamRef.current = stream;
      
      const response = await fetch(`/api/events/${eventId}/stream/start`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to start stream');
      
      setStreamState(prev => ({ ...prev, isLive: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start stream');
      throw err;
    }
  }, []);

  const stopStream = useCallback(async (eventId: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      await fetch(`/api/events/${eventId}/stream/stop`, {
        method: 'POST'
      });
      
      setStreamState(prev => ({ ...prev, isLive: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop stream');
      throw err;
    }
  }, []);

  const startRecording = useCallback(async (eventId: string) => {
    try {
      if (!streamRef.current) throw new Error('No active stream to record');
      
      const recorder = new MediaRecorder(streamRef.current);
      recordingRef.current = recorder;
      
      recorder.start();
      
      await fetch(`/api/events/${eventId}/recording/start`, {
        method: 'POST'
      });
      
      setStreamState(prev => ({ ...prev, isRecording: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      throw err;
    }
  }, []);

  const stopRecording = useCallback(async (eventId: string) => {
    try {
      if (recordingRef.current) {
        recordingRef.current.stop();
        recordingRef.current = null;
      }
      
      await fetch(`/api/events/${eventId}/recording/stop`, {
        method: 'POST'
      });
      
      setStreamState(prev => ({ ...prev, isRecording: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      throw err;
    }
  }, []);

  const sendChatMessage = useCallback(async (message: string) => {
    if (!currentEvent) return;
    
    try {
      const response = await fetch(`/api/events/${currentEvent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      if (!response.ok) throw new Error('Failed to send message');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [currentEvent]);

  const createBreakoutRoom = useCallback(async (roomData: Partial<BreakoutRoom>) => {
    if (!currentEvent) return;
    
    try {
      const response = await fetch(`/api/events/${currentEvent.id}/breakout-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomData)
      });
      
      if (!response.ok) throw new Error('Failed to create breakout room');
      
      const newRoom = await response.json();
      setBreakoutRooms(prev => [...prev, newRoom]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create breakout room');
      throw err;
    }
  }, [currentEvent]);

  const joinBreakoutRoom = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/breakout-rooms/${roomId}/join`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to join breakout room');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join breakout room');
      throw err;
    }
  }, []);

  const leaveBreakoutRoom = useCallback(async (roomId: string) => {
    try {
      await fetch(`/api/breakout-rooms/${roomId}/leave`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to leave breakout room:', err);
    }
  }, []);

  const startNetworking = useCallback(async () => {
    if (!currentEvent) return;
    
    try {
      const response = await fetch(`/api/events/${currentEvent.id}/networking/start`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to start networking');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start networking');
      throw err;
    }
  }, [currentEvent]);

  const acceptNetworkingMatch = useCallback(async (matchId: string) => {
    try {
      const response = await fetch(`/api/networking/matches/${matchId}/accept`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to accept match');
      
      setNetworkingMatches(prev => prev.map(match =>
        match.id === matchId ? { ...match, status: 'connected' as const } : match
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept match');
      throw err;
    }
  }, []);

  const value: EventsContextValue = {
    events,
    currentEvent,
    streamState,
    chatMessages,
    breakoutRooms,
    networkingMatches,
    isLoading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    joinEvent,
    leaveEvent,
    startStream,
    stopStream,
    startRecording,
    stopRecording,
    sendChatMessage,
    createBreakoutRoom,
    joinBreakoutRoom,
    leaveBreakoutRoom,
    startNetworking,
    acceptNetworkingMatch
  };

  return (
    <EventsContext.Provider value={value}>
      {children}
    </EventsContext.Provider>
  );
};

// Hook for using Events Context
export const useEvents = () => {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return context;
};

// Events Dashboard Component
export const EventsDashboard: React.FC = () => {
  const { events, isLoading, error, joinEvent, createEvent } = useEvents();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || event.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const upcomingEvents = filteredEvents.filter(event => event.status === 'scheduled');
  const liveEvents = filteredEvents.filter(event => event.status === 'live');
  const pastEvents = filteredEvents.filter(event => event.status === 'ended');

  const handleJoinEvent = async (eventId: string) => {
    try {
      await joinEvent(eventId);
    } catch (err) {
      console.error('Failed to join event:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Virtual Events</h1>
          <p className="text-gray-600 mt-2">Join live events, workshops, and conferences</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Create Event
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Events</option>
          <option value="scheduled">Upcoming</option>
          <option value="live">Live Now</option>
          <option value="ended">Past Events</option>
        </select>

        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover