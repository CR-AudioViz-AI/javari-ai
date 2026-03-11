import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { Queue } from 'bull';
import Redis from 'ioredis';
import crypto from 'crypto';

// Types
interface CRMConfig {
  provider: 'salesforce' | 'hubspot' | 'dynamics';
  credentials: Record<string, string>;
  fieldMappings: Record<string, string>;
  syncSettings: {
    bidirectional: boolean;
    conflictResolution: 'cr_wins' | 'crm_wins' | 'manual' | 'merge';
    batchSize: number;
    syncFrequency: number;
  };
}

interface SyncPayload {
  action: 'sync_customer' | 'sync_batch' | 'webhook_handler';
  crmProvider: string;
  customerId?: string;
  data?: any;
  webhookSignature?: string;
}

interface CRMCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  lastModified: string;
  customFields: Record<string, any>;
}

// Initialize services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);
const syncQueue = new Queue('crm-sync', process.env.REDIS_URL!);

// CRM Adapters
abstract class CRMAdapter {
  protected config: CRMConfig;
  
  constructor(config: CRMConfig) {
    this.config = config;
  }

  abstract authenticate(): Promise<string>;
  abstract getCustomer(id: string): Promise<CRMCustomer | null>;
  abstract createCustomer(customer: CRMCustomer): Promise<string>;
  abstract updateCustomer(id: string, customer: Partial<CRMCustomer>): Promise<void>;
  abstract deleteCustomer(id: string): Promise<void>;
  abstract getBatchCustomers(lastSync: Date): Promise<CRMCustomer[]>;
  abstract verifyWebhook(payload: string, signature: string): boolean;
}

class SalesforceAdapter extends CRMAdapter {
  private accessToken?: string;

  async authenticate(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    
    const response = await fetch(`${this.config.credentials.instanceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.credentials.clientId,
        client_secret: this.config.credentials.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Salesforce authentication failed');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    await redis.setex(`sf_token_${this.config.credentials.clientId}`, 3600, this.accessToken);
    
    return this.accessToken;
  }

  async getCustomer(id: string): Promise<CRMCustomer | null> {
    const token = await this.authenticate();
    const response = await fetch(
      `${this.config.credentials.instanceUrl}/services/data/v58.0/sobjects/Contact/${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) return null;
    const data = await response.json();
    return this.transformFromSalesforce(data);
  }

  async createCustomer(customer: CRMCustomer): Promise<string> {
    const token = await this.authenticate();
    const sfData = this.transformToSalesforce(customer);
    
    const response = await fetch(
      `${this.config.credentials.instanceUrl}/services/data/v58.0/sobjects/Contact`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sfData),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create Salesforce contact');
    }

    const result = await response.json();
    return result.id;
  }

  async updateCustomer(id: string, customer: Partial<CRMCustomer>): Promise<void> {
    const token = await this.authenticate();
    const sfData = this.transformToSalesforce(customer);
    
    const response = await fetch(
      `${this.config.credentials.instanceUrl}/services/data/v58.0/sobjects/Contact/${id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sfData),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update Salesforce contact');
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    const token = await this.authenticate();
    const response = await fetch(
      `${this.config.credentials.instanceUrl}/services/data/v58.0/sobjects/Contact/${id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete Salesforce contact');
    }
  }

  async getBatchCustomers(lastSync: Date): Promise<CRMCustomer[]> {
    const token = await this.authenticate();
    const soql = `SELECT Id, Email, FirstName, LastName, Account.Name, Phone, LastModifiedDate FROM Contact WHERE LastModifiedDate > ${lastSync.toISOString()}`;
    
    const response = await fetch(
      `${this.config.credentials.instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(soql)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Salesforce contacts');
    }

    const data = await response.json();
    return data.records.map((record: any) => this.transformFromSalesforce(record));
  }

  verifyWebhook(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.config.credentials.webhookSecret)
      .update(payload)
      .digest('base64');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  private transformFromSalesforce(data: any): CRMCustomer {
    return {
      id: data.Id,
      email: data.Email || '',
      firstName: data.FirstName || '',
      lastName: data.LastName || '',
      company: data.Account?.Name || '',
      phone: data.Phone || '',
      lastModified: data.LastModifiedDate,
      customFields: {},
    };
  }

  private transformToSalesforce(customer: Partial<CRMCustomer>): any {
    const mapped: any = {};
    if (customer.email) mapped.Email = customer.email;
    if (customer.firstName) mapped.FirstName = customer.firstName;
    if (customer.lastName) mapped.LastName = customer.lastName;
    if (customer.phone) mapped.Phone = customer.phone;
    return mapped;
  }
}

class HubSpotAdapter extends CRMAdapter {
  async authenticate(): Promise<string> {
    return this.config.credentials.apiKey;
  }

  async getCustomer(id: string): Promise<CRMCustomer | null> {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${id}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.credentials.apiKey}`,
        },
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    return this.transformFromHubSpot(data);
  }

  async createCustomer(customer: CRMCustomer): Promise<string> {
    const hsData = this.transformToHubSpot(customer);
    
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: hsData }),
    });

    if (!response.ok) {
      throw new Error('Failed to create HubSpot contact');
    }

    const result = await response.json();
    return result.id;
  }

  async updateCustomer(id: string, customer: Partial<CRMCustomer>): Promise<void> {
    const hsData = this.transformToHubSpot(customer);
    
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.config.credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: hsData }),
    });

    if (!response.ok) {
      throw new Error('Failed to update HubSpot contact');
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.config.credentials.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete HubSpot contact');
    }
  }

  async getBatchCustomers(lastSync: Date): Promise<CRMCustomer[]> {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,company,phone,lastmodifieddate&createdAfter=${lastSync.toISOString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.credentials.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch HubSpot contacts');
    }

    const data = await response.json();
    return data.results.map((contact: any) => this.transformFromHubSpot(contact));
  }

  verifyWebhook(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.config.credentials.webhookSecret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature.replace('sha256=', '')),
      Buffer.from(expectedSignature)
    );
  }

  private transformFromHubSpot(data: any): CRMCustomer {
    const props = data.properties;
    return {
      id: data.id,
      email: props.email || '',
      firstName: props.firstname || '',
      lastName: props.lastname || '',
      company: props.company || '',
      phone: props.phone || '',
      lastModified: props.lastmodifieddate,
      customFields: {},
    };
  }

  private transformToHubSpot(customer: Partial<CRMCustomer>): any {
    const mapped: any = {};
    if (customer.email) mapped.email = customer.email;
    if (customer.firstName) mapped.firstname = customer.firstName;
    if (customer.lastName) mapped.lastname = customer.lastName;
    if (customer.company) mapped.company = customer.company;
    if (customer.phone) mapped.phone = customer.phone;
    return mapped;
  }
}

