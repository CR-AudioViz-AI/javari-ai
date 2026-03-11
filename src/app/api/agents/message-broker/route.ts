import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { ratelimit } from '@/lib/rate-limit';

// Validation schemas
const MessageSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['direct', 'broadcast', 'subscribe', 'unsubscribe', 'ack']),
  from: z.string().min(1, 'Sender agent ID required'),
  to: z.string().optional(),
  channel: z.string().optional(),
  payload: z.record(z.any()),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  ttl: z.number().positive().optional(),
  requiresAck: z.boolean().default(false),
  metadata: z.record(z.any()).optional()
});

const SubscriptionSchema = z.object({
  agentId: z.string().min(1),
  channels: z.array(z.string().min(1)),
  filters: z.record(z.any()).optional()
});

// Types
type Message = z.infer<typeof MessageSchema>;
type Subscription = z.infer<typeof SubscriptionSchema>;

interface MessageDelivery {
  messageId: string;
  agentId: string;
  attempts: number;
  lastAttempt: Date;
  status: 'pending' | 'delivered' | 'failed' | 'expired';
  nextRetry?: Date;
}

interface AgentConnection {
  agentId: string;
  connectionId: string;
  lastSeen: Date;
  status: 'online' | 'offline' | 'busy';
  subscriptions: string[];
}

class MessageBroker {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  private redis = new Redis(process.env.REDIS_URL!);
  private connections = new Map<string, AgentConnection>();
  private messageQueues = new Map<string, Message[]>();
  private deliveryTracking = new Map<string, MessageDelivery>();
  
  // Message routing and delivery
  async routeMessage(message: Message): Promise<{ success: boolean; deliveryIds: string[] }> {
    try {
      const messageId = message.id || crypto.randomUUID();
      const enrichedMessage = { ...message, id: messageId, timestamp: new Date().toISOString() };
      
      // Persist message
      await this.persistMessage(enrichedMessage);
      
      // Determine recipients
      const recipients = await this.getRecipients(enrichedMessage);
      const deliveryIds: string[] = [];
      
      // Route to recipients
      for (const recipientId of recipients) {
        const deliveryId = await this.enqueueMessage(enrichedMessage, recipientId);
        deliveryIds.push(deliveryId);
        
        // Attempt immediate delivery if agent is online
        if (this.isAgentOnline(recipientId)) {
          await this.deliverMessage(enrichedMessage, recipientId);
        }
      }
      
      // Update metrics
      await this.updateMetrics('message_routed', {
        messageId,
        recipientCount: recipients.length,
        messageType: message.type
      });
      
      return { success: true, deliveryIds };
    } catch (error) {
      console.error('Message routing failed:', error);
      throw new Error('Failed to route message');
    }
  }
  
  // Direct message handling
  async handleDirectMessage(message: Message): Promise<boolean> {
    if (!message.to) {
      throw new Error('Direct message requires recipient');
    }
    
    // Validate recipient exists
    const recipientExists = await this.validateAgent(message.to);
    if (!recipientExists) {
      throw new Error('Recipient agent not found');
    }
    
    // Check if recipient is online
    if (this.isAgentOnline(message.to)) {
      return await this.deliverMessage(message, message.to);
    } else {
      // Queue for later delivery
      await this.enqueueMessage(message, message.to);
      return true;
    }
  }
  
  // Pub/Sub management
  async handleSubscription(subscription: Subscription): Promise<boolean> {
    try {
      // Update agent subscriptions
      const connection = this.connections.get(subscription.agentId);
      if (connection) {
        connection.subscriptions = [...new Set([...connection.subscriptions, ...subscription.channels])];
        this.connections.set(subscription.agentId, connection);
      }
      
      // Persist subscription
      await this.supabase
        .from('agent_subscriptions')
        .upsert({
          agent_id: subscription.agentId,
          channels: subscription.channels,
          filters: subscription.filters,
          updated_at: new Date().toISOString()
        });
      
      // Subscribe to Redis channels
      for (const channel of subscription.channels) {
        await this.redis.sadd(`channel:${channel}:subscribers`, subscription.agentId);
      }
      
      return true;
    } catch (error) {
      console.error('Subscription failed:', error);
      return false;
    }
  }
  
