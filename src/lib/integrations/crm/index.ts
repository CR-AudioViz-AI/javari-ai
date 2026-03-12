```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import Queue from 'bull';
import { z } from 'zod';
import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createHash, createHmac } from 'crypto';
import Pusher from 'pusher';
import { Sentry } from '@sentry/nextjs';

// Environment variables validation
const envSchema = z.object({
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_KEY: z.string(),
  REDIS_URL: z.string(),
  PUSHER_APP_ID: z.string(),
  PUSHER_KEY: z.string(),
  PUSHER_SECRET: z.string(),
  PUSHER_CLUSTER: z.string(),
  SENTRY_DSN: z.string().optional(),
});

const env = envSchema.parse(process.env);

// Initialize services
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const redis = new Redis(env.REDIS_URL);
const pusher = new Pusher({
  appId: env.PUSHER_APP_ID,
  key: env.PUSHER_KEY,
  secret: env.PUSHER_SECRET,
  cluster: env.PUSHER_CLUSTER,
  useTLS: true,
});

// Validation schemas
const CRMProviderSchema = z.enum(['salesforce', 'hubspot', 'dynamics']);
const ContactSchema = z.object({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

const LeadSchema = z.object({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

const OpportunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number().optional(),
  stage: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  closeDate: z.string().optional(),
  accountId: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

const SyncRequestSchema = z.object({
  userId: z.string(),
  provider: CRMProviderSchema,
  entities: z.array(z.enum(['contacts', 'leads', 'opportunities'])),
  direction: z.enum(['push', 'pull', 'bidirectional']),
  fieldMappings: z.record(z.string()).optional(),
});

// Types
interface CRMCredentials {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string;
  instance_url?: string;
  expires_at?: string;
  encrypted_data: string;
}

interface SyncState {
  id: string;
  user_id: string;
  provider: string;
  entity_type: string;
  last_sync: string;
  sync_token?: string;
  status: 'idle' | 'syncing' | 'error';
  error_message?: string;
}

interface CRMEntity {
  id: string;
  externalId: string;
  type: 'contact' | 'lead' | 'opportunity';
  data: Record<string, any>;
  lastModified: Date;
  provider: string;
}

// CRM Event Emitter
class CRMEventEmitter extends EventEmitter {
  emit(event: string, ...args: any[]): boolean {
    // Broadcast to Pusher for real-time updates
    pusher.trigger('crm-sync', event, args[0]).catch(console.error);
    return super.emit(event, ...args);
  }
}

const crmEvents = new CRMEventEmitter();

// Field Mapping Configuration
class FieldMappingConfig {
  private mappings: Map<string, Map<string, string>> = new Map();

  setMapping(provider: string, internalField: string, externalField: string): void {
    if (!this.mappings.has(provider)) {
      this.mappings.set(provider, new Map());
    }
    this.mappings.get(provider)!.set(internalField, externalField);
  }

  getMapping(provider: string, internalField: string): string | undefined {
    return this.mappings.get(provider)?.get(internalField);
  }

  mapFields(provider: string, data: Record<string, any>, direction: 'in' | 'out'): Record<string, any> {
    const providerMappings = this.mappings.get(provider);
    if (!providerMappings) return data;

    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (direction === 'out') {
        const mappedKey = providerMappings.get(key) || key;
        result[mappedKey] = value;
      } else {
        const originalKey = Array.from(providerMappings.entries())
          .find(([, mapped]) => mapped === key)?.[0] || key;
        result[originalKey] = value;
      }
    }

    return result;
  }
}

const fieldMapping = new FieldMappingConfig();

// Sync Conflict Resolver
class SyncConflictResolver {
  async resolveConflict(
    local: CRMEntity,
    remote: CRMEntity,
    strategy: 'local-wins' | 'remote-wins' | 'merge' | 'manual' = 'remote-wins'
  ): Promise<CRMEntity> {
    switch (strategy) {
      case 'local-wins':
        return local;
      case 'remote-wins':
        return remote;
      case 'merge':
        return {
          ...local,
          data: { ...remote.data, ...local.data },
          lastModified: new Date(Math.max(
            local.lastModified.getTime(),
            remote.lastModified.getTime()
          )),
        };
      case 'manual':
        // Store conflict for manual resolution
        await supabase.from('sync_conflicts').insert({
          entity_id: local.id,
          provider: local.provider,
          local_data: local.data,
          remote_data: remote.data,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
        return remote; // Default to remote while awaiting manual resolution
      default:
        return remote;
    }
  }
}

const conflictResolver = new SyncConflictResolver();

// Base CRM Connector
abstract class BaseCRMConnector {
  protected client: AxiosInstance;
  protected credentials: CRMCredentials;

  constructor(credentials: CRMCredentials) {
    this.credentials = credentials;
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(async (config) => {
      // Rate limiting
      const key = `rate_limit:${this.credentials.provider}:${this.credentials.user_id}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, 3600); // 1 hour window
      }
      if (current > 1000) { // 1000 requests per hour
        throw new Error('Rate limit exceeded');
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.refreshToken();
          return this.client.request(error.config);
        }
        throw error;
      }
    );
  }

  abstract refreshToken(): Promise<void>;
  abstract getContacts(lastModified?: Date): Promise<CRMEntity[]>;
  abstract getLeads(lastModified?: Date): Promise<CRMEntity[]>;
  abstract getOpportunities(lastModified?: Date): Promise<CRMEntity[]>;
  abstract createContact(data: any): Promise<CRMEntity>;
  abstract updateContact(id: string, data: any): Promise<CRMEntity>;
  abstract deleteContact(id: string): Promise<void>;
  abstract createLead(data: any): Promise<CRMEntity>;
  abstract updateLead(id: string, data: any): Promise<CRMEntity>;
  abstract deleteLead(id: string): Promise<void>;
  abstract createOpportunity(data: any): Promise<CRMEntity>;
  abstract updateOpportunity(id: string, data: any): Promise<CRMEntity>;
  abstract deleteOpportunity(id: string): Promise<void>;
}

