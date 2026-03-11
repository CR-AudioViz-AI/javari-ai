```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/utils/rate-limit';
import { validateApiKey } from '@/lib/auth/api-key-validator';
import { CRMProvider, CRMConnection, SyncOperation, CustomerInsight } from '@/types/crm';
import { SalesforceClient } from '@/lib/crm/salesforce-client';
import { HubSpotClient } from '@/lib/crm/hubspot-client';
import { DynamicsClient } from '@/lib/crm/dynamics-client';
import { LeadScorer } from '@/lib/crm/lead-scorer';
import { AIInsightsEngine } from '@/lib/crm/ai-insights';
import { SyncEngine } from '@/lib/crm/sync-engine';
import { sanitizeInput, validateSchema } from '@/lib/utils/validation';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import { Logger } from '@/lib/utils/logger';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const logger = new Logger('CRM-API');

interface CRMRequest {
  action: 'connect' | 'sync' | 'disconnect' | 'insights' | 'score_leads';
  provider: CRMProvider;
  connectionId?: string;
  credentials?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    instanceUrl?: string;
    accessToken?: string;
    hubId?: string;
    tenantId?: string;
  };
  syncOptions?: {
    entities: string[];
    direction: 'inbound' | 'outbound' | 'bidirectional';
    batchSize: number;
    filterCriteria?: Record<string, any>;
  };
  insightOptions?: {
    customerId?: string;
    timeRange?: string;
    metrics?: string[];
  };
}

const requestSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['connect', 'sync', 'disconnect', 'insights', 'score_leads'] },
    provider: { type: 'string', enum: ['salesforce', 'hubspot', 'dynamics'] },
    connectionId: { type: 'string', pattern: '^[a-zA-Z0-9-_]{1,50}$' },
    credentials: {
      type: 'object',
      additionalProperties: { type: 'string', maxLength: 500 }
    },
    syncOptions: {
      type: 'object',
      properties: {
        entities: { type: 'array', items: { type: 'string' }, maxItems: 20 },
        direction: { type: 'string', enum: ['inbound', 'outbound', 'bidirectional'] },
        batchSize: { type: 'number', minimum: 1, maximum: 1000 }
      }
    }
  },
  required: ['action', 'provider'],
  additionalProperties: false
};

function getCRMClient(provider: CRMProvider, credentials: any) {
  switch (provider) {
    case 'salesforce':
      return new SalesforceClient(credentials);
    case 'hubspot':
      return new HubSpotClient(credentials);
    case 'dynamics':
      return new DynamicsClient(credentials);
    default:
      throw new Error(`Unsupported CRM provider: ${provider}`);
  }
}

async function handleConnect(request: CRMRequest, userId: string): Promise<any> {
  if (!request.credentials) {
    throw new Error('Credentials are required for connection');
  }

  // Encrypt sensitive credentials
  const encryptedCredentials = encrypt(JSON.stringify(request.credentials));
  
  // Test connection
  const client = getCRMClient(request.provider, request.credentials);
  await client.testConnection();

  // Store connection
  const { data: connection, error } = await supabase
    .from('crm_connections')
    .insert({
      user_id: userId,
      provider: request.provider,
      credentials: encryptedCredentials,
      status: 'active',
      last_sync: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to store CRM connection', { error, userId, provider: request.provider });
    throw new Error('Failed to store connection');
  }

  // Initialize sync metadata
  await supabase
    .from('crm_sync_logs')
    .insert({
      connection_id: connection.id,
      status: 'initialized',
      sync_type: 'initial',
      records_processed: 0,
      errors: [],
      started_at: new Date().toISOString()
    });

  return {
    connectionId: connection.id,
    provider: request.provider,
    status: 'connected',
    capabilities: await client.getCapabilities()
  };
}

async function handleSync(request: CRMRequest, userId: string): Promise<any> {
  if (!request.connectionId) {
    throw new Error('Connection ID is required for sync operation');
  }

  // Get connection details
  const { data: connection, error: connectionError } = await supabase
    .from('crm_connections')
    .select('*')
    .eq('id', request.connectionId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (connectionError || !connection) {
    throw new Error('Invalid or inactive connection');
  }

  // Decrypt credentials
  const credentials = JSON.parse(decrypt(connection.credentials));
  const client = getCRMClient(connection.provider, credentials);

  // Initialize sync engine
  const syncEngine = new SyncEngine(client, supabase);
  
  const syncOptions = {
    entities: request.syncOptions?.entities || ['contacts', 'companies', 'deals'],
    direction: request.syncOptions?.direction || 'bidirectional',
    batchSize: request.syncOptions?.batchSize || 100,
    filterCriteria: request.syncOptions?.filterCriteria || {}
  };

  // Start async sync operation
  const syncJob = await syncEngine.startSync(connection.id, syncOptions);

  // Update connection last sync
  await supabase
    .from('crm_connections')
    .update({ 
      last_sync: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', connection.id);

  return {
    syncJobId: syncJob.id,
    status: 'started',
    estimatedRecords: syncJob.estimatedRecords,
    entities: syncOptions.entities
  };
}

async function handleInsights(request: CRMRequest, userId: string): Promise<any> {
  const aiEngine = new AIInsightsEngine(supabase);
  const leadScorer = new LeadScorer(supabase);

  const options = {
    customerId: request.insightOptions?.customerId,
    timeRange: request.insightOptions?.timeRange || '30d',
    metrics: request.insightOptions?.metrics || ['engagement', 'conversion_probability', 'churn_risk']
  };

  let insights: CustomerInsight[] = [];

  if (options.customerId) {
    // Get insights for specific customer
    const customerInsights = await aiEngine.analyzeCustomer(options.customerId, {
      timeRange: options.timeRange,
      includeMetrics: options.metrics
    });
    insights = [customerInsights];
  } else {
    // Get insights for all customers
    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .limit(100);

    if (customers) {
      const insightPromises = customers.map(customer =>
        aiEngine.analyzeCustomer(customer.id, options)
      );
      insights = await Promise.all(insightPromises);
    }
  }

  // Score leads if requested
  let scoredLeads = null;
  if (request.action === 'score_leads') {
    scoredLeads = await leadScorer.scoreLeads(userId, {
      limit: 50,
      minScore: 0.5
    });
  }

  return {
    insights: insights.map(insight => ({
      customerId: insight.customerId,
      engagementScore: insight.engagementScore,
      conversionProbability: insight.conversionProbability,
      churnRisk: insight.churnRisk,
      recommendedActions: insight.recommendedActions,
      lastUpdated: insight.lastUpdated
    })),
    scoredLeads,
    summary: {
      totalCustomers: insights.length,
      highEngagement: insights.filter(i => i.engagementScore > 0.7).length,
      atRisk: insights.filter(i => i.churnRisk > 0.6).length,
      avgConversionProbability: insights.reduce((sum, i) => sum + i.conversionProbability, 0) / insights.length
    }
  };
}

async function handleDisconnect(request: CRMRequest, userId: string): Promise<any> {
  if (!request.connectionId) {
    throw new Error('Connection ID is required for disconnect operation');
  }

  // Update connection status
  const { error } = await supabase
    .from('crm_connections')
    .update({ 
      status: 'disconnected',
      updated_at: new Date().toISOString()
    })
    .eq('id', request.connectionId)
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to disconnect CRM integration');
  }

  // Cancel any active sync jobs
  await supabase
    .from('crm_sync_logs')
    .update({ 
      status: 'cancelled',
      completed_at: new Date().toISOString()
    })
    .eq('connection_id', request.connectionId)
    .in('status', ['running', 'queued']);

  return {
    connectionId: request.connectionId,
    status: 'disconnected'
  };
}

export async function GET(request: NextRequest) {
  try {
    const headersList = headers();
    const apiKey = headersList.get('x-api-key');
    const userId = headersList.get('x-user-id');

    if (!apiKey || !userId) {
      return NextResponse.json(
        { error: 'API key and user ID are required' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(userId, 'crm-api', 100, 3600);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Validate API key
    const isValidKey = await validateApiKey(apiKey, userId);
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Get user's CRM connections
    const { data: connections, error } = await supabase
      .from('crm_connections')
      .select('id, provider, status, last_sync, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch CRM connections', { error, userId });
      return NextResponse.json(
        { error: 'Failed to fetch connections' },
        { status: 500 }
      );
    }

    // Get recent sync logs
    const { data: recentSyncs } = await supabase
      .from('crm_sync_logs')
      .select('connection_id, status, sync_type, records_processed, started_at, completed_at')
      .in('connection_id', connections?.map(c => c.id) || [])
      .order('started_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      connections: connections || [],
      recentSyncs: recentSyncs || [],
      supportedProviders: ['salesforce', 'hubspot', 'dynamics']
    });

  } catch (error) {
    logger.error('CRM API GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const headersList = headers();
    const apiKey = headersList.get('x-api-key');
    const userId = headersList.get('x-user-id');

    if (!apiKey || !userId) {
      return NextResponse.json(
        { error: 'API key and user ID are required' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(userId, 'crm-api-post', 50, 3600);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Validate API key
    const isValidKey = await validateApiKey(apiKey, userId);
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const sanitizedBody = sanitizeInput(body);

    // Validate request schema
    const validation = validateSchema(sanitizedBody, requestSchema);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid request format', details: validation.errors },
        { status: 400 }
      );
    }

    const crmRequest = sanitizedBody as CRMRequest;
    let result;

    switch (crmRequest.action) {
      case 'connect':
        result = await handleConnect(crmRequest, userId);
        break;
      case 'sync':
        result = await handleSync(crmRequest, userId);
        break;
      case 'insights':
      case 'score_leads':
        result = await handleInsights(crmRequest, userId);
        break;
      case 'disconnect':
        result = await handleDisconnect(crmRequest, userId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Log successful operation
    logger.info('CRM operation completed', {
      userId,
      action: crmRequest.action,
      provider: crmRequest.provider,
      connectionId: crmRequest.connectionId
    });

    return NextResponse.json({
      success: true,
      action: crmRequest.action,
      provider: crmRequest.provider,
      result
    });

  } catch (error) {
    logger.error('CRM API POST error', { error });
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const headersList = headers();
    const apiKey = headersList.get('x-api-key');
    const userId = headersList.get('x-user-id');

    if (!apiKey || !userId) {
      return NextResponse.json(
        { error: 'API key and user ID are required' },
        { status: 401 }
      );
    }

    // Validate API key
    const isValidKey = await validateApiKey(apiKey, userId);
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Delete connection and related data
    const { error: syncError } = await supabase
      .from('crm_sync_logs')
      .delete()
      .eq('connection_id', connectionId);

    const { error: connectionError } = await supabase
      .from('crm_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', userId);

    if (connectionError) {
      throw new Error('Failed to delete CRM connection');
    }

    return NextResponse.json({
      success: true,
      message: 'CRM connection deleted successfully'
    });

  } catch (error) {
    logger.error('CRM API DELETE error', { error });
    return NextResponse.json(
      { error: 'Failed to delete connection' },
      { status: 500 }
    );
  }
}
```