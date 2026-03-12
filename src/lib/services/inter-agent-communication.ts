```typescript
import { createClient, RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Inter-Agent Communication Protocol Service
 * Provides secure, low-latency communication between AI agents with real-time
 * context sharing, resource coordination, and task synchronization.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AgentIdentity {
  id: string;
  type: string;
  capabilities: string[];
  priority: number;
  status: 'online' | 'busy' | 'offline';
  lastSeen: number;
}

export interface Message {
  id: string;
  from: string;
  to?: string | string[]; // undefined = broadcast
  channel: string;
  type: MessageType;
  payload: unknown;
  timestamp: number;
  encrypted: boolean;
  priority: MessagePriority;
  expires?: number;
}

export enum MessageType {
  CONTEXT_UPDATE = 'context_update',
  RESOURCE_REQUEST = 'resource_request',
  RESOURCE_RESPONSE = 'resource_response',
  TASK_COORDINATION = 'task_coordination',
  CAPABILITY_BROADCAST = 'capability_broadcast',
  PRESENCE_UPDATE = 'presence_update',
  SYSTEM_NOTIFICATION = 'system_notification',
  HEARTBEAT = 'heartbeat'
}

export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export interface ContextState {
  agentId: string;
  data: Record<string, unknown>;
  version: number;
  timestamp: number;
  checksum: string;
}

export interface ResourceLock {
  resourceId: string;
  ownerId: string;
  type: 'read' | 'write' | 'exclusive';
  expires: number;
  metadata?: Record<string, unknown>;
}

export interface TaskCoordination {
  taskId: string;
  orchestratorId: string;
  participantIds: string[];
  dependencies: string[];
  priority: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  metadata: Record<string, unknown>;
}

export interface CommunicationConfig {
  encryption: {
    enabled: boolean;
    algorithm: 'AES-GCM';
    keySize: 256;
  };
  channels: {
    maxChannels: number;
    heartbeatInterval: number;
    presenceTimeout: number;
  };
  messaging: {
    maxMessageSize: number;
    queueSize: number;
    retryAttempts: number;
    retryDelay: number;
  };
  security: {
    allowedOrigins: string[];
    maxConnections: number;
    rateLimiting: {
      messages: number;
      window: number;
    };
  };
}

// ============================================================================
// State Management
// ============================================================================

interface CommunicationState {
  agents: Map<string, AgentIdentity>;
  messages: Map<string, Message>;
  contexts: Map<string, ContextState>;
  resources: Map<string, ResourceLock>;
  tasks: Map<string, TaskCoordination>;
  channels: Map<string, RealtimeChannel>;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastActivity: number;
}

const useCommunicationStore = create<CommunicationState>()(
  subscribeWithSelector(() => ({
    agents: new Map(),
    messages: new Map(),
    contexts: new Map(),
    resources: new Map(),
    tasks: new Map(),
    channels: new Map(),
    connectionStatus: 'disconnected',
    lastActivity: Date.now()
  }))
);

// ============================================================================
// Security Layer
// ============================================================================

class SecurityLayer {
  private keyCache = new Map<string, CryptoKey>();
  private readonly algorithm = 'AES-GCM';

  /**
   * Generate encryption key for agent communication
   */
  async generateKey(): Promise<CryptoKey> {
    try {
      return await crypto.subtle.generateKey(
        { name: this.algorithm, length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new Error(`Failed to generate encryption key: ${error}`);
    }
  }

  /**
   * Encrypt message payload
   */
  async encryptMessage(payload: unknown, agentId: string): Promise<ArrayBuffer> {
    try {
      let key = this.keyCache.get(agentId);
      if (!key) {
        key = await this.generateKey();
        this.keyCache.set(agentId, key);
      }

      const data = new TextEncoder().encode(JSON.stringify(payload));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm, iv },
        key,
        data
      );

      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encrypted), iv.length);
      
      return result.buffer;
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt message payload
   */
  async decryptMessage(encryptedData: ArrayBuffer, agentId: string): Promise<unknown> {
    try {
      const key = this.keyCache.get(agentId);
      if (!key) {
        throw new Error('Decryption key not found');
      }

      const data = new Uint8Array(encryptedData);
      const iv = data.slice(0, 12);
      const encrypted = data.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm, iv },
        key,
        encrypted
      );

      const json = new TextDecoder().decode(decrypted);
      return JSON.parse(json);
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Validate message integrity
   */
  validateMessage(message: Message): boolean {
    if (!message.id || !message.from || !message.type) return false;
    if (message.expires && Date.now() > message.expires) return false;
    if (!Object.values(MessageType).includes(message.type)) return false;
    return true;
  }
}

// ============================================================================
// Message Broker
// ============================================================================

class MessageBroker {
  private queues = new Map<string, Message[]>();
  private subscribers = new Map<string, Set<(message: Message) => void>>();
  private rateLimiter = new Map<string, { count: number; resetTime: number }>();

  /**
   * Queue message for delivery
   */
  queueMessage(message: Message): void {
    const channel = message.channel;
    if (!this.queues.has(channel)) {
      this.queues.set(channel, []);
    }

    const queue = this.queues.get(channel)!;
    
    // Insert message based on priority
    const insertIndex = queue.findIndex(m => m.priority < message.priority);
    if (insertIndex === -1) {
      queue.push(message);
    } else {
      queue.splice(insertIndex, 0, message);
    }

    this.processQueue(channel);
  }

  /**
   * Subscribe to channel messages
   */
  subscribe(channel: string, callback: (message: Message) => void): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }

    this.subscribers.get(channel)!.add(callback);

    return () => {
      this.subscribers.get(channel)?.delete(callback);
    };
  }

  /**
   * Process message queue for channel
   */
  private processQueue(channel: string): void {
    const queue = this.queues.get(channel);
    if (!queue || queue.length === 0) return;

    const message = queue.shift()!;
    const subscribers = this.subscribers.get(channel);

    if (subscribers && subscribers.size > 0) {
      subscribers.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Message delivery failed:', error);
        }
      });
    }

    // Continue processing if queue has more messages
    if (queue.length > 0) {
      setTimeout(() => this.processQueue(channel), 1);
    }
  }

  /**
   * Check rate limiting
   */
  checkRateLimit(agentId: string, limit: number, window: number): boolean {
    const now = Date.now();
    const entry = this.rateLimiter.get(agentId);

    if (!entry || now > entry.resetTime) {
      this.rateLimiter.set(agentId, { count: 1, resetTime: now + window });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }
}

// ============================================================================
// Context Synchronizer
// ============================================================================

class ContextSynchronizer {
  private conflictResolver = new ConflictResolver();

  /**
   * Synchronize context state between agents
   */
  async synchronizeContext(localContext: ContextState, remoteContext: ContextState): Promise<ContextState> {
    if (localContext.version === remoteContext.version) {
      return localContext; // Already synchronized
    }

    if (localContext.version > remoteContext.version) {
      return localContext; // Local is newer
    }

    if (localContext.version < remoteContext.version) {
      return remoteContext; // Remote is newer
    }

    // Version conflict - resolve
    return await this.conflictResolver.resolveContextConflict(localContext, remoteContext);
  }

  /**
   * Generate context checksum
   */
  generateChecksum(data: Record<string, unknown>): string {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return btoa(serialized).slice(0, 16);
  }

  /**
   * Validate context integrity
   */
  validateContext(context: ContextState): boolean {
    const expectedChecksum = this.generateChecksum(context.data);
    return context.checksum === expectedChecksum;
  }
}

// ============================================================================
// Resource Coordinator
// ============================================================================

class ResourceCoordinator {
  private locks = new Map<string, ResourceLock>();
  private waitingQueue = new Map<string, Array<{
    agentId: string;
    type: 'read' | 'write' | 'exclusive';
    resolve: (lock: ResourceLock) => void;
    reject: (error: Error) => void;
  }>>();

  /**
   * Acquire resource lock
   */
  async acquireLock(
    resourceId: string,
    agentId: string,
    type: 'read' | 'write' | 'exclusive',
    timeout = 30000
  ): Promise<ResourceLock> {
    return new Promise((resolve, reject) => {
      const existingLock = this.locks.get(resourceId);
      const now = Date.now();

      // Clean up expired locks
      if (existingLock && now > existingLock.expires) {
        this.locks.delete(resourceId);
      }

      // Check if resource is available
      if (!existingLock || this.canAcquireLock(existingLock, type)) {
        const lock: ResourceLock = {
          resourceId,
          ownerId: agentId,
          type,
          expires: now + timeout
        };
        
        this.locks.set(resourceId, lock);
        resolve(lock);
        return;
      }

      // Queue the request
      if (!this.waitingQueue.has(resourceId)) {
        this.waitingQueue.set(resourceId, []);
      }

      this.waitingQueue.get(resourceId)!.push({
        agentId,
        type,
        resolve,
        reject
      });

      // Set timeout
      setTimeout(() => {
        const queue = this.waitingQueue.get(resourceId);
        if (queue) {
          const index = queue.findIndex(item => item.agentId === agentId);
          if (index !== -1) {
            queue.splice(index, 1);
            reject(new Error('Lock acquisition timeout'));
          }
        }
      }, timeout);
    });
  }

  /**
   * Release resource lock
   */
  releaseLock(resourceId: string, agentId: string): boolean {
    const lock = this.locks.get(resourceId);
    if (!lock || lock.ownerId !== agentId) {
      return false;
    }

    this.locks.delete(resourceId);
    this.processWaitingQueue(resourceId);
    return true;
  }

  private canAcquireLock(existingLock: ResourceLock, requestedType: string): boolean {
    if (existingLock.type === 'exclusive') return false;
    if (requestedType === 'exclusive') return false;
    if (existingLock.type === 'write' || requestedType === 'write') return false;
    return true; // Both are read locks
  }

  private processWaitingQueue(resourceId: string): void {
    const queue = this.waitingQueue.get(resourceId);
    if (!queue || queue.length === 0) return;

    const request = queue.shift()!;
    const now = Date.now();

    const lock: ResourceLock = {
      resourceId,
      ownerId: request.agentId,
      type: request.type,
      expires: now + 30000
    };

    this.locks.set(resourceId, lock);
    request.resolve(lock);
  }
}

// ============================================================================
// Task Orchestrator
// ============================================================================

class TaskOrchestrator {
  private tasks = new Map<string, TaskCoordination>();
  private dependencies = new Map<string, Set<string>>();

  /**
   * Create coordinated task
   */
  createTask(
    taskId: string,
    orchestratorId: string,
    participantIds: string[],
    dependencies: string[] = [],
    priority = 1
  ): TaskCoordination {
    const task: TaskCoordination = {
      taskId,
      orchestratorId,
      participantIds,
      dependencies,
      priority,
      status: 'pending',
      metadata: {}
    };

    this.tasks.set(taskId, task);
    this.dependencies.set(taskId, new Set(dependencies));
    
    this.checkTaskReadiness(taskId);
    return task;
  }

  /**
   * Complete task
   */
  completeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'completed';
    this.checkDependentTasks(taskId);
    return true;
  }

  /**
   * Get task execution order based on dependencies
   */
  getExecutionOrder(taskIds: string[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (taskId: string): void => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected: ${taskId}`);
      }

      visiting.add(taskId);
      const deps = this.dependencies.get(taskId) || new Set();
      
      for (const dep of deps) {
        if (taskIds.includes(dep)) {
          visit(dep);
        }
      }

      visiting.delete(taskId);
      visited.add(taskId);
      result.push(taskId);
    };

    for (const taskId of taskIds) {
      visit(taskId);
    }

    return result;
  }

  private checkTaskReadiness(taskId: string): void {
    const task = this.tasks.get(taskId);
    const deps = this.dependencies.get(taskId);
    
    if (!task || !deps) return;

    const allCompleted = Array.from(deps).every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask?.status === 'completed';
    });

    if (allCompleted && task.status === 'pending') {
      task.status = 'active';
    }
  }

  private checkDependentTasks(completedTaskId: string): void {
    for (const [taskId, deps] of this.dependencies) {
      if (deps.has(completedTaskId)) {
        this.checkTaskReadiness(taskId);
      }
    }
  }
}

