```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { ratelimit } from '@/lib/ratelimit';
import { authMiddleware } from '@/lib/auth';
import { z } from 'zod';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Validation schemas
const messageSchema = z.object({
  targetAgentId: z.string().uuid(),
  content: z.object({
    type: z.enum(['command', 'data', 'query', 'notification']),
    payload: z.any(),
    metadata: z.record(z.string()).optional(),
  }),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  deliveryGuarantee: z.enum(['at-most-once', 'at-least-once', 'exactly-once']).default('at-least-once'),
  ttl: z.number().min(1).max(86400).default(3600), // 1 second to 24 hours
});

const bulkMessageSchema = z.object({
  messages: z.array(messageSchema).max(100),
  broadcast: z.boolean().default(false),
});

interface Message {
  id: string;
  teamId: string;
  sourceAgentId: string;
  targetAgentId: string;
  content: {
    type: 'command' | 'data' | 'query' | 'notification';
    payload: any;
    metadata?: Record<string, string>;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  deliveryGuarantee: 'at-most-once' | 'at-least-once' | 'exactly-once';
  status: 'pending' | 'delivered' | 'acknowledged' | 'failed' | 'expired';
  createdAt: Date;
  scheduledAt: Date;
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  ttl: number;
  retryCount: number;
  maxRetries: number;
}

interface DeliveryAttempt {
  messageId: string;
  attempt: number;
  timestamp: Date;
  status: 'success' | 'failure' | 'timeout';
  error?: string;
}

class MessageQueue {
  private priorityLevels = { low: 1, medium: 2, high: 3, critical: 4 };

  async enqueue(message: Message): Promise<void> {
    const queueKey = `team:${message.teamId}:message-queue`;
    const messageKey = `message:${message.id}`;
    
    // Store message details
    await redis.hset(messageKey, {
      ...message,
      createdAt: message.createdAt.toISOString(),
      scheduledAt: message.scheduledAt.toISOString(),
    });

    // Add to priority queue
    const priority = this.priorityLevels[message.priority];
    const score = priority * 1000000 + Date.now();
    
    await redis.zadd(queueKey, { score, member: message.id });
    
    // Set TTL for message
    await redis.expire(messageKey, message.ttl);
  }

  async dequeue(teamId: string, limit: number = 10): Promise<Message[]> {
    const queueKey = `team:${teamId}:message-queue`;
    
    // Get highest priority messages
    const messageIds = await redis.zrevrange(queueKey, 0, limit - 1);
    
    if (!messageIds.length) return [];

    // Fetch message details
    const messages: Message[] = [];
    for (const messageId of messageIds) {
      const messageData = await redis.hgetall(`message:${messageId}`);
      if (messageData) {
        messages.push({
          ...messageData,
          createdAt: new Date(messageData.createdAt),
          scheduledAt: new Date(messageData.scheduledAt),
          deliveredAt: messageData.deliveredAt ? new Date(messageData.deliveredAt) : undefined,
          acknowledgedAt: messageData.acknowledgedAt ? new Date(messageData.acknowledgedAt) : undefined,
        } as Message);
      }
    }

    return messages;
  }

  async remove(teamId: string, messageId: string): Promise<void> {
    const queueKey = `team:${teamId}:message-queue`;
    const messageKey = `message:${messageId}`;
    
    await Promise.all([
      redis.zrem(queueKey, messageId),
      redis.del(messageKey),
    ]);
  }
}

class DeliveryGuaranteeService {
  async trackDelivery(message: Message): Promise<void> {
    const deliveryKey = `delivery:${message.id}`;
    
    await redis.hset(deliveryKey, {
      messageId: message.id,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    
    await redis.expire(deliveryKey, message.ttl);
  }

  async recordAttempt(messageId: string, attempt: DeliveryAttempt): Promise<void> {
    const attemptKey = `delivery:${messageId}:attempts`;
    
    await redis.lpush(attemptKey, JSON.stringify(attempt));
    await redis.ltrim(attemptKey, 0, 99); // Keep last 100 attempts
    await redis.expire(attemptKey, 86400); // 24 hours
  }

  async acknowledge(messageId: string, agentId: string): Promise<boolean> {
    const deliveryKey = `delivery:${messageId}`;
    const ackKey = `ack:${messageId}`;
    
    const delivery = await redis.hgetall(deliveryKey);
    if (!delivery || delivery.status === 'acknowledged') {
      return false;
    }

    await Promise.all([
      redis.hset(deliveryKey, {
        status: 'acknowledged',
        acknowledgedBy: agentId,
        acknowledgedAt: new Date().toISOString(),
      }),
      redis.set(ackKey, agentId, { ex: 86400 }),
    ]);

    return true;
  }
}

class CommunicationPatternAnalyzer {
  async analyzePatterns(teamId: string, timeWindow: number = 3600): Promise<any> {
    const now = Date.now();
    const windowStart = now - (timeWindow * 1000);
    
    // Get messages from the time window
    const { data: messages } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('team_id', teamId)
      .gte('created_at', new Date(windowStart).toISOString())
      .order('created_at', { ascending: false });

    if (!messages?.length) {
      return { messageCount: 0, patterns: [] };
    }

    // Analyze communication patterns
    const patterns = {
      messageCount: messages.length,
      messageTypes: this.getMessageTypeDistribution(messages),
      agentActivity: this.getAgentActivityPattern(messages),
      communicationFlow: this.getCommunicationFlowPattern(messages),
      priorityDistribution: this.getPriorityDistribution(messages),
      responseTimeAnalysis: this.getResponseTimeAnalysis(messages),
    };

    return patterns;
  }

  private getMessageTypeDistribution(messages: any[]): Record<string, number> {
    return messages.reduce((acc, msg) => {
      const type = msg.content?.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  private getAgentActivityPattern(messages: any[]): Record<string, number> {
    return messages.reduce((acc, msg) => {
      acc[msg.source_agent_id] = (acc[msg.source_agent_id] || 0) + 1;
      return acc;
    }, {});
  }

  private getCommunicationFlowPattern(messages: any[]): Array<{ from: string; to: string; count: number }> {
    const flows: Record<string, number> = {};
    
    messages.forEach(msg => {
      const key = `${msg.source_agent_id}->${msg.target_agent_id}`;
      flows[key] = (flows[key] || 0) + 1;
    });

    return Object.entries(flows).map(([key, count]) => {
      const [from, to] = key.split('->');
      return { from, to, count };
    });
  }

  private getPriorityDistribution(messages: any[]): Record<string, number> {
    return messages.reduce((acc, msg) => {
      const priority = msg.priority || 'medium';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});
  }

  private getResponseTimeAnalysis(messages: any[]): any {
    // Group messages by conversation threads
    const conversations: Record<string, any[]> = {};
    
    messages.forEach(msg => {
      const conversationId = msg.content?.metadata?.conversationId || 'default';
      if (!conversations[conversationId]) {
        conversations[conversationId] = [];
      }
      conversations[conversationId].push(msg);
    });

    const responseTimes: number[] = [];
    
    Object.values(conversations).forEach(msgs => {
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      for (let i = 1; i < msgs.length; i++) {
        const prevTime = new Date(msgs[i - 1].created_at).getTime();
        const currTime = new Date(msgs[i].created_at).getTime();
        responseTimes.push(currTime - prevTime);
      }
    });

    if (responseTimes.length === 0) {
      return { average: 0, median: 0, p95: 0 };
    }

    responseTimes.sort((a, b) => a - b);
    const average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const median = responseTimes[Math.floor(responseTimes.length / 2)];
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];

    return { average, median, p95 };
  }
}

class AgentMessageBroker {
  private messageQueue = new MessageQueue();
  private deliveryService = new DeliveryGuaranteeService();

  async publishMessage(message: Message): Promise<string> {
    // Validate target agent exists and is active
    const { data: targetAgent } = await supabase
      .from('team_agents')
      .select('id, status')
      .eq('id', message.targetAgentId)
      .eq('team_id', message.teamId)
      .eq('status', 'active')
      .single();

    if (!targetAgent) {
      throw new Error('Target agent not found or inactive');
    }

    // Generate message ID and set defaults
    message.id = crypto.randomUUID();
    message.status = 'pending';
    message.retryCount = 0;
    message.maxRetries = this.getMaxRetries(message.deliveryGuarantee);
    message.scheduledAt = new Date();

    // Store in Supabase for persistence
    await supabase.from('agent_messages').insert({
      id: message.id,
      team_id: message.teamId,
      source_agent_id: message.sourceAgentId,
      target_agent_id: message.targetAgentId,
      content: message.content,
      priority: message.priority,
      delivery_guarantee: message.deliveryGuarantee,
      status: message.status,
      ttl: message.ttl,
      max_retries: message.maxRetries,
      created_at: message.createdAt.toISOString(),
      scheduled_at: message.scheduledAt.toISOString(),
    });

    // Add to queue and track delivery
    await Promise.all([
      this.messageQueue.enqueue(message),
      this.deliveryService.trackDelivery(message),
    ]);

    // Trigger real-time notification
    await this.notifyTargetAgent(message);

    return message.id;
  }

  async processMessages(teamId: string): Promise<void> {
    const messages = await this.messageQueue.dequeue(teamId, 50);
    
    for (const message of messages) {
      try {
        await this.deliverMessage(message);
      } catch (error) {
        console.error(`Failed to deliver message ${message.id}:`, error);
        await this.handleDeliveryFailure(message, error as Error);
      }
    }
  }

  private async deliverMessage(message: Message): Promise<void> {
    const attempt: DeliveryAttempt = {
      messageId: message.id,
      attempt: message.retryCount + 1,
      timestamp: new Date(),
      status: 'success',
    };

    try {
      // Update message status
      message.status = 'delivered';
      message.deliveredAt = new Date();
      message.retryCount++;

      // Update in database
      await supabase
        .from('agent_messages')
        .update({
          status: message.status,
          delivered_at: message.deliveredAt.toISOString(),
          retry_count: message.retryCount,
        })
        .eq('id', message.id);

      // Record successful attempt
      await this.deliveryService.recordAttempt(message.id, attempt);

      // Remove from queue if delivery guarantee allows
      if (message.deliveryGuarantee === 'at-most-once') {
        await this.messageQueue.remove(message.teamId, message.id);
      }

      // Send real-time notification
      await this.notifyTargetAgent(message);

    } catch (error) {
      attempt.status = 'failure';
      attempt.error = (error as Error).message;
      await this.deliveryService.recordAttempt(message.id, attempt);
      throw error;
    }
  }

  private async handleDeliveryFailure(message: Message, error: Error): Promise<void> {
    message.retryCount++;

    if (message.retryCount >= message.maxRetries) {
      message.status = 'failed';
      await this.messageQueue.remove(message.teamId, message.id);
    } else {
      // Exponential backoff for retry
      const backoffMs = Math.pow(2, message.retryCount) * 1000;
      message.scheduledAt = new Date(Date.now() + backoffMs);
    }

    // Update database
    await supabase
      .from('agent_messages')
      .update({
        status: message.status,
        retry_count: message.retryCount,
        scheduled_at: message.scheduledAt.toISOString(),
      })
      .eq('id', message.id);
  }

  private async notifyTargetAgent(message: Message): Promise<void> {
    // Send real-time notification via Supabase realtime
    await supabase
      .channel(`agent:${message.targetAgentId}:messages`)
      .send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          messageId: message.id,
          sourceAgentId: message.sourceAgentId,
          content: message.content,
          priority: message.priority,
          deliveredAt: message.deliveredAt,
        },
      });
  }

  private getMaxRetries(deliveryGuarantee: string): number {
    switch (deliveryGuarantee) {
      case 'at-most-once': return 0;
      case 'at-least-once': return 3;
      case 'exactly-once': return 5;
      default: return 3;
    }
  }
}

// API Route Handlers
export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } }
): Promise<NextResponse> {
  try {
    // Rate limiting
    const ip = request.ip ?? '127.0.0.1';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Authentication
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = params.teamId;
    const body = await request.json();
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'send';

    // Validate team access
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', authResult.user.id)
      .single();

    if (!teamMember) {
      return NextResponse.json({ error: 'Team access denied' }, { status: 403 });
    }

    const broker = new AgentMessageBroker();

    switch (action) {
      case 'send': {
        const validation = messageSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid message format', details: validation.error.errors },
            { status: 400 }
          );
        }

        const message: Message = {
          ...validation.data,
          id: '', // Will be set by broker
          teamId,
          sourceAgentId: body.sourceAgentId || authResult.user.id,
          status: 'pending',
          createdAt: new Date(),
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
        };

        const messageId = await broker.publishMessage(message);

        return NextResponse.json({
          success: true,
          messageId,
          status: 'queued',
        });
      }

      case 'send-bulk': {
        const validation = bulkMessageSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid bulk message format', details: validation.error.errors },
            { status: 400 }
          );
        }

        const results = [];
        for (const msgData of validation.data.messages) {
          try {
            const message: Message = {
              ...msgData,
              id: '',
              teamId,
              sourceAgentId: body.sourceAgentId || authResult.user.id,
              status: 'pending',
              createdAt: new Date(),
              scheduledAt: new Date(),
              retryCount: 0,
              maxRetries: 3,
            };

            const messageId = await broker.publishMessage(message);
            results.push({ success: true, messageId });
          } catch (error) {
            results.push({ 
              success: false, 
              error: (error as Error).message,
              targetAgentId: msgData.targetAgentId,
            });
          }
        }

        return NextResponse.json({
          success: true,
          results,
          processed: results.length,
          successful: results.filter(r => r.success).length,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Message queue API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
): Promise<NextResponse> {
  try {
    // Rate limiting
    const ip = request.ip ?? '127.0.0.1';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Authentication
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = params.teamId;
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'queue-status';

    // Validate team access
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', authResult.user.id)
      .single();

    if (!teamMember) {
      return NextResponse.json({ error: 'Team access denied' }, { status: 403 });
    }

    switch (action) {
      case 'queue-status': {
        const queueKey = `team:${teamId}:message-queue`;
        const queueSize = await redis.zcard(queueKey);
        
        // Get priority breakdown
        const messages = await redis.zrevrange(queueKey, 0, -1, { withScores: true });
        const priorityBreakdown = { low: 0, medium: 0, high: 0, critical: 0 };
        
        for (let i = 0; i < messages.length; i += 2) {
          const messageId = messages[i];
          const messageData = await redis.hgetall(`message:${messageId}`);
          if (messageData?.priority) {
            priorityBreakdown[messageData.priority as keyof typeof priorityBreakdown]++;
          }
        }

        return NextResponse.json({
          queueSize,
          priorityBreakdown,
          timestamp: new Date().toISOString(),
        });
      }

      case 'patterns': {
        const timeWindow = parseInt(url.searchParams.get('window') || '3600');
        const analyzer = new CommunicationPatternAnalyzer();
        const patterns = await analyzer.analyzePatterns(teamId, timeWindow);

        return NextResponse.json({
          success: true,
          patterns,
          timeWindow,
          generatedAt: new Date().toISOString(),
        });
      }

      case 'message-history': {
        const agentId = url.searchParams.get('agentId');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = supabase
          .from('agent_messages')
          .select('*')
          .eq('team_id', teamId)
          .order('created_at',