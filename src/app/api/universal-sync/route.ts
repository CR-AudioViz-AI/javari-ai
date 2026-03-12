```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SAPConnector } from '@/lib/connectors/sap/connector';
import { OracleConnector } from '@/lib/connectors/oracle/connector';
import { SalesforceConnector } from '@/lib/connectors/salesforce/connector';
import { DynamicsConnector } from '@/lib/connectors/dynamics/connector';
import { SyncEngine } from '@/lib/sync/sync-engine';
import { RealTimeHandler } from '@/lib/sync/real-time-handler';
import { DataTransformer } from '@/lib/sync/data-transformer';
import { ConflictResolver } from '@/lib/sync/conflict-resolver';
import { EnterpriseAuth } from '@/lib/auth/enterprise-auth';
import { WebhookManager } from '@/lib/webhooks/webhook-manager';
import { SyncQueue } from '@/lib/queue/sync-queue';
import { 
  EnterpriseSystem, 
  SyncConfiguration, 
  SyncStatus,
  ConnectorConfig,
  SyncJobStatus 
} from '@/types/enterprise-systems';

// Request validation schemas
const syncConfigSchema = z.object({
  systemType: z.enum(['sap', 'oracle', 'salesforce', 'dynamics']),
  connectionConfig: z.object({
    endpoint: z.string().url(),
    credentials: z.record(z.string()),
    environment: z.enum(['production', 'sandbox', 'development'])
  }),
  syncSettings: z.object({
    entities: z.array(z.string()).min(1),
    syncMode: z.enum(['full', 'incremental', 'real-time']),
    batchSize: z.number().min(1).max(10000).default(1000),
    frequency: z.number().min(60).max(86400).default(3600), // seconds
    conflictResolution: z.enum(['source-wins', 'target-wins', 'manual', 'latest-timestamp']).default('latest-timestamp')
  }),
  webhookConfig: z.object({
    enabled: z.boolean().default(true),
    endpoints: z.array(z.string().url()).default([])
  }).optional()
});

const syncActionSchema = z.object({
  action: z.enum(['start', 'stop', 'pause', 'resume', 'force-sync']),
  configId: z.string().uuid(),
  options: z.object({
    entities: z.array(z.string()).optional(),
    fullSync: z.boolean().default(false)
  }).optional()
});

const webhookConfigSchema = z.object({
  configId: z.string().uuid(),
  endpoints: z.array(z.object({
    url: z.string().url(),
    events: z.array(z.string()),
    headers: z.record(z.string()).optional(),
    retryPolicy: z.object({
      maxRetries: z.number().min(0).max(10).default(3),
      backoffMultiplier: z.number().min(1).max(10).default(2)
    }).optional()
  }))
});

class UniversalSyncAPI {
  private supabase;
  private connectors: Map<string, any>;
  private syncEngine: SyncEngine;
  private realTimeHandler: RealTimeHandler;
  private dataTransformer: DataTransformer;
  private conflictResolver: ConflictResolver;
  private enterpriseAuth: EnterpriseAuth;
  private webhookManager: WebhookManager;
  private syncQueue: SyncQueue;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
    this.connectors = new Map();
    this.syncEngine = new SyncEngine(supabaseClient);
    this.realTimeHandler = new RealTimeHandler(supabaseClient);
    this.dataTransformer = new DataTransformer();
    this.conflictResolver = new ConflictResolver();
    this.enterpriseAuth = new EnterpriseAuth();
    this.webhookManager = new WebhookManager(supabaseClient);
    this.syncQueue = new SyncQueue();

    this.initializeConnectors();
  }

  private initializeConnectors(): void {
    this.connectors.set('sap', new SAPConnector());
    this.connectors.set('oracle', new OracleConnector());
    this.connectors.set('salesforce', new SalesforceConnector());
    this.connectors.set('dynamics', new DynamicsConnector());
  }

  private getConnector(systemType: string) {
    const connector = this.connectors.get(systemType);
    if (!connector) {
      throw new Error(`Unsupported system type: ${systemType}`);
    }
    return connector;
  }

  async createSyncConfiguration(config: z.infer<typeof syncConfigSchema>, userId: string) {
    try {
      // Validate enterprise system credentials
      const connector = this.getConnector(config.systemType);
      const authResult = await this.enterpriseAuth.validateCredentials(
        config.systemType,
        config.connectionConfig.credentials
      );

      if (!authResult.valid) {
        throw new Error(`Invalid credentials for ${config.systemType}: ${authResult.error}`);
      }

      // Test connection
      await connector.testConnection(config.connectionConfig);

      // Store configuration in Supabase
      const { data: syncConfig, error } = await this.supabase
        .from('sync_configurations')
        .insert({
          user_id: userId,
          system_type: config.systemType,
          connection_config: config.connectionConfig,
          sync_settings: config.syncSettings,
          webhook_config: config.webhookConfig,
          status: 'inactive',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Initialize webhook endpoints if configured
      if (config.webhookConfig?.enabled && config.webhookConfig.endpoints.length > 0) {
        await this.webhookManager.registerEndpoints(
          syncConfig.id,
          config.webhookConfig.endpoints
        );
      }

      return {
        success: true,
        data: syncConfig,
        message: 'Sync configuration created successfully'
      };
    } catch (error: any) {
      throw new Error(`Failed to create sync configuration: ${error.message}`);
    }
  }

  async executeSyncAction(action: z.infer<typeof syncActionSchema>, userId: string) {
    try {
      // Verify user owns the configuration
      const { data: config, error: configError } = await this.supabase
        .from('sync_configurations')
        .select('*')
        .eq('id', action.configId)
        .eq('user_id', userId)
        .single();

      if (configError || !config) {
        throw new Error('Sync configuration not found or access denied');
      }

      const connector = this.getConnector(config.system_type);

      switch (action.action) {
        case 'start':
          return await this.startSync(config, action.options);
        case 'stop':
          return await this.stopSync(config.id);
        case 'pause':
          return await this.pauseSync(config.id);
        case 'resume':
          return await this.resumeSync(config);
        case 'force-sync':
          return await this.forceSyncNow(config, action.options);
        default:
          throw new Error(`Unknown sync action: ${action.action}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to execute sync action: ${error.message}`);
    }
  }

  private async startSync(config: any, options?: any) {
    // Update configuration status
    await this.supabase
      .from('sync_configurations')
      .update({ 
        status: 'active', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', config.id);

    // Initialize sync engine with configuration
    await this.syncEngine.initialize(config);

    // Queue initial sync job
    const jobId = await this.syncQueue.addSyncJob({
      configId: config.id,
      type: options?.fullSync ? 'full' : 'incremental',
      entities: options?.entities || config.sync_settings.entities,
      priority: 'high'
    });

    // Start real-time handler if enabled
    if (config.sync_settings.syncMode === 'real-time') {
      await this.realTimeHandler.startListening(config.id, config);
    }

    return {
      success: true,
      data: { configId: config.id, jobId, status: 'active' },
      message: 'Sync started successfully'
    };
  }

  private async stopSync(configId: string) {
    // Update configuration status
    await this.supabase
      .from('sync_configurations')
      .update({ 
        status: 'inactive', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', configId);

    // Stop real-time handler
    await this.realTimeHandler.stopListening(configId);

    // Cancel pending jobs
    await this.syncQueue.cancelJobsByConfig(configId);

    return {
      success: true,
      data: { configId, status: 'inactive' },
      message: 'Sync stopped successfully'
    };
  }

  private async pauseSync(configId: string) {
    await this.supabase
      .from('sync_configurations')
      .update({ 
        status: 'paused', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', configId);

    await this.realTimeHandler.pauseListening(configId);
    await this.syncQueue.pauseJobsByConfig(configId);

    return {
      success: true,
      data: { configId, status: 'paused' },
      message: 'Sync paused successfully'
    };
  }

  private async resumeSync(config: any) {
    await this.supabase
      .from('sync_configurations')
      .update({ 
        status: 'active', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', config.id);

    if (config.sync_settings.syncMode === 'real-time') {
      await this.realTimeHandler.resumeListening(config.id);
    }

    await this.syncQueue.resumeJobsByConfig(config.id);

    return {
      success: true,
      data: { configId: config.id, status: 'active' },
      message: 'Sync resumed successfully'
    };
  }

  private async forceSyncNow(config: any, options?: any) {
    const jobId = await this.syncQueue.addSyncJob({
      configId: config.id,
      type: 'force',
      entities: options?.entities || config.sync_settings.entities,
      priority: 'immediate'
    });

    return {
      success: true,
      data: { configId: config.id, jobId, status: 'syncing' },
      message: 'Force sync initiated'
    };
  }

  async getSyncStatus(configId: string, userId: string) {
    try {
      // Verify user owns the configuration
      const { data: config, error: configError } = await this.supabase
        .from('sync_configurations')
        .select('*')
        .eq('id', configId)
        .eq('user_id', userId)
        .single();

      if (configError || !config) {
        throw new Error('Sync configuration not found or access denied');
      }

      // Get recent sync jobs
      const { data: jobs, error: jobsError } = await this.supabase
        .from('sync_jobs')
        .select('*')
        .eq('config_id', configId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (jobsError) throw jobsError;

      // Get sync statistics
      const { data: stats, error: statsError } = await this.supabase
        .from('sync_statistics')
        .select('*')
        .eq('config_id', configId)
        .single();

      if (statsError && statsError.code !== 'PGRST116') throw statsError;

      return {
        success: true,
        data: {
          configuration: config,
          recentJobs: jobs || [],
          statistics: stats || {},
          currentStatus: config.status
        }
      };
    } catch (error: any) {
      throw new Error(`Failed to get sync status: ${error.message}`);
    }
  }

  async configureWebhooks(webhookConfig: z.infer<typeof webhookConfigSchema>, userId: string) {
    try {
      // Verify user owns the configuration
      const { data: config, error: configError } = await this.supabase
        .from('sync_configurations')
        .select('id, user_id')
        .eq('id', webhookConfig.configId)
        .eq('user_id', userId)
        .single();

      if (configError || !config) {
        throw new Error('Sync configuration not found or access denied');
      }

      // Update webhook configuration
      const webhookIds = await this.webhookManager.configureEndpoints(
        webhookConfig.configId,
        webhookConfig.endpoints
      );

      // Update configuration record
      await this.supabase
        .from('sync_configurations')
        .update({
          webhook_config: {
            enabled: true,
            endpoints: webhookConfig.endpoints.map(ep => ep.url)
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', webhookConfig.configId);

      return {
        success: true,
        data: { configId: webhookConfig.configId, webhookIds },
        message: 'Webhooks configured successfully'
      };
    } catch (error: any) {
      throw new Error(`Failed to configure webhooks: ${error.message}`);
    }
  }

  async listConfigurations(userId: string) {
    try {
      const { data: configurations, error } = await this.supabase
        .from('sync_configurations')
        .select(`
          *,
          sync_statistics (
            total_records_synced,
            last_sync_at,
            sync_success_rate
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: configurations || []
      };
    } catch (error: any) {
      throw new Error(`Failed to list configurations: ${error.message}`);
    }
  }
}

