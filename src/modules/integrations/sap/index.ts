import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { z } from 'zod';
import CryptoJS from 'crypto-js';

/**
 * SAP Integration Types
 */
export interface SapCredentials {
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
  certificatePath?: string;
  privateKeyPath?: string;
  tokenUrl: string;
  baseUrl: string;
}

export interface SapConnectionConfig {
  type: 'S4HANA' | 'SuccessFactors';
  environment: 'production' | 'sandbox' | 'development';
  credentials: SapCredentials;
  timeout: number;
  retryAttempts: number;
  rateLimiting: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface SapEntity {
  id: string;
  type: string;
  data: Record<string, any>;
  lastModified: Date;
  version: string;
}

export interface SyncConfiguration {
  entityTypes: string[];
  syncDirection: 'bidirectional' | 'to_sap' | 'from_sap';
  syncFrequency: number;
  batchSize: number;
  conflictResolution: 'sap_wins' | 'local_wins' | 'manual';
  fieldMappings: Record<string, string>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  triggers: WorkflowTrigger[];
  actions: WorkflowAction[];
  conditions: WorkflowCondition[];
  enabled: boolean;
}

export interface WorkflowTrigger {
  type: 'data_change' | 'time_based' | 'manual';
  entityType?: string;
  schedule?: string;
  conditions?: Record<string, any>;
}

export interface WorkflowAction {
  type: 'create' | 'update' | 'delete' | 'notify' | 'transform';
  targetSystem: 'SAP' | 'LOCAL' | 'EXTERNAL';
  configuration: Record<string, any>;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface SapMonitoringMetrics {
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastSyncTime: Date | null;
  syncErrors: number;
  apiCallsPerMinute: number;
  responseTime: number;
  dataQualityScore: number;
}

/**
 * SAP Authentication Provider
 */
class SapAuthProvider extends EventEmitter {
  private credentials: SapCredentials;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private httpClient: AxiosInstance;

  constructor(credentials: SapCredentials) {
    super();
    this.credentials = credentials;
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Authenticate with SAP system
   */
  public async authenticate(): Promise<void> {
    try {
      const response = await this.httpClient.post(this.credentials.tokenUrl, {
        grant_type: 'client_credentials',
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        username: this.credentials.username,
        password: this.credentials.password
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));

      this.emit('authenticated', {
        accessToken: this.accessToken,
        expiresAt: this.tokenExpiry
      });
    } catch (error) {
      this.emit('authError', error);
      throw new Error(`SAP authentication failed: ${error.message}`);
    }
  }

  /**
   * Get valid access token
   */
  public async getAccessToken(): Promise<string> {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.authenticate();
    }
    return this.accessToken!;
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return new Date() >= this.tokenExpiry;
  }

  /**
   * Refresh access token
   */
  public async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      await this.authenticate();
      return;
    }

    try {
      const response = await this.httpClient.post(this.credentials.tokenUrl, {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
    } catch (error) {
      await this.authenticate();
    }
  }
}

/**
 * SAP S/4HANA Client
 */
class S4HanaClient extends EventEmitter {
  private httpClient: AxiosInstance;
  private authProvider: SapAuthProvider;
  private baseUrl: string;

  constructor(config: SapConnectionConfig) {
    super();
    this.baseUrl = config.credentials.baseUrl;
    this.authProvider = new SapAuthProvider(config.credentials);
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Setup HTTP interceptors
   */
  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(async (config) => {
      const token = await this.authProvider.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.authProvider.refreshAccessToken();
          const token = await this.authProvider.getAccessToken();
          error.config.headers.Authorization = `Bearer ${token}`;
          return this.httpClient.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get business partner data
   */
  public async getBusinessPartners(filters?: Record<string, any>): Promise<SapEntity[]> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          queryParams.append(`$filter`, `${key} eq '${value}'`);
        });
      }

      const response = await this.httpClient.get(
        `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?${queryParams.toString()}`
      );

      return response.data.d.results.map((item: any) => ({
        id: item.BusinessPartner,
        type: 'BusinessPartner',
        data: item,
        lastModified: new Date(item.LastChangeDateTime),
        version: item.ETag || '1'
      }));
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to fetch business partners: ${error.message}`);
    }
  }

  /**
   * Create business partner
   */
  public async createBusinessPartner(data: Record<string, any>): Promise<SapEntity> {
    try {
      const response = await this.httpClient.post(
        '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner',
        data
      );

      const createdEntity: SapEntity = {
        id: response.data.d.BusinessPartner,
        type: 'BusinessPartner',
        data: response.data.d,
        lastModified: new Date(),
        version: '1'
      };

      this.emit('entityCreated', createdEntity);
      return createdEntity;
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to create business partner: ${error.message}`);
    }
  }

  /**
   * Update business partner
   */
  public async updateBusinessPartner(id: string, data: Record<string, any>): Promise<SapEntity> {
    try {
      const response = await this.httpClient.patch(
        `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner('${id}')`,
        data
      );

      const updatedEntity: SapEntity = {
        id,
        type: 'BusinessPartner',
        data: response.data.d,
        lastModified: new Date(),
        version: response.data.d.ETag || '1'
      };

      this.emit('entityUpdated', updatedEntity);
      return updatedEntity;
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to update business partner: ${error.message}`);
    }
  }

  /**
   * Get sales orders
   */
  public async getSalesOrders(filters?: Record<string, any>): Promise<SapEntity[]> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          queryParams.append(`$filter`, `${key} eq '${value}'`);
        });
      }

      const response = await this.httpClient.get(
        `/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?${queryParams.toString()}`
      );

      return response.data.d.results.map((item: any) => ({
        id: item.SalesOrder,
        type: 'SalesOrder',
        data: item,
        lastModified: new Date(item.LastChangeDateTime),
        version: item.ETag || '1'
      }));
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to fetch sales orders: ${error.message}`);
    }
  }
}

