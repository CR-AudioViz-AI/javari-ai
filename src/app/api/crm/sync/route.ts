import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { ratelimit } from '@/lib/redis';

// Types
interface CRMProvider {
  id: string;
  name: 'salesforce' | 'hubspot' | 'dynamics';
  credentials: Record<string, string>;
  lastSyncAt: string;
  isActive: boolean;
}

interface SyncOperation {
  id: string;
  provider: string;
  operation: 'create' | 'update' | 'delete';
  recordType: string;
  recordId: string;
  data: Record<string, any>;
  timestamp: string;
  version: number;
}

interface ConflictResolution {
  strategy: 'latest_wins' | 'merge' | 'manual' | 'source_priority';
  sourceSystem: string;
  targetSystem: string;
  conflictData: Record<string, any>;
}

// Validation schemas
const syncRequestSchema = z.object({
  providers: z.array(z.enum(['salesforce', 'hubspot', 'dynamics'])).optional(),
  recordTypes: z.array(z.string()).optional(),
  mode: z.enum(['incremental', 'full', 'bidirectional']).default('incremental'),
  conflictStrategy: z.enum(['latest_wins', 'merge', 'manual', 'source_priority']).default('latest_wins'),
  batchSize: z.number().min(1).max(1000).default(100),
  dryRun: z.boolean().default(false)
});

const webhookSchema = z.object({
  provider: z.enum(['salesforce', 'hubspot', 'dynamics']),
  eventType: z.string(),
  recordId: z.string(),
  recordType: z.string(),
  data: z.record(z.any()),
  timestamp: z.string()
});

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

// CRM Adapters
class SalesforceAdapter {
  private accessToken: string;
  private instanceUrl: string;

  constructor(credentials: Record<string, string>) {
    this.accessToken = credentials.access_token;
    this.instanceUrl = credentials.instance_url;
  }

  async fetchRecords(recordType: string, lastModified?: string): Promise<any[]> {
    const soql = lastModified 
      ? `SELECT Id, Name, LastModifiedDate FROM ${recordType} WHERE LastModifiedDate > ${lastModified}`
      : `SELECT Id, Name, LastModifiedDate FROM ${recordType}`;

    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(soql)}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.records || [];
  }

  async createRecord(recordType: string, data: Record<string, any>): Promise<string> {
    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/${recordType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Salesforce create error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.id;
  }

  async updateRecord(recordType: string, recordId: string, data: Record<string, any>): Promise<void> {
    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/${recordType}/${recordId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Salesforce update error: ${response.statusText}`);
    }
  }
}

class HubSpotAdapter {
  private accessToken: string;

  constructor(credentials: Record<string, string>) {
    this.accessToken = credentials.access_token;
  }

  async fetchRecords(recordType: string, lastModified?: string): Promise<any[]> {
    const endpoint = `https://api.hubapi.com/crm/v3/objects/${recordType}`;
    const params = new URLSearchParams({
      limit: '100',
      properties: 'id,createdate,lastmodifieddate'
    });

    if (lastModified) {
      params.append('filters', JSON.stringify([{
        propertyName: 'lastmodifieddate',
        operator: 'GT',
        value: lastModified
      }]));
    }

    const response = await fetch(`${endpoint}?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  async createRecord(recordType: string, data: Record<string, any>): Promise<string> {
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/${recordType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties: data })
    });

    if (!response.ok) {
      throw new Error(`HubSpot create error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.id;
  }

  async updateRecord(recordType: string, recordId: string, data: Record<string, any>): Promise<void> {
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/${recordType}/${recordId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties: data })
    });

    if (!response.ok) {
      throw new Error(`HubSpot update error: ${response.statusText}`);
    }
  }
}

class DynamicsAdapter {
  private accessToken: string;
  private baseUrl: string;

  constructor(credentials: Record<string, string>) {
    this.accessToken = credentials.access_token;
    this.baseUrl = credentials.base_url;
  }

