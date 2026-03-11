/**
 * @fileoverview SAP Integration Gateway - Enterprise module for CR AudioViz AI platform
 * Provides standardized API connectivity between CR AudioViz AI and SAP ERP systems
 * with real-time data synchronization and business process automation capabilities
 * @version 1.0.0
 * @author CR AudioViz AI Platform Team
 */

import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { WorkflowClient } from '@temporalio/client';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { RateLimiter } from 'limiter';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createHash, randomBytes } from 'crypto';
import { performance } from 'perf_hooks';

/**
 * SAP Entity Types and Schemas
 */
const SapCustomerSchema = z.object({
  CustomerNumber: z.string(),
  CompanyCode: z.string(),
  CustomerName: z.string(),
  Country: z.string(),
  City: z.string(),
  PostalCode: z.string(),
  EmailAddress: z.string().email().optional(),
  PhoneNumber: z.string().optional(),
  CreditLimit: z.number().optional(),
  Currency: z.string().optional(),
  CreatedAt: z.string(),
  ModifiedAt: z.string()
});

const SapSalesOrderSchema = z.object({
  SalesOrderNumber: z.string(),
  CustomerNumber: z.string(),
  CompanyCode: z.string(),
  SalesOrderType: z.string(),
  OrderDate: z.string(),
  DeliveryDate: z.string().optional(),
  NetAmount: z.number(),
  TaxAmount: z.number(),
  TotalAmount: z.number(),
  Currency: z.string(),
  Status: z.enum(['OPEN', 'PROCESSING', 'DELIVERED', 'CANCELLED']),
  Items: z.array(z.object({
    ItemNumber: z.string(),
    MaterialNumber: z.string(),
    Quantity: z.number(),
    Unit: z.string(),
    NetPrice: z.number()
  })),
  CreatedAt: z.string(),
  ModifiedAt: z.string()
});

const SapMaterialSchema = z.object({
  MaterialNumber: z.string(),
  MaterialType: z.string(),
  Description: z.string(),
  BaseUnit: z.string(),
  Weight: z.number().optional(),
  WeightUnit: z.string().optional(),
  Volume: z.number().optional(),
  VolumeUnit: z.string().optional(),
  CreatedAt: z.string(),
  ModifiedAt: z.string()
});

type SapCustomer = z.infer<typeof SapCustomerSchema>;
type SapSalesOrder = z.infer<typeof SapSalesOrderSchema>;
type SapMaterial = z.infer<typeof SapMaterialSchema>;

/**
 * SAP Response Types
 */
interface SapODataResponse<T> {
  'd': {
    results: T[];
    __count?: string;
  };
}

interface SapBAPIResponse {
  RETURN: Array<{
    TYPE: 'S' | 'E' | 'W' | 'I';
    ID: string;
    NUMBER: string;
    MESSAGE: string;
    LOG_NO: string;
    LOG_MSG_NO: string;
    MESSAGE_V1: string;
    MESSAGE_V2: string;
    MESSAGE_V3: string;
    MESSAGE_V4: string;
  }>;
  [key: string]: any;
}

/**
 * SAP Configuration and Connection Settings
 */
interface SapConnectionConfig {
  baseUrl: string;
  client: string;
  username: string;
  password: string;
  language: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  poolSize: number;
  enableSsl: boolean;
  certificates?: {
    ca?: string;
    cert?: string;
    key?: string;
  };
}

interface SapEndpoints {
  odata: {
    customers: string;
    salesOrders: string;
    materials: string;
    businessPartners: string;
  };
  rfc: {
    auth: string;
    execute: string;
  };
  bapi: {
    customer: {
      create: string;
      update: string;
      read: string;
    };
    salesOrder: {
      create: string;
      update: string;
      read: string;
    };
  };
}

/**
 * SAP Authentication Manager
 */
class SapAuthManager {
  private redis: Redis;
  private logger: Logger;
  private sessionCache = new Map<string, any>();

  constructor(redis: Redis, logger: Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Authenticate with SAP system and retrieve session token
   */
  async authenticate(config: SapConnectionConfig): Promise<string> {
    try {
      const sessionKey = `sap:session:${config.client}:${config.username}`;
      
      // Check for cached session
      const cachedSession = await this.redis.get(sessionKey);
      if (cachedSession) {
        const session = JSON.parse(cachedSession);
        if (Date.now() < session.expiresAt) {
          return session.token;
        }
      }

      // Authenticate with SAP
      const authResponse = await axios.post(
        `${config.baseUrl}/sap/bc/rest/oauth2/token`,
        {
          grant_type: 'password',
          username: config.username,
          password: config.password,
          client_id: config.client
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': 'Fetch'
          },
          timeout: config.timeout
        }
      );

      const token = authResponse.data.access_token;
      const expiresIn = authResponse.data.expires_in * 1000;
      const expiresAt = Date.now() + expiresIn;

      // Cache session
      const session = { token, expiresAt };
      await this.redis.setex(sessionKey, Math.floor(expiresIn / 1000), JSON.stringify(session));

      this.logger.info('SAP authentication successful', { client: config.client, username: config.username });
      return token;
    } catch (error) {
      this.logger.error('SAP authentication failed', { error: error.message, client: config.client });
      throw new Error(`SAP authentication failed: ${error.message}`);
    }
  }

