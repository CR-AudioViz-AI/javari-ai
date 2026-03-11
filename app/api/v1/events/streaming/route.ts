```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import Pusher from 'pusher';

// Validation schemas
const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime(),
  duration: z.number().min(5).max(480), // 5 minutes to 8 hours
  maxParticipants: z.number().min(1).max(10000),
  isPrivate: z.boolean().default(false),
  features: z.object({
    chat: z.boolean().default(true),
    polls: z.boolean().default(false),
    handRaise: z.boolean().default(false),
    breakoutRooms: z.boolean().default(false),
    recording: z.boolean().default(false),
    screenShare: z.boolean().default(false)
  }).optional()
});

const joinEventSchema = z.object({
  eventId: z.string().uuid(),
  displayName: z.string().min(1).max(50),
  role: z.enum(['host', 'presenter', 'participant']).default('participant')
});

const streamActionSchema = z.object({
  action: z.enum(['start', 'stop', 'pause', 'resume', 'updateQuality']),
  eventId: z.string().uuid(),
  streamId: z.string().optional(),
  quality: z.enum(['360p', '720p', '1080p']).optional()
});

const interactionSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum(['chat', 'poll', 'handRaise', 'reaction']),
  data: z.record(z.any())
});

// Initialize services
const redis = new Redis(process.env.REDIS_URL!);
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true
});

interface StreamingEvent {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  scheduledAt: string;
  duration: number;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  maxParticipants: number;
  currentParticipants: number;
  isPrivate: boolean;
  features: {
    chat: boolean;
    polls: boolean;
    handRaise: boolean;
    breakoutRooms: boolean;
    recording: boolean;
    screenShare: boolean;
  };
  streams: StreamInfo[];
  createdAt: string;
  updatedAt: string;
}

interface StreamInfo {
  id: string;
  userId: string;
  type: 'main' | 'screen' | 'camera';
  quality: string;
  isActive: boolean;
  viewerCount: number;
  rtmpUrl?: string;
  hlsUrl?: string;
}

interface Participant {
  id: string;
  userId: string;
  eventId: string;
  displayName: string;
  role: 'host' | 'presenter' | 'participant';
  isOnline: boolean;
  joinedAt: string;
  handRaised: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
}

class StreamingEventManager {
  constructor(private supabase: any, private redis: Redis) {}

  async createEvent(hostId: string, eventData: any): Promise<StreamingEvent> {
    const eventId = randomUUID();
    const now = new Date().toISOString();

    const event: StreamingEvent = {
      id: eventId,
      title: eventData.title,
      description: eventData.description,
      hostId,
      scheduledAt: eventData.scheduledAt,
      duration: eventData.duration,
      status: 'scheduled',
      maxParticipants: eventData.maxParticipants,
      currentParticipants: 0,
      isPrivate: eventData.isPrivate,
      features: {
        chat: true,
        polls: false,
        handRaise: false,
        breakoutRooms: false,
        recording: false,
        screenShare: false,
        ...eventData.features
      },
      streams: [],
      createdAt: now,
      updatedAt: now
    };

    // Store in Supabase
    await this.supabase
      .from('streaming_events')
      .insert(event);

    // Cache in Redis
    await this.redis.setex(
      `event:${eventId}`,
      3600 * 24, // 24 hours
      JSON.stringify(event)
    );

    return event;
  }

  async getEvent(eventId: string): Promise<StreamingEvent | null> {
    try {
      // Try Redis first
      const cached = await this.redis.get(`event:${eventId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to Supabase
      const { data, error } = await this.supabase
        .from('streaming_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error || !data) return null;

      // Update cache
      await this.redis.setex(
        `event:${eventId}`,
        3600 * 24,
        JSON.stringify(data)
      );

      return data;
    } catch (error) {
      console.error('Error getting event:', error);
      return null;
    }
  }

  async updateEventStatus(eventId: string, status: StreamingEvent['status']): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) throw new Error('Event not found');

    event.status = status;
    event.updatedAt = new Date().toISOString();

    // Update in Supabase
    await this.supabase
      .from('streaming_events')
      .update({ status, updatedAt: event.updatedAt })
      .eq('id', eventId);

    // Update cache
    await this.redis.setex(
      `event:${eventId}`,
      3600 * 24,
      JSON.stringify(event)
    );

    // Broadcast status change
    await pusher.trigger(`event-${eventId}`, 'status-changed', {
      status,
      timestamp: event.updatedAt
    });
  }
}

class MultiStreamController {
  constructor(private redis: Redis, private pusher: Pusher) {}