  async fetchRecords(recordType: string, lastModified?: string): Promise<any[]> {
    let url = `${this.baseUrl}/api/data/v9.2/${recordType}`;
    
    if (lastModified) {
      url += `?$filter=modifiedon gt ${lastModified}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Dynamics API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.value || [];
  }

  async createRecord(recordType: string, data: Record<string, any>): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/data/v9.2/${recordType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Dynamics create error: ${response.statusText}`);
    }

    const location = response.headers.get('OData-EntityId');
    return location?.split('(')[1]?.split(')')[0] || '';
  }

  async updateRecord(recordType: string, recordId: string, data: Record<string, any>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/data/v9.2/${recordType}(${recordId})`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Dynamics update error: ${response.statusText}`);
    }
  }
}

// Sync Engine
class CRMSyncEngine {
  private adapters: Map<string, any> = new Map();

  async initializeAdapters(providers: CRMProvider[]): Promise<void> {
    for (const provider of providers) {
      switch (provider.name) {
        case 'salesforce':
          this.adapters.set(provider.id, new SalesforceAdapter(provider.credentials));
          break;
        case 'hubspot':
          this.adapters.set(provider.id, new HubSpotAdapter(provider.credentials));
          break;
        case 'dynamics':
          this.adapters.set(provider.id, new DynamicsAdapter(provider.credentials));
          break;
      }
    }
  }