  /**
   * Validate session token
   */
  async validateSession(token: string, config: SapConnectionConfig): Promise<boolean> {
    try {
      const response = await axios.get(
        `${config.baseUrl}/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          timeout: config.timeout
        }
      );

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(config: SapConnectionConfig): Promise<string> {
    const sessionKey = `sap:session:${config.client}:${config.username}`;
    await this.redis.del(sessionKey);
    return this.authenticate(config);
  }
}

/**
 * SAP Data Mapper for transforming between SAP and internal formats
 */
class SapDataMapper {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Map SAP customer data to internal format
   */
  mapSapCustomer(sapData: any): SapCustomer {
    return {
      CustomerNumber: sapData.Customer || sapData.CustomerNumber,
      CompanyCode: sapData.CompanyCode,
      CustomerName: sapData.CustomerName || sapData.OrganizationBPName1,
      Country: sapData.Country || sapData.BusinessPartnerCountry,
      City: sapData.CityName || sapData.BusinessPartnerCity,
      PostalCode: sapData.PostalCode || sapData.BusinessPartnerPostalCode,
      EmailAddress: sapData.EmailAddress,
      PhoneNumber: sapData.PhoneNumber,
      CreditLimit: sapData.CreditLimitAmount ? parseFloat(sapData.CreditLimitAmount) : undefined,
      Currency: sapData.Currency || sapData.CreditLimitCurrency,
      CreatedAt: sapData.CreationDate || new Date().toISOString(),
      ModifiedAt: sapData.LastChangeDate || new Date().toISOString()
    };
  }

  /**
   * Map SAP sales order data to internal format
   */
  mapSapSalesOrder(sapData: any): SapSalesOrder {
    return {
      SalesOrderNumber: sapData.SalesOrder,
      CustomerNumber: sapData.SoldToParty,
      CompanyCode: sapData.SalesOrganization,
      SalesOrderType: sapData.SalesOrderType,
      OrderDate: sapData.SalesOrderDate,
      DeliveryDate: sapData.RequestedDeliveryDate,
      NetAmount: parseFloat(sapData.TotalNetAmount || '0'),
      TaxAmount: parseFloat(sapData.TotalTaxAmount || '0'),
      TotalAmount: parseFloat(sapData.TotalGrossAmount || '0'),
      Currency: sapData.TransactionCurrency,
      Status: this.mapSapOrderStatus(sapData.OverallSDProcessStatus),
      Items: sapData.to_Item?.results?.map((item: any) => ({
        ItemNumber: item.SalesOrderItem,
        MaterialNumber: item.Material,
        Quantity: parseFloat(item.OrderQuantity),
        Unit: item.OrderQuantityUnit,
        NetPrice: parseFloat(item.NetAmount)
      })) || [],
      CreatedAt: sapData.CreationDate || new Date().toISOString(),
      ModifiedAt: sapData.LastChangeDate || new Date().toISOString()
    };
  }

  /**
   * Map SAP material data to internal format
   */
  mapSapMaterial(sapData: any): SapMaterial {
    return {
      MaterialNumber: sapData.Material,
      MaterialType: sapData.MaterialType,
      Description: sapData.MaterialDescription || sapData.ProductDescription,
      BaseUnit: sapData.BaseUnit,
      Weight: sapData.GrossWeight ? parseFloat(sapData.GrossWeight) : undefined,
      WeightUnit: sapData.WeightUnit,
      Volume: sapData.Volume ? parseFloat(sapData.Volume) : undefined,
      VolumeUnit: sapData.VolumeUnit,
      CreatedAt: sapData.CreationDate || new Date().toISOString(),
      ModifiedAt: sapData.LastChangeDate || new Date().toISOString()
    };
  }

  private mapSapOrderStatus(sapStatus: string): 'OPEN' | 'PROCESSING' | 'DELIVERED' | 'CANCELLED' {
    const statusMap: { [key: string]: 'OPEN' | 'PROCESSING' | 'DELIVERED' | 'CANCELLED' } = {
      'A': 'OPEN',
      'B': 'PROCESSING',
      'C': 'DELIVERED',
      'D': 'CANCELLED'
    };
    return statusMap[sapStatus] || 'OPEN';
  }
}

/**
 * SAP Error Handler for consistent error management
 */
class SapErrorHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Handle SAP API errors
   */
  handleApiError(error: any, context: string): Error {
    let errorMessage = 'Unknown SAP API error';
    let errorCode = 'SAP_UNKNOWN_ERROR';

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          errorCode = 'SAP_AUTH_ERROR';
          errorMessage = 'SAP authentication failed or expired';
          break;
        case 403:
          errorCode = 'SAP_PERMISSION_ERROR';
          errorMessage = 'Insufficient permissions for SAP operation';
          break;
        case 404:
          errorCode = 'SAP_RESOURCE_NOT_FOUND';
          errorMessage = 'SAP resource not found';
          break;
        case 429:
          errorCode = 'SAP_RATE_LIMIT_EXCEEDED';
          errorMessage = 'SAP API rate limit exceeded';
          break;
        case 500:
        case 502:
        case 503:
          errorCode = 'SAP_SERVER_ERROR';
          errorMessage = 'SAP server error - please retry';
          break;
        default:
          errorMessage = data?.error?.message || `SAP API error: ${status}`;
      }
    } else if (error.code) {
      switch (error.code) {
        case 'ECONNREFUSED':
        case 'ENOTFOUND':
          errorCode = 'SAP_CONNECTION_ERROR';
          errorMessage = 'Unable to connect to SAP system';
          break;
        case 'ETIMEDOUT':
          errorCode = 'SAP_TIMEOUT_ERROR';
          errorMessage = 'SAP request timed out';
          break;
        default:
          errorMessage = error.message || 'SAP connection error';
      }
    }

    this.logger.error('SAP Error', {
      context,
      errorCode,
      errorMessage,
      originalError: error.message,
      stack: error.stack
    });

    const sapError = new Error(errorMessage);
    (sapError as any).code = errorCode;
    (sapError as any).context = context;
    return sapError;
  }

  /**
   * Handle SAP BAPI return messages
   */
  handleBAPIResponse(response: SapBAPIResponse): { success: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let success = true;

    if (response.RETURN) {
      for (const message of response.RETURN) {
        switch (message.TYPE) {
          case 'E':
            errors.push(message.MESSAGE);
            success = false;
            break;
          case 'W':
            warnings.push(message.MESSAGE);
            break;
        }
      }
    }

    return { success, errors, warnings };
  }
}

/**
 * SAP Rate Limiter
 */
class SapRateLimiter {
  private limiter: RateLimiter;
  private logger: Logger;

  constructor(requestsPerSecond: number, logger: Logger) {
    this.limiter = new RateLimiter(requestsPerSecond, 'second');
    this.logger = logger;
  }

  /**
   * Wait for rate limit availability
   */
  async waitForAvailability(): Promise<void> {
    return new Promise((resolve) => {
      this.limiter.removeTokens(1, (err, remainingTokens) => {
        if (err) {
          this.logger.error('Rate limiter error', { error: err.message });
        }
        resolve();
      });
    });
  }
}

/**
 * SAP Webhook Handler
 */
class SapWebhookHandler extends EventEmitter {
  private logger: Logger;
  private dataMapper: SapDataMapper;
  private supabase: any;

  constructor(logger: Logger, dataMapper: SapDataMapper, supabase: any) {
    super();
    this.logger = logger;
    this.dataMapper = dataMapper;
    this.supabase = supabase;
  }

  /**
   * Process incoming SAP webhook
   */
  async processWebhook(payload: any, signature: string): Promise<void> {
    try {
      // Verify webhook signature
      if (!this.verifySignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      const eventType = payload.eventType;
      const entityType = payload.entityType;
      const data = payload.data;

      this.logger.info('Processing SAP webhook', { eventType, entityType });

      switch (entityType) {
        case 'Customer':
          await this.handleCustomerEvent(eventType, data);
          break;
        case 'SalesOrder':
          await this.handleSalesOrderEvent(eventType, data);
          break;
        case 'Material':
          await this.handleMaterialEvent(eventType, data);
          break;
        default:
          this.logger.warn('Unknown entity type in webhook', { entityType });
      }

      this.emit('webhook:processed', { eventType, entityType, data });
    } catch (error) {
      this.logger.error('Webhook processing failed', { error: error.message });
      this.emit('webhook:error', error);
      throw error;
    }
  }

  private async handleCustomerEvent(eventType: string, data: any): Promise<void> {
    const customer = this.dataMapper.mapSapCustomer(data);
    
    switch (eventType) {
      case 'created':
      case 'updated':
        await this.supabase
          .from('sap_customers')
          .upsert(customer, { onConflict: 'CustomerNumber' });
        break;
      case 'deleted':
        await this.supabase
          .from('sap_customers')
          .delete()
          .eq('CustomerNumber', customer.CustomerNumber);
        break;
    }
  }

  private async handleSalesOrderEvent(eventType: string, data: any): Promise<void> {
    const salesOrder = this.dataMapper.mapSapSalesOrder(data);
    
    switch (eventType) {
      case 'created':
      case 'updated':
        await this.supabase
          .from('sap_sales_orders')
          .upsert(salesOrder, { onConflict: 'SalesOrderNumber' });
        break;
      case 'deleted':
        await this.supabase
          .from('sap_sales_orders')
          .delete()
          .eq('SalesOrderNumber', salesOrder.SalesOrderNumber);
        break;
    }
  }

  private async handleMaterialEvent(eventType: string, data: any): Promise<void> {
    const material = this.dataMapper.mapSapMaterial(data);
    
    switch (eventType) {
      case 'created':
      case 'updated':
        await this.supabase
          .from('sap_materials')
          .upsert(material, { onConflict: 'MaterialNumber' });
        break;
      case 'deleted':
        await this.supabase
          .from('sap_materials')
          .delete()
          .eq('MaterialNumber', material.MaterialNumber);
        break;
    }
  }

  private verifySignature(payload: any, signature: string): boolean {
    // Implement webhook signature verification logic
    const secret = process.env.SAP_WEBHOOK_SECRET;
    if (!secret) return false;

    const computedSignature = createHash('sha256')
      .update(JSON.stringify(payload) + secret)
      .digest('hex');

    return signature === computedSignature;
  }
}

/**
 * SAP Batch Processor for handling bulk operations
 */
class SapBatchProcessor {
  private logger: Logger;
  private gateway: SapGateway;
  private batchSize: number = 100;

  constructor(logger: Logger, gateway: SapGateway) {
    this.logger = logger;
    this.gateway = gateway;
  }

  /**
   * Process batch data synchronization
   */
  async processBatchSync(entityType: string, lastSyncTime?: Date): Promise<{ processed: number; errors: any[] }> {
    try {
      this.logger.info('Starting batch sync', { entityType, lastSyncTime });
      
      const startTime = performance.now();
      let processed = 0;
      const errors: any[] = [];
      let hasMore = true;
      let skip = 0;

      while (hasMore) {
        try {
          const batch = await this.fetchBatch(entityType, skip, this.batchSize, lastSyncTime);
          
          if (batch.length === 0) {
            hasMore = false;
            break;
          }

          await this.processBatch(entityType, batch);
          processed += batch.length;
          skip += this.batchSize;

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          errors.push({
            skip,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          if (errors.length > 10) {
            this.logger.error('Too many batch errors, stopping sync', { entityType });
            break;
          }
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      this.logger.info('Batch sync completed', {
        entityType,
        processed,
        errors: errors.length,
        durationMs: duration
      });

      return { processed, errors };
    } catch (error) {
      this.logger.error('Batch sync failed', { entityType, error: error.message });
      throw error;
    }
  }

  private async fetchBatch(entityType: string, skip: number, top: number, lastSyncTime?: Date): Promise<any[]> {
    let filter = '';
    if (lastSyncTime) {
      const isoDate = lastSyncTime.toISOString();
      filter = `LastChangeDate gt datetime'${isoDate}'`;
    }

    switch (entityType) {
      case 'customers':
        return await this.gateway.getCustomers({ skip, top, filter });
      case 'salesOrders':
        return await this.gateway.getSalesOrders({ skip, top, filter });
      case 'materials':
        return await this.gateway.getMaterials({ skip, top, filter });
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  private async processBatch(entityType: string, batch: any[]): Promise<void> {
    // Process batch data and store in local database
    // Implementation depends on specific entity type
    this.logger.debug('Processing batch', { entityType, batchSize: batch.length });
  }
}

/**
 * Main SAP Gateway class
 */
export class SapGateway extends EventEmitter {
  private config: SapConnectionConfig;
  private authManager: SapAuthManager;
  private dataMapper: SapDataMapper;
  private errorHandler: SapErrorHandler;
  private rateLimiter: SapRateLimiter;
  private webhookHandler: SapWebhookHandler;
  private batchProcessor: SapBatchProcessor;
  private httpClient: AxiosInstance;
  private redis: Redis;
  private supabase: any;
  private temporal: WorkflowClient;
  private logger: Logger;
  private