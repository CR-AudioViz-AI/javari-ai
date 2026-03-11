import { EventEmitter } from 'events';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

/**
 * SAP Business One Integration Module
 * Comprehensive integration with real-time data synchronization, automated workflows, and custom field mapping
 */

// Configuration Schema
const SAPConfigSchema = z.object({
  serverUrl: z.string().url(),
  companyDb: z.string(),
  username: z.string(),
  password: z.string(),
  version: z.string().default('10.0'),
  timeout: z.number().default(30000),
  retryAttempts: z.number().default(3),
  batchSize: z.number().default(100),
  syncInterval: z.number().default(300000), // 5 minutes
  enableWebhooks: z.boolean().default(true),
  webhookSecret: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export type SAPConfig = z.infer<typeof SAPConfigSchema>;

// Error Classes
export class SAPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'SAPError';
  }
}

export class SAPAuthError extends SAPError {
  constructor(message: string, details?: any) {
    super(message, 'SAP_AUTH_ERROR', 401, details);
    this.name = 'SAPAuthError';
  }
}

export class SAPSyncError extends SAPError {
  constructor(message: string, details?: any) {
    super(message, 'SAP_SYNC_ERROR', 500, details);
    this.name = 'SAPSyncError';
  }
}

// Type Definitions
export interface SAPEntity {
  DocEntry?: number;
  DocNum?: string;
  DocDate?: string;
  CardCode?: string;
  CardName?: string;
  [key: string]: any;
}

export interface SAPBusinessPartner {
  CardCode: string;
  CardName: string;
  CardType: 'C' | 'S' | 'L';
  EmailAddress?: string;
  Phone1?: string;
  FederalTaxID?: string;
  [key: string]: any;
}

export interface SAPDocument {
  DocEntry?: number;
  DocNum?: string;
  DocType: string;
  CardCode: string;
  DocDate: string;
  DocTotal: number;
  DocumentLines: SAPDocumentLine[];
  [key: string]: any;
}

export interface SAPDocumentLine {
  LineNum?: number;
  ItemCode?: string;
  ItemDescription?: string;
  Quantity: number;
  Price: number;
  LineTotal: number;
  [key: string]: any;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  errors: Array<{ record: any; error: string }>;
  timestamp: Date;
  duration: number;
}

export interface FieldMapping {
  sapField: string;
  localField: string;
  transform?: (value: any) => any;
  validation?: (value: any) => boolean;
  required?: boolean;
}

export interface WorkflowRule {
  id: string;
  name: string;
  trigger: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  conditions: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in';
    value: any;
  }>;
  actions: Array<{
    type: 'SYNC' | 'NOTIFY' | 'TRANSFORM' | 'VALIDATE';
    config: any;
  }>;
}

// Authentication Provider
class SAPAuthProvider {
  private sessionId: string | null = null;
  private sessionExpiry: Date | null = null;

  constructor(private config: SAPConfig) {}