// ============================================================================
// Presence Manager
// ============================================================================

class PresenceManager {
  private presenceStates = new Map<string, AgentIdentity>();
  private heartbeatTimers = new Map<string, NodeJS.Timeout>();
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly PRESENCE_TIMEOUT = 90000; // 90 seconds

  /**
   * Register agent presence
   */
  registerAgent(agent: AgentIdentity): void {
    agent.lastSeen = Date.now();
    this.presenceStates.set(agent.id, agent);
    this.startHeartbeat(agent.id);
  }

  /**
   * Update agent status
   */
  updateStatus(agentId: string, status: AgentIdentity['status']): boolean {
    const agent = this.presenceStates.get(agentId);
    if (!agent) return false;

    agent.status = status;
    agent.lastSeen = Date.now();
    return true;
  }

  /**
   * Remove agent from presence
   */
  removeAgent(agentId: string): boolean {
    const timer = this.heartbeatTimers.get(agentId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(agentId);
    }
    
    return this.presenceStates.delete(agentId);
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): AgentIdentity[] {
    const now = Date.now();
    return Array.from(this.presenceStates.values())
      .filter(agent => now - agent.lastSeen < this.PRESENCE_TIMEOUT);
  }

  private startHeartbeat(agentId: string): void {
    const timer = setInterval(() => {
      const agent = this.presenceStates.get(agentId);
      if (!agent) {
        clearInterval(timer);
        this.heartbeatTimers.delete(agentId);
        return;
      }

      const now = Date.now();
      if (now - agent.lastSeen > this.PRESENCE_TIMEOUT) {
        this.removeAgent(agentId);
      }
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatTimers.set(agentId, timer);
  }
}

// ============================================================================
// Conflict Resolver
// ============================================================================

class ConflictResolver {
  /**
   * Resolve context conflicts between agents
   */
  async resolveContextConflict(
    localContext: ContextState,
    remoteContext: ContextState
  ): Promise<ContextState> {
    // Merge strategy based on timestamps and priority
    const mergedData = { ...localContext.data };
    
    for (const [key, remoteValue] of Object.entries(remoteContext.data)) {
      if (!(key in localContext.data)) {
        mergedData[key] = remoteValue;
      } else if (remoteContext.timestamp > localContext.timestamp) {
        mergedData[key] = remoteValue;
      }
    }

    return {
      agentId: localContext.agentId,
      data: mergedData,
      version: Math.max(localContext.version, remoteContext.version) + 1,
      timestamp: Date.now(),
      checksum: new ContextSynchronizer().generateChecksum(mergedData)
    };
  }

  /**
   * Resolve resource access conflicts
   */
  resolveResourceConflict(
    requests: Array<{ agentId: string; type: string; priority: number }>
  ): string | null {
    if (requests.length === 0) return null;

    // Sort by priority, then by arrival time
    requests.sort((a, b) => b.priority - a.priority);
    return requests[0].agentId;
  }
}

// ============================================================================
// Main Service
// ============================================================================

export class AgentCommunicationService {
  private supabaseClient;
  private config: CommunicationConfig;
  private securityLayer = new SecurityLayer();
  private messageBroker = new MessageBroker();
  private contextSynchronizer = new ContextSynchronizer();
  private resourceCoordinator = new ResourceCoordinator();
  private taskOrchestrator = new TaskOrchestrator();
  private presenceManager = new PresenceManager();
  private currentAgent?: AgentIdentity;

  constructor(supabaseUrl: string, supabaseKey: string, config?: Partial<CommunicationConfig>) {
    this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: {
          eventsPerSecond: 100
        }
      }
    });