  async createStream(eventId: string, userId: string, type: 'main' | 'screen' | 'camera'): Promise<StreamInfo> {
    const streamId = randomUUID();
    const stream: StreamInfo = {
      id: streamId,
      userId,
      type,
      quality: '720p',
      isActive: false,
      viewerCount: 0,
      rtmpUrl: `rtmp://stream.audioviz.ai/live/${streamId}`,
      hlsUrl: `https://stream.audioviz.ai/hls/${streamId}/playlist.m3u8`
    };

    // Store stream info
    await this.redis.hset(
      `event:${eventId}:streams`,
      streamId,
      JSON.stringify(stream)
    );

    // Broadcast new stream
    await this.pusher.trigger(`event-${eventId}`, 'stream-created', {
      streamId,
      userId,
      type,
      urls: {
        rtmp: stream.rtmpUrl,
        hls: stream.hlsUrl
      }
    });

    return stream;
  }

  async updateStreamStatus(eventId: string, streamId: string, isActive: boolean): Promise<void> {
    const streamData = await this.redis.hget(`event:${eventId}:streams`, streamId);
    if (!streamData) throw new Error('Stream not found');

    const stream: StreamInfo = JSON.parse(streamData);
    stream.isActive = isActive;

    await this.redis.hset(
      `event:${eventId}:streams`,
      streamId,
      JSON.stringify(stream)
    );

    // Broadcast stream status
    await this.pusher.trigger(`event-${eventId}`, 'stream-status', {
      streamId,
      isActive,
      timestamp: new Date().toISOString()
    });
  }

  async updateViewerCount(eventId: string, streamId: string, count: number): Promise<void> {
    const streamData = await this.redis.hget(`event:${eventId}:streams`, streamId);
    if (!streamData) return;

    const stream: StreamInfo = JSON.parse(streamData);
    stream.viewerCount = count;

    await this.redis.hset(
      `event:${eventId}:streams`,
      streamId,
      JSON.stringify(stream)
    );
  }
}

class AudienceEngagementTracker {
  constructor(private redis: Redis, private pusher: Pusher) {}

  async joinEvent(eventId: string, userId: string, displayName: string, role: string): Promise<Participant> {
    const participant: Participant = {
      id: randomUUID(),
      userId,
      eventId,
      displayName: displayName.trim(),
      role: role as any,
      isOnline: true,
      joinedAt: new Date().toISOString(),
      handRaised: false,
      isMuted: true,
      isVideoOff: true
    };

    // Store participant
    await this.redis.hset(
      `event:${eventId}:participants`,
      userId,
      JSON.stringify(participant)
    );

    // Update participant count
    await this.redis.hincrby(`event:${eventId}:stats`, 'currentParticipants', 1);

    // Broadcast join
    await this.pusher.trigger(`event-${eventId}`, 'participant-joined', {
      participant: {
        id: participant.id,
        displayName: participant.displayName,
        role: participant.role,
        joinedAt: participant.joinedAt
      }
    });

    return participant;
  }

  async leaveEvent(eventId: string, userId: string): Promise<void> {
    // Remove participant
    await this.redis.hdel(`event:${eventId}:participants`, userId);

    // Update participant count
    await this.redis.hincrby(`event:${eventId}:stats`, 'currentParticipants', -1);

    // Broadcast leave
    await this.pusher.trigger(`event-${eventId}`, 'participant-left', {
      userId,
      timestamp: new Date().toISOString()
    });
  }

  async raiseHand(eventId: string, userId: string): Promise<void> {
    const participantData = await this.redis.hget(`event:${eventId}:participants`, userId);
    if (!participantData) throw new Error('Participant not found');

    const participant: Participant = JSON.parse(participantData);
    participant.handRaised = !participant.handRaised;

    await this.redis.hset(
      `event:${eventId}:participants`,
      userId,
      JSON.stringify(participant)
    );

    // Broadcast hand raise
    await this.pusher.trigger(`event-${eventId}`, 'hand-raised', {
      userId,
      displayName: participant.displayName,
      handRaised: participant.handRaised,
      timestamp: new Date().toISOString()
    });
  }

  async sendReaction(eventId: string, userId: string, reaction: string): Promise<void> {
    const participantData = await this.redis.hget(`event:${eventId}:participants`, userId);
    if (!participantData) throw new Error('Participant not found');

    const participant: Participant = JSON.parse(participantData);

    // Broadcast reaction
    await this.pusher.trigger(`event-${eventId}`, 'reaction', {
      userId,
      displayName: participant.displayName,
      reaction,
      timestamp: new Date().toISOString()
    });

    // Track reaction stats
    await this.redis.hincrby(`event:${eventId}:reactions`, reaction, 1);
  }
}

class EventChatManager {
  constructor(private redis: Redis, private pusher: Pusher, private supabase: any) {}

  async sendMessage(eventId: string, userId: string, message: string): Promise<void> {
    // Get participant info
    const participantData = await this.redis.hget(`event:${eventId}:participants`, userId);
    if (!participantData) throw new Error('Participant not found');

    const participant: Participant = JSON.parse(participantData);

    // Validate and sanitize message
    const sanitizedMessage = message.trim().substring(0, 500);
    if (!sanitizedMessage) return;

    const chatMessage = {
      id: randomUUID(),
      eventId,
      userId,
      displayName: participant.displayName,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      isFromHost: participant.role === 'host'
    };

    // Store in Supabase for persistence
    await this.supabase
      .from('event_chat_messages')
      .insert(chatMessage);

    // Store recent messages in Redis
    await this.redis.lpush(
      `event:${eventId}:chat`,
      JSON.stringify(chatMessage)
    );
    await this.redis.ltrim(`event:${eventId}:chat`, 0, 99); // Keep last 100 messages

    // Broadcast message
    await this.pusher.trigger(`event-${eventId}`, 'chat-message', chatMessage);
  }

