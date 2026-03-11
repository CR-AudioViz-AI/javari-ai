```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { ServiceBusClient } from '@azure/service-bus';
import { createHash, createHmac } from 'crypto';
import { z } from 'zod';

// Environment validation
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_TENANT_ID: z.string().min(1),
  AZURE_SERVICE_BUS_CONNECTION: z.string().min(1),
  MICROSOFT_WEBHOOK_SECRET: z.string().min(1),
  REDIS_URL: z.string().url(),
});

const env = envSchema.parse({
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID!,
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET!,
  MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID!,
  AZURE_SERVICE_BUS_CONNECTION: process.env.AZURE_SERVICE_BUS_CONNECTION!,
  MICROSOFT_WEBHOOK_SECRET: process.env.MICROSOFT_WEBHOOK_SECRET!,
  REDIS_URL: process.env.REDIS_URL!,
});

// Initialize Supabase client
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Request schemas
const authCodeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  tenant_id: z.string().uuid(),
});

const webhookSchema = z.object({
  value: z.array(z.object({
    subscriptionId: z.string(),
    resource: z.string(),
    resourceData: z.record(z.unknown()),
    changeType: z.enum(['created', 'updated', 'deleted']),
  })),
});

const teamsIntegrationSchema = z.object({
  tenant_id: z.string().uuid(),
  team_id: z.string().min(1),
  channel_id: z.string().min(1),
  webhook_url: z.string().url(),
});

const sharepointSyncSchema = z.object({
  tenant_id: z.string().uuid(),
  site_id: z.string().min(1),
  library_id: z.string().min(1),
  sync_frequency: z.enum(['realtime', 'hourly', 'daily']),
});

const powerPlatformSchema = z.object({
  tenant_id: z.string().uuid(),
  environment_id: z.string().min(1),
  flow_id: z.string().min(1),
  trigger_events: z.array(z.string()),
});

// Custom Microsoft Graph Authentication Provider
class CustomAuthProvider implements AuthenticationProvider {
  private credential: ClientSecretCredential;

  constructor() {
    this.credential = new ClientSecretCredential(
      env.MICROSOFT_TENANT_ID,
      env.MICROSOFT_CLIENT_ID,
      env.MICROSOFT_CLIENT_SECRET
    );
  }

  async getAccessToken(): Promise<string> {
    try {
      const tokenResponse = await this.credential.getToken(['https://graph.microsoft.com/.default']);
      if (!tokenResponse) {
        throw new Error('Failed to acquire access token');
      }
      return tokenResponse.token;
    } catch (error) {
      console.error('Authentication error:', error);
      throw new Error('Failed to authenticate with Microsoft Graph');
    }
  }
}

// Microsoft Graph client
const authProvider = new CustomAuthProvider();
const graphClient = Client.initWithMiddleware({ authProvider });

// Azure Service Bus client
const serviceBusClient = new ServiceBusClient(env.AZURE_SERVICE_BUS_CONNECTION);

// Redis client simulation (replace with actual Redis client)
class RedisCache {
  private static cache = new Map<string, { value: string; expiry: number }>();

  static async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  static async set(key: string, value: string, ttl: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl * 1000,
    });
  }

  static async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

// Utility functions
function validateWebhookSignature(payload: string, signature: string): boolean {
  const expectedSignature = createHmac('sha256', env.MICROSOFT_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return signature === expectedSignature;
}

async function getTenantFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const cacheKey = `tenant:${createHash('sha256').update(token).digest('hex')}`;
  
  return await RedisCache.get(cacheKey);
}

async function createGraphSubscription(resource: string, tenantId: string): Promise<string> {
  const subscription = {
    changeType: 'created,updated,deleted',
    notificationUrl: `${process.env.NEXTAUTH_URL}/api/integrations/microsoft365/webhooks`,
    resource,
    expirationDateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    clientState: tenantId,
  };

  const response = await graphClient.api('/subscriptions').post(subscription);
  return response.id;
}

async function syncSharePointDocument(siteId: string, driveId: string, itemId: string, tenantId: string): Promise<void> {
  try {
    const item = await graphClient
      .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}`)
      .get();

    const { data: existingDoc, error } = await supabase
      .from('sharepoint_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('item_id', itemId)
      .single();

    const documentData = {
      tenant_id: tenantId,
      site_id: siteId,
      drive_id: driveId,
      item_id: itemId,
      name: item.name,
      size: item.size,
      created_datetime: item.createdDateTime,
      modified_datetime: item.lastModifiedDateTime,
      content_type: item.file?.mimeType || 'application/octet-stream',
      version: item.cTag,
      web_url: item.webUrl,
      download_url: item['@microsoft.graph.downloadUrl'],
    };

    if (existingDoc) {
      await supabase
        .from('sharepoint_documents')
        .update(documentData)
        .eq('id', existingDoc.id);
    } else {
      await supabase
        .from('sharepoint_documents')
        .insert([documentData]);
    }
  } catch (error) {
    console.error('SharePoint sync error:', error);
    throw error;
  }
}

