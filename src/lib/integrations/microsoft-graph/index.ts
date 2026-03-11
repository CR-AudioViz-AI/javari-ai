```typescript
import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';
import { Redis } from '@upstash/redis';

// Environment variables
const GRAPH_CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID!;
const GRAPH_TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const REDIS_URL = process.env.REDIS_URL!;

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const redis = new Redis({ url: REDIS_URL });

// Zod schemas for validation
const GraphTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  scope: z.string(),
});

const TeamsMessageSchema = z.object({
  id: z.string(),
  createdDateTime: z.string(),
  body: z.object({
    content: z.string(),
    contentType: z.enum(['text', 'html']),
  }),
  from: z.object({
    user: z.object({
      displayName: z.string(),
      id: z.string(),
    }),
  }),
});

const SharePointDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string(),
  lastModifiedDateTime: z.string(),
  size: z.number(),
  file: z.object({
    mimeType: z.string(),
  }).optional(),
});

const CalendarEventSchema = z.object({
  id: z.string(),
  subject: z.string(),
  start: z.object({
    dateTime: z.string(),
    timeZone: z.string(),
  }),
  end: z.object({
    dateTime: z.string(),
    timeZone: z.string(),
  }),
  attendees: z.array(z.object({
    emailAddress: z.object({
      address: z.string(),
      name: z.string(),
    }),
    status: z.object({
      response: z.enum(['none', 'accepted', 'declined', 'tentative']),
    }),
  })),
});

// Custom Authentication Provider
class GraphAuthProvider implements AuthenticationProvider {
  private msalInstance: PublicClientApplication;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.msalInstance = new PublicClientApplication({
      auth: {
        clientId: GRAPH_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${GRAPH_TENANT_ID}`,
        redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
    });
  }

  async getAccessToken(): Promise<string> {
    try {
      // Try to get token from cache first
      const cachedToken = await redis.get(`graph_token:${this.userId}`);
      if (cachedToken) {
        const parsed = JSON.parse(cachedToken as string);
        if (Date.now() < parsed.expiresAt) {
          return parsed.access_token;
        }
      }

      // Get token from database
      const { data: tokenData, error } = await supabase
        .from('microsoft_graph_tokens')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (error || !tokenData) {
        throw new Error('No valid token found');
      }

      const token = GraphTokenSchema.parse(tokenData);
      
      // Check if token is expired
      if (Date.now() >= tokenData.expires_at) {
        return await this.refreshToken(tokenData.refresh_token);
      }

      // Cache valid token
      await redis.set(`graph_token:${this.userId}`, JSON.stringify({
        access_token: token.access_token,
        expiresAt: tokenData.expires_at,
      }), { ex: 3600 });

      return token.access_token;
    } catch (error) {
      throw new GraphError('Failed to get access token', 'AUTH_ERROR', error);
    }
  }

  private async refreshToken(refreshToken: string): Promise<string> {
    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GRAPH_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: 'https://graph.microsoft.com/.default',
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokenData = await response.json();
      const validatedToken = GraphTokenSchema.parse(tokenData);

      // Update database
      const expiresAt = Date.now() + (validatedToken.expires_in * 1000);
      await supabase
        .from('microsoft_graph_tokens')
        .update({
          access_token: validatedToken.access_token,
          refresh_token: validatedToken.refresh_token || refreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', this.userId);

      // Cache new token
      await redis.set(`graph_token:${this.userId}`, JSON.stringify({
        access_token: validatedToken.access_token,
        expiresAt,
      }), { ex: 3600 });

      return validatedToken.access_token;
    } catch (error) {
      throw new GraphError('Failed to refresh token', 'TOKEN_REFRESH_ERROR', error);
    }
  }
}

// Custom Error Class
class GraphError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

