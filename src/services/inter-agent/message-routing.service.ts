```typescript
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger.util';
import { supabase } from '../../config/supabase';
import { redisClient } from '../../config/redis';
import { encryptionService } from '../security/encryption.service';
import { agentRegistryService } from './agent-registry.service';
import { monitoringService } from '../monitoring/monitoring.service';

/**
 * Message priority levels for routing
 */
export enum MessagePriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3
}

/**
 * Message delivery patterns
 */
export enum DeliveryPattern {
  DIRECT = 'direct',
  BROADCAST = 'broadcast',
  MULTICAST = 'multicast',
  ROUND_ROBIN = 'round_robin'
}

/**
 * Message delivery guarantee levels
 */
export enum DeliveryGuarantee {
  AT_MOST_ONCE = 'at_most_once',
  AT_LEAST_ONCE = 'at_least_once',
  EXACTLY_ONCE = 'exactly_once'
}

/**
 * Message status tracking
 */
export enum MessageStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENT = 'sent',
  ACKNOWLEDGED = 'acknowledged',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

/**
 * Inter-agent message interface
 */
export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId?: string;
  toAgentGroup?: string;
  type: string;
  payload: Record<string, any>;
  priority: MessagePriority;
  deliveryPattern: DeliveryPattern;
  deliveryGuarantee: DeliveryGuarantee;
  timestamp: Date;
  expiresAt?: Date;
  retryCount: number;
  maxRetries: number;
  metadata: Record<string, any>;
}

/**
 * Message routing configuration
 */
export interface RoutingConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryDelayMs: number;
  messageTimeoutMs: number;
  ackTimeoutMs: number;
  enableEncryption: boolean;
  enableMetrics: boolean;
}

/**
 * Message acknowledgment
 */
export interface MessageAck {
  messageId: string;
  agentId: string;
  status: 'success' | 'failure';
  error?: string;
  timestamp: Date;
}

/**
 * Delivery metrics
 */
export interface DeliveryMetrics {
  totalMessages: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageDeliveryTime: number;
  queueSize: number;
  retryRate: number;
}

/**
 * Message queue with priority support
 */
class MessageQueue {
  private queues: Map<MessagePriority, AgentMessage[]> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
    // Initialize priority queues
    Object.values(MessagePriority).forEach(priority => {
      if (typeof priority === 'number') {
        this.queues.set(priority, []);
      }
    });
  }

  /**
   * Enqueue message with priority
   */
  enqueue(message: AgentMessage): boolean {
    const queue = this.queues.get(message.priority);
    if (!queue) return false;

    if (this.getTotalSize() >= this.maxSize) {
      // Remove lowest priority message if queue is full
      this.removeLowPriorityMessage();
    }

    queue.push(message);
    queue.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return true;
  }

  /**
   * Dequeue highest priority message
   */
  dequeue(): AgentMessage | null {
    for (const priority of [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.NORMAL, MessagePriority.LOW]) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  /**
   * Get total queue size
   */
  getTotalSize(): number {
    return Array.from(this.queues.values()).reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Remove lowest priority message
   */
  private removeLowPriorityMessage(): void {
    for (const priority of [MessagePriority.LOW, MessagePriority.NORMAL, MessagePriority.HIGH]) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        queue.shift();
        return;
      }
    }
  }
}

/**
 * Delivery guarantee manager
 */
class DeliveryGuaranteeManager extends EventEmitter {
  private pendingAcks: Map<string, AgentMessage> = new Map();
  private retryQueue: AgentMessage[] = [];
  private ackTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(private config: RoutingConfig) {
    super();
    this.startRetryProcessor();
  }

  /**
   * Track message for delivery guarantee
   */
  trackMessage(message: AgentMessage): void {
    if (message.deliveryGuarantee === DeliveryGuarantee.AT_MOST_ONCE) {
      return; // No tracking needed
    }

    this.pendingAcks.set(message.id, message);

    // Set acknowledgment timeout
    const timeout = setTimeout(() => {
      this.handleAckTimeout(message.id);
    }, this.config.ackTimeoutMs);

    this.ackTimeouts.set(message.id, timeout);
  }

  /**
   * Process message acknowledgment
   */
  processAck(ack: MessageAck): void {
    const message = this.pendingAcks.get(ack.messageId);
    if (!message) return;

    // Clear timeout
    const timeout = this.ackTimeouts.get(ack.messageId);
    if (timeout) {
      clearTimeout(timeout);
      this.ackTimeouts.delete(ack.messageId);
    }

    if (ack.status === 'success') {
      this.pendingAcks.delete(ack.messageId);
      this.emit('messageDelivered', message, ack);
    } else {
      this.handleFailedDelivery(message, ack.error);
    }
  }

  /**
   * Handle acknowledgment timeout
   */
  private handleAckTimeout(messageId: string): void {
    const message = this.pendingAcks.get(messageId);
    if (message) {
      this.handleFailedDelivery(message, 'Acknowledgment timeout');
    }
  }

  /**
   * Handle failed delivery
   */
  private handleFailedDelivery(message: AgentMessage, error?: string): void {
    if (message.retryCount < message.maxRetries) {
      message.retryCount++;
      this.retryQueue.push(message);
      this.emit('messageRetry', message, error);
    } else {
      this.pendingAcks.delete(message.id);
      this.emit('messageFailure', message, error);
    }
  }

  /**
   * Start retry processor
   */
  private startRetryProcessor(): void {
    setInterval(() => {
      while (this.retryQueue.length > 0) {
        const message = this.retryQueue.shift()!;
        setTimeout(() => {
          this.emit('retryMessage', message);
        }, this.config.retryDelayMs * Math.pow(2, message.retryCount - 1));
      }
    }, 1000);
  }
}

/**
 * Broadcast manager for group messaging
 */
class BroadcastManager {
  constructor(
    private agentRegistry: typeof agentRegistryService,
    private messageRouter: MessageRouter
  ) {}

  /**
   * Broadcast message to all agents
   */
  async broadcastToAll(message: Omit<AgentMessage, 'toAgentId' | 'deliveryPattern'>): Promise<string[]> {
    const agents = await this.agentRegistry.getAllActiveAgents();
    const messageIds: string[] = [];

    for (const agent of agents) {
      if (agent.id !== message.fromAgentId) {
        const individualMessage: AgentMessage = {
          ...message,
          id: uuidv4(),
          toAgentId: agent.id,
          deliveryPattern: DeliveryPattern.BROADCAST
        };
        await this.messageRouter.routeMessage(individualMessage);
        messageIds.push(individualMessage.id);
      }
    }

    return messageIds;
  }

  /**
   * Multicast message to specific agent group
   */
  async multicastToGroup(
    message: Omit<AgentMessage, 'toAgentId' | 'deliveryPattern'>,
    groupId: string
  ): Promise<string[]> {
    const agents = await this.agentRegistry.getAgentsByGroup(groupId);
    const messageIds: string[] = [];

    for (const agent of agents) {
      if (agent.id !== message.fromAgentId) {
        const individualMessage: AgentMessage = {
          ...message,
          id: uuidv4(),
          toAgentId: agent.id,
          deliveryPattern: DeliveryPattern.MULTICAST
        };
        await this.messageRouter.routeMessage(individualMessage);
        messageIds.push(individualMessage.id);
      }
    }

    return messageIds;
  }
}

/**
 * Security validator for message authentication
 */
class SecurityValidator {
  constructor(private encryptionService: typeof encryptionService) {}

  /**
   * Validate message security
   */
  async validateMessage(message: AgentMessage): Promise<boolean> {
    try {
      // Verify sender is authenticated
      const senderExists = await agentRegistryService.getAgent(message.fromAgentId);
      if (!senderExists) {
        throw new Error('Sender not found in registry');
      }

      // Verify recipient exists (if direct message)
      if (message.toAgentId) {
        const recipientExists = await agentRegistryService.getAgent(message.toAgentId);
        if (!recipientExists) {
          throw new Error('Recipient not found in registry');
        }
      }

      // Validate message structure
      if (!message.type || !message.payload) {
        throw new Error('Invalid message structure');
      }

      return true;
    } catch (error) {
      Logger.error('Message validation failed:', error);
      return false;
    }
  }

  /**
   * Encrypt message payload
   */
  async encryptMessage(message: AgentMessage): Promise<AgentMessage> {
    if (!message.payload) return message;

    try {
      const encryptedPayload = await this.encryptionService.encrypt(
        JSON.stringify(message.payload)
      );
      
      return {
        ...message,
        payload: { encrypted: encryptedPayload },
        metadata: {
          ...message.metadata,
          encrypted: true
        }
      };
    } catch (error) {
      Logger.error('Message encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt message payload
   */
  async decryptMessage(message: AgentMessage): Promise<AgentMessage> {
    if (!message.metadata?.encrypted) return message;

    try {
      const decryptedPayload = await this.encryptionService.decrypt(
        message.payload.encrypted
      );
      
      return {
        ...message,
        payload: JSON.parse(decryptedPayload),
        metadata: {
          ...message.metadata,
          encrypted: false
        }
      };
    } catch (error) {
      Logger.error('Message decryption failed:', error);
      throw error;
    }
  }
}

/**
 * Metrics collector for performance tracking
 */
class MetricsCollector {
  private metrics: DeliveryMetrics = {
    totalMessages: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    averageDeliveryTime: 0,
    queueSize: 0,
    retryRate: 0
  };

  private deliveryTimes: number[] = [];

  /**
   * Record message sent
   */
  recordMessageSent(): void {
    this.metrics.totalMessages++;
  }

  /**
   * Record successful delivery
   */
  recordSuccessfulDelivery(deliveryTime: number): void {
    this.metrics.successfulDeliveries++;
    this.deliveryTimes.push(deliveryTime);
    this.updateAverageDeliveryTime();
  }

  /**
   * Record failed delivery
   */
  recordFailedDelivery(): void {
    this.metrics.failedDeliveries++;
  }

  /**
   * Update queue size
   */
  updateQueueSize(size: number): void {
    this.metrics.queueSize = size;
  }

  /**
   * Calculate retry rate
   */
  updateRetryRate(retries: number, total: number): void {
    this.metrics.retryRate = total > 0 ? (retries / total) * 100 : 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): DeliveryMetrics {
    return { ...this.metrics };
  }

  /**
   * Update average delivery time
   */
  private updateAverageDeliveryTime(): void {
    if (this.deliveryTimes.length === 0) return;
    
    const sum = this.deliveryTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageDeliveryTime = sum / this.deliveryTimes.length;
    
    // Keep only last 1000 delivery times for rolling average
    if (this.deliveryTimes.length > 1000) {
      this.deliveryTimes = this.deliveryTimes.slice(-1000);
    }
  }
}

/**
 * Main message router service
 */
class MessageRouter extends EventEmitter {
  private messageQueue: MessageQueue;
  private deliveryGuaranteeManager: DeliveryGuaranteeManager;
  private broadcastManager: BroadcastManager;
  private securityValidator: SecurityValidator;
  private metricsCollector: MetricsCollector;
  private isProcessing = false;

  constructor(private config: RoutingConfig) {
    super();

    this.messageQueue = new MessageQueue(config.maxQueueSize);
    this.deliveryGuaranteeManager = new DeliveryGuaranteeManager(config);
    this.broadcastManager = new BroadcastManager(agentRegistryService, this);
    this.securityValidator = new SecurityValidator(encryptionService);
    this.metricsCollector = new MetricsCollector();

    this.setupEventHandlers();
    this.startMessageProcessor();
  }

  /**
   * Route message to target agent(s)
   */
  async routeMessage(message: AgentMessage): Promise<void> {
    try {
      // Validate message security
      const isValid = await this.securityValidator.validateMessage(message);
      if (!isValid) {
        throw new Error('Message validation failed');
      }

      // Encrypt message if enabled
      let processedMessage = message;
      if (this.config.enableEncryption) {
        processedMessage = await this.securityValidator.encryptMessage(message);
      }

      // Handle different delivery patterns
      switch (processedMessage.deliveryPattern) {
        case DeliveryPattern.BROADCAST:
          await this.broadcastManager.broadcastToAll(processedMessage);
          break;
        
        case DeliveryPattern.MULTICAST:
          if (processedMessage.toAgentGroup) {
            await this.broadcastManager.multicastToGroup(processedMessage, processedMessage.toAgentGroup);
          }
          break;
        
        case DeliveryPattern.DIRECT:
        default:
          this.messageQueue.enqueue(processedMessage);
          break;
      }

      this.metricsCollector.recordMessageSent();
      this.emit('messageQueued', processedMessage);

    } catch (error) {
      Logger.error('Message routing failed:', error);
      this.emit('routingError', message, error);
      throw error;
    }
  }

  /**
   * Send message directly
   */
  async sendMessage(
    fromAgentId: string,
    toAgentId: string,
    type: string,
    payload: Record<string, any>,
    options: Partial<AgentMessage> = {}
  ): Promise<string> {
    const message: AgentMessage = {
      id: uuidv4(),
      fromAgentId,
      toAgentId,
      type,
      payload,
      priority: MessagePriority.NORMAL,
      deliveryPattern: DeliveryPattern.DIRECT,
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      metadata: {},
      ...options
    };

    await this.routeMessage(message);
    return message.id;
  }

  /**
   * Broadcast message to all agents
   */
  async broadcastMessage(
    fromAgentId: string,
    type: string,
    payload: Record<string, any>,
    options: Partial<AgentMessage> = {}
  ): Promise<string[]> {
    const message = {
      fromAgentId,
      type,
      payload,
      priority: MessagePriority.NORMAL,
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      metadata: {},
      ...options
    };

    return await this.broadcastManager.broadcastToAll(message);
  }

  /**
   * Process message acknowledgment
   */
  processAcknowledgment(ack: MessageAck): void {
    this.deliveryGuaranteeManager.processAck(ack);
  }

  /**
   * Get delivery metrics
   */
  getMetrics(): DeliveryMetrics {
    this.metricsCollector.updateQueueSize(this.messageQueue.getTotalSize());
    return this.metricsCollector.getMetrics();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.deliveryGuaranteeManager.on('messageDelivered', (message, ack) => {
      const deliveryTime = Date.now() - message.timestamp.getTime();
      this.metricsCollector.recordSuccessfulDelivery(deliveryTime);
      this.emit('messageDelivered', message, ack);
    });

    this.deliveryGuaranteeManager.on('messageFailure', (message, error) => {
      this.metricsCollector.recordFailedDelivery();
      this.emit('messageFailure', message, error);
    });

    this.deliveryGuaranteeManager.on('retryMessage', (message) => {
      this.messageQueue.enqueue(message);
    });
  }

  /**
   * Start message processor
   */
  private startMessageProcessor(): void {
    const processMessages = async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        const message = this.messageQueue.dequeue();
        if (message) {
          await this.deliverMessage(message);
        }
      } catch (error) {
        Logger.error('Message processing error:', error);
      } finally {
        this.isProcessing = false;
      }
    };

    // Process messages every 10ms
    setInterval(processMessages, 10);
  }

  /**
   * Deliver message to target agent
   */
  private async deliverMessage(message: AgentMessage): Promise<void> {
    try {
      // Check if message has expired
      if (message.expiresAt && message.expiresAt < new Date()) {
        this.emit('messageExpired', message);
        return;
      }

      // Track for delivery guarantee
      this.deliveryGuaranteeManager.trackMessage(message);

      // Decrypt message if needed
      let deliveryMessage = message;
      if (this.config.enableEncryption && message.metadata?.encrypted) {
        deliveryMessage = await this.securityValidator.decryptMessage(message);
      }

      // Send via Supabase Realtime
      await this.sendViaRealtime(deliveryMessage);

      // Store in Redis for offline agents
      await this.storeForOfflineAgent(deliveryMessage);

      this.emit('messageSent', deliveryMessage);

    } catch (error) {
      Logger.error('Message delivery failed:', error);
      this.deliveryGuaranteeManager.processAck({
        messageId: message.id,
        agentId: message.toAgentId || 'unknown',
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
    }
  }

  /**
   * Send message via Supabase Realtime
   */
  private async sendViaRealtime(message: AgentMessage): Promise<void> {
    if (!message.toAgentId) return;

    const channel = supabase.channel(`agent-${message.toAgentId}`);
    await channel.send({
      type: 'broadcast',
      event: 'agent_message',
      payload: message
    });
  }

  /**
   * Store message for offline agent
   */
  private async storeForOfflineAgent(message: AgentMessage): Promise<void> {
    if (!message.toAgentId) return;

    const key = `offline_messages:${message.toAgentId}`;
    await redisClient.lpush(key, JSON.stringify(message));
    
    // Set expiration for the key (24 hours)
    await redisClient.expire(key, 24 * 60 * 60);
  }
}

/**
 * Default routing configuration
 */
const defaultConfig: RoutingConfig = {
  maxQueueSize: 10000,
  maxRetries: 3,
  retryDelayMs: 1000,
  messageTimeoutMs: 30000,
  ackTimeoutMs: 5000,
  enableEncryption: true,
  enableMetrics: true
};

/**
 * Inter-Agent Message Routing Service
 * Provides secure and efficient message routing between team agents
 */
export class InterAgentMessageRoutingService {
  private messageRouter: MessageRouter;

  constructor(config: Partial<RoutingConfig> = {}) {
    const finalConfig = { ...defaultConfig, ...config };
    this.messageRouter = new MessageRouter(finalConfig);
    
    this.setupMonitoring();
  }

  /**
   * Send direct message to specific agent