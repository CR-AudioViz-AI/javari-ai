```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import crypto from 'crypto';
import { z } from 'zod';

// Type definitions
interface AgentMessage {
  id: string;
  senderId: string;
  recipientId?: string;
  messageType: 'task' | 'response' | 'broadcast' | 'query' | 'error';
  payload: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  contextId: string;
  timestamp: number;
  encrypted: boolean;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

interface AgentCapability {
  agentId: string;
  capabilities: string[];
  load: number;
  status: 'active' | 'busy' | 'offline';
  lastSeen: number;
}

interface ConversationContext {
  id: string;
  participants: string[];
  messageHistory: string[];
  sharedState: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

// Validation schemas
const MessageSchema = z.object({
  recipientId: z.string().optional(),
  messageType: z.enum(['task', 'response', 'broadcast', 'query', 'error']),
  payload: z.record(z.any()),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  contextId: z.string(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

const ContextUpdateSchema = z.object({
  contextId: z.string(),
  sharedState: z.record(z.any()).optional(),
  participants: z.array(z.string()).optional(),
});

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

class MessageRouter {
  private encryptionKey = process.env.AGENT_MESSAGE_ENCRYPTION_KEY!;

  async route(message: AgentMessage): Promise<string[]> {
    try {
      // Validate sender exists and is authenticated
      const { data: sender } = await supabase
        .from('agents')
        .select('id, status, capabilities')
        .eq('id', message.senderId)
        .single();

      if (!sender || sender.status !== 'active') {
        throw new Error('Invalid or inactive sender agent');
      }

      let recipients: string[] = [];

      if (message.recipientId) {
        // Direct message to specific agent
        recipients = [message.recipientId];
      } else if (message.messageType === 'broadcast') {
        // Broadcast to all active agents
        const { data: activeAgents } = await supabase
          .from('agents')
          .select('id')
          .eq('status', 'active')
          .neq('id', message.senderId);
        
        recipients = activeAgents?.map(a => a.id) || [];
      } else if (message.capabilities) {
        // Route based on capabilities
        const matcher = new AgentCapabilityMatcher();
        recipients = await matcher.findBestMatch(message.capabilities, message.senderId);
      }

      // Queue messages for recipients
      const queuePromises = recipients.map(recipientId =>
        this.queueMessage({ ...message, recipientId })
      );

      await Promise.all(queuePromises);
      
      return recipients;
    } catch (error) {
      console.error('Message routing failed:', error);
      throw new Error('Failed to route message');
    }
  }

  private async queueMessage(message: AgentMessage): Promise<void> {
    const serializer = new MessageSerializer();
    const encryptedMessage = await serializer.encrypt(message, this.encryptionKey);
    
    const queueKey = `agent_queue:${message.recipientId}`;
    const priorityScore = this.getPriorityScore(message.priority);
    
    await redis.zadd(queueKey, priorityScore, JSON.stringify(encryptedMessage));
    await redis.expire(queueKey, 3600); // 1 hour TTL
    
    // Notify agent of new message via pub/sub
    await redis.publish(`agent_notifications:${message.recipientId}`, JSON.stringify({
      type: 'new_message',
      messageId: message.id,
      senderId: message.senderId,
      priority: message.priority,
    }));
  }

  private getPriorityScore(priority: string): number {
    const scores = { urgent: 4, high: 3, medium: 2, low: 1 };
    return scores[priority as keyof typeof scores] * Date.now();
  }
}

class AgentCapabilityMatcher {
  async findBestMatch(requiredCapabilities: string[], senderId: string): Promise<string[]> {
    const { data: agents } = await supabase
      .from('agents')
      .select('id, capabilities, current_load, status')
      .eq('status', 'active')
      .neq('id', senderId);

    if (!agents) return [];

    const matches = agents
      .filter(agent => {
        const agentCaps = agent.capabilities || [];
        return requiredCapabilities.some(cap => agentCaps.includes(cap));
      })
      .map(agent => ({
        ...agent,
        matchScore: this.calculateMatchScore(requiredCapabilities, agent.capabilities),
        loadFactor: agent.current_load || 0,
      }))
      .sort((a, b) => {
        // Sort by match score (desc) then by load (asc)
        if (a.matchScore !== b.matchScore) {
          return b.matchScore - a.matchScore;
        }
        return a.loadFactor - b.loadFactor;
      });

    return matches.slice(0, 3).map(m => m.id); // Return top 3 matches
  }

  private calculateMatchScore(required: string[], available: string[]): number {
    const matches = required.filter(cap => available.includes(cap));
    return matches.length / required.length;
  }
}

class ContextPreserver {
  async updateContext(contextId: string, updates: Partial<ConversationContext>): Promise<void> {
    const { error } = await supabase
      .from('conversation_contexts')
      .upsert({
        id: contextId,
        ...updates,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to update context: ${error.message}`);
    }
  }

  async getContext(contextId: string): Promise<ConversationContext | null> {
    const { data } = await supabase
      .from('conversation_contexts')
      .select('*')
      .eq('id', contextId)
      .single();

    return data;
  }

  async addMessageToHistory(contextId: string, messageId: string): Promise<void> {
    const context = await this.getContext(contextId);
    if (context) {
      const updatedHistory = [...(context.messageHistory || []), messageId];
      await this.updateContext(contextId, { messageHistory: updatedHistory });
    }
  }
}

