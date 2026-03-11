```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';

// Types
interface SalesforceConnection {
  id: string;
  user_id: string;
  instance_url: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  is_active: boolean;
}

interface SyncJob {
  id: string;
  connection_id: string;
  job_type: 'full' | 'incremental' | 'real_time';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  object_types: string[];
  records_processed: number;
  records_failed: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

interface ConflictResolution {
  id: string;
  sync_job_id: string;
  object_type: string;
  salesforce_id: string;
  local_id: string;
  conflict_type: 'field_mismatch' | 'timestamp_conflict' | 'schema_change';
  resolution_strategy: 'salesforce_wins' | 'local_wins' | 'merge' | 'manual';
  resolved: boolean;
  resolved_at?: string;
}

interface FieldMapping {
  id: string;
  connection_id: string;
  object_type: string;
  salesforce_field: string;
  local_field: string;
  transformation_rule?: string;
  is_bidirectional: boolean;
}

class SalesforceConnector {
  private instanceUrl: string;
  private accessToken: string;
  private redis: Redis;
  private supabase: any;

  constructor(connection: SalesforceConnection, redis: Redis, supabase: any) {
    this.instanceUrl = connection.instance_url;
    this.accessToken = connection.access_token;
    this.redis = redis;
    this.supabase = supabase;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const rateLimitKey = `salesforce_rate_limit:${this.instanceUrl}`;
    const currentCount = await this.redis.get(rateLimitKey);
    
    if (currentCount && parseInt(currentCount) >= 1000) {
      throw new Error('Salesforce API rate limit exceeded');
    }

    const response = await fetch(`${this.instanceUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    await this.redis.incr(rateLimitKey);
    await this.redis.expire(rateLimitKey, 3600); // 1 hour window

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Salesforce API error: ${response.status} - ${error.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async getRecords(objectType: string, fields: string[], lastModified?: string): Promise<any[]> {
    let query = `SELECT ${fields.join(', ')} FROM ${objectType}`;
    
    if (lastModified) {
      query += ` WHERE LastModifiedDate > ${lastModified}`;
    }
    
    query += ' ORDER BY LastModifiedDate ASC LIMIT 2000';

    const result = await this.makeRequest(`/services/data/v58.0/query/?q=${encodeURIComponent(query)}`);
    return result.records || [];
  }

  async createRecord(objectType: string, data: Record<string, any>): Promise<string> {
    const result = await this.makeRequest(`/services/data/v58.0/sobjects/${objectType}/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.id;
  }

  async updateRecord(objectType: string, id: string, data: Record<string, any>): Promise<void> {
    await this.makeRequest(`/services/data/v58.0/sobjects/${objectType}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteRecord(objectType: string, id: string): Promise<void> {
    await this.makeRequest(`/services/data/v58.0/sobjects/${objectType}/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkOperation(objectType: string, operation: 'insert' | 'update' | 'delete', records: any[]): Promise<any> {
    const job = await this.makeRequest('/services/data/v58.0/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify({
        object: objectType,
        operation,
        contentType: 'JSON',
        lineEnding: 'LF'
      }),
    });

    // Upload data
    await fetch(`${this.instanceUrl}/services/data/v58.0/jobs/ingest/${job.id}/batches`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: records.map(record => JSON.stringify(record)).join('\n'),
    });

    // Close job
    await this.makeRequest(`/services/data/v58.0/jobs/ingest/${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'JobComplete' }),
    });

    return job;
  }
}

class LeadSyncManager {
  private connector: SalesforceConnector;
  private supabase: any;
  private fieldMappings: FieldMapping[];

  constructor(connector: SalesforceConnector, supabase: any, fieldMappings: FieldMapping[]) {
    this.connector = connector;
    this.supabase = supabase;
    this.fieldMappings = fieldMappings.filter(m => m.object_type === 'Lead');
  }

  async syncToSalesforce(localLeads: any[]): Promise<{ success: number; failed: number; conflicts: ConflictResolution[] }> {
    const results = { success: 0, failed: 0, conflicts: [] as ConflictResolution[] };

    for (const lead of localLeads) {
      try {
        const transformedLead = this.transformToSalesforce(lead);
        
        if (lead.salesforce_id) {
          // Check for conflicts
          const sfLead = await this.connector.getRecords('Lead', ['LastModifiedDate'], 
            `Id = '${lead.salesforce_id}'`)[0];
          
          if (sfLead && new Date(sfLead.LastModifiedDate) > new Date(lead.updated_at)) {
            results.conflicts.push({
              id: crypto.randomUUID(),
              sync_job_id: '',
              object_type: 'Lead',
              salesforce_id: lead.salesforce_id,
              local_id: lead.id,
              conflict_type: 'timestamp_conflict',
              resolution_strategy: 'salesforce_wins',
              resolved: false,
            });
            continue;
          }

          await this.connector.updateRecord('Lead', lead.salesforce_id, transformedLead);
        } else {
          const salesforceId = await this.connector.createRecord('Lead', transformedLead);
          await this.supabase.from('leads').update({ salesforce_id: salesforceId }).eq('id', lead.id);
        }
        
        results.success++;
      } catch (error) {
        console.error(`Failed to sync lead ${lead.id}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  async syncFromSalesforce(lastSync?: string): Promise<{ success: number; failed: number; conflicts: ConflictResolution[] }> {
    const results = { success: 0, failed: 0, conflicts: [] as ConflictResolution[] };
    const fields = ['Id', 'FirstName', 'LastName', 'Email', 'Phone', 'Company', 'Status', 'LastModifiedDate'];
    
    const salesforceLeads = await this.connector.getRecords('Lead', fields, lastSync);

    for (const sfLead of salesforceLeads) {
      try {
        const transformedLead = this.transformFromSalesforce(sfLead);
        
        const { data: existingLead } = await this.supabase
          .from('leads')
          .select('*')
          .eq('salesforce_id', sfLead.Id)
          .single();

        if (existingLead) {
          if (new Date(existingLead.updated_at) > new Date(sfLead.LastModifiedDate)) {
            results.conflicts.push({
              id: crypto.randomUUID(),
              sync_job_id: '',
              object_type: 'Lead',
              salesforce_id: sfLead.Id,
              local_id: existingLead.id,
              conflict_type: 'timestamp_conflict',
              resolution_strategy: 'local_wins',
              resolved: false,
            });
            continue;
          }

          await this.supabase
            .from('leads')
            .update(transformedLead)
            .eq('salesforce_id', sfLead.Id);
        } else {
          await this.supabase
            .from('leads')
            .insert({ ...transformedLead, salesforce_id: sfLead.Id });
        }

        results.success++;
      } catch (error) {
        console.error(`Failed to sync lead from Salesforce ${sfLead.Id}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private transformToSalesforce(localLead: any): Record<string, any> {
    const transformed: Record<string, any> = {};
    
    for (const mapping of this.fieldMappings) {
      if (mapping.is_bidirectional || !mapping.salesforce_field.includes('->')) {
        const value = localLead[mapping.local_field];
        if (value !== undefined) {
          transformed[mapping.salesforce_field] = mapping.transformation_rule 
            ? this.applyTransformation(value, mapping.transformation_rule)
            : value;
        }
      }
    }

    return transformed;
  }

  private transformFromSalesforce(sfLead: any): Record<string, any> {
    const transformed: Record<string, any> = {};
    
    for (const mapping of this.fieldMappings) {
      const value = sfLead[mapping.salesforce_field];
      if (value !== undefined) {
        transformed[mapping.local_field] = mapping.transformation_rule 
          ? this.applyTransformation(value, mapping.transformation_rule)
          : value;
      }
    }

    return transformed;
  }

  private applyTransformation(value: any, rule: string): any {
    // Basic transformation rules
    switch (rule) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'phone_format':
        return typeof value === 'string' ? value.replace(/\D/g, '') : value;
      default:
        return value;
    }
  }
}

class OpportunitySyncManager {
  private connector: SalesforceConnector;
  private supabase: any;
  private fieldMappings: FieldMapping[];

  constructor(connector: SalesforceConnector, supabase: any, fieldMappings: FieldMapping[]) {
    this.connector = connector;
    this.supabase = supabase;
    this.fieldMappings = fieldMappings.filter(m => m.object_type === 'Opportunity');
  }

  async syncToSalesforce(localOpportunities: any[]): Promise<{ success: number; failed: number; conflicts: ConflictResolution[] }> {
    const results = { success: 0, failed: 0, conflicts: [] as ConflictResolution[] };

    for (const opportunity of localOpportunities) {
      try {
        const transformedOpp = this.transformToSalesforce(opportunity);
        
        if (opportunity.salesforce_id) {
          await this.connector.updateRecord('Opportunity', opportunity.salesforce_id, transformedOpp);
        } else {
          const salesforceId = await this.connector.createRecord('Opportunity', transformedOpp);
          await this.supabase.from('opportunities').update({ salesforce_id: salesforceId }).eq('id', opportunity.id);
        }
        
        results.success++;
      } catch (error) {
        console.error(`Failed to sync opportunity ${opportunity.id}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  async syncFromSalesforce(lastSync?: string): Promise<{ success: number; failed: number; conflicts: ConflictResolution[] }> {
    const results = { success: 0, failed: 0, conflicts: [] as ConflictResolution[] };
    const fields = ['Id', 'Name', 'Amount', 'StageName', 'CloseDate', 'Probability', 'LastModifiedDate'];
    
    const salesforceOpps = await this.connector.getRecords('Opportunity', fields, lastSync);

    for (const sfOpp of salesforceOpps) {
      try {
        const transformedOpp = this.transformFromSalesforce(sfOpp);
        
        const { data: existingOpp } = await this.supabase
          .from('opportunities')
          .select('*')
          .eq('salesforce_id', sfOpp.Id)
          .single();

        if (existingOpp) {
          await this.supabase
            .from('opportunities')
            .update(transformedOpp)
            .eq('salesforce_id', sfOpp.Id);
        } else {
          await this.supabase
            .from('opportunities')
            .insert({ ...transformedOpp, salesforce_id: sfOpp.Id });
        }

        results.success++;
      } catch (error) {
        console.error(`Failed to sync opportunity from Salesforce ${sfOpp.Id}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private transformToSalesforce(localOpp: any): Record<string, any> {
    const transformed: Record<string, any> = {};
    
    for (const mapping of this.fieldMappings) {
      if (mapping.is_bidirectional || !mapping.salesforce_field.includes('->')) {
        const value = localOpp[mapping.local_field];
        if (value !== undefined) {
          transformed[mapping.salesforce_field] = value;
        }
      }
    }

    return transformed;
  }

  private transformFromSalesforce(sfOpp: any): Record<string, any> {
    const transformed: Record<string, any> = {};
    
    for (const mapping of this.fieldMappings) {
      const value = sfOpp[mapping.salesforce_field];
      if (value !== undefined) {
        transformed[mapping.local_field] = value;
      }
    }

    return transformed;
  }
}

class ConflictResolver {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async resolveConflict(conflictId: string, resolution: 'salesforce_wins' | 'local_wins' | 'merge'): Promise<void> {
    const { data: conflict } = await this.supabase
      .from('conflict_logs')
      .select('*')
      .eq('id', conflictId)
      .single();

    if (!conflict) {
      throw new Error('Conflict not found');
    }

    switch (resolution) {
      case 'salesforce_wins':
        await this.applySalesforceWins(conflict);
        break;
      case 'local_wins':
        await this.applyLocalWins(conflict);
        break;
      case 'merge':
        await this.applyMerge(conflict);
        break;
    }

    await this.supabase
      .from('conflict_logs')
      .update({ 
        resolved: true, 
        resolved_at: new Date().toISOString(),
        resolution_strategy: resolution 
      })
      .eq('id', conflictId);
  }

  private async applySalesforceWins(conflict: ConflictResolution): Promise<void> {
    // Implementation to fetch from Salesforce and update local record
  }

  private async applyLocalWins(conflict: ConflictResolution): Promise<void> {
    // Implementation to push local record to Salesforce
  }

  private async applyMerge(conflict: ConflictResolution): Promise<void> {
    // Implementation to merge both records based on field priority
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, connection_id, object_types = ['Lead', 'Opportunity'], job_type = 'incremental' } = body;

    // Get Salesforce connection
    const { data: connection, error: connectionError } = await supabase
      .from('salesforce_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Invalid or inactive Salesforce connection' }, { status: 400 });
    }

    // Get field mappings
    const { data: fieldMappings } = await supabase
      .from('field_mappings')
      .select('*')
      .eq('connection_id', connection_id);

    // Create sync job
    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        connection_id,
        job_type,
        object_types,
        status: 'pending',
        records_processed: 0,
        records_failed: 0,
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: 'Failed to create sync job' }, { status: 500 });
    }

    // Initialize components
    const connector = new SalesforceConnector(connection, redis, supabase);
    const leadSync = new LeadSyncManager(connector, supabase, fieldMappings || []);
    const oppSync = new OpportunitySyncManager(connector, supabase, fieldMappings || []);

    // Update job status to running
    await supabase
      .from('sync_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', syncJob.id);

    let totalProcessed = 0;
    let totalFailed = 0;
    const allConflicts: ConflictResolution[] = [];

    try {
      switch (action) {
        case 'sync_to_salesforce':
          if (object_types.includes('Lead')) {
            const { data: leads } = await supabase.from('leads').select('*').eq('needs_sync', true);
            const leadResults = await leadSync.syncToSalesforce(leads || []);
            totalProcessed += leadResults.success;
            totalFailed += leadResults.failed;
            allConflicts.push(...leadResults.conflicts);
          }

          if (object_types.includes('Opportunity')) {
            const { data: opportunities } = await supabase.from('opportunities').select('*').eq('needs_sync', true);
            const oppResults = await oppSync.syncToSalesforce(opportunities || []);
            totalProcessed += oppResults.success;
            totalFailed += oppResults.failed;
            allConflicts.push(...oppResults.conflicts);
          }
          break;

        case 'sync_from_salesforce':
          const lastSync = job_type === 'incremental' 
            ? await redis.get(`last_sync:${connection_id}`)
            : undefined;

          if (object_types.includes('Lead')) {
            const leadResults = await leadSync.syncFromSalesforce(lastSync || undefined);
            totalProcessed += leadResults.success;
            totalFailed += leadResults.failed;
            allConflicts.push(...leadResults.conflicts);
          }

          if (object_types.includes('Opportunity')) {
            const oppResults = await oppSync.syncFromSalesforce(lastSync || undefined);
            totalProcessed += oppResults.success;
            totalFailed += oppResults.failed;
            allConflicts.push(...oppResults.conflicts);
          }

          await redis.set(`last_sync:${connection_id}`, new Date().toISOString());
          break;

        default:
          throw new Error('Invalid sync action');
      }

      // Log conflicts
      if (allConflicts.length > 0) {
        await supabase.from('conflict_logs').insert(
          allConflicts.map(conflict => ({ ...conflict, sync_job_id: syncJob.id }))
        );
      }

      // Update job completion
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: totalProcessed,
          records_failed: totalFailed,
        })
        .eq('id', syncJob.id);

      return NextResponse.json({
        sync_job_id: syncJob.id,
        status: 'completed',
        records_processed: totalProcessed,
        records_failed: totalFailed,
        conflicts: allConflicts.length,
      });

    } catch (error) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', syncJob.id);

      throw error;
    }

  } catch (error) {
    console.error('Salesforce sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');
    const connectionId = searchParams.get('connection_id');

    if (jobId) {
      const { data: job, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        return NextResponse.json({ error: '