// CRM Factory
class CRMAdapterFactory {
  static create(config: CRMConfig): CRMAdapter {
    switch (config.provider) {
      case 'salesforce':
        return new SalesforceAdapter(config);
      case 'hubspot':
        return new HubSpotAdapter(config);
      default:
        throw new Error(`Unsupported CRM provider: ${config.provider}`);
    }
  }
}

// Sync Service
class CRMSyncService {
  async syncCustomer(crmProvider: string, customerId: string): Promise<void> {
    const config = await this.getCRMConfig(crmProvider);
    const adapter = CRMAdapterFactory.create(config);
    
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (!customer) {
      throw new Error('Customer not found');
    }

    const crmCustomer = await this.transformToCRMFormat(customer, config);
    
    const { data: syncRecord } = await supabase
      .from('customer_crm_sync')
      .select('*')
      .eq('customer_id', customerId)
      .eq('crm_provider', crmProvider)
      .single();

    try {
      if (syncRecord?.crm_id) {
        await adapter.updateCustomer(syncRecord.crm_id, crmCustomer);
      } else {
        const crmId = await adapter.createCustomer(crmCustomer);
        await supabase.from('customer_crm_sync').insert({
          customer_id: customerId,
          crm_provider: crmProvider,
          crm_id: crmId,
          last_sync: new Date().toISOString(),
          sync_status: 'success',
        });
      }

      await this.logSyncOperation(customerId, crmProvider, 'sync_success', null);
    } catch (error) {
      await this.logSyncOperation(customerId, crmProvider, 'sync_error', (error as Error).message);
      throw error;
    }
  }

  async handleWebhook(crmProvider: string, payload: any, signature: string): Promise<void> {
    const config = await this.getCRMConfig(crmProvider);
    const adapter = CRMAdapterFactory.create(config);

    if (!adapter.verifyWebhook(JSON.stringify(payload), signature)) {
      throw new Error('Invalid webhook signature');
    }

    const customerId = this.extractCustomerIdFromWebhook(payload, crmProvider);
    if (!customerId) return;

    await syncQueue.add('webhook-sync', {
      crmProvider,
      customerId,
      payload,
    });
  }

  async resolveConflict(customerId: string, crmProvider: string): Promise<void> {
    const config = await this.getCRMConfig(crmProvider);
    const adapter = CRMAdapterFactory.create(config);

    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    const { data: syncRecord } = await supabase
      .from('customer_crm_sync')
      .select('*')
      .eq('customer_id', customerId)
      .eq('crm_provider', crmProvider)
      .single();

    if (!customer || !syncRecord?.crm_id) return;

    const crmCustomer = await adapter.getCustomer(syncRecord.crm_id);
    if (!crmCustomer) return;

    const resolution = config.syncSettings.conflictResolution;
    let resolvedData: any;

    switch (resolution) {
      case 'cr_wins':
        resolvedData = await this.transformToCRMFormat(customer, config);
        await adapter.updateCustomer(syncRecord.crm_id, resolvedData);
        break;
      case 'crm_wins':
        resolvedData = await this.transformFromCRMFormat(crmCustomer, config);
        await supabase
          .from('customers')
          .update(resolvedData)
          .eq('id', customerId);
        break;
      case 'merge':
        resolvedData = await this.mergeCustomerData(customer, crmCustomer, config);
        await adapter.updateCustomer(syncRecord.crm_id, resolvedData.crm);
        await supabase
          .from('customers')
          .update(resolvedData.cr)
          .eq('id', customerId);
        break;
    }

    await supabase
      .from('customer_crm_sync')
      .update({
        last_sync: new Date().toISOString(),
        sync_status: 'resolved',
        conflict_resolution: resolution,
      })
      .eq('customer_id', customerId)
      .eq('crm_provider', crmProvider);

    await this.logSyncOperation(customerId, crmProvider, 'conflict_resolved', resolution);
  }