// GET handler - List configurations or get specific status
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const api = new UniversalSyncAPI(supabase);
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');

    if (configId) {
      const result = await api.getSyncStatus(configId, user.id);
      return NextResponse.json(result);
    } else {
      const result = await api.listConfigurations(user.id);
      return NextResponse.json(result);
    }
  } catch (error: any) {
    console.error('Universal Sync API GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST handler - Create configuration or execute action
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const api = new UniversalSyncAPI(supabase);

    // Determine action type based on request body structure
    if (body.action) {
      // Execute sync action
      const validatedAction = syncActionSchema.parse(body);
      const result = await api.executeSyncAction(validatedAction, user.id);
      return NextResponse.json(result);
    } else if (body.systemType) {
      // Create sync configuration
      const validatedConfig = syncConfigSchema.parse(body);
      const result = await api.createSyncConfiguration(validatedConfig, user.id);
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Universal Sync API POST error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT handler - Configure webhooks or update configuration
export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const api = new UniversalSyncAPI(supabase);

    if (body.endpoints) {
      // Configure webhooks
      const validatedWebhookConfig = webhookConfigSchema.parse(body);
      const result = await api.configureWebhooks(validatedWebhookConfig, user.id);
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid request body for webhook configuration' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Universal Sync API PUT error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE handler - Delete configuration
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');

    if (!configId) {
      return NextResponse.json(
        { success: false, error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    // Stop sync first
    const api = new UniversalSyncAPI(supabase);
    await api.executeSyncAction({ action: 'stop', configId }, user.id);

    // Delete configuration
    const { error: deleteError } = await supabase
      .from('sync_configurations')
      .delete()
      .eq('id', configId)
      .eq('user_id', user.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: 'Sync configuration deleted successfully'
    });
  } catch (error: any) {
    console.error('Universal Sync API DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```