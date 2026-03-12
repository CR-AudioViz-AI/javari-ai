```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/security/rate-limit';
import { validateApiKey, requirePermissions } from '@/lib/security/auth';
import { ThreatDetector } from '@/lib/security/threat-detector';
import { SIEMConnector } from '@/lib/security/siem-connector';
import { EventAggregator } from '@/lib/security/event-aggregator';
import { ResponseEngine } from '@/lib/security/response-engine';
import { IntelligenceFeeds } from '@/lib/security/intelligence-feeds';
import { SecurityEventProcessor } from '@/lib/db/security-events';
import { SecurityAlert, SecurityEvent, ThreatIntelligence, SecurityMetrics } from '@/types/security';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const threatDetector = new ThreatDetector();
const siemConnector = new SIEMConnector();
const eventAggregator = new EventAggregator();
const responseEngine = new ResponseEngine();
const intelligenceFeeds = new IntelligenceFeeds();
const eventProcessor = new SecurityEventProcessor(supabase);

interface SecurityMonitorRequest {
  action: 'stream' | 'events' | 'threats' | 'metrics' | 'alerts' | 'respond';
  filters?: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    category?: string[];
    timeRange?: string;
    source?: string[];
  };
  eventData?: Partial<SecurityEvent>;
  alertId?: string;
  responseAction?: {
    type: 'block' | 'quarantine' | 'investigate' | 'notify';
    target: string;
    reason: string;
  };
}

export async function GET(request: NextRequest) {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(ip, 'security-monitor', 100, 300); // 100 requests per 5 minutes
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
    }

    // Authentication and authorization
    const apiKey = headersList.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const authResult = await validateApiKey(apiKey);
    if (!authResult.valid) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const hasPermission = await requirePermissions(authResult.userId, ['security:monitor:read']);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'events';

    switch (action) {
      case 'events':
        return await handleGetEvents(searchParams, authResult.userId);
      case 'threats':
        return await handleGetThreats(searchParams, authResult.userId);
      case 'metrics':
        return await handleGetMetrics(searchParams, authResult.userId);
      case 'alerts':
        return await handleGetAlerts(searchParams, authResult.userId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Security monitor GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(ip, 'security-monitor-post', 50, 300);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const apiKey = headersList.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const authResult = await validateApiKey(apiKey);
    if (!authResult.valid) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    let body: SecurityMonitorRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Input validation
    if (!body.action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    switch (body.action) {
      case 'stream':
        return await handleStartStream(body, authResult.userId);
      case 'respond':
        return await handleSecurityResponse(body, authResult.userId);
      default:
        return NextResponse.json(
          { error: 'Invalid action for POST' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Security monitor POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(ip, 'security-monitor-put', 30, 300);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const apiKey = headersList.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const authResult = await validateApiKey(apiKey);
    if (!authResult.valid) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const hasPermission = await requirePermissions(authResult.userId, ['security:monitor:write']);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    let body: SecurityMonitorRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!body.eventData) {
      return NextResponse.json(
        { error: 'Event data is required' },
        { status: 400 }
      );
    }

    return await handleUpdateEvent(body, authResult.userId);
  } catch (error) {
    console.error('Security monitor PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleGetEvents(searchParams: URLSearchParams, userId: string): Promise<NextResponse> {
  try {
    const filters = {
      severity: searchParams.get('severity') as 'low' | 'medium' | 'high' | 'critical' | null,
      category: searchParams.get('category')?.split(',') || [],
      timeRange: searchParams.get('timeRange') || '24h',
      source: searchParams.get('source')?.split(',') || [],
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    const events = await eventProcessor.getEvents(filters);
    
    // Aggregate events for better insights
    const aggregatedData = await eventAggregator.aggregateEvents(events, {
      groupBy: ['severity', 'category', 'source'],
      timeInterval: '1h'
    });

    return NextResponse.json({
      success: true,
      data: {
        events,
        aggregation: aggregatedData,
        total: events.length,
        filters: filters
      }
    });
  } catch (error) {
    console.error('Error fetching security events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security events' },
      { status: 500 }
    );
  }
}

async function handleGetThreats(searchParams: URLSearchParams, userId: string): Promise<NextResponse> {
  try {
    const timeRange = searchParams.get('timeRange') || '24h';
    
    // Get active threats from multiple sources
    const [detectedThreats, intelligenceData, siemThreats] = await Promise.all([
      threatDetector.getActiveThreats(timeRange),
      intelligenceFeeds.getLatestThreats(),
      siemConnector.getThreats(timeRange)
    ]);

    // Correlate and score threats
    const correlatedThreats = await threatDetector.correlateThreats([
      ...detectedThreats,
      ...siemThreats
    ], intelligenceData);

    return NextResponse.json({
      success: true,
      data: {
        threats: correlatedThreats,
        intelligence: intelligenceData,
        summary: {
          total: correlatedThreats.length,
          critical: correlatedThreats.filter(t => t.severity === 'critical').length,
          high: correlatedThreats.filter(t => t.severity === 'high').length,
          medium: correlatedThreats.filter(t => t.severity === 'medium').length,
          low: correlatedThreats.filter(t => t.severity === 'low').length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching threat data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch threat data' },
      { status: 500 }
    );
  }
}

async function handleGetMetrics(searchParams: URLSearchParams, userId: string): Promise<NextResponse> {
  try {
    const timeRange = searchParams.get('timeRange') || '24h';
    
    const metrics = await eventAggregator.getSecurityMetrics(timeRange);
    
    return NextResponse.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching security metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security metrics' },
      { status: 500 }
    );
  }
}

async function handleGetAlerts(searchParams: URLSearchParams, userId: string): Promise<NextResponse> {
  try {
    const status = searchParams.get('status') || 'active';
    const severity = searchParams.get('severity');
    
    const alerts = await eventProcessor.getAlerts({
      status,
      severity: severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
      limit: parseInt(searchParams.get('limit') || '50')
    });

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        total: alerts.length
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

async function handleStartStream(body: SecurityMonitorRequest, userId: string): Promise<NextResponse> {
  try {
    const hasPermission = await requirePermissions(userId, ['security:monitor:stream']);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Stream access denied' },
        { status: 403 }
      );
    }

    // Create real-time subscription for security events
    const streamId = await eventProcessor.createEventStream(userId, body.filters);
    
    // Set up SIEM integration for real-time data
    await siemConnector.startRealTimeSync(streamId, body.filters);

    return NextResponse.json({
      success: true,
      data: {
        streamId,
        message: 'Real-time security monitoring stream started',
        websocketUrl: `${process.env.NEXT_PUBLIC_WS_URL}/security/${streamId}`
      }
    });
  } catch (error) {
    console.error('Error starting security stream:', error);
    return NextResponse.json(
      { error: 'Failed to start security stream' },
      { status: 500 }
    );
  }
}

async function handleSecurityResponse(body: SecurityMonitorRequest, userId: string): Promise<NextResponse> {
  try {
    const hasPermission = await requirePermissions(userId, ['security:respond']);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Response action denied' },
        { status: 403 }
      );
    }

    if (!body.responseAction || !body.alertId) {
      return NextResponse.json(
        { error: 'Response action and alert ID required' },
        { status: 400 }
      );
    }

    // Execute automated response
    const responseResult = await responseEngine.executeResponse({
      alertId: body.alertId,
      action: body.responseAction,
      userId,
      timestamp: new Date().toISOString()
    });

    // Log the response action
    await eventProcessor.logSecurityAction({
      userId,
      action: body.responseAction.type,
      target: body.responseAction.target,
      alertId: body.alertId,
      result: responseResult.success ? 'success' : 'failed',
      details: responseResult.details
    });

    return NextResponse.json({
      success: true,
      data: {
        responseId: responseResult.id,
        status: responseResult.success ? 'executed' : 'failed',
        message: responseResult.message,
        details: responseResult.details
      }
    });
  } catch (error) {
    console.error('Error executing security response:', error);
    return NextResponse.json(
      { error: 'Failed to execute security response' },
      { status: 500 }
    );
  }
}

async function handleUpdateEvent(body: SecurityMonitorRequest, userId: string): Promise<NextResponse> {
  try {
    if (!body.eventData?.id) {
      return NextResponse.json(
        { error: 'Event ID required for update' },
        { status: 400 }
      );
    }

    const updatedEvent = await eventProcessor.updateEvent(body.eventData.id, {
      ...body.eventData,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    });

    // Trigger threat re-analysis if severity or status changed
    if (body.eventData.severity || body.eventData.status) {
      await threatDetector.analyzeEvent(updatedEvent);
    }

    return NextResponse.json({
      success: true,
      data: {
        event: updatedEvent,
        message: 'Security event updated successfully'
      }
    });
  } catch (error) {
    console.error('Error updating security event:', error);
    return NextResponse.json(
      { error: 'Failed to update security event' },
      { status: 500 }
    );
  }
}
```