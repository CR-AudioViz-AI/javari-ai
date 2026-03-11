```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ratelimit } from '@/lib/redis';
import { UniversalCRMConnector } from '@/lib/crm/universal-connector';
import { SalesforceAdapter } from '@/lib/crm/adapters/salesforce-adapter';
import { HubSpotAdapter } from '@/lib/crm/adapters/hubspot-adapter';
import { DynamicsAdapter } from '@/lib/crm/adapters/dynamics-adapter';
import { BidirectionalSync } from '@/lib/crm/sync/bidirectional-sync';
import { OAuthManager } from '@/lib/crm/auth/oauth-manager';
import { CRMRateLimiter } from '@/lib/crm/rate-limiter';
import { DataTransformer } from '@/utils/crm/data-transformer';
import { FieldMapper } from '@/utils/crm/field-mapping';
import type { 
  CRMProvider, 
  UniversalCRMRequest, 
  NormalizedContact, 
  SyncOperation,
  CRMConnection
} from '@/types/crm/universal-types';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const crmRequestSchema = z.object({
  operation: z.enum(['create', 'read', 'update', 'delete', 'sync', 'batch']),
  provider: z.enum(['salesforce', 'hubspot', 'dynamics']),
  entity: z.enum(['contact', 'lead', 'opportunity', 'account', 'deal']),
  data: z.any().optional(),
  filters: z.record(z.any()).optional(),
  connectionId: z.string(),
  syncDirection: z.enum(['inbound', 'outbound', 'bidirectional']).optional(),
  batchSize: z.number().min(1).max(1000).optional()
});

const syncRequestSchema = z.object({
  sourceProvider: z.enum(['salesforce', 'hubspot', 'dynamics']),
  targetProvider: z.enum(['salesforce', 'hubspot', 'dynamics']),
  entities: z.array(z.enum(['contact', 'lead', 'opportunity', 'account', 'deal'])),
  syncMode: z.enum(['full', 'incremental', 'selective']),
  fieldMappings: z.record(z.string()).optional(),
  filters: z.record(z.any()).optional()
});

// Rate limiting configuration per CRM provider
const RATE_LIMITS = {
  salesforce: { requests: 100, window: '1m' },
  hubspot: { requests: 100, window: '10s' },
  dynamics: { requests: 60, window: '1m' }
} as const;

// Initialize CRM connectors
const initializeConnectors = () => {
  const salesforceAdapter = new SalesforceAdapter({
    clientId: process.env.SALESFORCE_CLIENT_ID!,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET!,
    redirectUri: process.env.SALESFORCE_REDIRECT_URI!
  });

  const hubspotAdapter = new HubSpotAdapter({
    apiKey: process.env.HUBSPOT_API_KEY!,
    clientId: process.env.HUBSPOT_CLIENT_ID!,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET!
  });

  const dynamicsAdapter = new DynamicsAdapter({
    tenantId: process.env.AZURE_TENANT_ID!,
    clientId: process.env.DYNAMICS_CLIENT_ID!,
    clientSecret: process.env.DYNAMICS_CLIENT_SECRET!,
    instanceUrl: process.env.DYNAMICS_INSTANCE_URL!
  });

  return new UniversalCRMConnector({
    adapters: {
      salesforce: salesforceAdapter,
      hubspot: hubspotAdapter,
      dynamics: dynamicsAdapter
    },
    rateLimiter: new CRMRateLimiter(),
    dataTransformer: new DataTransformer(),
    fieldMapper: new FieldMapper()
  });
};

// Authentication middleware
async function authenticateRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new Error('Invalid or expired token');
    }

    // Check user permissions for CRM integrations
    const { data: permissions } = await supabase
      .from('user_permissions')
      .select('permissions')
      .eq('user_id', user.id)
      .single();

    if (!permissions?.permissions?.includes('crm_integrations')) {
      throw new Error('Insufficient permissions for CRM integrations');
    }

    return { user, permissions };
  } catch (error) {
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Rate limiting check
async function checkRateLimit(userId: string, provider: CRMProvider) {
  const limit = RATE_LIMITS[provider];
  const identifier = `crm:${provider}:${userId}`;
  
  const { success, reset } = await ratelimit(limit.requests, limit.window).limit(identifier);
  
  if (!success) {
    throw new Error(`Rate limit exceeded for ${provider}. Reset at: ${new Date(reset)}`);
  }
}

// Audit logging
async function logCRMOperation(
  userId: string,
  operation: string,
  provider: CRMProvider,
  entity: string,
  success: boolean,
  metadata?: any
) {
  try {
    await supabase.from('crm_audit_logs').insert({
      user_id: userId,
      operation,
      provider,
      entity,
      success,
      metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log CRM operation:', error);
  }
}

// Get CRM connection
async function getCRMConnection(connectionId: string, userId: string): Promise<CRMConnection> {
  const { data: connection, error } = await supabase
    .from('crm_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error || !connection) {
    throw new Error('CRM connection not found or inactive');
  }

  // Decrypt credentials
  const oauthManager = new OAuthManager();
  const decryptedCredentials = await oauthManager.decryptCredentials(
    connection.encrypted_credentials
  );

  return {
    ...connection,
    credentials: decryptedCredentials
  };
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    
    const operation = searchParams.get('operation') || 'read';
    const provider = searchParams.get('provider') as CRMProvider;
    const entity = searchParams.get('entity') || 'contact';
    const connectionId = searchParams.get('connectionId');

    if (!provider || !connectionId) {
      return NextResponse.json(
        { error: 'Provider and connectionId are required' },
        { status: 400 }
      );
    }

    await checkRateLimit(user.id, provider);

    const connection = await getCRMConnection(connectionId, user.id);
    const connector = initializeConnectors();

    let result;
    switch (operation) {
      case 'read':
        const filters = Object.fromEntries(
          Array.from(searchParams.entries()).filter(([key]) => 
            key.startsWith('filter_')
          ).map(([key, value]) => [key.replace('filter_', ''), value])
        );
        
        result = await connector.query({
          provider,
          entity,
          filters,
          connection
        });
        break;

      case 'list_connections':
        const { data: connections } = await supabase
          .from('crm_connections')
          .select('id, provider, name, status, created_at')
          .eq('user_id', user.id);
        
        result = { connections };
        break;

      case 'sync_status':
        const { data: syncStatus } = await supabase
          .from('crm_sync_jobs')
          .select('*')
          .eq('connection_id', connectionId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        result = { syncJobs: syncStatus };
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported GET operation: ${operation}` },
          { status: 400 }
        );
    }

    await logCRMOperation(user.id, operation, provider, entity, true, { connectionId });

    return NextResponse.json({
      success: true,
      data: result,
      provider,
      entity,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('CRM Universal Connector GET Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: error instanceof Error && error.message.includes('Rate limit') ? 429 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await authenticateRequest(request);
    const body = await request.json();
    
    const validatedData = crmRequestSchema.parse(body);
    const { operation, provider, entity, data, connectionId } = validatedData;

    await checkRateLimit(user.id, provider);

    const connection = await getCRMConnection(connectionId, user.id);
    const connector = initializeConnectors();

    let result;
    switch (operation) {
      case 'create':
        result = await connector.create({
          provider,
          entity,
          data,
          connection
        });
        break;

      case 'update':
        if (!data.id) {
          throw new Error('Record ID is required for update operation');
        }
        result = await connector.update({
          provider,
          entity,
          id: data.id,
          data,
          connection
        });
        break;

      case 'delete':
        if (!data.id) {
          throw new Error('Record ID is required for delete operation');
        }
        result = await connector.delete({
          provider,
          entity,
          id: data.id,
          connection
        });
        break;

      case 'batch':
        const { operations, batchSize = 100 } = body;
        result = await connector.batch({
          provider,
          operations,
          batchSize,
          connection
        });
        break;

      case 'sync':
        const syncConfig = syncRequestSchema.parse(body);
        const bidirectionalSync = new BidirectionalSync({
          connector,
          supabase,
          rateLimiter: new CRMRateLimiter()
        });

        // Create sync job
        const { data: syncJob, error: jobError } = await supabase
          .from('crm_sync_jobs')
          .insert({
            user_id: user.id,
            source_provider: syncConfig.sourceProvider,
            target_provider: syncConfig.targetProvider,
            entities: syncConfig.entities,
            sync_mode: syncConfig.syncMode,
            status: 'queued',
            config: syncConfig
          })
          .select()
          .single();

        if (jobError) {
          throw new Error('Failed to create sync job');
        }

        // Execute sync asynchronously
        bidirectionalSync.execute({
          jobId: syncJob.id,
          ...syncConfig,
          sourceConnection: connection,
          targetConnection: await getCRMConnection(body.targetConnectionId, user.id)
        }).catch(error => {
          console.error('Sync execution error:', error);
          // Update job status to failed
          supabase
            .from('crm_sync_jobs')
            .update({ 
              status: 'failed', 
              error_message: error.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', syncJob.id)
            .then();
        });

        result = { syncJobId: syncJob.id, status: 'queued' };
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported operation: ${operation}` },
          { status: 400 }
        );
    }

    await logCRMOperation(user.id, operation, provider, entity, true, { connectionId });

    return NextResponse.json({
      success: true,
      data: result,
      operation,
      provider,
      entity,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('CRM Universal Connector POST Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    await logCRMOperation(
      (request as any).user?.id || 'unknown',
      body?.operation || 'unknown',
      body?.provider || 'unknown',
      body?.entity || 'unknown',
      false,
      { error: errorMessage }
    ).catch(() => {});

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { 
        status: error instanceof Error && error.message.includes('Rate limit') ? 429 : 
                error instanceof Error && error.message.includes('permissions') ? 403 : 500 
      }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await authenticateRequest(request);
    const body = await request.json();
    
    const { connectionId, config } = body;
    
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Update CRM connection configuration
    const { data: connection, error } = await supabase
      .from('crm_connections')
      .update({
        config: {
          ...config,
          updated_at: new Date().toISOString()
        }
      })
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update CRM connection');
    }

    await logCRMOperation(user.id, 'update_config', connection.provider, 'connection', true, { connectionId });

    return NextResponse.json({
      success: true,
      data: connection,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('CRM Universal Connector PUT Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    
    const connectionId = searchParams.get('connectionId');
    const syncJobId = searchParams.get('syncJobId');
    
    if (connectionId) {
      // Delete CRM connection
      const { error } = await supabase
        .from('crm_connections')
        .update({ status: 'deleted', deleted_at: new Date().toISOString() })
        .eq('id', connectionId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error('Failed to delete CRM connection');
      }

      await logCRMOperation(user.id, 'delete_connection', 'unknown', 'connection', true, { connectionId });

      return NextResponse.json({
        success: true,
        message: 'CRM connection deleted successfully',
        timestamp: new Date().toISOString()
      });

    } else if (syncJobId) {
      // Cancel sync job
      const { error } = await supabase
        .from('crm_sync_jobs')
        .update({ 
          status: 'cancelled', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', syncJobId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error('Failed to cancel sync job');
      }

      return NextResponse.json({
        success: true,
        message: 'Sync job cancelled successfully',
        timestamp: new Date().toISOString()
      });

    } else {
      return NextResponse.json(
        { error: 'Either connectionId or syncJobId is required' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('CRM Universal Connector DELETE Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
```