  async handleUnsubscribe(agentId: string, channels: string[]): Promise<boolean> {
    try {
      const connection = this.connections.get(agentId);
      if (connection) {
        connection.subscriptions = connection.subscriptions.filter(
          sub => !channels.includes(sub)
        );
        this.connections.set(agentId, connection);
      }
      
      // Remove from Redis channels
      for (const channel of channels) {
        await this.redis.srem(`channel:${channel}:subscribers`, agentId);
      }
      
      // Update database
      await this.supabase
        .from('agent_subscriptions')
        .update({
          channels: connection?.subscriptions || [],
          updated_at: new Date().toISOString()
        })
        .eq('agent_id', agentId);
      
      return true;
    } catch (error) {
      console.error('Unsubscribe failed:', error);
      return false;
    }
  }
  
  // Message delivery
  async deliverMessage(message: Message, recipientId: string): Promise<boolean> {
    try {
      // Send via Supabase Realtime
      await this.supabase
        .channel(`agent:${recipientId}`)
        .send({
          type: 'broadcast',
          event: 'message',
          payload: message
        });
      
      // Track delivery
      const deliveryId = crypto.randomUUID();
      this.deliveryTracking.set(deliveryId, {
        messageId: message.id!,
        agentId: recipientId,
        attempts: 1,
        lastAttempt: new Date(),
        status: 'delivered'
      });
      
      // Store delivery record
      await this.supabase
        .from('message_deliveries')
        .insert({
          id: deliveryId,
          message_id: message.id,
          agent_id: recipientId,
          status: 'delivered',
          delivered_at: new Date().toISOString()
        });
      
      return true;
    } catch (error) {
      console.error('Message delivery failed:', error);
      await this.handleDeliveryFailure(message, recipientId);
      return false;
    }
  }
  
  // Queue management
  async enqueueMessage(message: Message, recipientId: string): Promise<string> {
    const deliveryId = crypto.randomUUID();
    const queueKey = `queue:${recipientId}`;
    
    // Add to Redis queue with priority
    const priority = this.getPriorityScore(message.priority);
    await this.redis.zadd(queueKey, priority, JSON.stringify({
      deliveryId,
      message,
      enqueuedAt: new Date().toISOString()
    }));
    
    // Track delivery
    this.deliveryTracking.set(deliveryId, {
      messageId: message.id!,
      agentId: recipientId,
      attempts: 0,
      lastAttempt: new Date(),
      status: 'pending'
    });
    
    return deliveryId;
  }
  