    this.config = {
      encryption: {
        enabled: true,
        algorithm: 'AES-GCM',
        keySize: 256
      },
      channels: {
        maxChannels: 10,
        heartbeatInterval: 30000,
        presenceTimeout: 90000
      },
      messaging: {
        maxMessageSize: 1024 * 1024, // 1MB
        queueSize: 1000,
        retryAttempts: 3,
        retryDelay: 1000
      },
      security: {
        allowedOrigins: ['*'],
        maxConnections: 100,
        rateLimiting: {
          messages: 100,
          window: 60000
        }
      },
      ...config
    };
  }

  /**
   * Initialize communication service
   */
  async initialize(agent: AgentIdentity): Promise<void> {
    try {
      this.currentAgent = agent;
      
      // Register agent presence
      this.presenceManager.registerAgent(agent);
      
      // Connect to main communication channel
      await this.connectToChannel('main');
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Update connection status
      useCommunicationStore.setState({ connectionStatus: 'connected' });
      
      console.log(`Agent ${agent.id} initialized communication service`);
    } catch (error) {
      useCommunicationStore.setState({ connectionStatus: 'error' });
      throw new Error(`Failed to initialize communication service: ${error}`);
    }
  }

  /**
   * Connect to communication channel
   */
  async connectToChannel(channelName: string): Promise<RealtimeChannel> {
    const channel