class SecurityValidator {
  validateAgentAccess(agentId: string, contextId: string): boolean {
    // Implement agent access validation logic
    return true; // Simplified for this implementation
  }

  sanitizePayload(payload: Record<string, any>): Record<string, any> {
    // Remove potentially dangerous properties
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const sanitized = { ...payload };
    
    dangerous.forEach(prop => {
      delete sanitized[prop];
    });

    return sanitized;
  }
}

class MessageSerializer {
  async encrypt(message: AgentMessage, key: string): Promise<string> {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(JSON.stringify(message), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  async decrypt(encryptedMessage: string, key: string): Promise<AgentMessage> {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedMessage, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }
}

// API Handlers
export async function POST(request: NextRequest) {
  try {
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agent ID in headers' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = MessageSchema.parse(body);

    const message: AgentMessage = {
      id: crypto.randomUUID(),
      senderId: agentId,
      timestamp: Date.now(),
      encrypted: true,
      ...validatedData,
    };

    // Validate and sanitize
    const validator = new SecurityValidator();
    if (!validator.validateAgentAccess(agentId, message.contextId)) {
      return NextResponse.json(
        { error: 'Access denied to conversation context' },
        { status: 403 }
      );
    }

    message.payload = validator.sanitizePayload(message.payload);

    // Route message
    const router = new MessageRouter();
    const recipients = await router.route(message);

    // Update conversation context
    const contextPreserver = new ContextPreserver();
    await contextPreserver.addMessageToHistory(message.contextId, message.id);

    // Store message in database
    await supabase.from('agent_messages').insert({
      id: message.id,
      sender_id: message.senderId,
      recipient_ids: recipients,
      message_type: message.messageType,
      payload: message.payload,
      priority: message.priority,
      context_id: message.contextId,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      messageId: message.id,
      recipients,
      status: 'queued',
      timestamp: message.timestamp,
    });

  } catch (error) {
    console.error('Message routing error:', error);
    return NextResponse.json(
      { error: 'Failed to route message' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agentId parameter' },
        { status: 400 }
      );
    }

    const queueKey = `agent_queue:${agentId}`;
    const messages = await redis.zrevrange(queueKey, 0, -1);
    
    const serializer = new MessageSerializer();
    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          return await serializer.decrypt(
            JSON.parse(msg),
            process.env.AGENT_MESSAGE_ENCRYPTION_KEY!
          );
        } catch {
          return null;
        }
      })
    );

    const validMessages = decryptedMessages.filter(Boolean);

    return NextResponse.json({
      messages: validMessages,
      count: validMessages.length,
    });

  } catch (error) {
    console.error('Queue retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve messages' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agent ID in headers' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = ContextUpdateSchema.parse(body);

    const contextPreserver = new ContextPreserver();
    await contextPreserver.updateContext(validatedData.contextId, {
      sharedState: validatedData.sharedState,
      participants: validatedData.participants,
    });

    return NextResponse.json({
      contextId: validatedData.contextId,
      status: 'updated',
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('Context update error:', error);
    return NextResponse.json(
      { error: 'Failed to update context' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const messageId = searchParams.get('messageId');
    
    if (!agentId || !messageId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const queueKey = `agent_queue:${agentId}`;
    await redis.zremrangebyscore(queueKey, messageId, messageId);

    return NextResponse.json({
      messageId,
      status: 'removed',
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('Message removal error:', error);
    return NextResponse.json(
      { error: 'Failed to remove message' },
      { status: 500 }
    );
  }
}
```