  async processMessageQueue(agentId: string): Promise<number> {
    const queueKey = `queue:${agentId}`;
    const messages = await this.redis.zrevrange(queueKey, 0, 9, 'WITHSCORES');
    
    let processedCount = 0;
    
    for (let i = 0; i < messages.length; i += 2) {
      try {
        const messageData = JSON.parse(messages[i]);
        const delivered = await this.deliverMessage(messageData.message, agentId);
        
        if (delivered) {
          await this.redis.zrem(queueKey, messages[i]);
          processedCount++;
        }
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }
    
    return processedCount;
  }
  
  // Connection management
  registerAgentConnection(agentId: string, connectionId: string): void {
    this.connections.set(agentId, {
      agentId,
      connectionId,
      lastSeen: new Date(),
      status: 'online',
      subscriptions: []
    });
    
    // Process pending messages
    this.processMessageQueue(agentId);
  }
  
  unregisterAgentConnection(agentId: string): void {
    const connection = this.connections.get(agentId);
    if (connection) {
      connection.status = 'offline';
      this.connections.set(agentId, connection);
    }
  }
  
  isAgentOnline(agentId: string): boolean {
    const connection = this.connections.get(agentId);
    return connection?.status === 'online';
  }
  
  // Helper methods
  private async getRecipients(message: Message): Promise<string[]> {
    if (message.type === 'direct' && message.to) {
      return [message.to];
    }
    
    if (message.type === 'broadcast' && message.channel) {
      const subscribers = await this.redis.smembers(`channel:${message.channel}:subscribers`);
      return subscribers.filter(sub => sub !== message.from);
    }
    
    return [];
  }
  
  private async persistMessage(message: Message): Promise<void> {
    await this.supabase
      .from('agent_messages')
      .insert({
        id: message.id,
        type: message.type,
        from_agent: message.from,
        to_agent: message.to,
        channel: message.channel,
        payload: message.payload,
        priority: message.priority,
        ttl: message.ttl,
        requires_ack: message.requiresAck,
        metadata: message.metadata,
        created_at: new Date().toISOString()
      });
  }
  
  private async validateAgent(agentId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single();
    
    return !!data;
  }
  
  private getPriorityScore(priority: string): number {
    const scores = { low: 1, normal: 2, high: 3, critical: 4 };
    return scores[priority as keyof typeof scores] || 2;
  }
  
  private async handleDeliveryFailure(message: Message, recipientId: string): Promise<void> {
    // Implement retry logic with exponential backoff
    const maxRetries = 3;
    const delivery = Array.from(this.deliveryTracking.values())
      .find(d => d.messageId === message.id && d.agentId === recipientId);
    
    if (delivery && delivery.attempts < maxRetries) {
      delivery.attempts++;
      delivery.nextRetry = new Date(Date.now() + Math.pow(2, delivery.attempts) * 1000);
      delivery.status = 'pending';
      
      // Re-enqueue for retry
      setTimeout(() => {
        this.deliverMessage(message, recipientId);
      }, Math.pow(2, delivery.attempts) * 1000);
    } else if (delivery) {
      delivery.status = 'failed';
      // Move to dead letter queue
      await this.redis.lpush('dead_letter_queue', JSON.stringify({
        message,
        recipientId,
        failedAt: new Date().toISOString()
      }));
    }
  }
  
  private async updateMetrics(event: string, data: any): Promise<void> {
    await this.redis.hincrby('message_broker_metrics', event, 1);
    await this.redis.lpush(`metrics:${event}`, JSON.stringify({
      ...data,
      timestamp: new Date().toISOString()
    }));
  }
}

const messageBroker = new MessageBroker();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success, remaining } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
    
    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const message = MessageSchema.parse(body);
    
    // Route message based on type
    let result;
    switch (message.type) {
      case 'direct':
        const delivered = await messageBroker.handleDirectMessage(message);
        result = { delivered, messageId: message.id };
        break;
        
      case 'broadcast':
        const routeResult = await messageBroker.routeMessage(message);
        result = routeResult;
        break;
        
      default:
        throw new Error(`Unsupported message type: ${message.type}`);
    }
    
    return NextResponse.json({
      success: true,
      data: result,
      remaining
    });
    
  } catch (error) {
    console.error('Message broker error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    const { action, ...data } = body;
    
    let result;
    switch (action) {
      case 'subscribe':
        const subscription = SubscriptionSchema.parse(data);
        result = await messageBroker.handleSubscription(subscription);
        break;
        
      case 'unsubscribe':
        const { agentId, channels } = data;
        result = await messageBroker.handleUnsubscribe(agentId, channels);
        break;
        
      case 'connect':
        const { agentId, connectionId } = data;
        messageBroker.registerAgentConnection(agentId, connectionId);
        result = { connected: true };
        break;
        
      case 'disconnect':
        messageBroker.unregisterAgentConnection(data.agentId);
        result = { disconnected: true };
        break;
        
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Message broker action error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const action = searchParams.get('action');
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID required' },
        { status: 400 }
      );
    }
    
    let result;
    switch (action) {
      case 'queue':
        const queueCount = await messageBroker.processMessageQueue(agentId);
        result = { processed: queueCount };
        break;
        
      case 'status':
        const isOnline = messageBroker.isAgentOnline(agentId);
        result = { online: isOnline };
        break;
        
      default:
        result = { agentId, status: 'active' };
    }
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Message broker GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}