/**
 * SAP SuccessFactors Client
 */
class SuccessFactorsClient extends EventEmitter {
  private httpClient: AxiosInstance;
  private authProvider: SapAuthProvider;
  private baseUrl: string;

  constructor(config: SapConnectionConfig) {
    super();
    this.baseUrl = config.credentials.baseUrl;
    this.authProvider = new SapAuthProvider(config.credentials);
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Setup HTTP interceptors
   */
  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(async (config) => {
      const token = await this.authProvider.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  /**
   * Get employee data
   */
  public async getEmployees(filters?: Record<string, any>): Promise<SapEntity[]> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          queryParams.append(key, value);
        });
      }

      const response = await this.httpClient.get(
        `/odata/v2/EmpJob?${queryParams.toString()}`
      );

      return response.data.d.results.map((item: any) => ({
        id: item.userId,
        type: 'Employee',
        data: item,
        lastModified: new Date(item.lastModifiedDateTime),
        version: '1'
      }));
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }
  }

  /**
   * Update employee data
   */
  public async updateEmployee(userId: string, data: Record<string, any>): Promise<SapEntity> {
    try {
      const response = await this.httpClient.post(
        `/odata/v2/upsert`,
        {
          __metadata: { uri: `EmpJob(userId='${userId}')` },
          ...data
        }
      );

      const updatedEntity: SapEntity = {
        id: userId,
        type: 'Employee',
        data: response.data.d,
        lastModified: new Date(),
        version: '1'
      };

      this.emit('entityUpdated', updatedEntity);
      return updatedEntity;
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to update employee: ${error.message}`);
    }
  }
}

/**
 * Data Synchronization Engine
 */
class DataSyncEngine extends EventEmitter {
  private supabase: SupabaseClient;
  private redis: Redis;
  private s4hanaClient: S4HanaClient | null = null;
  private successFactorsClient: SuccessFactorsClient | null = null;
  private syncConfigurations: Map<string, SyncConfiguration> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string, redisConfig: any) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(redisConfig);
  }

  /**
   * Initialize sync engine with clients
   */
  public initializeClients(
    s4hanaConfig?: SapConnectionConfig,
    successFactorsConfig?: SapConnectionConfig
  ): void {
    if (s4hanaConfig) {
      this.s4hanaClient = new S4HanaClient(s4hanaConfig);
    }
    if (successFactorsConfig) {
      this.successFactorsClient = new SuccessFactorsClient(successFactorsConfig);
    }
  }

  /**
   * Configure synchronization for entity type
   */
  public configureSyncForEntity(entityType: string, config: SyncConfiguration): void {
    this.syncConfigurations.set(entityType, config);
    this.scheduleSync(entityType, config);
  }

  /**
   * Schedule periodic sync for entity type
   */
  private scheduleSync(entityType: string, config: SyncConfiguration): void {
    // Clear existing interval
    const existingInterval = this.syncIntervals.get(entityType);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Schedule new sync
    const interval = setInterval(async () => {
      await this.performSync(entityType, config);
    }, config.syncFrequency * 1000);

    this.syncIntervals.set(entityType, interval);
  }

  /**
   * Perform synchronization for entity type
   */
  private async performSync(entityType: string, config: SyncConfiguration): Promise<void> {
    try {
      this.emit('syncStarted', { entityType, timestamp: new Date() });

      // Get last sync timestamp
      const lastSyncKey = `sap_sync:${entityType}:last_sync`;
      const lastSyncTime = await this.redis.get(lastSyncKey);
      const lastSync = lastSyncTime ? new Date(lastSyncTime) : null;

      // Sync from SAP to local
      if (config.syncDirection === 'from_sap' || config.syncDirection === 'bidirectional') {
        await this.syncFromSap(entityType, config, lastSync);
      }

      // Sync from local to SAP
      if (config.syncDirection === 'to_sap' || config.syncDirection === 'bidirectional') {
        await this.syncToSap(entityType, config, lastSync);
      }

      // Update last sync timestamp
      await this.redis.set(lastSyncKey, new Date().toISOString());

      this.emit('syncCompleted', {
        entityType,
        timestamp: new Date(),
        success: true
      });

    } catch (error) {
      this.emit('syncError', {
        entityType,
        error: error.message,
        timestamp: new Date()
      });

      // Log sync error to Supabase
      await this.supabase.from('sap_sync_logs').insert({
        entity_type: entityType,
        status: 'error',
        error_message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Sync data from SAP to local storage
   */
  private async syncFromSap(
    entityType: string,
    config: SyncConfiguration,
    lastSync: Date | null
  ): Promise<void> {
    let sapEntities: SapEntity[] = [];

    // Fetch data from appropriate SAP system
    if (this.s4hanaClient && ['BusinessPartner', 'SalesOrder'].includes(entityType)) {
      const filters = lastSync ? { LastChangeDateTime: `gt datetime'${lastSync.toISOString()}'` } : {};
      
      if (entityType === 'BusinessPartner') {
        sapEntities = await this.s4hanaClient.getBusinessPartners(filters);
      } else if (entityType === 'SalesOrder') {
        sapEntities = await this.s4hanaClient.getSalesOrders(filters);
      }
    } else if (this.successFactorsClient && entityType === 'Employee') {
      const filters = lastSync ? { lastModifiedDateTime: lastSync.toISOString() } : {};
      sapEntities = await this.successFactorsClient.getEmployees(filters);
    }

    // Process entities in batches
    for (let i = 0; i < sapEntities.length; i += config.batchSize) {
      const batch = sapEntities.slice(i, i + config.batchSize);
      await this.processSapEntityBatch(batch, config);
    }
  }

  /**
   * Process batch of SAP entities
   */
  private async processSapEntityBatch(
    entities: SapEntity[],
    config: SyncConfiguration
  ): Promise<void> {
    const mappedEntities = entities.map(entity => this.mapSapToLocal(entity, config));

    for (const mappedEntity of mappedEntities) {
      try {
        // Check if entity exists locally
        const { data: existingEntity } = await this.supabase
          .from('sap_entities')
          .select('*')
          .eq('sap_id', mappedEntity.id)
          .eq('entity_type', mappedEntity.type)
          .single();

        if (existingEntity) {
          // Handle conflict resolution
          const shouldUpdate = await this.resolveConflict(
            existingEntity,
            mappedEntity,
            config.conflictResolution
          );

          if (shouldUpdate) {
            await this.supabase
              .from('sap_entities')
              .update({
                data: mappedEntity.data,
                last_modified: mappedEntity.lastModified.toISOString(),
                version: mappedEntity.version
              })
              .eq('id', existingEntity.id);
          }
        } else {
          // Create new entity
          await this.supabase.from('sap_entities').insert({
            sap_id: mappedEntity.id,
            entity_type: mappedEntity.type,
            data: mappedEntity.data,
            last_modified: mappedEntity.lastModified.toISOString(),
            version: mappedEntity.version
          });
        }
      } catch (error) {
        console.error(`Error processing entity ${mappedEntity.id}:`, error);
      }
    }
  }

  /**
   * Sync data from local to SAP
   */
  private async syncToSap(
    entityType: string,
    config: SyncConfiguration,
    lastSync: Date | null
  ): Promise<void> {
    // Get modified local entities
    let query = this.supabase
      .from('sap_entities')
      .select('*')
      .eq('entity_type', entityType)
      .eq('sync_status', 'pending');

    if (lastSync) {
      query = query.gte('last_modified', lastSync.toISOString());
    }

    const { data: localEntities, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch local entities: ${error.message}`);
    }

    // Process local entities
    for (const localEntity of localEntities || []) {
      try {
        const mappedData = this.mapLocalToSap(localEntity, config);
        
        if (this.s4hanaClient && ['BusinessPartner', 'SalesOrder'].includes(entityType)) {
          if (localEntity.sap_id) {
            // Update existing
            await this.s4hanaClient.updateBusinessPartner(localEntity.sap_id, mappedData);
          } else {
            // Create new
            const createdEntity = await this.s4hanaClient.createBusinessPartner(mappedData);
            // Update local entity with SAP ID
            await this.supabase
              .from('sap_entities')
              .update({ sap_id: createdEntity.id })
              .eq('id', localEntity.id);
          }
        } else if (this.successFactorsClient && entityType === 'Employee') {
          await this.successFactorsClient.updateEmployee(localEntity.sap_id, mappedData);
        }

        // Mark as synced
        await this.supabase
          .from('sap_entities')
          .update({ sync_status: 'synced' })
          .eq('id', localEntity.id);

      } catch (error) {
        // Mark as error
        await this.supabase
          .from('sap_entities')
          .update({ 
            sync_status: 'error',
            error_message: error.message 
          })
          .eq('id', localEntity.id);
      }
    }
  }

  /**
   * Map SAP entity to local format
   */
  private mapSapToLocal(entity: SapEntity, config: SyncConfiguration): SapEntity {
    const mappedData: