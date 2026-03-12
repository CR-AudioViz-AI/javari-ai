```typescript
/**
 * @fileoverview Craiverse State Persistence Microservice
 * 
 * Handles world state synchronization, delta compression, and conflict resolution
 * for concurrent user modifications across sessions in the Craiverse ecosystem.
 * 
 * Features:
 * - CRDT-based conflict resolution with vector clocks
 * - LZ4 delta compression for efficient state sync
 * - Redis caching for active world states
 * - WebSocket real-time synchronization
 * - Operational transforms for concurrent edits
 * - Automatic conflict detection and resolution
 * 
 * @author CR AudioViz AI
 * @version 1.0.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { WebSocket, WebSocketServer } from 'ws';
import LZ4 from 'lz4';
import { EventEmitter } from 'events';

/**
 * Vector clock for ordering concurrent operations
 */
interface VectorClock {
  /** Node identifier */
  nodeId: string;
  /** Clock value for this node */
  clock: number;
  /** Clock values for other nodes */
  vector: Record<string, number>;
}

/**
 * Delta operation representing a state change
 */
interface StateOperation {
  /** Unique operation ID */
  id: string;
  /** Operation type */
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE';
  /** Target entity path */
  path: string[];
  /** Operation payload */
  payload: any;
  /** Vector clock timestamp */
  vectorClock: VectorClock;
  /** User who performed the operation */
  userId: string;
  /** Timestamp when operation occurred */
  timestamp: number;
}

/**
 * Compressed state delta
 */
interface CompressedDelta {
  /** Compressed operation data */
  data: Buffer;
  /** Compression metadata */
  metadata: {
    originalSize: number;
    compressedSize: number;
    algorithm: 'lz4';
    checksum: string;
  };
  /** Operations included in this delta */
  operationIds: string[];
}

/**
 * World state snapshot
 */
interface WorldState {
  /** World identifier */
  worldId: string;
  /** Current state version */
  version: number;
  /** Complete world data */
  data: Record<string, any>;
  /** Vector clock for this state */
  vectorClock: VectorClock;
  /** Last modification timestamp */
  lastModified: number;
  /** Active user sessions */
  activeSessions: Set<string>;
}

/**
 * Conflict resolution result
 */
interface ConflictResolution {
  /** Whether conflict was resolved */
  resolved: boolean;
  /** Merged state after resolution */
  mergedState: any;
  /** Operations that were applied */
  appliedOperations: StateOperation[];
  /** Operations that were rejected */
  rejectedOperations: StateOperation[];
  /** Resolution strategy used */
  strategy: 'LAST_WRITE_WINS' | 'OPERATIONAL_TRANSFORM' | 'MANUAL_MERGE';
}

/**
 * Client connection interface
 */
interface ClientConnection {
  /** Client session ID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** WebSocket connection */
  websocket: WebSocket;
  /** Subscribed world IDs */
  subscribedWorlds: Set<string>;
  /** Client's vector clock */
  vectorClock: VectorClock;
  /** Last ping timestamp */
  lastPing: number;
}

/**
 * Sync event types
 */
type SyncEventType = 
  | 'STATE_CHANGED'
  | 'OPERATION_APPLIED'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED'
  | 'CLIENT_CONNECTED'
  | 'CLIENT_DISCONNECTED'
  | 'SNAPSHOT_CREATED';

/**
 * Configuration for the state persistence service
 */
interface StatePersistenceConfig {
  /** Supabase configuration */
  supabase: {
    url: string;
    key: string;
  };
  /** Redis configuration */
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  /** WebSocket server configuration */
  websocket: {
    port: number;
    heartbeatInterval: number;
  };
  /** State management settings */
  state: {
    maxCacheSize: number;
    snapshotInterval: number;
    conflictResolutionTimeout: number;
  };
}

/**
 * Delta compression engine for efficient state synchronization
 */
class DeltaCompressor {
  /**
   * Compress a collection of state operations
   */
  public async compressOperations(operations: StateOperation[]): Promise<CompressedDelta> {
    const serialized = JSON.stringify(operations);
    const buffer = Buffer.from(serialized, 'utf8');
    const compressed = LZ4.encode(buffer);
    
    const checksum = this.calculateChecksum(buffer);
    
    return {
      data: compressed,
      metadata: {
        originalSize: buffer.length,
        compressedSize: compressed.length,
        algorithm: 'lz4',
        checksum
      },
      operationIds: operations.map(op => op.id)
    };
  }

  /**
   * Decompress delta operations
   */
  public async decompressOperations(delta: CompressedDelta): Promise<StateOperation[]> {
    const decompressed = LZ4.decode(delta.data);
    const checksum = this.calculateChecksum(decompressed);
    
    if (checksum !== delta.metadata.checksum) {
      throw new Error('Checksum verification failed during decompression');
    }
    
    const serialized = decompressed.toString('utf8');
    return JSON.parse(serialized);
  }

  /**
   * Calculate checksum for integrity verification
   */
  private calculateChecksum(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

/**
 * CRDT-based conflict resolver using vector clocks and operational transforms
 */
class ConflictResolver {
  /**
   * Resolve conflicts between concurrent operations
   */
  public async resolveConflicts(
    operations: StateOperation[],
    currentState: any
  ): Promise<ConflictResolution> {
    // Sort operations by vector clock ordering
    const sortedOps = this.sortByVectorClock(operations);
    
    const appliedOps: StateOperation[] = [];
    const rejectedOps: StateOperation[] = [];
    let mergedState = { ...currentState };
    
    for (const operation of sortedOps) {
      try {
        const transformedOp = await this.transformOperation(operation, appliedOps);
        mergedState = this.applyOperation(mergedState, transformedOp);
        appliedOps.push(transformedOp);
      } catch (error) {
        rejectedOps.push(operation);
      }
    }
    
    return {
      resolved: rejectedOps.length === 0,
      mergedState,
      appliedOperations: appliedOps,
      rejectedOperations: rejectedOps,
      strategy: 'OPERATIONAL_TRANSFORM'
    };
  }

  /**
   * Sort operations by vector clock causality
   */
  private sortByVectorClock(operations: StateOperation[]): StateOperation[] {
    return operations.sort((a, b) => {
      return this.compareVectorClocks(a.vectorClock, b.vectorClock);
    });
  }

  /**
   * Compare two vector clocks to determine ordering
   */
  private compareVectorClocks(a: VectorClock, b: VectorClock): number {
    // If one clock is causally before the other, order accordingly
    if (this.isCausallyBefore(a, b)) return -1;
    if (this.isCausallyBefore(b, a)) return 1;
    
    // Concurrent operations: use timestamp as tiebreaker
    return a.clock - b.clock;
  }

  /**
   * Check if vector clock A is causally before B
   */
  private isCausallyBefore(a: VectorClock, b: VectorClock): boolean {
    const allNodes = new Set([...Object.keys(a.vector), ...Object.keys(b.vector)]);
    
    let hasSmaller = false;
    for (const node of allNodes) {
      const aValue = node === a.nodeId ? a.clock : (a.vector[node] || 0);
      const bValue = node === b.nodeId ? b.clock : (b.vector[node] || 0);
      
      if (aValue > bValue) return false;
      if (aValue < bValue) hasSmaller = true;
    }
    
    return hasSmaller;
  }

  /**
   * Transform operation to resolve conflicts with previously applied operations
   */
  private async transformOperation(
    operation: StateOperation,
    appliedOperations: StateOperation[]
  ): Promise<StateOperation> {
    let transformedOp = { ...operation };
    
    // Apply operational transforms based on conflicting operations
    for (const appliedOp of appliedOperations) {
      if (this.operationsConflict(transformedOp, appliedOp)) {
        transformedOp = await this.applyTransform(transformedOp, appliedOp);
      }
    }
    
    return transformedOp;
  }

  /**
   * Check if two operations conflict
   */
  private operationsConflict(op1: StateOperation, op2: StateOperation): boolean {
    // Operations conflict if they target the same path or parent-child relationship
    return this.pathsConflict(op1.path, op2.path);
  }

  /**
   * Check if two paths conflict
   */
  private pathsConflict(path1: string[], path2: string[]): boolean {
    const minLength = Math.min(path1.length, path2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (path1[i] !== path2[i]) return false;
    }
    
    return true; // One path is a prefix of the other
  }

  /**
   * Apply operational transform to resolve conflict
   */
  private async applyTransform(
    operation: StateOperation,
    conflictingOp: StateOperation
  ): Promise<StateOperation> {
    // Implement specific transform logic based on operation types
    switch (operation.type) {
      case 'CREATE':
        return this.transformCreate(operation, conflictingOp);
      case 'UPDATE':
        return this.transformUpdate(operation, conflictingOp);
      case 'DELETE':
        return this.transformDelete(operation, conflictingOp);
      case 'MOVE':
        return this.transformMove(operation, conflictingOp);
      default:
        return operation;
    }
  }

  /**
   * Transform CREATE operation
   */
  private transformCreate(op: StateOperation, conflict: StateOperation): StateOperation {
    if (conflict.type === 'CREATE') {
      // Both creating at same location: modify path to avoid collision
      const newPath = [...op.path];
      newPath[newPath.length - 1] += `_${op.vectorClock.nodeId}`;
      return { ...op, path: newPath };
    }
    return op;
  }

  /**
   * Transform UPDATE operation
   */
  private transformUpdate(op: StateOperation, conflict: StateOperation): StateOperation {
    if (conflict.type === 'DELETE') {
      // Target was deleted: reject update
      throw new Error('Cannot update deleted entity');
    }
    return op;
  }

  /**
   * Transform DELETE operation
   */
  private transformDelete(op: StateOperation, conflict: StateOperation): StateOperation {
    if (conflict.type === 'DELETE') {
      // Already deleted: no-op
      throw new Error('Entity already deleted');
    }
    return op;
  }

  /**
   * Transform MOVE operation
   */
  private transformMove(op: StateOperation, conflict: StateOperation): StateOperation {
    // Complex move transformation logic
    return op;
  }

  /**
   * Apply operation to state
   */
  private applyOperation(state: any, operation: StateOperation): any {
    const newState = { ...state };
    
    switch (operation.type) {
      case 'CREATE':
        this.setNestedValue(newState, operation.path, operation.payload);
        break;
      case 'UPDATE':
        this.updateNestedValue(newState, operation.path, operation.payload);
        break;
      case 'DELETE':
        this.deleteNestedValue(newState, operation.path);
        break;
      case 'MOVE':
        this.moveNestedValue(newState, operation.path, operation.payload.newPath);
        break;
    }
    
    return newState;
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!(path[i] in current)) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  }

  /**
   * Update nested value in object
   */
  private updateNestedValue(obj: any, path: string[], updates: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    Object.assign(current[path[path.length - 1]], updates);
  }

  /**
   * Delete nested value from object
   */
  private deleteNestedValue(obj: any, path: string[]): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    delete current[path[path.length - 1]];
  }

  /**
   * Move nested value in object
   */
  private moveNestedValue(obj: any, fromPath: string[], toPath: string[]): void {
    const value = this.getNestedValue(obj, fromPath);
    this.deleteNestedValue(obj, fromPath);
    this.setNestedValue(obj, toPath, value);
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string[]): any {
    let current = obj;
    for (const key of path) {
      current = current[key];
    }
    return current;
  }
}

/**
 * State manager for handling world state operations
 */
class StateManager {
  private states = new Map<string, WorldState>();
  private conflictResolver = new ConflictResolver();

  /**
   * Get world state by ID
   */
  public getWorldState(worldId: string): WorldState | null {
    return this.states.get(worldId) || null;
  }

  /**
   * Update world state with operations
   */
  public async updateWorldState(
    worldId: string,
    operations: StateOperation[]
  ): Promise<ConflictResolution> {
    const currentState = this.states.get(worldId);
    if (!currentState) {
      throw new Error(`World state not found: ${worldId}`);
    }

    const resolution = await this.conflictResolver.resolveConflicts(
      operations,
      currentState.data
    );

    if (resolution.resolved) {
      const newState: WorldState = {
        ...currentState,
        data: resolution.mergedState,
        version: currentState.version + 1,
        lastModified: Date.now(),
        vectorClock: this.mergeVectorClocks(
          currentState.vectorClock,
          operations.map(op => op.vectorClock)
        )
      };

      this.states.set(worldId, newState);
    }

    return resolution;
  }

  /**
   * Merge multiple vector clocks
   */
  private mergeVectorClocks(base: VectorClock, clocks: VectorClock[]): VectorClock {
    const merged = { ...base };
    
    for (const clock of clocks) {
      // Update vector with maximum values from all clocks
      merged.vector[clock.nodeId] = Math.max(
        merged.vector[clock.nodeId] || 0,
        clock.clock
      );
      
      for (const [nodeId, value] of Object.entries(clock.vector)) {
        merged.vector[nodeId] = Math.max(
          merged.vector[nodeId] || 0,
          value
        );
      }
    }
    
    merged.clock = Math.max(merged.clock, ...clocks.map(c => c.clock)) + 1;
    
    return merged;
  }

  /**
   * Create snapshot of world state
   */
  public createSnapshot(worldId: string): WorldState | null {
    const state = this.states.get(worldId);
    if (!state) return null;

    return {
      ...state,
      data: JSON.parse(JSON.stringify(state.data)), // Deep clone
      activeSessions: new Set(state.activeSessions)
    };
  }

  /**
   * Load world state from snapshot
   */
  public loadFromSnapshot(worldId: string, snapshot: WorldState): void {
    this.states.set(worldId, {
      ...snapshot,
      activeSessions: new Set(snapshot.activeSessions)
    });
  }
}

/**
 * Synchronization engine for real-time state updates
 */
class SyncEngine extends EventEmitter {
  private clients = new Map<string, ClientConnection>();
  private pendingOperations = new Map<string, StateOperation[]>();

  /**
   * Add client connection
   */
  public addClient(connection: ClientConnection): void {
    this.clients.set(connection.sessionId, connection);
    this.emit('CLIENT_CONNECTED', connection);
  }

  /**
   * Remove client connection
   */
  public removeClient(sessionId: string): void {
    const client = this.clients.get(sessionId);
    if (client) {
      this.clients.delete(sessionId);
      this.emit('CLIENT_DISCONNECTED', client);
    }
  }

  /**
   * Broadcast operations to subscribed clients
   */
  public async broadcastOperations(worldId: string, operations: StateOperation[]): Promise<void> {
    const subscribedClients = Array.from(this.clients.values())
      .filter(client => client.subscribedWorlds.has(worldId));

    const compressor = new DeltaCompressor();
    const compressed = await compressor.compressOperations(operations);

    const message = JSON.stringify({
      type: 'STATE_UPDATE',
      worldId,
      delta: {
        data: compressed.data.toString('base64'),
        metadata: compressed.metadata,
        operationIds: compressed.operationIds
      }
    });

    subscribedClients.forEach(client => {
      if (client.websocket.readyState === WebSocket.OPEN) {
        client.websocket.send(message);
      }
    });
  }

  /**
   * Handle client operation
   */
  public addPendingOperations(worldId: string, operations: StateOperation[]): void {
    if (!this.pendingOperations.has(worldId)) {
      this.pendingOperations.set(worldId, []);
    }
    this.pendingOperations.get(worldId)!.push(...operations);
  }

  /**
   * Get and clear pending operations
   */
  public getPendingOperations(worldId: string): StateOperation[] {
    const operations = this.pendingOperations.get(worldId) || [];
    this.pendingOperations.set(worldId, []);
    return operations;
  }
}

/**
 * Database adapter for persistent storage
 */
class DatabaseAdapter {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Save world state to database
   */
  public async saveWorldState(state: WorldState): Promise<void> {
    const { error } = await this.supabase
      .from('world_states')
      .upsert({
        world_id: state.worldId,
        version: state.version,
        data: state.data,
        vector_clock: state.vectorClock,
        last_modified: new Date(state.lastModified).toISOString()
      });

    if (error) {
      throw new Error(`Failed to save world state: ${error.message}`);
    }
  }

  /**
   * Load world state from database
   */
  public async loadWorldState(worldId: string): Promise<WorldState | null> {
    const { data, error } = await this.supabase
      .from('world_states')
      .select('*')
      .eq('world_id', worldId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to load world state: ${error.message}`);
    }

    return {
      worldId: data.world_id,
      version: data.version,
      data: data.data,
      vectorClock: data.vector_clock,
      lastModified: new Date(data.last_modified).getTime(),
      activeSessions: new Set()
    };
  }

  /**
   * Save state operations to database
   */
  public async saveOperations(worldId: string, operations: StateOperation[]): Promise<void> {
    const records = operations.map(op => ({
      id: op.id,
      world_id: worldId,
      type: op.type,
      path: op.path,
      payload: op.payload,
      vector_clock: op.vectorClock,
      user_id: op.userId,
      timestamp: new Date(op.timestamp).toISOString()
    }));

    const { error } = await this.supabase
      .from('state_operations')
      .insert(records);

    if (error) {
      throw new Error(`Failed to save operations: ${error.message}`);
    }
  }
}

/**
 * WebSocket handler for real-time communication
 */
class WebSocketHandler {
  private wss: WebSocketServer;
  private syncEngine: SyncEngine;

  constructor(port: number, syncEngine: SyncEngine) {
    this.syncEngine = syncEngine;
    this.wss = new WebSocketServer({ port });
    this.setupWebSocketServer();
  }

  /**
   * Setup WebSocket server with event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws, request) => {
      const sessionId = this.generateSessionId();
      
      const connection: ClientConnection = {
        sessionId,
        userId: '', // Will be set during authentication
        websocket: ws,
        subscribedWorlds: new Set(),
        vectorClock: {
          nodeId: sessionId,
          clock: 0,
          vector: {}
        },
        lastPing: Date.now()