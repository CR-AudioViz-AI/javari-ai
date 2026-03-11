```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { PublicClientApplication, AuthenticationResult } from '@azure/msal-node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimit } from '@/lib/utils/rate-limit';

// Environment validation
const envSchema = z.object({
  MICROSOFT_CLIENT_ID: z.string(),
  MICROSOFT_CLIENT_SECRET: z.string(),
  MICROSOFT_TENANT_ID: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
});

const env = envSchema.parse(process.env);

// Request/Response schemas
const graphRequestSchema = z.object({
  action: z.enum(['auth', 'teams', 'sharepoint', 'office', 'webhook', 'permissions']),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
  endpoint: z.string().optional(),
  data: z.any().optional(),
  userId: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

// Initialize Supabase client
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}`,
  },
};

class GraphClient {
  private static instance: GraphClient;
  private msalInstance: PublicClientApplication;
  private tokenCache = new Map<string, { token: string; expires: number }>();

  private constructor() {
    this.msalInstance = new PublicClientApplication(msalConfig);
  }

  public static getInstance(): GraphClient {
    if (!GraphClient.instance) {
      GraphClient.instance = new GraphClient();
    }
    return GraphClient.instance;
  }

  async getAccessToken(userId: string, scopes: string[]): Promise<string> {
    const cacheKey = `${userId}-${scopes.join(',')}`;
    const cached = this.tokenCache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.token;
    }

    try {
      // Get user session from Supabase
      const { data: session } = await supabase
        .from('microsoft_sessions')
        .select('refresh_token')
        .eq('user_id', userId)
        .single();

      if (!session?.refresh_token) {
        throw new Error('No refresh token found');
      }

      const tokenRequest = {
        refreshToken: session.refresh_token,
        scopes,
      };

      const response = await this.msalInstance.acquireTokenSilent(tokenRequest);
      
      // Cache token
      this.tokenCache.set(cacheKey, {
        token: response.accessToken,
        expires: response.expiresOn?.getTime() || Date.now() + 3600000,
      });

      return response.accessToken;
    } catch (error) {
      throw new Error(`Token acquisition failed: ${error}`);
    }
  }

  async createGraphClient(userId: string, scopes: string[]) {
    const accessToken = await this.getAccessToken(userId, scopes);
    
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
      defaultVersion: 'v1.0',
    });
  }

  async retryRequest<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        if (attempt === maxRetries) throw error;
        
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }
}

class TeamsService {
  constructor(private graphClient: Client) {}

  async getTeams() {
    return this.graphClient.api('/me/joinedTeams').get();
  }

  async getChannels(teamId: string) {
    return this.graphClient.api(`/teams/${teamId}/channels`).get();
  }

  async sendMessage(teamId: string, channelId: string, message: any) {
    return this.graphClient
      .api(`/teams/${teamId}/channels/${channelId}/messages`)
      .post(message);
  }

  async createMeeting(meeting: any) {
    return this.graphClient.api('/me/onlineMeetings').post(meeting);
  }
}

class SharePointService {
  constructor(private graphClient: Client) {}

  async getSites() {
    return this.graphClient.api('/sites?search=*').get();
  }

  async getDocuments(siteId: string) {
    return this.graphClient.api(`/sites/${siteId}/drive/root/children`).get();
  }

  async uploadDocument(siteId: string, fileName: string, content: Buffer) {
    return this.graphClient
      .api(`/sites/${siteId}/drive/root:/${fileName}:/content`)
      .put(content);
  }
}

class OfficeService {
  constructor(private graphClient: Client) {}

  async getDocument(driveItemId: string) {
    return this.graphClient.api(`/me/drive/items/${driveItemId}`).get();
  }

  async updateDocument(driveItemId: string, content: any) {
    return this.graphClient
      .api(`/me/drive/items/${driveItemId}/workbook/worksheets`)
      .patch(content);
  }

  async createDocument(document: any) {
    return this.graphClient.api('/me/drive/root/children').post(document);
  }
}

class PermissionManager {
  private readonly requiredScopes = {
    teams: ['Team.ReadBasic.All', 'Channel.ReadBasic.All'],
    sharepoint: ['Sites.Read.All', 'Files.ReadWrite.All'],
    office: ['Files.ReadWrite.All', 'User.Read'],
  };

  validateScopes(action: string, userScopes: string[]): boolean {
    const required = this.requiredScopes[action as keyof typeof this.requiredScopes] || [];
    return required.every(scope => userScopes.includes(scope));
  }

  async checkPermissions(userId: string, action: string) {
    const { data: permissions } = await supabase
      .from('microsoft_permissions')
      .select('scopes')
      .eq('user_id', userId)
      .single();

    if (!permissions) {
      throw new Error('No permissions found');
    }

    const userScopes = JSON.parse(permissions.scopes);
    if (!this.validateScopes(action, userScopes)) {
      throw new Error(`Insufficient permissions for ${action}`);
    }

    return true;
  }
}

class WebhookHandler {
  async createSubscription(graphClient: Client, resource: string, notificationUrl: string) {
    const subscription = {
      changeType: 'created,updated,deleted',
      notificationUrl,
      resource,
      expirationDateTime: new Date(Date.now() + 3600000).toISOString(),
    };

    return graphClient.api('/subscriptions').post(subscription);
  }

  async processNotification(notification: any) {
    // Store webhook events in Supabase
    await supabase.from('microsoft_webhooks').insert({
      resource: notification.resource,
      change_type: notification.changeType,
      client_state: notification.clientState,
      subscription_id: notification.subscriptionId,
      created_at: new Date().toISOString(),
    });

    return { processed: true };
  }
}

// Rate limiting
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function GET(request: NextRequest) {
  try {
    await limiter.check(request, 10, 'GRAPH_API');

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const userId = url.searchParams.get('userId');

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const graphClientInstance = GraphClient.getInstance();
    const permissionManager = new PermissionManager();

    // Check permissions
    await permissionManager.checkPermissions(userId, action);

    const scopes = ['https://graph.microsoft.com/.default'];
    const client = await graphClientInstance.createGraphClient(userId, scopes);

    let result;
    switch (action) {
      case 'teams':
        const teamsService = new TeamsService(client);
        result = await teamsService.getTeams();
        break;
      case 'sharepoint':
        const sharepointService = new SharePointService(client);
        result = await sharepointService.getSites();
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Graph API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await limiter.check(request, 5, 'GRAPH_API');

    const body = await request.json();
    const validatedData = graphRequestSchema.parse(body);

    const graphClientInstance = GraphClient.getInstance();
    const permissionManager = new PermissionManager();
    const webhookHandler = new WebhookHandler();

    if (validatedData.action === 'webhook' && validatedData.data) {
      // Handle webhook notifications
      const result = await webhookHandler.processNotification(validatedData.data);
      return NextResponse.json({ success: true, data: result });
    }

    if (!validatedData.userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Check permissions
    await permissionManager.checkPermissions(validatedData.userId, validatedData.action);

    const scopes = validatedData.scopes || ['https://graph.microsoft.com/.default'];
    const client = await graphClientInstance.createGraphClient(validatedData.userId, scopes);

    let result;
    switch (validatedData.action) {
      case 'teams':
        const teamsService = new TeamsService(client);
        if (validatedData.endpoint?.includes('messages')) {
          const [teamId, channelId] = validatedData.endpoint.split('/');
          result = await teamsService.sendMessage(teamId, channelId, validatedData.data);
        }
        break;
      case 'sharepoint':
        const sharepointService = new SharePointService(client);
        if (validatedData.endpoint && validatedData.data) {
          result = await sharepointService.uploadDocument(
            validatedData.endpoint,
            validatedData.data.fileName,
            Buffer.from(validatedData.data.content, 'base64')
          );
        }
        break;
      case 'office':
        const officeService = new OfficeService(client);
        if (validatedData.method === 'POST') {
          result = await officeService.createDocument(validatedData.data);
        }
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Graph API POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await limiter.check(request, 3, 'GRAPH_API');

    const body = await request.json();
    const validatedData = graphRequestSchema.parse(body);

    if (!validatedData.userId || !validatedData.endpoint) {
      return NextResponse.json(
        { error: 'User ID and endpoint required' },
        { status: 400 }
      );
    }

    const graphClientInstance = GraphClient.getInstance();
    const permissionManager = new PermissionManager();

    await permissionManager.checkPermissions(validatedData.userId, validatedData.action);

    const scopes = ['https://graph.microsoft.com/.default'];
    const client = await graphClientInstance.createGraphClient(validatedData.userId, scopes);

    const result = await graphClientInstance.retryRequest(() =>
      client.api(validatedData.endpoint!).patch(validatedData.data)
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Graph API PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await limiter.check(request, 2, 'GRAPH_API');

    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');
    const userId = url.searchParams.get('userId');

    if (!endpoint || !userId) {
      return NextResponse.json(
        { error: 'Endpoint and User ID required' },
        { status: 400 }
      );
    }

    const graphClientInstance = GraphClient.getInstance();
    const permissionManager = new PermissionManager();

    await permissionManager.checkPermissions(userId, 'office');

    const scopes = ['https://graph.microsoft.com/.default'];
    const client = await graphClientInstance.createGraphClient(userId, scopes);

    const result = await graphClientInstance.retryRequest(() =>
      client.api(endpoint).delete()
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Graph API DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
```