// Graph Error Handler
export class GraphErrorHandler {
  static handle(error: unknown, context: string): never {
    console.error(`Graph API Error in ${context}:`, error);

    if (error instanceof GraphError) {
      throw error;
    }

    if (error && typeof error === 'object' && 'code' in error) {
      const graphError = error as { code: string; message: string };
      throw new GraphError(
        graphError.message || 'Graph API error',
        graphError.code,
        error
      );
    }

    throw new GraphError(`Unknown error in ${context}`, 'UNKNOWN_ERROR', error);
  }
}

// Graph Permissions Validator
export class GraphPermissionsValidator {
  private static requiredScopes = {
    teams: ['Team.ReadBasic.All', 'ChannelMessage.Read.All'],
    sharepoint: ['Sites.Read.All', 'Files.Read.All'],
    calendar: ['Calendars.Read', 'Calendars.ReadWrite'],
  };

  static async validatePermissions(client: Client, service: keyof typeof this.requiredScopes): Promise<boolean> {
    try {
      const me = await client.api('/me').get();
      // In a real implementation, you'd check the actual granted permissions
      return !!me;
    } catch (error) {
      GraphErrorHandler.handle(error, 'permission-validation');
    }
  }
}

// Graph Cache Manager
export class GraphCacheManager {
  private static readonly TTL = {
    short: 300, // 5 minutes
    medium: 1800, // 30 minutes
    long: 3600, // 1 hour
  };

  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached as string) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  static async set(key: string, value: unknown, ttl: keyof typeof this.TTL = 'medium'): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), { ex: this.TTL[ttl] });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  static async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }
}

// Teams Automation Service
export class TeamsAutomationService {
  private client: Client;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    const authProvider = new GraphAuthProvider(userId);
    this.client = Client.initWithMiddleware({ authProvider });
  }

  async getTeams() {
    try {
      const cacheKey = `teams:${this.userId}`;
      const cached = await GraphCacheManager.get(cacheKey);
      if (cached) return cached;

      await GraphPermissionsValidator.validatePermissions(this.client, 'teams');

      const response = await this.client.api('/me/joinedTeams').get();
      await GraphCacheManager.set(cacheKey, response.value);
      
      return response.value;
    } catch (error) {
      GraphErrorHandler.handle(error, 'get-teams');
    }
  }

  async getChannelMessages(teamId: string, channelId: string, limit = 50) {
    try {
      const cacheKey = `messages:${teamId}:${channelId}:${limit}`;
      const cached = await GraphCacheManager.get(cacheKey);
      if (cached) return cached;

      const response = await this.client
        .api(`/teams/${teamId}/channels/${channelId}/messages`)
        .top(limit)
        .get();

      const validatedMessages = response.value.map((msg: unknown) => 
        TeamsMessageSchema.parse(msg)
      );

      await GraphCacheManager.set(cacheKey, validatedMessages, 'short');
      return validatedMessages;
    } catch (error) {
      GraphErrorHandler.handle(error, 'get-channel-messages');
    }
  }

  async sendChannelMessage(teamId: string, channelId: string, content: string) {
    try {
      const message = {
        body: {
          contentType: 'text',
          content,
        },
      };

      const response = await this.client
        .api(`/teams/${teamId}/channels/${channelId}/messages`)
        .post(message);

      // Invalidate messages cache
      await GraphCacheManager.invalidate(`messages:${teamId}:${channelId}:*`);
      
      return TeamsMessageSchema.parse(response);
    } catch (error) {
      GraphErrorHandler.handle(error, 'send-channel-message');
    }
  }

  async createTeamMeeting(teamId: string, subject: string, startTime: string, endTime: string) {
    try {
      const meeting = {
        subject,
        start: {
          dateTime: startTime,
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime,
          timeZone: 'UTC',
        },
        isOnlineMeeting: true,
      };

      const response = await this.client
        .api(`/teams/${teamId}/schedule/schedulingGroups`)
        .post(meeting);

      return response;
    } catch (error) {
      GraphErrorHandler.handle(error, 'create-team-meeting');
    }
  }
}