// Salesforce Connector
class SalesforceConnector extends BaseCRMConnector {
  constructor(credentials: CRMCredentials) {
    super(credentials);
    this.client.defaults.baseURL = `${credentials.instance_url}/services/data/v58.0`;
  }

  async refreshToken(): Promise<void> {
    const response = await axios.post(`${this.credentials.instance_url}/services/oauth2/token`, {
      grant_type: 'refresh_token',
      refresh_token: this.credentials.refresh_token,
      client_id: process.env.SALESFORCE_CLIENT_ID,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET,
    });

    const { access_token, refresh_token } = response.data;
    this.credentials.access_token = access_token;
    if (refresh_token) {
      this.credentials.refresh_token = refresh_token;
    }

    await supabase
      .from('crm_credentials')
      .update({ 
        access_token,
        refresh_token: refresh_token || this.credentials.refresh_token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.credentials.id);
  }

  async getContacts(lastModified?: Date): Promise<CRMEntity[]> {
    const whereClause = lastModified 
      ? `WHERE LastModifiedDate > ${lastModified.toISOString()}`
      : '';
    
    const query = `SELECT Id, FirstName, LastName, Email, Phone, Account.Name FROM Contact ${whereClause}`;
    const response = await this.client.get(`/query?q=${encodeURIComponent(query)}`);

    return response.data.records.map((record: any) => ({
      id: createHash('md5').update(`sf_contact_${record.Id}`).digest('hex'),
      externalId: record.Id,
      type: 'contact' as const,
      provider: 'salesforce',
      data: fieldMapping.mapFields('salesforce', {
        firstName: record.FirstName,
        lastName: record.LastName,
        email: record.Email,
        phone: record.Phone,
        company: record.Account?.Name,
      }, 'in'),
      lastModified: new Date(record.LastModifiedDate),
    }));
  }

  async getLeads(lastModified?: Date): Promise<CRMEntity[]> {
    const whereClause = lastModified 
      ? `WHERE LastModifiedDate > ${lastModified.toISOString()}`
      : '';
    
    const query = `SELECT Id, FirstName, LastName, Email, Company, Status, LeadSource FROM Lead ${whereClause}`;
    const response = await this.client.get(`/query?q=${encodeURIComponent(query)}`);

    return response.data.records.map((record: any) => ({
      id: createHash('md5').update(`sf_lead_${record.Id}`).digest('hex'),
      externalId: record.Id,
      type: 'lead' as const,
      provider: 'salesforce',
      data: fieldMapping.mapFields('salesforce', {
        firstName: record.FirstName,
        lastName: record.LastName,
        email: record.Email,
        company: record.Company,
        status: record.Status,
        source: record.LeadSource,
      }, 'in'),
      lastModified: new Date(record.LastModifiedDate),
    }));
  }

  async getOpportunities(lastModified?: Date): Promise<CRMEntity[]> {
    const whereClause = lastModified 
      ? `WHERE LastModifiedDate > ${lastModified.toISOString()}`
      : '';
    
    const query = `SELECT Id, Name, Amount, StageName, Probability, CloseDate, AccountId FROM Opportunity ${whereClause}`;
    const response = await this.client.get(`/query?q=${encodeURIComponent(query)}`);

    return response.data.records.map((record: any) => ({
      id: createHash('md5').update(`sf_opp_${record.Id}`).digest('hex'),
      externalId: record.Id,
      type: 'opportunity' as const,
      provider: 'salesforce',
      data: fieldMapping.mapFields('salesforce', {
        name: record.Name,
        amount: record.Amount,
        stage: record.StageName,
        probability: record.Probability,
        closeDate: record.CloseDate,
        accountId: record.AccountId,
      }, 'in'),
      lastModified: new Date(record.LastModifiedDate),
    }));
  }

  async createContact(data: any): Promise<CRMEntity> {
    const mappedData = fieldMapping.mapFields('salesforce', data, 'out');
    const response = await this.client.post('/sobjects/Contact', mappedData);
    
    return {
      id: createHash('md5').update(`sf_contact_${response.data.id}`).digest('hex'),
      externalId: response.data.id,
      type: 'contact',
      provider: 'salesforce',
      data,
      lastModified: new Date(),
    };
  }

  async updateContact(id: string, data: any): Promise<CRMEntity> {
    const mappedData = fieldMapping.mapFields('salesforce', data, 'out');
    await this.client.patch(`/sobjects/Contact/${id}`, mappedData);
    
    return {
      id: createHash('md5').update(`sf_contact_${id}`).digest('hex'),
      externalId: id,
      type: 'contact',
      provider: 'salesforce',
      data,
      lastModified: new Date(),
    };
  }

  async deleteContact(id: string): Promise<void> {
    await this.client.delete(`/sobjects/Contact/${id}`);
  }

  async createLead(data: any): Promise<CRMEntity> {
    const mappedData = fieldMapping.mapFields('salesforce', data, 'out');
    const response = await this.client.post('/sobjects/Lead', mappedData);
    
    return {
      id: createHash('md5').update(`sf_lead_${response.data.id}`).digest('hex'),
      externalId: response.data.id,
      type: 'lead',
      provider: 'salesforce',
      data,
      lastModified: new Date(),
    };
  }

  async updateLead(id: string, data: any): Promise<CRMEntity> {
    const mappedData = fieldMapping.mapFields('salesforce', data, 'out');
    await this.client.patch(`/sobjects/Lead/${id}`, mappedData);
    
    return {
      id: createHash('md5').update(`sf_lead_${id}`).digest('hex'),
      externalId: id,
      type: 'lead',
      provider: 'salesforce',
      data,
      lastModified: new Date(),
    };
  }

  async deleteLead(id: string): Promise<void> {
    await this.client.delete(`/sobjects/Lead/${id}`);
  }

  async createOpportunity(data: any): Promise<CRMEntity> {
    const mappedData = fieldMapping.mapFields('salesforce', data, 'out');
    const response = await this.client.post('/sobjects/Opportunity', mappedData);
    
    return {
      id: createHash('md5').update(`sf_opp_${response.data.id}`).digest('hex'),
      externalId: response.data.id,
      type: 'opportunity',
      provider: 'salesforce',
      data,
      lastModified: new Date(),
    };
  }

  async updateOpportunity(id: string, data: any): Promise<CRMEntity> {
    const mappedData = fieldMapping.mapFields('salesforce', data, 'out');
    await this.client.patch(`/sobjects/Opportunity/${id}`, mappedData);
    
    return {
      id: createHash('md5').update(`sf_opp_${id}`).digest('hex'),
      externalId: id,
      type: 'opportunity',
      provider: 'salesforce',
      data,
      lastModified: new Date(),
    };
  }

  async deleteOpportunity(id: string): Promise<void> {
    await this.client.delete(`/sobjects/Opportunity/${id}`);
  }
}

// HubSpot Connector
class HubSpotConnector extends BaseCRMConnector {
  constructor(credentials: CRMCredentials) {
    super(credentials);
    this.client.defaults.baseURL = 'https://api.hubapi.com';
  }