  async performSync(options: z.infer<typeof syncRequestSchema>): Promise<any> {
    const syncId = crypto.randomUUID();
    const lockKey = `sync:${syncId}`;
    
    try {
      // Acquire distributed lock
      const lockAcquired = await redis.set(lockKey, '1', 'PX', 300000, 'NX');
      if (!lockAcquired) {
        throw new Error('Sync already in progress');
      }

      // Get active providers
      const { data: providers, error } = await supabase
        .from('crm_providers')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      const results = {
        syncId,
        startTime: new Date().toISOString(),
        providers: [],
        conflicts: [],
        summary: { created: 0, updated: 0, errors: 0 }
      };

      await this.initializeAdapters(providers);

      for (const provider of providers) {
        if (options.providers && !options.providers.includes(provider.name)) continue;

        try {
          const providerResult = await this.syncProvider(provider, options);
          results.providers.push(providerResult);
          results.summary.created += providerResult.created;
          results.summary.updated += providerResult.updated;
          results.conflicts.push(...providerResult.conflicts);
        } catch (error) {
          results.summary.errors++;
          results.providers.push({
            providerId: provider.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Log sync operation
      await supabase.from('sync_logs').insert({
        sync_id: syncId,
        status: 'completed',
        results: results,
        created_at: new Date().toISOString()
      });

      return results;

    } finally {
      await redis.del(lockKey);
    }
  }

  private async syncProvider(provider: CRMProvider, options: z.infer<typeof syncRequestSchema>): Promise<any> {
    const adapter = this.adapters.get(provider.id);
    if (!adapter) throw new Error(`Adapter not found for provider ${provider.id}`);

    const result = {
      providerId: provider.id,
      created: 0,
      updated: 0,
      conflicts: []
    };

    const recordTypes = options.recordTypes || ['contacts', 'companies', 'deals'];
    
    for (const recordType of recordTypes) {
      const lastSync = options.mode === 'full' ? undefined : provider.lastSyncAt;
      const records = await adapter.fetchRecords(recordType, lastSync);

      for (const record of records) {
        try {
          const operation = await this.detectOperation(provider.id, recordType, record);
          
          if (operation.hasConflict) {
            const resolution = await this.resolveConflict(operation, options.conflictStrategy);
            result.conflicts.push(resolution);
            
            if (resolution.resolution === 'skip') continue;
          }

          if (options.dryRun) continue;

          switch (operation.type) {
            case 'create':
              await this.createRecord(provider.id, recordType, record);
              result.created++;
              break;
            case 'update':
              await this.updateRecord(provider.id, recordType, record.id, record);
              result.updated++;
              break;
          }

          // Log operation
          await supabase.from('sync_operations').insert({
            provider_id: provider.id,
            record_type: recordType,
            record_id: record.id,
            operation: operation.type,
            data: record,
            created_at: new Date().toISOString()
          });

        } catch (error) {
          console.error(`Sync error for record ${record.id}:`, error);
        }
      }
    }

    // Update last sync time
    await supabase
      .from('crm_providers')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', provider.id);

    return result;
  }

  private async detectOperation(providerId: string, recordType: string, record: any): Promise<any> {
    const { data: existing } = await supabase
      .from('crm_records')
      .select('*')
      .eq('provider_id', providerId)
      .eq('record_type', recordType)
      .eq('external_id', record.id)
      .single();

    if (!existing) {
      return { type: 'create', hasConflict: false };
    }

    // Check for conflicts (concurrent updates)
    const hasConflict = new Date(record.lastModified) < new Date(existing.last_modified);
    
    return {
      type: 'update',
      hasConflict,
      existing,
      incoming: record
    };
  }

  private async resolveConflict(operation: any, strategy: string): Promise<ConflictResolution> {
    const conflict: ConflictResolution = {
      strategy: strategy as any,
      sourceSystem: operation.incoming.source || 'unknown',
      targetSystem: operation.existing.source || 'unknown',
      conflictData: {
        existing: operation.existing,
        incoming: operation.incoming
      }
    };

    switch (strategy) {
      case 'latest_wins':
        return { ...conflict, resolution: 'use_incoming' };
      case 'source_priority':
        const priority = await this.getSourcePriority(conflict.sourceSystem, conflict.targetSystem);
        return { ...conflict, resolution: priority === 'source' ? 'use_incoming' : 'use_existing' };
      case 'manual':
        await this.logConflictForManualResolution(conflict);
        return { ...conflict, resolution: 'skip' };
      default:
        return { ...conflict, resolution: 'use_incoming' };
    }
  }

  private async getSourcePriority(source: string, target: string): Promise<string> {
    const { data } = await supabase
      .from('sync_rules')
      .select('priority')
      .eq('source_system', source)
      .eq('target_system', target)
      .single();

    return data?.priority || 'source';
  }

  private async logConflictForManualResolution(conflict: ConflictResolution): Promise<void> {
    await supabase.from('sync_conflicts').insert({
      source_system: conflict.sourceSystem,
      target_system: conflict.targetSystem,
      conflict_data: conflict.conflictData,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  }

  private async createRecord(providerId: string, recordType: string, data: any): Promise<void> {
    // Implementation would sync to other connected systems
    await supabase.from('crm_records').insert({
      provider_id: providerId,
      record_type: recordType,
      external_id: data.id,
      data: data,
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString()
    });
  }

  private async updateRecord(providerId: string, recordType: string, recordId: string, data: any): Promise<void> {
    await supabase
      .from('crm_records')
      .update({
        data: data,
        last_modified: new Date().toISOString()
      })
      .eq('provider_id', providerId)
      .eq('record_type', recordType)
      .eq('external_id', recordId);
  }
}

// Route handlers
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.ip ?? '127.0.0.1';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = syncRequestSchema.parse(body);

    const syncEngine = new CRMSyncEngine();
    const result = await syncEngine.performSync(validatedData);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('CRM sync error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');
    const status = searchParams.get('status');

    let query = supabase.from('sync_logs').select('*');

    if (syncId) {
      query = query.eq('sync_id', syncId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Get sync logs error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Webhook handler for real-time sync
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = webhookSchema.parse(body);

    // Queue webhook for processing
    await redis.lpush('sync_webhooks', JSON.stringify({
      ...validatedData,
      receivedAt: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Webhook queued for processing'
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}