// SharePoint Document Service
export class SharePointDocumentService {
  private client: Client;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    const authProvider = new GraphAuthProvider(userId);
    this.client = Client.initWithMiddleware({ authProvider });
  }

  async getSites() {
    try {
      const cacheKey = `sites:${this.userId}`;
      const cached = await GraphCacheManager.get(cacheKey);
      if (cached) return cached;

      await GraphPermissionsValidator.validatePermissions(this.client, 'sharepoint');

      const response = await this.client.api('/sites').get();
      await GraphCacheManager.set(cacheKey, response.value);
      
      return response.value;
    } catch (error) {
      GraphErrorHandler.handle(error, 'get-sites');
    }
  }

  async getDocuments(siteId: string, driveId?: string) {
    try {
      const cacheKey = `documents:${siteId}:${driveId || 'default'}`;
      const cached = await GraphCacheManager.get(cacheKey);
      if (cached) return cached;

      const endpoint = driveId 
        ? `/sites/${siteId}/drives/${driveId}/root/children`
        : `/sites/${siteId}/drive/root/children`;

      const response = await this.client.api(endpoint).get();
      
      const validatedDocuments = response.value.map((doc: unknown) => 
        SharePointDocumentSchema.parse(doc)
      );

      await GraphCacheManager.set(cacheKey, validatedDocuments);
      return validatedDocuments;
    } catch (error) {
      GraphErrorHandler.handle(error, 'get-documents');
    }
  }

  async uploadDocument(siteId: string, fileName: string, content: Buffer) {
    try {
      const response = await this.client
        .api(`/sites/${siteId}/drive/root:/${fileName}:/content`)
        .put(content);

      // Invalidate documents cache
      await GraphCacheManager.invalidate(`documents:${siteId}:*`);
      
      return SharePointDocumentSchema.parse(response);
    } catch (error) {
      GraphErrorHandler.handle(error, 'upload-document');
    }
  }

  async getDocumentContent(siteId: string, itemId: string) {
    try {
      const cacheKey = `document-content:${siteId}:${itemId}`;
      const cached = await GraphCacheManager.get(cacheKey);
      if (cached) return cached;

      const response = await this.client
        .api(`/sites/${siteId}/drive/items/${itemId}/content`)
        .get();

      await GraphCacheManager.set(cacheKey, response, 'long');
      return response;
    } catch (error) {
      GraphErrorHandler.handle(error, 'get-document-content');
    }
  }
}

// Outlook Calendar Service
export class OutlookCalendarService {
  private client: Client;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    const authProvider = new GraphAuthProvider(userId);
    this.client = Client.initWithMiddleware({ authProvider });
  }

  async getCalendars() {
    try {
      const cacheKey = `calendars:${this.userId}`;
      const cached = await GraphCacheManager.get(cacheKey);
      if (cached) return cached;

      await GraphPermissionsValidator.validatePermissions(this.client, 'calendar');

      const response = await this.client.api('/me/calendars').get();
      await GraphCacheManager.set(cacheKey, response.value);
      
      return response.value;
    } catch (error) {
      GraphErrorHandler.handle(error, 'get-calendars');
    }
  }

  async getEvents(calendarId?: string, startTime?: string, endTime?: string) {
    try {
      const cacheKey = `events:${this.userId}:${calendarId || 'default'}:${startTime}:${endTime}`;
      const cached = await GraphCacheManager.get(cacheKey);
      if (cached) return cached;

      let endpoint = calendarId ? `/me/calendars/${calendarId}/events` : '/me/events';
      let query = this.client.api(endpoint);

      if (startTime && endTime) {
        query = query.filter(`start/dateTime ge '${startTime}' and end/dateTime le '${endTime}'`);
      }

      const response = await query.get();
      
      const validatedEvents = response.value.map((event: unknown) => 
        CalendarEventSchema.parse(event)
      );

      await GraphCacheManager.set(cacheKey, validatedEvents, 'short');
      return validatedEvents;
    } catch (error) {
      GraphErrorHandler.handle(error, 'get-events');
    }
  }

  async createEvent(event: z.infer<typeof CalendarEventSchema>) {
    try {
      const response = await this.client.api('/me/events').post(event);
      
      // Invalidate events cache
      await GraphCacheManager.invalidate(`events:${this.userId}:*`);
      
      return CalendarEventSchema.parse(response);
    } catch (error) {
      GraphErrorHandler.handle(error, 'create-event');
    }
  }

  async updateEvent(eventId: string, updates: Partial<z.infer<typeof CalendarEventSchema>>) {
    try {
      const response = await this.client.api(`/me/events/${eventId}`).patch(updates);
      
      // Invalidate events cache
      await GraphCacheManager.invalidate(`events:${this.userId}:*`);
      
      return CalendarEventSchema.parse(response);
    } catch (error) {
      GraphErrorHandler.handle(error, 'update-event');
    }
  }

  async findMeetingTimes(attendees: string[], duration: number, maxCandidates = 20) {
    try {
      const request = {
        attendees: attendees.map(email => ({ emailAddress: { address: email } })),
        timeConstraint: {
          timeslots: [{
            start: {
              dateTime: new Date().toISOString(),
              timeZone: 'UTC',
            },
            end: {
              dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              timeZone: 'UTC',
            },
          }],
        },
        meetingDuration: `PT${duration}M`,
        maxCandidates,
      };

      const response = await this.client.api('/me/calendar/getSchedule').post(request);
      return response;
    } catch (error) {
      GraphErrorHandler.handle(error, 'find-meeting-times');
    }
  }
}