  async refreshToken(): Promise<void> {
    const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
      grant_type: 'refresh_token',
      refresh_token: this.credentials.refresh_token,
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
    });

    const { access_token, refresh_token } = response.data;
    this.credentials.access_token = access_token;
    if (refresh_token) {
      this.credentials.refresh_token = refresh_token;
    }

    await supabase
      .from('crm_credentials')
      .update({ 
        access_token,
        refresh_token: refresh_token || this.credentials.refresh_token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.credentials.id);
  }

  async getContacts(lastModified?: Date): Promise<CRMEntity[]> {
    const params = new URLSearchParams({
      properties: 'firstname,lastname,email,phone,company',
      limit: '100',
    });

    if (lastModified) {
      params.append('lastmodifieddate', lastModified.getTime().toString());
    }

    const response = await this.client.get(`/crm/v3/objects/contacts?${params}`);

    return response.data.results.map((record: any) => ({
      id: createHash('md5').update(`hs_contact_${record.id}`).digest('hex'),
      externalId: record.id,
      type: 'contact' as const,
      provider: 'hubspot',
      data: fieldMapping.mapFields('hubspot', {
        firstName: record.properties.firstname,
        lastName: record.properties.lastname,
        email: record.properties.email,
        phone: record.properties.phone,
        company: record.properties.company,
      }, 'in'),
      lastModified: new Date(record.updatedAt),
    }));
  }