  async getChatHistory(eventId: string): Promise<any[]> {
    const messages = await this.redis.lrange(`event:${eventId}:chat`, 0, -1);
    return messages.map(msg => JSON.parse(msg)).reverse();
  }
}

// POST - Create event or join event
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'create';
    const body = await request.json();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventManager = new StreamingEventManager(supabase, redis);
    const engagementTracker = new AudienceEngagementTracker(redis, pusher);

    switch (action) {
      case 'create':
        const eventData = createEventSchema.parse(body);
        const event = await eventManager.createEvent(user.id, eventData);
        
        return NextResponse.json({
          success: true,
          event,
          message: 'Event created successfully'
        }, { status: 201 });

      case 'join':
        const joinData = joinEventSchema.parse(body);
        const participant = await engagementTracker.joinEvent(
          joinData.eventId,
          user.id,
          joinData.displayName,
          joinData.role
        );
        
        return NextResponse.json({
          success: true,
          participant,
          message: 'Joined event successfully'
        });

      case 'stream':
        const streamData = streamActionSchema.parse(body);
        const streamController = new MultiStreamController(redis, pusher);
        
        switch (streamData.action) {
          case 'start':
            const stream = await streamController.createStream(
              streamData.eventId,
              user.id,
              'main'
            );
            await streamController.updateStreamStatus(streamData.eventId, stream.id, true);
            await eventManager.updateEventStatus(streamData.eventId, 'live');
            
            return NextResponse.json({
              success: true,
              stream,
              message: 'Stream started successfully'
            });

          case 'stop':
            if (streamData.streamId) {
              await streamController.updateStreamStatus(streamData.eventId, streamData.streamId, false);
              await eventManager.updateEventStatus(streamData.eventId, 'ended');
            }
            
            return NextResponse.json({
              success: true,
              message: 'Stream stopped successfully'
            });

          default:
            return NextResponse.json(
              { error: 'Invalid stream action' },
              { status: 400 }
            );
        }

      case 'interact':
        const interactionData = interactionSchema.parse(body);
        
        switch (interactionData.type) {
          case 'chat':
            const chatManager = new EventChatManager(redis, pusher, supabase);
            await chatManager.sendMessage(
              interactionData.eventId,
              user.id,
              interactionData.data.message
            );
            break;

          case 'handRaise':
            await engagementTracker.raiseHand(interactionData.eventId, user.id);
            break;

          case 'reaction':
            await engagementTracker.sendReaction(
              interactionData.eventId,
              user.id,
              interactionData.data.reaction
            );
            break;
        }
        
        return NextResponse.json({
          success: true,
          message: 'Interaction processed successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Streaming API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get event details or list events
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const action = searchParams.get('action') || 'details';

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventManager = new StreamingEventManager(supabase, redis);

    switch (action) {
      case 'details':
        if (!eventId) {
          return NextResponse.json(
            { error: 'Event ID is required' },
            { status: 400 }
          );
        }

        const event = await eventManager.getEvent(eventId);
        if (!event) {
          return NextResponse.json(
            { error: 'Event not found' },
            { status: 404 }
          );
        }

        // Get current participants
        const participants = await redis.hgetall(`event:${eventId}:participants`);
        const participantList = Object.values(participants).map(p => JSON.parse(p));

        // Get chat history
        const chatManager = new EventChatManager(redis, pusher, supabase);
        const chatHistory = await chatManager.getChatHistory(eventId);

        return NextResponse.json({
          success: true,
          event,
          participants: participantList,
          chatHistory
        });

      case 'list':
        const { data: events, error } = await supabase
          .from('streaming_events')
          .select('*')
          .or(`hostId.eq.${user.id},isPrivate.eq.false`)
          .order('scheduledAt', { ascending: true })
          .limit(50);

        if (error) throw error;

        return NextResponse.json({
          success: true,
          events
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Streaming GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Leave event or cancel event
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const action = searchParams.get('action') || 'leave';

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventManager = new StreamingEventManager(supabase, redis);
    const engagementTracker = new AudienceEngagementTracker(redis, pusher);

    switch (action) {
      case 'leave':
        await engagementTracker.leaveEvent(eventId, user.id);
        
        return NextResponse.json({
          success: true,
          message: 'Left event successfully'
        });

      case 'cancel':
        const event = await eventManager.getEvent(eventId);
        if (!event) {
          return NextResponse.json(
            { error: 'Event not found' },
            { status: 404 }
          );