// Graph AI Insights Engine
export class GraphAIInsightsEngine {
  private openai: OpenAI;

  constructor() {
    this.openai = openai;
  }

  async analyzeTeamsConversation(messages: z.infer<typeof TeamsMessageSchema>[]) {
    try {
      const conversation = messages
        .map(msg => `${msg.from.user.displayName}: ${msg.body.content}`)
        .join('\n');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Analyze this Teams conversation and provide key insights, action items, and sentiment analysis.',
          },
          {
            role: 'user',
            content: conversation,
          },
        ],
        temperature: 0.3,
      });

      return {
        insights: completion.choices[0]?.message.content || '',
        messageCount: messages.length,
        participants: [...new Set(messages.map(m => m.from.user.displayName))],
        timeSpan: {
          start: messages[messages.length - 1]?.createdDateTime,
          end: messages[0]?.createdDateTime,
        },
      };
    } catch (error) {
      GraphErrorHandler.handle(error, 'analyze-teams-conversation');
    }
  }

  async summarizeDocument(content: string, fileName: string) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Summarize this document content and extract key points, topics, and actionable items.',
          },
          {
            role: 'user',
            content: `Document: ${fileName}\n\nContent: ${content.substring(0, 4000)}`,
          },
        ],
        temperature: 0.3,
      });

      return {
        summary: completion.choices[0]?.message.content || '',
        fileName,
        contentLength: content.length,
        analyzedAt: new Date().toISOString(),
      };
    } catch (error) {
      GraphErrorHandler.handle(error, 'summarize-document');
    }
  }

  async optimizeCalendarSchedule(events: z.infer<typeof CalendarEventSchema>[]) {
    try {
      const schedule = events
        .map(event => `${event.subject}: ${event.start.dateTime} - ${event.end.dateTime}`)
        .join('\n');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Analyze this calendar schedule and suggest optimizations for better time management and productivity.',
          },
          {
            role: 'user',
            content: schedule,
          },
        ],
        temperature: 0.3,
      });

      return {
        recommendations: completion.choices[0]?.message.content || '',
        eventCount: events.length,
        totalDuration: this.calculateTotalDuration(events),
        busyPeriods: this.identifyBusyPeriods(events),
      };
    } catch (error) {
      GraphErrorHandler.handle(error, 'optimize-calendar-schedule');
    }
  }

  private calculateTotalDuration(events: z.infer<typeof CalendarEventSchema>[]): number {
    return events.reduce((total, event) => {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      return total + (end.getTime() - start.getTime());
    }, 0);
  }

  private identifyBusyPeriods(events: z