  private async getCRMConfig(provider: string): Promise<CRMConfig> {
    const { data } = await supabase
      .from('crm_configurations')
      .select('*')
      .eq('provider', provider)
      .single();

    if (!data) {
      throw new Error(`CRM configuration not found for provider: ${provider}`);
    }

    return data as CRMConfig;
  }

  private async transformToCRMFormat(customer: any, config: CRMConfig): Promise<CRMCustomer> {
    const mappings = config.fieldMappings;
    return {
      id: customer.id,
      email: customer[mappings.email] || customer.email,
      firstName: customer[mappings.firstName] || customer.first_name,
      lastName: customer[mappings.lastName] || customer.last_name,
      company: customer[mappings.company] || customer.company,
      phone: customer[mappings.phone] || customer.phone,
      lastModified: customer.updated_at,
      customFields: {},
    };
  }

  private async transformFromCRMFormat(crmCustomer: CRMCustomer, config: CRMConfig): Promise<any> {
    const mappings = config.fieldMappings;
    const customer: any = {};
    
    if (mappings.email) customer[mappings.email] = crmCustomer.email;
    if (mappings.firstName) customer[mappings.firstName] = crmCustomer.firstName;
    if (mappings.lastName) customer[mappings.lastName] = crmCustomer.lastName;
    if (mappings.company) customer[mappings.company] = crmCustomer.company;
    if (mappings.phone) customer[mappings.phone] = crmCustomer.phone;
    
    return customer;
  }

  private async mergeCustomerData(crCustomer: any, crmCustomer: CRMCustomer, config: CRMConfig): Promise<{ cr: any; crm: CRMCustomer }> {
    const crData = { ...crCustomer };
    const crmData = { ...crmCustomer };

    // Simple merge strategy: use most recent non-empty values
    const crModified = new Date(crCustomer.updated_at);
    const crmModified = new Date(crmCustomer.lastModified);

    if (crmModified > crModified) {
      if (crmCustomer.firstName) crData.first_name = crmCustomer.firstName;
      if (crmCustomer.lastName) crData.last_name = crmCustomer.lastName;
      if (crmCustomer.company) crData.company = crmCustomer.company;
      if (crmCustomer.phone) crData.phone = crmCustomer.phone;
    } else {
      if (crCustomer.first_name) crmData.firstName = crCustomer.first_name;
      if (crCustomer.last_name) crmData.lastName = crCustomer.last_name;
      if (crCustomer.company) crmData.company = crCustomer.company;
      if (crCustomer.phone) crmData.phone = crCustomer.phone;
    }

    return { cr: crData, crm: crmData };
  }

  private extractCustomerIdFromWebhook(payload: any, provider: string): string | null {
    switch (provider) {
      case 'salesforce':
        return payload.sobject?.Id || null;
      case 'hubspot':
        return payload.objectId || null;
      default:
        return null;
    }
  }

  private async logSyncOperation(customerId: string, crmProvider: string, operation: string, details: string | null): Promise<void> {
    await supabase.from('audit_logs').insert({
      customer_id: customerId,
      operation_type: 'crm_sync',
      operation_details: {
        crm_provider: crmProvider,
        operation,
        details,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

const syncService = new CRMSyncService();

// Route Handlers
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request.ip ?? 'anonymous', 100, 60);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json() as SyncPayload;
    const { action, crmProvider, customerId, data, webhookSignature } = body;

    // Input validation
    if (!action || !crmProvider) {
      return NextResponse.json(
        { error: 'Missing required fields: action, crmProvider' },
        { status: 400 }
      );
    }

    const validProviders = ['salesforce', 'hubspot', 'dynamics'];
    if (!validProviders.includes(crmProvider)) {
      return NextResponse.json(
        { error: 'Invalid CRM provider' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'sync_customer':
        if (!customerId) {
          return NextResponse.json(
            { error: 'Customer ID required for sync_customer action' },
            { status: 400 }
          );
        }
        await syncService.syncCustomer(crmProvider, customerId);
        return NextResponse.json({ success: true, message: 'Customer synced successfully' });

      case 'webhook_handler':
        if (!data || !webhookSignature) {
          return NextResponse.json(
            { error: 'Webhook data and signature required' },
            { status: 400 }
          );
        }
        await syncService.handleWebhook(crmProvider, data, webhookSignature);
        return NextResponse.json({ success: true, message: 'Webhook processed successfully' });

      case 'sync_batch':
        await syncQueue.add('batch-sync', { crmProvider });
        return NextResponse.json({ success: true, message: 'Batch sync queued successfully' });

      default:
        return NextResponse.json