async function triggerPowerPlatformFlow(flowId: string, environmentId: string, data: any): Promise<void> {
  const sender = serviceBusClient.createSender('power-platform-triggers');
  
  const message = {
    body: {
      flowId,
      environmentId,
      triggerData: data,
      timestamp: new Date().toISOString(),
    },
  };

  await sender.sendMessages(message);
  await sender.close();
}

// Main API handlers
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tenantId = await getTenantFromRequest(request);

    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    switch (action) {
      case 'auth-url': {
        const scopes = [
          'https://graph.microsoft.com/User.Read',
          'https://graph.microsoft.com/Files.ReadWrite.All',
          'https://graph.microsoft.com/Sites.ReadWrite.All',
          'https://graph.microsoft.com/Mail.ReadWrite',
          'https://graph.microsoft.com/Calendars.ReadWrite',
          'https://graph.microsoft.com/Team.ReadBasic.All',
        ];

        const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
        authUrl.searchParams.set('client_id', env.MICROSOFT_CLIENT_ID);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', `${process.env.NEXTAUTH_URL}/api/integrations/microsoft365/callback`);
        authUrl.searchParams.set('scope', scopes.join(' '));
        authUrl.searchParams.set('state', tenantId);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        return NextResponse.json({ authUrl: authUrl.toString() });
      }

      case 'status': {
        const { data: integration } = await supabase
          .from('microsoft365_integrations')
          .select('*')
          .eq('tenant_id', tenantId)
          .single();

        return NextResponse.json({ 
          connected: !!integration,
          lastSync: integration?.last_sync_at,
          features: {
            teams: integration?.teams_enabled || false,
            sharepoint: integration?.sharepoint_enabled || false,
            powerPlatform: integration?.power_platform_enabled || false,
            office: integration?.office_enabled || false,
          }
        });
      }

      case 'teams-channels': {
        const teams = await graphClient.api('/me/joinedTeams').get();
        const channels = [];

        for (const team of teams.value) {
          const teamChannels = await graphClient
            .api(`/teams/${team.id}/channels`)
            .get();
          
          channels.push({
            teamId: team.id,
            teamName: team.displayName,
            channels: teamChannels.value,
          });
        }

        return NextResponse.json({ teams: channels });
      }

      case 'sharepoint-sites': {
        const sites = await graphClient
          .api('/sites?search=*')
          .top(50)
          .get();

        const sitesWithLibraries = await Promise.all(
          sites.value.map(async (site: any) => {
            try {
              const drives = await graphClient
                .api(`/sites/${site.id}/drives`)
                .get();
              
              return {
                siteId: site.id,
                siteName: site.displayName,
                webUrl: site.webUrl,
                libraries: drives.value,
              };
            } catch {
              return {
                siteId: site.id,
                siteName: site.displayName,
                webUrl: site.webUrl,
                libraries: [],
              };
            }
          })
        );

        return NextResponse.json({ sites: sitesWithLibraries });
      }

      case 'power-platform-environments': {
        // This would require Power Platform Admin API access
        const environments = [
          {
            id: 'default',
            displayName: 'Default Environment',
            region: 'unitedstates',
          }
        ];

        return NextResponse.json({ environments });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const body = await request.json();
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');
      const tenantId = await getTenantFromRequest(request);

      if (!tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      switch (action) {
        case 'setup-teams': {
          const data = teamsIntegrationSchema.parse(body);
          
          // Create webhook subscription for Teams events
          const subscriptionId = await createGraphSubscription(
            '/teams/getAllMessages',
            data.tenant_id
          );

          const { error } = await supabase
            .from('teams_integrations')
            .upsert([{
              tenant_id: data.tenant_id,
              team_id: data.team_id,
              channel_id: data.channel_id,
              webhook_url: data.webhook_url,
              subscription_id: subscriptionId,
              created_at: new Date().toISOString(),
            }]);

          if (error) throw error;

          return NextResponse.json({ 
            success: true,
            subscriptionId,
          });
        }

        case 'setup-sharepoint': {
          const data = sharepointSyncSchema.parse(body);
          
          // Create subscription for SharePoint document changes
          const subscriptionId = await createGraphSubscription(
            `/sites/${data.site_id}/drives/${data.library_id}/root`,
            data.tenant_id
          );

          const { error } = await supabase
            .from('sharepoint_integrations')
            .upsert([{
              tenant_id: data.tenant_id,
              site_id: data.site_id,
              library_id: data.library_id,
              sync_frequency: data.sync_frequency,
              subscription_id: subscriptionId,
              created_at: new Date().toISOString(),
            }]);

          if (error) throw error;

          // Initial sync
          if (data.sync_frequency === 'realtime') {
            const items = await graphClient
              .api(`/sites/${data.site_id}/drives/${data.library_id}/root/children`)
              .get();

            for (const item of items.value) {
              await syncSharePointDocument(
                data.site_id,
                data.library_id,
                item.id,
                data.tenant_id
              );
            }
          }

          return NextResponse.json({ 
            success: true,
            subscriptionId,
            itemsCount: data.sync_frequency === 'realtime' ? 'synced' : 'scheduled',
          });
        }

        case 'setup-power-platform': {
          const data = powerPlatformSchema.parse(body);
          
          const { error } = await supabase
            .from('power_platform_integrations')
            .upsert([{
              tenant_id: data.tenant_id,
              environment_id: data.environment_id,
              flow_id: data.flow_id,
              trigger_events: data.trigger_events,
              created_at: new Date().toISOString(),
            }]);

          if (error) throw error;

          return NextResponse.json({ success: true });
        }

        case 'generate-office-manifest': {
          const manifest = {
            "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.14/MicrosoftTeams.schema.json",
            "manifestVersion": "1.14",
            "version": "1.0.0",
            "id": `cr-audioviz-${tenantId}`,
            "packageName": "com.craudioviz.office",
            "developer": {
              "name": "CR AudioViz AI",
              "websiteUrl": process.env.NEXTAUTH_URL,
              "privacyUrl": `${process.env.NEXTAUTH_URL}/privacy`,
              "termsOfUseUrl": `${process.env.NEXTAUTH_URL}/terms`
            },
            "icons": {
              "color": "icon-color.png",
              "outline": "icon-outline.png"
            },
            "name": {
              "short": "CR AudioViz AI",
              "full": "CR AudioViz AI - Microsoft 365 Integration"
            },
            "description": {
              "short": "AI-powered audio visualization for Microsoft 365",
              "full": "Advanced audio visualization and analytics integrated with your Microsoft 365 workflow"
            },
            "accentColor": "#FFFFFF",
            "staticTabs": [
              {
                "entityId": "audioviz-tab",
                "name": "AudioViz",
                "contentUrl": `${process.env.NEXTAUTH_URL}/integrations/microsoft365/tab`,
                "scopes": ["personal", "team"]
              }
            ],
            "permissions": ["identity", "messageTeamMembers"],
            "validDomains": [new URL(process.env.NEXTAUTH_URL!).hostname]
          };

          return NextResponse.json({ manifest });
        }

        case 'oauth-callback': {
          const data = authCodeSchema.parse(body);
          
          // Exchange code for tokens
          const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: env.MICROSOFT_CLIENT_ID,
              client_secret: env.MICROSOFT_CLIENT_SECRET,
              code: data.code,
              grant_type: 'authorization_code',
              redirect_uri: `${process.env.NEXTAUTH_URL}/api/integrations/microsoft365/callback`,
            }),
          });

          if (!tokenResponse.ok) {
            throw new Error('Token exchange failed');
          }

          const tokens = await tokenResponse.json();

          // Store tokens securely
          const { error } = await supabase
            .from('microsoft365_integrations')
            .upsert([{
              tenant_id: data.tenant_id,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
              scope: tokens.scope,
              connected_at: new Date().toISOString(),
            }]);

          if (error) throw error;

          return NextResponse.json({ success: true });
        }

        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
    } 
    
    // Handle webhook notifications
    else if (request.headers.get('x-ms-webhook-signature')) {
      const payload = await request.text();
      const signature = request.headers.get('x-ms-webhook-signature')!;
      
      if (!validateWebhookSignature(payload, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      const data = webhookSchema.parse(JSON.parse(payload));
      
      for (const notification of data.value) {
        const tenantId = notification.subscriptionId;
        
        // Process different types of notifications
        if (notification.resource.includes('/sites/')) {
          // SharePoint document change
          const parts = notification.resource.split('/');
          const siteId = parts[2];
          const driveId = parts[4];
          const itemId = parts[6];
          
          await syncSharePointDocument(siteId, driveId, itemId, tenantId);
        } 
        else if (notification.resource.includes('/teams/')) {
          // Teams message
          await triggerPowerPlatformFlow(
            'teams-message-flow',
            'default',
            {
              changeType: notification.changeType,
              resource: notification.resource,
              data: notification.resourceData,
            }
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tenantId = await getTenantFromRequest(request);

    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    switch (action) {
      case 'sync-now': {
        const { data: integrations } = await supabase
          .from('sharepoint_integrations')
          .select('*')
          .eq('tenant_id', tenantId);

        let syncCount = 0;
        for (const integration of integrations || []) {
          const items = await graphClient
            .api(`/sites/${integration.site_id}/drives/${integration.library_id}/root/children`)
            .get();

          for (const item of items.value) {
            await syncSharePointDocument(
              integration.site_id,
              integration.library_id,
              item.id,
              tenantId
            );
            syncCount++;
          }
        }

        return NextResponse.json({ 
          success: true,
          syncedItems: syncCount,
        });
      }

      case 'refresh-tokens': {
        const { data: integration } = await supabase
          .from('microsoft365_integrations')
          .select('refresh_token')
          .eq('tenant_id', tenantId)
          .single();

        if (!integration?.refresh_token) {
          return NextResponse.json({ error: 'No refresh token found' }, { status: 400 });
        }

        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: env.MICROSOFT_CLIENT_ID,
            client_secret: env.MICROSOFT_CLIENT_SECRET,
            refresh_token: integration.refresh_token,
            grant_type: 'refresh