  async getLeads(lastModified?: Date): Promise<CRMEntity[]> {
    // HubSpot doesn't have separate leads, treating contacts with specific lifecycle stage as leads
    const params = new URLSearchParams({
      properties: 'firstname,lastname,email,company,lifecyclestage,hs_lead_status,hs_analytics_source',
      limit: '100',
    });

    if (lastModified) {
      params.append('lastmodifieddate', lastModified.getTime().toString());
    }

    const response = await this.client.get(`/crm/v3/objects/contacts?${params}`);

    return response.data.results
      .filter((record: any) => record.properties.lifecyclestage === 'lead')
      .map((record: any) => ({
        id: createHash('md5').update(`hs_lead_${record.id}`).digest('hex'),
        externalId: record.id,
        type: 'lead' as const,
        provider: 'hubspot',
        data: fieldMapping.mapFields('hubspot', {
          firstName: record.properties.firstname,
          lastName: record.properties.lastname,
          email: record.properties.email,
          company: record.properties.company,
          status: record.properties.hs_lead_status,
          source: record.properties.hs_analytics_source,
        }, 'in'),
        lastModified: new Date(record.updatedAt),
      }));
  }

  async getOpportunities(lastModified?: Date): Promise<CRMEntity[]> {
    const params = new URLSearchParams({
      properties: 'dealname,amount,dealstage,probability,closedate,hubspot_owner_id',
      limit: '100',
    });

    if (lastModified) {
      params.append('lastmodifieddate', lastModified.getTime().toString());
    }

    const response = await this.client.get(`/crm/v3/objects/deals?${params}`);

    return response.data.results.map((record: any) => ({
      id: createHash('md5').update(`hs_deal_${record.id}`).digest('hex'),
      externalId: record.id,
      type: 'opportunity' as const,
      provider: 'hubspot',
      data: fieldMapping.mapFields('hubspot', {
        name: record.properties.dealname,
        amount: parseFloat(record.properties.amount) || 0,
        stage: record.properties.dealstage,
        probability: parseFloat(record.properties.probability) || 0,
        closeDate: record.properties.closedate,
        ownerId: record.properties.hubspot_owner_id,
      }, 'in'),
      lastModified: new Date(record.updatedAt),
    }));
  }

  async createContact(data: any): Promise<CRMEntity> {
    const mappedData = fieldMapping.mapFields('hubspot', data, 'out');
    const response = await this.client.post('/crm/v3/objects/contacts', {
      properties: mappedData,
    });
    
    return {
      id: createHash('md5').update(`hs_contact_${response.data.id}`).digest('hex'),
      externalId: response.data.id