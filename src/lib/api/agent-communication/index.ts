```typescript
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { z } from 'zod';

// Types and Schemas
export interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'busy';
  lastSeen: Date;
  metadata: Record<string, any>;
}

export interface Message {
  id: string;
  agentId: string;
  targetId: string;
  messageType: string;
  payload: any;
  timestamp: Date;
  signature: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  encrypted: boolean;
  acknowledgmentRequired: boolean;
  expiresAt?: Date;
}

export interface MessageAcknowledgment {
  messageId: string;
  agentId: string;
  status: 'received' | 'processed' | 'failed';
  timestamp: Date;
  errorMessage?: string;
}

const MessageSchema = z.object({
  agentId: z.string(),
  targetId: z.string(),
  messageType: z.string(),
  payload: z.any(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  acknowledgmentRequired: z.boolean().default(false),
  expiresAt: z.date().optional()
});

// Configuration
interface CommunicationConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl?: string;
  encryptionKey: string;
  jwtSecret: string;
  messageRetryAttempts: number;
  messageRetryDelay: number;
  agentTimeoutMs: number;
}

export class AgentCommunicationClient {
  private supabase: any;
  private redis?: Redis;
  private config: CommunicationConfig;
  private agents: Map<string, Agent> = new Map();
  private messageHandlers: Map<string, (message: Message) => Promise<void>> = new Map();
  private subscriptions: Map<string, any> = new Map();
  private metrics = {
    messagesSent: 0,
    messagesReceived: 0,
    messagesDelivered: 0,
    messagesFailed: 0,
    averageLatency: 0
  };

  constructor(config: CommunicationConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    
    if (config.redisUrl) {
      this.redis = new Redis({ url: config.redisUrl });
    }

    this.initializeTables();
  }

  private async initializeTables() {
    // Create agents table
    await this.supabase.rpc('create_agents_table_if_not_exists');
    
    // Create messages table
    await this.supabase.rpc('create_messages_table_if_not_exists');
    
    // Create acknowledgments table
    await this.supabase.rpc('create_acknowledgments_table_if_not_exists');
  }

  // Agent Registration
  async registerAgent(agent: Omit<Agent, 'lastSeen'>): Promise<void> {
    const agentWithTimestamp = {
      ...agent,
      lastSeen: new Date().toISOString(),
      status: 'active'
    };

    const { error } = await this.supabase
      .from('agents')
      .upsert(agentWithTimestamp);

    if (error) {
      throw new Error(`Failed to register agent: ${error.message}`);
    }

    this.agents.set(agent.id, { ...agentWithTimestamp, lastSeen: new Date() });

    // Broadcast agent registration
    await this.broadcastAgentUpdate('agent_registered', agent.id);
  }

  async unregisterAgent(agentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('agents')
      .update({ status: 'inactive' })
      .eq('id', agentId);

    if (error) {
      throw new Error(`Failed to unregister agent: ${error.message}`);
    }

    this.agents.delete(agentId);
    await this.broadcastAgentUpdate('agent_unregistered', agentId);
  }

  // Message Sending
  async sendMessage(messageData: z.infer<typeof MessageSchema>): Promise<string> {
    const validatedData = MessageSchema.parse(messageData);
    
    const message: Message = {
      id: this.generateMessageId(),
      ...validatedData,
      timestamp: new Date(),
      signature: await this.signMessage(validatedData),
      encrypted: false
    };

    // Encrypt sensitive messages
    if (this.shouldEncryptMessage(message)) {
      message.payload = this.encryptPayload(message.payload);
      message.encrypted = true;
    }

    // Validate target agent exists and is active
    const targetAgent = await this.getAgent(message.targetId);
    if (!targetAgent || targetAgent.status !== 'active') {
      throw new Error(`Target agent ${message.targetId} is not available`);
    }

    // Queue message with priority
    await this.queueMessage(message);

    // Store message in database
    const { error } = await this.supabase
      .from('messages')
      .insert({
        id: message.id,
        agent_id: message.agentId,
        target_id: message.targetId,
        message_type: message.messageType,
        payload: message.payload,
        timestamp: message.timestamp.toISOString(),
        signature: message.signature,
        priority: message.priority,
        encrypted: message.encrypted,
        acknowledgment_required: message.acknowledgmentRequired,
        expires_at: message.expiresAt?.toISOString()
      });

    if (error) {
      throw new Error(`Failed to store message: ${error.message}`);
    }

    // Attempt immediate delivery
    await this.deliverMessage(message);

    this.metrics.messagesSent++;
    return message.id;
  }

  // Message Subscription
  async subscribeToMessages(
    agentId: string,
    messageHandler: (message: Message) => Promise<void>
  ): Promise<void> {
    this.messageHandlers.set(agentId, messageHandler);

    // Subscribe to real-time messages
    const subscription = this.supabase
      .channel(`messages:${agentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `target_id=eq.${agentId}`
        },
        async (payload: any) => {
          const message = this.parseMessageFromDb(payload.new);
          await this.handleIncomingMessage(message);
        }
      )
      .subscribe();

    this.subscriptions.set(agentId, subscription);

    // Process any queued messages
    await this.processQueuedMessages(agentId);
  }

  async unsubscribeFromMessages(agentId: string): Promise<void> {
    const subscription = this.subscriptions.get(agentId);
    if (subscription) {
      await this.supabase.removeChannel(subscription);
      this.subscriptions.delete(agentId);
    }
    this.messageHandlers.delete(agentId);
  }

  // Agent Discovery
  async discoverAgents(capabilities?: string[]): Promise<Agent[]> {
    let query = this.supabase
      .from('agents')
      .select('*')
      .eq('status', 'active');

    if (capabilities && capabilities.length > 0) {
      query = query.overlaps('capabilities', capabilities);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to discover agents: ${error.message}`);
    }

    return data.map((agent: any) => ({
      id: agent.id,
      name: agent.name,
      capabilities: agent.capabilities,
      status: agent.status,
      lastSeen: new Date(agent.last_seen),
      metadata: agent.metadata
    }));
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    // Check local cache first
    if (this.agents.has(agentId)) {
      return this.agents.get(agentId)!;
    }

    const { data, error } = await this.supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error || !data) {
      return null;
    }

    const agent: Agent = {
      id: data.id,
      name: data.name,
      capabilities: data.capabilities,
      status: data.status,
      lastSeen: new Date(data.last_seen),
      metadata: data.metadata
    };

    this.agents.set(agentId, agent);
    return agent;
  }

  // Message Acknowledgment
  async acknowledgeMessage(
    messageId: string,
    agentId: string,
    status: 'received' | 'processed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const acknowledgment: MessageAcknowledgment = {
      messageId,
      agentId,
      status,
      timestamp: new Date(),
      errorMessage
    };

    const { error } = await this.supabase
      .from('acknowledgments')
      .insert({
        message_id: acknowledgment.messageId,
        agent_id: acknowledgment.agentId,
        status: acknowledgment.status,
        timestamp: acknowledgment.timestamp.toISOString(),
        error_message: acknowledgment.errorMessage
      });

    if (error) {
      throw new Error(`Failed to acknowledge message: ${error.message}`);
    }

    // Update metrics
    if (status === 'processed') {
      this.metrics.messagesDelivered++;
    } else if (status === 'failed') {
      this.metrics.messagesFailed++;
    }
  }

  // Metrics and Monitoring
  getCommunicationMetrics() {
    return { ...this.metrics };
  }

  async getMessageHistory(
    agentId: string,
    limit: number = 100
  ): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .or(`agent_id.eq.${agentId},target_id.eq.${agentId}`)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get message history: ${error.message}`);
    }

    return data.map((msg: any) => this.parseMessageFromDb(msg));
  }

  // Private Methods
  private async queueMessage(message: Message): Promise<void> {
    if (!this.redis) return;

    const queueKey = `agent_queue:${message.targetId}`;
    const priorityScore = this.getPriorityScore(message.priority);

    await this.redis.zadd(queueKey, {
      score: priorityScore,
      member: JSON.stringify(message)
    });

    // Set expiration if specified
    if (message.expiresAt) {
      const ttl = Math.floor((message.expiresAt.getTime() - Date.now()) / 1000);
      await this.redis.expire(queueKey, ttl);
    }
  }

  private async processQueuedMessages(agentId: string): Promise<void> {
    if (!this.redis) return;

    const queueKey = `agent_queue:${agentId}`;
    
    // Get highest priority messages
    const messages = await this.redis.zrevrange(queueKey, 0, 9);
    
    for (const messageStr of messages) {
      try {
        const message: Message = JSON.parse(messageStr);
        await this.handleIncomingMessage(message);
        
        // Remove from queue after processing
        await this.redis.zrem(queueKey, messageStr);
      } catch (error) {
        console.error('Failed to process queued message:', error);
      }
    }
  }

  private async deliverMessage(message: Message): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if agent is subscribed for real-time delivery
      const handler = this.messageHandlers.get(message.targetId);
      if (handler) {
        await handler(message);
        
        if (message.acknowledgmentRequired) {
          await this.acknowledgeMessage(
            message.id,
            message.targetId,
            'delivered'
          );
        }
        
        // Update latency metric
        const latency = Date.now() - startTime;
        this.updateAverageLatency(latency);
        
        return;
      }

      // Queue for later delivery
      await this.queueMessage(message);
      
    } catch (error) {
      console.error(`Failed to deliver message ${message.id}:`, error);
      
      if (message.acknowledgmentRequired) {
        await this.acknowledgeMessage(
          message.id,
          message.targetId,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  private async handleIncomingMessage(message: Message): Promise<void> {
    try {
      // Decrypt if necessary
      if (message.encrypted) {
        message.payload = this.decryptPayload(message.payload);
      }

      // Validate message signature
      if (!(await this.validateMessageSignature(message))) {
        throw new Error('Invalid message signature');
      }

      // Check expiration
      if (message.expiresAt && new Date() > message.expiresAt) {
        throw new Error('Message has expired');
      }

      const handler = this.messageHandlers.get(message.targetId);
      if (handler) {
        await handler(message);
        
        if (message.acknowledgmentRequired) {
          await this.acknowledgeMessage(
            message.id,
            message.targetId,
            'processed'
          );
        }
        
        this.metrics.messagesReceived++;
      }
    } catch (error) {
      console.error('Failed to handle incoming message:', error);
      
      if (message.acknowledgmentRequired) {
        await this.acknowledgeMessage(
          message.id,
          message.targetId,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  private async signMessage(messageData: any): Promise<string> {
    const secret = new TextEncoder().encode(this.config.jwtSecret);
    const jwt = await new SignJWT(messageData)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .sign(secret);
    
    return jwt;
  }

  private async validateMessageSignature(message: Message): Promise<boolean> {
    try {
      const secret = new TextEncoder().encode(this.config.jwtSecret);
      await jwtVerify(message.signature, secret);
      return true;
    } catch {
      return false;
    }
  }

  private encryptPayload(payload: any): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.config.encryptionKey, 'hex');
    const iv = randomBytes(16);
    
    const cipher = createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  private decryptPayload(encryptedPayload: string): any {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.config.encryptionKey, 'hex');
    const { encrypted, iv, authTag } = JSON.parse(encryptedPayload);
    
    const decipher = createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldEncryptMessage(message: Message): boolean {
    const sensitiveTypes = ['credentials', 'personal_data', 'financial', 'confidential'];
    return sensitiveTypes.includes(message.messageType);
  }

  private getPriorityScore(priority: string): number {
    const scores = { low: 1, normal: 2, high: 3, urgent: 4 };
    return scores[priority as keyof typeof scores] || 2;
  }

  private parseMessageFromDb(dbMessage: any): Message {
    return {
      id: dbMessage.id,
      agentId: dbMessage.agent_id,
      targetId: dbMessage.target_id,
      messageType: dbMessage.message_type,
      payload: dbMessage.payload,
      timestamp: new Date(dbMessage.timestamp),
      signature: dbMessage.signature,
      priority: dbMessage.priority,
      encrypted: dbMessage.encrypted,
      acknowledgmentRequired: dbMessage.acknowledgment_required,
      expiresAt: dbMessage.expires_at ? new Date(dbMessage.expires_at) : undefined
    };
  }

  private async broadcastAgentUpdate(eventType: string, agentId: string): Promise<void> {
    await this.supabase
      .channel('agent_updates')
      .send({
        type: 'broadcast',
        event: eventType,
        payload: { agentId, timestamp: new Date().toISOString() }
      });
  }

  private updateAverageLatency(latency: number): void {
    const alpha = 0.1; // Exponential moving average factor
    this.metrics.averageLatency = 
      this.metrics.averageLatency * (1 - alpha) + latency * alpha;
  }

  // Cleanup
  async disconnect(): Promise<void> {
    // Unsubscribe from all channels
    for (const [agentId] of this.subscriptions) {
      await this.unsubscribeFromMessages(agentId);
    }

    // Close Redis connection
    if (this.redis) {
      // Redis client cleanup handled automatically
    }
  }
}

// Factory function
export function createAgentCommunicationClient(config: CommunicationConfig): AgentCommunicationClient {
  return new AgentCommunicationClient(config);
}

// Utility exports
export { MessageSchema };
export type { Agent, Message, MessageAcknowledgment, CommunicationConfig };
```