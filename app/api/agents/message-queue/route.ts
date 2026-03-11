```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { verifyAgentToken } from '@/lib/auth/agent-auth';

// Validation schemas
const SendMessageSchema = z.object({
  targetAgentId: z.string().min(1).max(100).optional(),
  broadcast: z.boolean().default(false),
  messageType: z.enum(['task', 'status', 'data', 'control', 'broadcast']),
  payload: z.record(z.any()),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  ttl: z.number().int().min(60).max(86400).default(3600), // 1 hour default
  requiresAck: z.boolean().default(true),
  retryCount: z.number().int().min(0).max(5).default(3)
});

const ConsumeMessageSchema = z.object({
  count: z.number().int().min(1).max(100).default(10),
  block: z.number().int().min(0).max(30000).default(5000) // 5 seconds
});

const AckMessageSchema = z.object({
  messageId: z.string().min(1),
  status: z.enum(['success', 'failed', 'retry'])
});

// Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST!,
  port: parseInt(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MessagePayload {
  id: string;
  fromAgentId: string;
  targetAgentId?: string;
  messageType: string;
  payload: Record<string, any>;
  priority: string;
  timestamp: number;
  ttl: number;
  requiresAck: boolean;
  retryCount: number;
  attempts: number;
}

class RedisStreamManager {
  private static getStreamKey(agentId: string): string {
    return `agent:queue:${agentId}`;
  }

  private static getConsumerGroup(agentId: string): string {
    return `${agentId}:consumers`;
  }

  private static getDeadLetterKey(agentId: string): string {
    return `agent:dlq:${agentId}`;
  }

  static async ensureConsumerGroup(agentId: string): Promise<void> {
    const streamKey = this.getStreamKey(agentId);
    const groupName = this.getConsumerGroup(agentId);
    
    try {
      await redis.xgroup('CREATE', streamKey, groupName, '0', 'MKSTREAM');
    } catch (error: any) {
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  static async addMessage(agentId: string, message: MessagePayload): Promise<string> {
    const streamKey = this.getStreamKey(agentId);
    await this.ensureConsumerGroup(agentId);
    
    const messageId = await redis.xadd(
      streamKey,
      '*',
      'data', JSON.stringify(message),
      'priority', message.priority,
      'timestamp', message.timestamp.toString()
    );

    // Set TTL for the entire stream if configured
    if (message.ttl > 0) {
      await redis.expire(streamKey, message.ttl);
    }

    return messageId;
  }

  static async consumeMessages(agentId: string, count: number, blockTime: number): Promise<any[]> {
    const streamKey = this.getStreamKey(agentId);
    const groupName = this.getConsumerGroup(agentId);
    const consumerName = `consumer:${agentId}:${Date.now()}`;

    await this.ensureConsumerGroup(agentId);

    const messages = await redis.xreadgroup(
      'GROUP', groupName, consumerName,
      'COUNT', count,
      'BLOCK', blockTime,
      'STREAMS', streamKey, '>'
    );

    return messages || [];
  }

  static async acknowledgeMessage(agentId: string, messageId: string): Promise<void> {
    const streamKey = this.getStreamKey(agentId);
    const groupName = this.getConsumerGroup(agentId);
    
    await redis.xack(streamKey, groupName, messageId);
  }

  static async moveToDeadLetter(agentId: string, message: MessagePayload): Promise<void> {
    const dlqKey = this.getDeadLetterKey(agentId);
    
    await redis.xadd(
      dlqKey,
      '*',
      'data', JSON.stringify({
        ...message,
        failedAt: Date.now(),
        reason: 'max_retries_exceeded'
      })
    );
  }
}

class MessageQueueService {
  static async sendMessage(fromAgentId: string, messageData: any): Promise<{ messageId: string; deliveredTo: string[] }> {
    const message: MessagePayload = {
      id: crypto.randomUUID(),
      fromAgentId,
      targetAgentId: messageData.targetAgentId,
      messageType: messageData.messageType,
      payload: messageData.payload,
      priority: messageData.priority,
      timestamp: Date.now(),
      ttl: messageData.ttl,
      requiresAck: messageData.requiresAck,
      retryCount: messageData.retryCount,
      attempts: 0
    };

    const deliveredTo: string[] = [];
    
    if (messageData.broadcast) {
      // Get all active agents for broadcast
      const { data: agents } = await supabase
        .from('agent_registry')
        .select('agent_id')
        .eq('status', 'active');

      if (agents) {
        for (const agent of agents) {
          if (agent.agent_id !== fromAgentId) {
            const messageId = await RedisStreamManager.addMessage(agent.agent_id, message);
            deliveredTo.push(agent.agent_id);
          }
        }
      }
    } else if (messageData.targetAgentId) {
      const messageId = await RedisStreamManager.addMessage(messageData.targetAgentId, message);
      deliveredTo.push(messageData.targetAgentId);
    }

    // Persist message for audit trail
    await this.persistMessage(message, deliveredTo);

    return { messageId: message.id, deliveredTo };
  }

  static async consumeMessages(agentId: string, count: number, blockTime: number): Promise<any[]> {
    const rawMessages = await RedisStreamManager.consumeMessages(agentId, count, blockTime);
    const processedMessages = [];

    for (const stream of rawMessages) {
      const [streamName, messages] = stream;
      
      for (const [messageId, fields] of messages) {
        try {
          const messageData = JSON.parse(fields[1]); // fields[1] is the 'data' field
          
          // Check if message has expired
          if (messageData.ttl > 0 && (Date.now() - messageData.timestamp) > (messageData.ttl * 1000)) {
            await RedisStreamManager.acknowledgeMessage(agentId, messageId);
            continue;
          }

          processedMessages.push({
            messageId,
            ...messageData
          });
        } catch (error) {
          console.error('Failed to parse message:', error);
          await RedisStreamManager.acknowledgeMessage(agentId, messageId);
        }
      }
    }

    return processedMessages;
  }

  static async acknowledgeMessage(agentId: string, messageId: string, status: string): Promise<void> {
    await RedisStreamManager.acknowledgeMessage(agentId, messageId);
    
    // Update message status in persistence layer
    await supabase
      .from('message_queue_audit')
      .update({
        status,
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('message_id', messageId)
      .eq('target_agent_id', agentId);
  }

  private static async persistMessage(message: MessagePayload, deliveredTo: string[]): Promise<void> {
    const auditRecords = deliveredTo.map(targetAgentId => ({
      message_id: message.id,
      from_agent_id: message.fromAgentId,
      target_agent_id: targetAgentId,
      message_type: message.messageType,
      payload: message.payload,
      priority: message.priority,
      requires_ack: message.requiresAck,
      ttl: message.ttl,
      retry_count: message.retryCount,
      status: 'sent',
      created_at: new Date().toISOString()
    }));

    await supabase
      .from('message_queue_audit')
      .insert(auditRecords);
  }
}

class QueueHealthMonitor {
  static async getQueueMetrics(agentId: string): Promise<any> {
    const streamKey = RedisStreamManager['getStreamKey'](agentId);
    const dlqKey = RedisStreamManager['getDeadLetterKey'](agentId);
    
    const [streamLength, dlqLength, pendingCount] = await Promise.all([
      redis.xlen(streamKey),
      redis.xlen(dlqKey),
      redis.xpending(streamKey, RedisStreamManager['getConsumerGroup'](agentId))
    ]);

    return {
      queueLength: streamLength,
      deadLetterQueueLength: dlqLength,
      pendingMessages: Array.isArray(pendingCount) ? pendingCount[0] : 0,
      timestamp: Date.now()
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const limiter = rateLimit({
      interval: 60 * 1000, // 1 minute
      uniqueTokenPerInterval: 500,
    });
    
    await limiter.check(10, 'message_queue_send');

    // Agent authentication
    const agentAuth = await verifyAgentToken(request);
    if (!agentAuth.success) {
      return NextResponse.json(
        { error: 'Unauthorized agent' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const messageData = SendMessageSchema.parse(body);

    // Validate target agent exists (if not broadcast)
    if (!messageData.broadcast && messageData.targetAgentId) {
      const { data: targetAgent } = await supabase
        .from('agent_registry')
        .select('agent_id, status')
        .eq('agent_id', messageData.targetAgentId)
        .single();

      if (!targetAgent) {
        return NextResponse.json(
          { error: 'Target agent not found' },
          { status: 404 }
        );
      }

      if (targetAgent.status !== 'active') {
        return NextResponse.json(
          { error: 'Target agent is not active' },
          { status: 400 }
        );
      }
    }

    const result = await MessageQueueService.sendMessage(agentAuth.agentId, messageData);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      deliveredTo: result.deliveredTo,
      deliveryCount: result.deliveredTo.length
    });

  } catch (error) {
    console.error('Message queue send error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const limiter = rateLimit({
      interval: 60 * 1000,
      uniqueTokenPerInterval: 500,
    });
    
    await limiter.check(50, 'message_queue_consume');

    // Agent authentication
    const agentAuth = await verifyAgentToken(request);
    if (!agentAuth.success) {
      return NextResponse.json(
        { error: 'Unauthorized agent' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryData = ConsumeMessageSchema.parse({
      count: searchParams.get('count') ? parseInt(searchParams.get('count')!) : undefined,
      block: searchParams.get('block') ? parseInt(searchParams.get('block')!) : undefined
    });

    // Check for health metrics request
    if (searchParams.get('metrics') === 'true') {
      const metrics = await QueueHealthMonitor.getQueueMetrics(agentAuth.agentId);
      return NextResponse.json({ success: true, metrics });
    }

    const messages = await MessageQueueService.consumeMessages(
      agentAuth.agentId,
      queryData.count,
      queryData.block
    );

    return NextResponse.json({
      success: true,
      messages,
      count: messages.length,
      agentId: agentAuth.agentId
    });

  } catch (error) {
    console.error('Message queue consume error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to consume messages' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const limiter = rateLimit({
      interval: 60 * 1000,
      uniqueTokenPerInterval: 500,
    });
    
    await limiter.check(100, 'message_queue_ack');

    // Agent authentication
    const agentAuth = await verifyAgentToken(request);
    if (!agentAuth.success) {
      return NextResponse.json(
        { error: 'Unauthorized agent' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const ackData = AckMessageSchema.parse(body);

    await MessageQueueService.acknowledgeMessage(
      agentAuth.agentId,
      ackData.messageId,
      ackData.status
    );

    return NextResponse.json({
      success: true,
      messageId: ackData.messageId,
      status: ackData.status,
      acknowledgedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Message queue acknowledge error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to acknowledge message' },
      { status: 500 }
    );
  }
}
```