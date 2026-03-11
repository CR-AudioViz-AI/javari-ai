```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { z } from 'zod';

// Redis client for message broker
const redis = Redis.fromEnv();

// Rate limiting
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
});

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Message schema validation
const MessageSchema = z.object({
  id: z.string().uuid().optional(),
  from: z.string().min(1),
  to: z.string().min(1).or(z.array(z.string().min(1))),
  type: z.enum(['direct', 'broadcast', 'request', 'response']),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  payload: z.record(z.any()),
  correlationId: z.string().optional(),
  ttl: z.number().min(1).max(3600).default(300), // 5 minutes default
  deliveryMode: z.enum(['at_most_once', 'at_least_once', 'exactly_once']).default('at_least_once'),
  retryCount: z.number().min(0).max(5).default(3),
});

const AgentRegistrationSchema = z.object({
  agentId: z.string().min(1),
  capabilities: z.array(z.string()),
  endpoint: z.string().url(),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active'),
});

const MessageFilterSchema = z.object({
  agentId: z.string().min(1),
  limit: z.number().min(1).max(100).default(10),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  type: z.enum(['direct', 'broadcast', 'request', 'response']).optional(),
  since: z.string().datetime().optional(),
});

type Message = z.infer<typeof MessageSchema>;
type AgentRegistration = z.infer<typeof AgentRegistrationSchema>;
type MessageFilter = z.infer<typeof MessageFilterSchema>;

interface DeliveryReceipt {
  messageId: string;
  agentId: string;
  status: 'delivered' | 'failed' | 'acknowledged';
  timestamp: string;
  error?: string;
}

class MessageBroker {
  private readonly PRIORITY_WEIGHTS = {
    low: 1,
    normal: 2,
    high: 3,
    critical: 4,
  };

  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

  async sendMessage(message: Message): Promise<{ messageId: string; status: string }> {
    const messageId = message.id || crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    const enrichedMessage = {
      ...message,
      id: messageId,
      timestamp,
      attempts: 0,
    };

    try {
      // Persist message to Supabase
      const { error: dbError } = await supabase
        .from('agent_messages')
        .insert({
          id: messageId,
          from_agent: message.from,
          to_agent: Array.isArray(message.to) ? message.to.join(',') : message.to,
          message_type: message.type,
          priority: message.priority,
          payload: message.payload,
          correlation_id: message.correlationId,
          ttl: message.ttl,
          delivery_mode: message.deliveryMode,
          retry_count: message.retryCount,
          status: 'queued',
          created_at: timestamp,
        });

      if (dbError) {
        console.error('Failed to persist message:', dbError);
      }

      // Add to priority queue
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      
      for (const recipient of recipients) {
        const queueKey = `agent:queue:${recipient}`;
        const priority = this.PRIORITY_WEIGHTS[message.priority];
        
        await redis.zadd(queueKey, {
          score: Date.now() + (priority * 1000000), // Priority + timestamp
          member: JSON.stringify(enrichedMessage),
        });

        // Set TTL for the queue entry
        await redis.expire(queueKey, message.ttl);
      }

      // Publish to real-time subscribers
      await this.publishToSubscribers(enrichedMessage);

      return { messageId, status: 'queued' };
    } catch (error) {
      console.error('Message broker error:', error);
      throw new Error('Failed to process message');
    }
  }

  async getMessages(filter: MessageFilter): Promise<Message[]> {
    const queueKey = `agent:queue:${filter.agentId}`;
    
    try {
      // Get messages from priority queue
      const messages = await redis.zrevrange(queueKey, 0, filter.limit - 1);
      
      const parsedMessages = messages
        .map(msg => {
          try {
            return JSON.parse(msg);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .filter(msg => {
          if (filter.priority && msg.priority !== filter.priority) return false;
          if (filter.type && msg.type !== filter.type) return false;
          if (filter.since && msg.timestamp < filter.since) return false;
          return true;
        });

      return parsedMessages;
    } catch (error) {
      console.error('Error retrieving messages:', error);
      return [];
    }
  }

  async acknowledgeMessage(messageId: string, agentId: string): Promise<void> {
    try {
      // Remove from queue
      const queueKey = `agent:queue:${agentId}`;
      const messages = await redis.zrange(queueKey, 0, -1);
      
      for (const msgStr of messages) {
        const msg = JSON.parse(msgStr);
        if (msg.id === messageId) {
          await redis.zrem(queueKey, msgStr);
          break;
        }
      }

      // Update delivery status
      await supabase
        .from('agent_messages')
        .update({ 
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      // Record delivery receipt
      const receipt: DeliveryReceipt = {
        messageId,
        agentId,
        status: 'acknowledged',
        timestamp: new Date().toISOString(),
      };

      await redis.lpush(`receipts:${messageId}`, JSON.stringify(receipt));
      await redis.expire(`receipts:${messageId}`, 86400); // 24 hours

    } catch (error) {
      console.error('Error acknowledging message:', error);
      throw new Error('Failed to acknowledge message');
    }
  }

  async registerAgent(registration: AgentRegistration): Promise<void> {
    try {
      const { error } = await supabase
        .from('agent_registry')
        .upsert({
          agent_id: registration.agentId,
          capabilities: registration.capabilities,
          endpoint: registration.endpoint,
          status: registration.status,
          last_seen: new Date().toISOString(),
        });

      if (error) throw error;

      // Cache in Redis for fast lookup
      await redis.hset(`agent:${registration.agentId}`, {
        capabilities: JSON.stringify(registration.capabilities),
        endpoint: registration.endpoint,
        status: registration.status,
        lastSeen: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error registering agent:', error);
      throw new Error('Failed to register agent');
    }
  }

  private async publishToSubscribers(message: Message): Promise<void> {
    try {
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      
      for (const recipient of recipients) {
        await redis.publish(`agent:${recipient}:messages`, JSON.stringify(message));
      }

      if (message.type === 'broadcast') {
        await redis.publish('agent:broadcast', JSON.stringify(message));
      }
    } catch (error) {
      console.error('Error publishing to subscribers:', error);
    }
  }

  async getAgentStatus(agentId: string): Promise<any> {
    try {
      const cached = await redis.hgetall(`agent:${agentId}`);
      if (Object.keys(cached).length > 0) {
        return {
          agentId,
          ...cached,
          capabilities: JSON.parse(cached.capabilities || '[]'),
        };
      }

      const { data } = await supabase
        .from('agent_registry')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      return data;
    } catch (error) {
      console.error('Error getting agent status:', error);
      return null;
    }
  }

  async handleFailedDelivery(messageId: string, agentId: string, error: string): Promise<void> {
    try {
      const queueKey = `agent:queue:${agentId}`;
      const retryQueueKey = `agent:retry:${agentId}`;
      
      // Find and move message to retry queue
      const messages = await redis.zrange(queueKey, 0, -1);
      
      for (const msgStr of messages) {
        const msg = JSON.parse(msgStr);
        if (msg.id === messageId) {
          msg.attempts = (msg.attempts || 0) + 1;
          
          if (msg.attempts >= this.MAX_RETRY_ATTEMPTS) {
            // Move to dead letter queue
            await redis.lpush(`agent:dlq:${agentId}`, JSON.stringify({
              ...msg,
              error,
              failedAt: new Date().toISOString(),
            }));
          } else {
            // Schedule retry with exponential backoff
            const delay = this.RETRY_DELAYS[msg.attempts - 1] || 16000;
            const retryTime = Date.now() + delay;
            
            await redis.zadd(retryQueueKey, {
              score: retryTime,
              member: JSON.stringify(msg),
            });
          }
          
          await redis.zrem(queueKey, msgStr);
          break;
        }
      }

      // Record failure receipt
      const receipt: DeliveryReceipt = {
        messageId,
        agentId,
        status: 'failed',
        timestamp: new Date().toISOString(),
        error,
      };

      await redis.lpush(`receipts:${messageId}`, JSON.stringify(receipt));

    } catch (err) {
      console.error('Error handling failed delivery:', err);
    }
  }
}

const broker = new MessageBroker();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { success } = await ratelimit.limit(
      request.ip ?? request.headers.get('x-forwarded-for') ?? 'anonymous'
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'send': {
        const body = await request.json();
        const message = MessageSchema.parse(body);
        const result = await broker.sendMessage(message);
        return NextResponse.json(result);
      }

      case 'register': {
        const body = await request.json();
        const registration = AgentRegistrationSchema.parse(body);
        await broker.registerAgent(registration);
        return NextResponse.json({ status: 'registered' });
      }

      case 'acknowledge': {
        const { messageId, agentId } = await request.json();
        if (!messageId || !agentId) {
          return NextResponse.json(
            { error: 'Missing messageId or agentId' },
            { status: 400 }
          );
        }
        await broker.acknowledgeMessage(messageId, agentId);
        return NextResponse.json({ status: 'acknowledged' });
      }

      case 'failed': {
        const { messageId, agentId, error } = await request.json();
        if (!messageId || !agentId || !error) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }
        await broker.handleFailedDelivery(messageId, agentId, error);
        return NextResponse.json({ status: 'handled' });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Message broker API error:', error);
    
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { success } = await ratelimit.limit(
      request.ip ?? request.headers.get('x-forwarded-for') ?? 'anonymous'
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'messages': {
        const filter = MessageFilterSchema.parse({
          agentId: url.searchParams.get('agentId'),
          limit: Number(url.searchParams.get('limit')) || 10,
          priority: url.searchParams.get('priority') || undefined,
          type: url.searchParams.get('type') || undefined,
          since: url.searchParams.get('since') || undefined,
        });
        
        const messages = await broker.getMessages(filter);
        return NextResponse.json({ messages });
      }

      case 'status': {
        const agentId = url.searchParams.get('agentId');
        if (!agentId) {
          return NextResponse.json(
            { error: 'Missing agentId' },
            { status: 400 }
          );
        }
        
        const status = await broker.getAgentStatus(agentId);
        return NextResponse.json({ status });
      }

      case 'health': {
        // Health check endpoint
        try {
          await redis.ping();
          const { data, error } = await supabase.from('agent_registry').select('count').limit(1);
          
          return NextResponse.json({
            status: 'healthy',
            redis: 'connected',
            supabase: error ? 'error' : 'connected',
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          return NextResponse.json({
            status: 'unhealthy',
            error: 'Service connectivity issues',
          }, { status: 503 });
        }
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Message broker GET error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const agentId = url.searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agentId' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'unregister': {
        // Remove agent from registry
        await supabase
          .from('agent_registry')
          .delete()
          .eq('agent_id', agentId);

        // Clear Redis cache
        await redis.del(`agent:${agentId}`);
        
        // Clear queues
        await redis.del(`agent:queue:${agentId}`);
        await redis.del(`agent:retry:${agentId}`);
        await redis.del(`agent:dlq:${agentId}`);

        return NextResponse.json({ status: 'unregistered' });
      }

      case 'clear-queue': {
        await redis.del(`agent:queue:${agentId}`);
        return NextResponse.json({ status: 'queue cleared' });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Message broker DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```