  /**
   * Authenticate with SAP Business One
   */
  async authenticate(): Promise<string> {
    if (this.sessionId && this.sessionExpiry && this.sessionExpiry > new Date()) {
      return this.sessionId;
    }

    try {
      const response = await fetch(`${this.config.serverUrl}/b1s/v1/Login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          CompanyDB: this.config.companyDb,
          UserName: this.config.username,
          Password: this.config.password,
        }),
      });

      if (!response.ok) {
        throw new SAPAuthError(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.sessionId = data.SessionId;
      this.sessionExpiry = new Date(Date.now() + data.SessionTimeout * 60 * 1000);

      return this.sessionId;
    } catch (error) {
      throw new SAPAuthError('Failed to authenticate with SAP B1', error);
    }
  }

  /**
   * Logout from SAP Business One
   */
  async logout(): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.config.serverUrl}/b1s/v1/Logout`, {
        method: 'POST',
        headers: {
          'Cookie': `B1SESSION=${this.sessionId}`,
        },
      });
    } catch (error) {
      console.warn('Failed to logout from SAP B1:', error);
    } finally {
      this.sessionId = null;
      this.sessionExpiry = null;
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

// SAP Client
class SAPClient {
  private auth: SAPAuthProvider;

  constructor(private config: SAPConfig) {
    this.auth = new SAPAuthProvider(config);
  }

  /**
   * Make authenticated request to SAP Business One
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const sessionId = await this.auth.authenticate();
    
    const response = await fetch(`${this.config.serverUrl}/b1s/v1${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `B1SESSION=${sessionId}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new SAPError(
        `SAP API request failed: ${response.statusText}`,
        'SAP_API_ERROR',
        response.status,
        errorData
      );
    }

    return response.json();
  }

  /**
   * Get business partners
   */
  async getBusinessPartners(filter?: string): Promise<SAPBusinessPartner[]> {
    const endpoint = filter ? `/BusinessPartners?$filter=${filter}` : '/BusinessPartners';
    const response = await this.request<{ value: SAPBusinessPartner[] }>(endpoint);
    return response.value;
  }

  /**
   * Create business partner
   */
  async createBusinessPartner(partner: Partial<SAPBusinessPartner>): Promise<SAPBusinessPartner> {
    return this.request<SAPBusinessPartner>('/BusinessPartners', {
      method: 'POST',
      body: JSON.stringify(partner),
    });
  }

  /**
   * Update business partner
   */
  async updateBusinessPartner(cardCode: string, updates: Partial<SAPBusinessPartner>): Promise<void> {
    await this.request(`/BusinessPartners('${cardCode}')`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Get documents by type
   */
  async getDocuments(docType: string, filter?: string): Promise<SAPDocument[]> {
    const endpoint = filter ? `/${docType}?$filter=${filter}` : `/${docType}`;
    const response = await this.request<{ value: SAPDocument[] }>(endpoint);
    return response.value;
  }

  /**
   * Create document
   */
  async createDocument(docType: string, document: Partial<SAPDocument>): Promise<SAPDocument> {
    return this.request<SAPDocument>(`/${docType}`, {
      method: 'POST',
      body: JSON.stringify(document),
    });
  }

  /**
   * Get items
   */
  async getItems(filter?: string): Promise<any[]> {
    const endpoint = filter ? `/Items?$filter=${filter}` : '/Items';
    const response = await this.request<{ value: any[] }>(endpoint);
    return response.value;
  }
}

// Field Mapper
class FieldMapper {
  private mappings: Map<string, FieldMapping[]> = new Map();

  /**
   * Add field mapping for an entity
   */
  addMapping(entity: string, mapping: FieldMapping): void {
    if (!this.mappings.has(entity)) {
      this.mappings.set(entity, []);
    }
    this.mappings.get(entity)!.push(mapping);
  }

  /**
   * Map SAP data to local format
   */
  mapFromSAP(entity: string, sapData: any): any {
    const entityMappings = this.mappings.get(entity);
    if (!entityMappings) return sapData;

    const mapped: any = {};
    
    for (const mapping of entityMappings) {
      const value = sapData[mapping.sapField];
      
      if (value !== undefined) {
        let transformedValue = mapping.transform ? mapping.transform(value) : value;
        
        if (mapping.validation && !mapping.validation(transformedValue)) {
          throw new Error(`Validation failed for field ${mapping.localField}`);
        }
        
        mapped[mapping.localField] = transformedValue;
      } else if (mapping.required) {
        throw new Error(`Required field ${mapping.sapField} is missing`);
      }
    }
    
    return mapped;
  }

  /**
   * Map local data to SAP format
   */
  mapToSAP(entity: string, localData: any): any {
    const entityMappings = this.mappings.get(entity);
    if (!entityMappings) return localData;

    const mapped: any = {};
    
    for (const mapping of entityMappings) {
      const value = localData[mapping.localField];
      
      if (value !== undefined) {
        mapped[mapping.sapField] = mapping.transform ? mapping.transform(value) : value;
      }
    }
    
    return mapped;
  }
}

// Data Synchronizer
class DataSynchronizer extends EventEmitter {
  private client: SAPClient;
  private fieldMapper: FieldMapper;
  private isRunning = false;
  private syncInterval?: NodeJS.Timeout;

  constructor(config: SAPConfig) {
    super();
    this.client = new SAPClient(config);
    this.fieldMapper = new FieldMapper();
  }

  /**
   * Start automatic synchronization
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.syncInterval = setInterval(() => {
      this.syncAll().catch(error => {
        this.emit('error', new SAPSyncError('Automatic sync failed', error));
      });
    }, 300000); // 5 minutes
    
    this.emit('started');
  }

  /**
   * Stop automatic synchronization
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
    
    this.emit('stopped');
  }

  /**
   * Synchronize all entities
   */
  async syncAll(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    
    try {
      // Sync Business Partners
      const bpResult = await this.syncBusinessPartners();
      results.push(bpResult);
      
      // Sync Sales Orders
      const soResult = await this.syncSalesOrders();
      results.push(soResult);
      
      // Sync Items
      const itemsResult = await this.syncItems();
      results.push(itemsResult);
      
      this.emit('sync-completed', results);
      return results;
    } catch (error) {
      this.emit('sync-error', error);
      throw error;
    }
  }

  /**
   * Sync Business Partners
   */
  async syncBusinessPartners(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      errors: [],
      timestamp: new Date(),
      duration: 0,
    };

    try {
      const partners = await this.client.getBusinessPartners();
      
      for (const partner of partners) {
        try {
          const mapped = this.fieldMapper.mapFromSAP('BusinessPartner', partner);
          // Store in local database (implementation depends on your database layer)
          result.recordsProcessed++;
        } catch (error) {
          result.errors.push({
            record: partner,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      result.success = false;
      throw new SAPSyncError('Failed to sync business partners', error);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Sync Sales Orders
   */
  async syncSalesOrders(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      errors: [],
      timestamp: new Date(),
      duration: 0,
    };

    try {
      const orders = await this.client.getDocuments('Orders');
      
      for (const order of orders) {
        try {
          const mapped = this.fieldMapper.mapFromSAP('SalesOrder', order);
          // Store in local database
          result.recordsProcessed++;
        } catch (error) {
          result.errors.push({
            record: order,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      result.success = false;
      throw new SAPSyncError('Failed to sync sales orders', error);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Sync Items
   */
  async syncItems(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      errors: [],
      timestamp: new Date(),
      duration: 0,
    };

    try {
      const items = await this.client.getItems();
      
      for (const item of items) {
        try {
          const mapped = this.fieldMapper.mapFromSAP('Item', item);
          // Store in local database
          result.recordsProcessed++;
        } catch (error) {
          result.errors.push({
            record: item,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      result.success = false;
      throw new SAPSyncError('Failed to sync items', error);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  getFieldMapper(): FieldMapper {
    return this.fieldMapper;
  }
}

// Workflow Engine
class WorkflowEngine extends EventEmitter {
  private rules: Map<string, WorkflowRule> = new Map();
  private client: SAPClient;

  constructor(config: SAPConfig) {
    super();
    this.client = new SAPClient(config);
  }

  /**
   * Add workflow rule
   */
  addRule(rule: WorkflowRule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule-added', rule);
  }

  /**
   * Remove workflow rule
   */
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      this.emit('rule-removed', rule);
    }
  }

  /**
   * Execute workflows for entity change
   */
  async executeWorkflows(
    entity: string,
    trigger: 'CREATE' | 'UPDATE' | 'DELETE',
    data: any
  ): Promise<void> {
    const applicableRules = Array.from(this.rules.values()).filter(
      rule => rule.entity === entity && rule.trigger === trigger
    );

    for (const rule of applicableRules) {
      try {
        if (this.evaluateConditions(rule.conditions, data)) {
          await this.executeActions(rule.actions, data);
          this.emit('workflow-executed', { rule: rule.id, data });
        }
      } catch (error) {
        this.emit('workflow-error', { rule: rule.id, error, data });
      }
    }
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(conditions: WorkflowRule['conditions'], data: any): boolean {
    return conditions.every(condition => {
      const fieldValue = data[condition.field];
      
      switch (condition.operator) {
        case 'eq':
          return fieldValue === condition.value;
        case 'ne':
          return fieldValue !== condition.value;
        case 'gt':
          return fieldValue > condition.value;
        case 'lt':
          return fieldValue < condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        default:
          return false;
      }
    });
  }

  /**
   * Execute workflow actions
   */
  private async executeActions(actions: WorkflowRule['actions'], data: any): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'SYNC':
          await this.executeSyncAction(action.config, data);
          break;
        case 'NOTIFY':
          await this.executeNotifyAction(action.config, data);
          break;
        case 'TRANSFORM':
          await this.executeTransformAction(action.config, data);
          break;
        case 'VALIDATE':
          await this.executeValidateAction(action.config, data);
          break;
      }
    }
  }

  private async executeSyncAction(config: any, data: any): Promise<void> {
    // Implementation depends on sync requirements
  }

  private async executeNotifyAction(config: any, data: any): Promise<void> {
    // Send notifications based on config
  }

  private async executeTransformAction(config: any, data: any): Promise<void> {
    // Transform data based on config
  }

  private async executeValidateAction(config: any, data: any): Promise<void> {
    // Validate data based on config
  }
}

// Webhook Handler
class SAPWebhookHandler {
  constructor(
    private workflowEngine: WorkflowEngine,
    private dataSynchronizer: DataSynchronizer
  ) {}

  /**
   * Handle SAP webhook
   */
  async handleWebhook(payload: any, signature?: string): Promise<void> {
    try {
      // Validate webhook signature if provided
      if (signature) {
        this.validateSignature(payload, signature);
      }

      const { entity, action, data } = payload;
      
      // Execute workflows
      await this.workflowEngine.executeWorkflows(entity, action, data);
      
      // Trigger sync if needed
      if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') {
        this.dataSynchronizer.emit('webhook-received', { entity, action, data });
      }
    } catch (error) {
      throw new SAPError('Failed to handle webhook', 'WEBHOOK_ERROR', 400, error);
    }
  }

  /**
   * Validate webhook signature
   */
  private validateSignature(payload: any, signature: string): void {
    // Implement signature validation based on SAP webhook configuration
    // This would typically involve HMAC validation
  }
}

// Main Integration Class
export class SAPBusinessOneIntegration extends EventEmitter {
  private config: SAPConfig;
  private client: SAPClient;
  private dataSynchronizer: DataSynchronizer;
  private workflowEngine: WorkflowEngine;
  private webhookHandler: SAPWebhookHandler;
  private redis?: Redis;

  constructor(config: Partial<SAPConfig>) {
    super();
    
    try {
      this.config = SAPConfigSchema.parse(config);
    } catch (error) {
      throw new SAPError('Invalid configuration', 'CONFIG_ERROR', 400, error);
    }

    this.client = new SAPClient(this.config);
    this.dataSynchronizer = new DataSynchronizer(this.config);
    this.workflowEngine = new WorkflowEngine(this.config);
    this.webhookHandler = new SAPWebhookHandler(this.workflowEngine, this.dataSynchronizer);

    this.setupEventListeners();
  }

  /**
   * Initialize integration with Redis cache
   */
  async initialize(redisUrl?: string): Promise<void> {
    try {
      if (redisUrl) {
        this.redis = new Redis(redisUrl);
      }

      // Test SAP connection
      await this.client.request('/CompanyService_GetCompanyInfo');
      
      // Setup default field mappings
      this.setupDefaultMappings();
      
      this.emit('initialized');
    } catch (error) {
      throw new SAPError('Failed to initialize integration', 'INIT_ERROR', 500, error);
    }
  }

  /**
   * Start integration services
   */
  async start(): Promise<void> {
    this.dataSynchronizer.start();
    this.emit('started');
  }

  /**
   * Stop integration services
   */
  async stop(): Promise<void> {
    this.dataSynchronizer.stop();
    await this.redis?.quit();
    this.emit('stopped');
  }

  /**
   * Get SAP client instance
   */
  getClient(): SAPClient {
    return this.client;
  }

  /**
   * Get data synchronizer instance
   */
  getDataSynchronizer(): DataSynchronizer {
    return this.dataSynchronizer;
  }

  /**
   * Get workflow engine instance
   */
  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine;