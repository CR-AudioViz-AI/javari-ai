```tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Users,
  MessageSquare,
  Settings,
  Calendar,
  Play,
  Pause,
  Square,
  Camera,
  Hand,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Volume2,
  VolumeX,
  UserPlus,
  UserMinus,
  Presentation,
  Radio
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  role: 'host' | 'presenter' | 'attendee';
  isOnline: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  isHandRaised: boolean;
  breakoutRoomId?: string;
}

interface BreakoutRoom {
  id: string;
  name: string;
  participants: Participant[];
  maxCapacity: number;
  topic?: string;
}

interface ChatMessage {
  id: string;
  participantId: string;
  participantName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'emoji';
}

interface PresentationSlide {
  id: string;
  url: string;
  title?: string;
  annotations?: Array<{
    x: number;
    y: number;
    text: string;
    color: string;
  }>;
}

interface VirtualEvent {
  id: string;
  title: string;
  description: string;
  type: 'workshop' | 'hackathon' | 'showcase';
  startTime: Date;
  endTime: Date;
  maxParticipants: number;
  isLive: boolean;
  isRecording: boolean;
  streamUrl?: string;
  presentationSlides?: PresentationSlide[];
  currentSlide: number;
}

interface VirtualEventsInterfaceProps {
  event: VirtualEvent;
  currentUser: Participant;
  participants: Participant[];
  breakoutRooms: BreakoutRoom[];
  chatMessages: ChatMessage[];
  onJoinEvent?: (eventId: string) => void;
  onLeaveEvent?: (eventId: string) => void;
  onToggleVideo?: (enabled: boolean) => void;
  onToggleMute?: (enabled: boolean) => void;
  onToggleScreenShare?: (enabled: boolean) => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onSendMessage?: (message: string) => void;
  onRaiseHand?: () => void;
  onJoinBreakoutRoom?: (roomId: string) => void;
  onLeaveBreakoutRoom?: () => void;
  onCreateBreakoutRoom?: (name: string, maxCapacity: number) => void;
  onNextSlide?: () => void;
  onPreviousSlide?: () => void;
  onGoToSlide?: (slideIndex: number) => void;
  onAddAnnotation?: (x: number, y: number, text: string) => void;
  className?: string;
}

const EventLobby: React.FC<{
  event: VirtualEvent;
  participants: Participant[];
  onJoin: () => void;
}> = ({ event, participants, onJoin }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
    <div className="mb-6">
      <Badge variant={event.isLive ? "default" : "secondary"} className="mb-4">
        {event.isLive ? 'Live Now' : 'Starting Soon'}
      </Badge>
      <h2 className="text-3xl font-bold mb-2">{event.title}</h2>
      <p className="text-muted-foreground mb-4">{event.description}</p>
      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
        <span>{event.startTime.toLocaleTimeString()}</span>
        <Separator orientation="vertical" className="h-4" />
        <span className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          {participants.length}/{event.maxParticipants}
        </span>
      </div>
    </div>
    <Button onClick={onJoin} size="lg" className="px-8">
      Join Event
    </Button>
  </div>
);

const LivestreamPlayer: React.FC<{
  streamUrl?: string;
  isLive: boolean;
  onToggleMute: (muted: boolean) => void;
}> = ({ streamUrl, isLive, onToggleMute }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    onToggleMute(newMuted);
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (!isFullscreen) {
        videoRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      {streamUrl ? (
        <video
          ref={videoRef}
          src={streamUrl}
          className="w-full h-full object-cover"
          autoPlay
          muted={isMuted}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <Radio className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Stream will start shortly</p>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <Badge variant={isLive ? "destructive" : "secondary"}>
          {isLive ? 'LIVE' : 'OFFLINE'}
        </Badge>
        
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMuteToggle}
            className="bg-black/50 hover:bg-black/70"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleFullscreen}
            className="bg-black/50 hover:bg-black/70"
          >
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const BreakoutRoomManager: React.FC<{
  rooms: BreakoutRoom[];
  currentUser: Participant;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
  onCreateRoom: (name: string, maxCapacity: number) => void;
}> = ({ rooms, currentUser, onJoinRoom, onLeaveRoom, onCreateRoom }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('8');

  const handleCreateRoom = () => {
    if (roomName.trim()) {
      onCreateRoom(roomName, parseInt(maxCapacity));
      setRoomName('');
      setIsCreating(false);
    }
  };

  const currentRoom = rooms.find(room => room.participants.some(p => p.id === currentUser.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Breakout Rooms</h3>
        {currentUser.role === 'host' && (
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Create Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Breakout Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
                <Select value={maxCapacity} onValueChange={setMaxCapacity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Max participants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 participants</SelectItem>
                    <SelectItem value="6">6 participants</SelectItem>
                    <SelectItem value="8">8 participants</SelectItem>
                    <SelectItem value="10">10 participants</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreateRoom} className="w-full">
                  Create Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {currentRoom && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current Room: {currentRoom.name}</CardTitle>
              <Button variant="outline" size="sm" onClick={onLeaveRoom}>
                <UserMinus className="w-4 h-4 mr-2" />
                Leave
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex -space-x-2">
              {currentRoom.participants.slice(0, 5).map((participant) => (
                <Avatar key={participant.id} className="w-8 h-8 border-2 border-background">
                  <AvatarImage src={participant.avatar} />
                  <AvatarFallback>{participant.name[0]}</AvatarFallback>
                </Avatar>
              ))}
              {currentRoom.participants.length > 5 && (
                <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                  +{currentRoom.participants.length - 5}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2">
        {rooms.filter(room => room.id !== currentRoom?.id).map((room) => (
          <Card key={room.id} className="cursor-pointer hover:bg-accent/50" onClick={() => onJoinRoom(room.id)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{room.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {room.participants.length}/{room.maxCapacity} participants
                  </p>
                  {room.topic && (
                    <p className="text-xs text-muted-foreground mt-1">{room.topic}</p>
                  )}
                </div>
                <div className="flex -space-x-1">
                  {room.participants.slice(0, 3).map((participant) => (
                    <Avatar key={participant.id} className="w-6 h-6 border border-background">
                      <AvatarFallback className="text-xs">{participant.name[0]}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const InteractivePresentationViewer: React.FC<{
  slides: PresentationSlide[];
  currentSlide: number;
  onNextSlide: () => void;
  onPreviousSlide: () => void;
  onAddAnnotation: (x: number, y: number, text: string) => void;
  canControl: boolean;
}> = ({ slides, currentSlide, onNextSlide, onPreviousSlide, onAddAnnotation, canControl }) => {
  const [annotationMode, setAnnotationMode] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  const handleSlideClick = (e: React.MouseEvent) => {
    if (annotationMode && slideRef.current && canControl) {
      const rect = slideRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      const annotation = prompt('Enter annotation:');
      if (annotation) {
        onAddAnnotation(x, y, annotation);
      }
      setAnnotationMode(false);
    }
  };

  const currentSlideData = slides[currentSlide];

  if (!currentSlideData) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center">
          <Presentation className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No presentation available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Presentation</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {currentSlide + 1} of {slides.length}
          </span>
          {canControl && (
            <Button
              variant={annotationMode ? "default" : "outline"}
              size="sm"
              onClick={() => setAnnotationMode(!annotationMode)}
            >
              Annotate
            </Button>
          )}
        </div>
      </div>

      <div
        ref={slideRef}
        className="relative aspect-video bg-white rounded-lg overflow-hidden border cursor-crosshair"
        onClick={handleSlideClick}
      >
        <img
          src={currentSlideData.url}
          alt={currentSlideData.title || `Slide ${currentSlide + 1}`}
          className="w-full h-full object-contain"
        />
        
        {/* Render annotations */}
        {currentSlideData.annotations?.map((annotation, index) => (
          <div
            key={index}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${annotation.x * 100}%`,
              top: `${annotation.y * 100}%`,
            }}
          >
            <div className="bg-yellow-400 text-black px-2 py-1 rounded text-sm whitespace-nowrap">
              {annotation.text}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onPreviousSlide}
          disabled={currentSlide === 0 || !canControl}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        <div className="flex items-center gap-1">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full ${
                index === currentSlide ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onNextSlide}
          disabled={currentSlide === slides.length - 1 || !canControl}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

const EventChat: React.FC<{
  messages: ChatMessage[];
  currentUser: Participant;
  onSendMessage: (message: string) => void;
}> = ({ messages, currentUser, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Event Chat</h3>
        <Badge variant="secondary">{messages.length} messages</Badge>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="flex items-start gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs">
                  {message.participantName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{message.participantName}</span>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{message.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="sm">
            Send
          </Button>
        </div>
      </form>
    </div>
  );
};

const ParticipantsList: React.FC<{
  participants: Participant[];
  currentUser: Participant;
}> = ({ participants, currentUser }) => {
  const hosts = participants.filter(p => p.role === 'host');
  const presenters = participants.filter(p => p.role === 'presenter');
  const attendees = participants.filter(p => p.role === 'attendee');

  const ParticipantItem: React.FC<{ participant: Participant }> = ({ participant }) => (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
      <div className="relative">
        <Avatar className="w-8 h-8">
          <AvatarImage src={participant.avatar} />
          <AvatarFallback>{participant.name[0]}</AvatarFallback>
        </Avatar>
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
            participant.isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{participant.name}</span>
          {participant.id === currentUser.id && (
            <Badge variant="outline" className="text-xs">You</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1">
          <Badge variant="secondary" className="text-xs">
            {participant.role}
          </Badge>
          {participant.isHandRaised && <Hand className="w-3 h-3 text-yellow-500" />}
          {!participant.isMuted && <Mic className="w-3 h-3 text-green-500" />}
          {participant.hasVideo && <Video className="w-3 h-3 text-blue-500" />}
        </div>
      </div>
    </div>
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {hosts.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Hosts</h4>
            <div className="space-y-1">
              {hosts.map((participant) => (
                <ParticipantItem key={participant.id} participant={participant} />
              ))}
            </div>
          </div>
        )}

        {presenters.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Presenters</h4>
            <div