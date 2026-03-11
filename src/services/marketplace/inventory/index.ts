```typescript
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Marketplace inventory item interface
 */
export interface InventoryItem {
  id: string;
  agentId: string;
  licenseType: 'basic' | 'professional' | 'enterprise';
  totalQuota: number;
  availableQuota: number;
  reservedQuota: number;
  pricePerUnit: number;
  currency: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * License allocation record
 */
export interface LicenseAllocation {
  id: string;
  inventoryItemId: string;
  userId: string;
  quotaAllocated: number;
  quotaUsed: number;
  status: 'active' | 'suspended' | 'expired';
  purchaseTransactionId: string;
  allocatedAt: Date;
  expiresAt?: Date;
}

/**
 * Purchase request interface
 */
export interface PurchaseRequest {
  id: string;
  userId: string;
  inventoryItemId: string;
  quantity: number;
  maxPricePerUnit: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Reservation record for concurrent purchase handling
 */
export interface Reservation {
  id: string;
  inventoryItemId: string;
  userId: string;
  quantity: number;
  reservedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
}

/**
 * Inventory transaction record
 */
export interface InventoryTransaction {
  id: string;
  type: 'purchase' | 'refund' | 'quota_replenish' | 'quota_consume';
  inventoryItemId: string;
  userId: string;
  quantity: number;
  pricePerUnit?: number;
  totalAmount?: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Inventory event types
 */
export type InventoryEvent = 
  | { type: 'QUOTA_UPDATED'; payload: { inventoryItemId: string; availableQuota: number } }
  | { type: 'PURCHASE_COMPLETED'; payload: { transactionId: string; allocation: LicenseAllocation } }
  | { type: 'RESERVATION_CREATED'; payload: { reservation: Reservation } }
  | { type: 'RESERVATION_EXPIRED'; payload: { reservationId: string } }
  | { type: 'INVENTORY_LOW'; payload: { inventoryItemId: string; threshold: number } }
  | { type: 'CONCURRENCY_CONFLICT'; payload: { inventoryItemId: string; conflictCount: number } };

/**
 * Service configuration
 */
interface InventoryConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  reservationTtlSeconds: number;
  lowInventoryThreshold: number;
  maxConcurrentPurchases: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

/**
 * Marketplace Inventory Management Microservice
 * 
 * Provides real-time inventory tracking, concurrent purchase handling,
 * and transactional consistency for AI marketplace agent licenses.
 */
export class MarketplaceInventoryService extends EventEmitter {
  private supabase: SupabaseClient;
  private redis: Redis;
  private config: InventoryConfig;
  private realtimeChannel: RealtimeChannel | null = null;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private isShuttingDown = false;

  constructor(config: InventoryConfig) {
    super();
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.redis = new Redis(config.redisUrl);
    this.setupRealtimeSubscription();
    this.setupCleanupTasks();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      // Test database connection
      const { error: dbError } = await this.supabase
        .from('inventory_items')
        .select('count')
        .limit(1);
      
      if (dbError) {
        throw new Error(`Database connection failed: ${dbError.message}`);
      }

      // Test Redis connection
      await this.redis.ping();

      console.log('MarketplaceInventoryService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MarketplaceInventoryService:', error);
      throw error;
    }
  }

  /**
   * Get available inventory items with filtering
   */
  async getAvailableInventory(filters?: {
    agentId?: string;
    licenseType?: string;
    minQuota?: number;
    maxPrice?: number;
  }): Promise<InventoryItem[]> {
    try {
      let query = this.supabase
        .from('inventory_items')
        .select('*')
        .eq('isActive', true)
        .gt('availableQuota', 0);

      if (filters?.agentId) {
        query = query.eq('agentId', filters.agentId);
      }
      if (filters?.licenseType) {
        query = query.eq('licenseType', filters.licenseType);
      }
      if (filters?.minQuota) {
        query = query.gte('availableQuota', filters.minQuota);
      }
      if (filters?.maxPrice) {
        query = query.lte('pricePerUnit', filters.maxPrice);
      }

      const { data, error } = await query.order('pricePerUnit', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch inventory: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching available inventory:', error);
      throw error;
    }
  }

  /**
   * Check availability for specific quantity
   */
  async checkAvailability(inventoryItemId: string, quantity: number): Promise<{
    available: boolean;
    availableQuota: number;
    pricePerUnit: number;
    estimatedTotal: number;
  }> {
    try {
      const { data: item, error } = await this.supabase
        .from('inventory_items')
        .select('availableQuota, pricePerUnit, isActive')
        .eq('id', inventoryItemId)
        .single();

      if (error) {
        throw new Error(`Failed to check availability: ${error.message}`);
      }

      if (!item || !item.isActive) {
        return {
          available: false,
          availableQuota: 0,
          pricePerUnit: 0,
          estimatedTotal: 0
        };
      }

      const available = item.availableQuota >= quantity;
      const estimatedTotal = quantity * item.pricePerUnit;

      return {
        available,
        availableQuota: item.availableQuota,
        pricePerUnit: item.pricePerUnit,
        estimatedTotal
      };
    } catch (error) {
      console.error('Error checking availability:', error);
      throw error;
    }
  }

  /**
   * Create reservation for concurrent purchase handling
   */
  async createReservation(request: PurchaseRequest): Promise<Reservation> {
    const lockKey = `inventory:${request.inventoryItemId}`;
    const reservationId = `reservation:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Acquire distributed lock
      const lockAcquired = await this.acquireLock(lockKey, 30000); // 30s timeout
      if (!lockAcquired) {
        throw new Error('Unable to acquire lock for inventory item');
      }

      try {
        // Check availability within lock
        const availability = await this.checkAvailability(request.inventoryItemId, request.quantity);
        if (!availability.available) {
          throw new Error('Insufficient inventory available');
        }

        // Verify price hasn't increased beyond max acceptable
        if (availability.pricePerUnit > request.maxPricePerUnit) {
          throw new Error('Price exceeds maximum acceptable amount');
        }

        const reservation: Reservation = {
          id: reservationId,
          inventoryItemId: request.inventoryItemId,
          userId: request.userId,
          quantity: request.quantity,
          reservedAt: new Date(),
          expiresAt: new Date(Date.now() + this.config.reservationTtlSeconds * 1000),
          status: 'pending'
        };

        // Create reservation record and update inventory atomically
        const { error: txError } = await this.supabase.rpc('create_inventory_reservation', {
          p_reservation: reservation,
          p_inventory_item_id: request.inventoryItemId,
          p_quantity: request.quantity
        });

        if (txError) {
          throw new Error(`Failed to create reservation: ${txError.message}`);
        }

        // Cache reservation in Redis with TTL
        await this.redis.setex(
          `reservation:${reservationId}`,
          this.config.reservationTtlSeconds,
          JSON.stringify(reservation)
        );

        this.emit('RESERVATION_CREATED', { reservation });
        return reservation;

      } finally {
        await this.releaseLock(lockKey);
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      throw error;
    }
  }

  /**
   * Process purchase with reservation
   */
  async processPurchase(
    reservationId: string,
    paymentTransactionId: string,
    metadata?: Record<string, any>
  ): Promise<{ allocation: LicenseAllocation; transaction: InventoryTransaction }> {
    try {
      // Get reservation from cache
      const reservationData = await this.redis.get(`reservation:${reservationId}`);
      if (!reservationData) {
        throw new Error('Reservation not found or expired');
      }

      const reservation: Reservation = JSON.parse(reservationData);
      if (reservation.status !== 'pending') {
        throw new Error('Reservation is not in pending state');
      }

      // Create transaction record
      const transaction: InventoryTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'purchase',
        inventoryItemId: reservation.inventoryItemId,
        userId: reservation.userId,
        quantity: reservation.quantity,
        status: 'pending',
        createdAt: new Date(),
        metadata: {
          ...metadata,
          reservationId,
          paymentTransactionId
        }
      };

      // Execute purchase transaction atomically
      const { data: result, error } = await this.supabase.rpc('process_inventory_purchase', {
        p_reservation_id: reservationId,
        p_transaction: transaction,
        p_payment_transaction_id: paymentTransactionId
      });

      if (error) {
        throw new Error(`Failed to process purchase: ${error.message}`);
      }

      const allocation: LicenseAllocation = result.allocation;
      const completedTransaction: InventoryTransaction = result.transaction;

      // Remove reservation from cache
      await this.redis.del(`reservation:${reservationId}`);

      // Emit events
      this.emit('PURCHASE_COMPLETED', { 
        transactionId: completedTransaction.id, 
        allocation 
      });

      this.emit('QUOTA_UPDATED', {
        inventoryItemId: reservation.inventoryItemId,
        availableQuota: result.updatedQuota
      });

      // Check for low inventory
      if (result.updatedQuota <= this.config.lowInventoryThreshold) {
        this.emit('INVENTORY_LOW', {
          inventoryItemId: reservation.inventoryItemId,
          threshold: this.config.lowInventoryThreshold
        });
      }

      return { allocation, transaction: completedTransaction };

    } catch (error) {
      console.error('Error processing purchase:', error);
      
      // Mark transaction as failed if it exists
      try {
        await this.supabase
          .from('inventory_transactions')
          .update({ status: 'failed' })
          .eq('metadata->reservationId', reservationId);
      } catch (updateError) {
        console.error('Failed to update transaction status:', updateError);
      }

      throw error;
    }
  }

  /**
   * Cancel reservation
   */
  async cancelReservation(reservationId: string): Promise<void> {
    try {
      const reservationData = await this.redis.get(`reservation:${reservationId}`);
      if (!reservationData) {
        return; // Already expired or doesn't exist
      }

      const reservation: Reservation = JSON.parse(reservationData);
      
      // Update reservation status and restore inventory atomically
      const { error } = await this.supabase.rpc('cancel_inventory_reservation', {
        p_reservation_id: reservationId,
        p_inventory_item_id: reservation.inventoryItemId,
        p_quantity: reservation.quantity
      });

      if (error) {
        console.error('Failed to cancel reservation in database:', error);
      }

      // Remove from cache
      await this.redis.del(`reservation:${reservationId}`);

    } catch (error) {
      console.error('Error canceling reservation:', error);
      throw error;
    }
  }

  /**
   * Get user's license allocations
   */
  async getUserAllocations(userId: string): Promise<LicenseAllocation[]> {
    try {
      const { data, error } = await this.supabase
        .from('license_allocations')
        .select(`
          *,
          inventory_items (
            agentId,
            licenseType,
            pricePerUnit,
            currency
          )
        `)
        .eq('userId', userId)
        .eq('status', 'active')
        .order('allocatedAt', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch user allocations: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user allocations:', error);
      throw error;
    }
  }

  /**
   * Update quota usage
   */
  async updateQuotaUsage(
    allocationId: string, 
    usageAmount: number, 
    operation: 'consume' | 'restore' = 'consume'
  ): Promise<{ success: boolean; remainingQuota: number }> {
    try {
      const { data: result, error } = await this.supabase.rpc('update_quota_usage', {
        p_allocation_id: allocationId,
        p_usage_amount: usageAmount,
        p_operation: operation
      });

      if (error) {
        throw new Error(`Failed to update quota usage: ${error.message}`);
      }

      return {
        success: true,
        remainingQuota: result.remaining_quota
      };

    } catch (error) {
      console.error('Error updating quota usage:', error);
      return { success: false, remainingQuota: 0 };
    }
  }

  /**
   * Get inventory analytics
   */
  async getInventoryAnalytics(timeframe: '1h' | '24h' | '7d' = '24h'): Promise<{
    totalTransactions: number;
    totalRevenue: number;
    averagePrice: number;
    topSellingAgents: Array<{ agentId: string; totalSales: number; revenue: number }>;
    inventoryTurnover: Array<{ inventoryItemId: string; turnoverRate: number }>;
  }> {
    try {
      const timeframeMins = timeframe === '1h' ? 60 : timeframe === '24h' ? 1440 : 10080;
      
      const { data, error } = await this.supabase.rpc('get_inventory_analytics', {
        p_timeframe_minutes: timeframeMins
      });

      if (error) {
        throw new Error(`Failed to get analytics: ${error.message}`);
      }

      return data || {
        totalTransactions: 0,
        totalRevenue: 0,
        averagePrice: 0,
        topSellingAgents: [],
        inventoryTurnover: []
      };

    } catch (error) {
      console.error('Error fetching inventory analytics:', error);
      throw error;
    }
  }

  /**
   * Replenish inventory
   */
  async replenishInventory(
    inventoryItemId: string, 
    additionalQuota: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const transaction: InventoryTransaction = {
        id: `replenish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'quota_replenish',
        inventoryItemId,
        userId: 'system',
        quantity: additionalQuota,
        status: 'pending',
        createdAt: new Date(),
        metadata
      };

      const { error } = await this.supabase.rpc('replenish_inventory', {
        p_inventory_item_id: inventoryItemId,
        p_additional_quota: additionalQuota,
        p_transaction: transaction
      });

      if (error) {
        throw new Error(`Failed to replenish inventory: ${error.message}`);
      }

    } catch (error) {
      console.error('Error replenishing inventory:', error);
      throw error;
    }
  }

  /**
   * Setup realtime subscription for inventory updates
   */
  private setupRealtimeSubscription(): void {
    this.realtimeChannel = this.supabase
      .channel('inventory-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inventory_items'
        },
        (payload) => {
          this.emit('QUOTA_UPDATED', {
            inventoryItemId: payload.new.id,
            availableQuota: payload.new.availableQuota
          });
        }
      )
      .subscribe();
  }

  /**
   * Acquire distributed lock using Redis
   */
  private async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    try {
      const result = await this.redis.set(
        `lock:${key}`,
        'locked',
        'PX',
        ttlMs,
        'NX'
      );
      return result === 'OK';
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(key: string): Promise<void> {
    try {
      await this.redis.del(`lock:${key}`);
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }

  /**
   * Setup cleanup tasks for expired reservations
   */
  private setupCleanupTasks(): void {
    // Clean up expired reservations every minute
    const cleanupInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        const expiredKeys = await this.redis.eval(
          `
          local keys = redis.call('KEYS', 'reservation:*')
          local expired = {}
          for i=1,#keys do
            local ttl = redis.call('TTL', keys[i])
            if ttl == -2 or ttl == 0 then
              table.insert(expired, keys[i])
            end
          end
          return expired
          `,
          0
        ) as string[];

        if (expiredKeys.length > 0) {
          console.log(`Cleaning up ${expiredKeys.length} expired reservations`);
          await this.redis.del(...expiredKeys);
        }
      } catch (error) {
        console.error('Error in cleanup task:', error);
      }
    }, 60000);

    // Store interval for cleanup on shutdown
    (this as any).cleanupInterval = cleanupInterval;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Clear cleanup interval
    if ((this as any).cleanupInterval) {
      clearInterval((this as any).cleanupInterval);
    }

    // Unsubscribe from realtime
    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
    }

    // Close Redis connection
    await this.redis.quit();

    console.log('MarketplaceInventoryService shutdown complete');
  }
}

/**
 * Factory function to create inventory service instance
 */
export function createInventoryService(config: InventoryConfig): MarketplaceInventoryService {
  return new MarketplaceInventoryService(config);
}

/**
 * Default export
 */
export default MarketplaceInventoryService;
```