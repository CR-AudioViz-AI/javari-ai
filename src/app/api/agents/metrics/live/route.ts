import { NextRequest } from 'next/server';
import { WebSocket, WebSocketServer } from 'ws';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

interface AgentMetrics {
  agent_id: string;
  requests_per_minute: number;
  avg_response_time: number;
  error_rate: number;
  satisfaction_score: number;
  total_requests: number;
  active_users: number;
  last_updated: string;
}

interface MetricsCache {
  [agentId: string]: {
    metrics: AgentMetrics;
    lastUpdate: number;
    requestBuffer: Array<{ timestamp: number; response_time: number; success: boolean; }>;
  };
}

class AgentMetricsStream {
  private wss: WebSocketServer;
  private clients: Set<WebSocket>;
  private metricsCache: MetricsCache;
  private supabase: any;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
    this.clients = new Set();
    this.metricsCache = {};
    this.cleanupInterval = null;
    this.setupWebSocketServer();
    this.startCleanupTimer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: any) => {
      this.clients.add(ws);
      console.log(`Client connected. Total clients: ${this.clients.size}`);

      // Send current metrics to new client
      this.sendCurrentMetrics(ws);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Error parsing client message:', error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`Client disconnected. Total clients: ${this.clients.size}`);
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  private async initializeSupabase(): Promise<void> {
    try {
      this.supabase = createServerComponentClient<Database>({ cookies });
      await this.setupRealtimeSubscriptions();
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
    }
  }

  private async setupRealtimeSubscriptions(): Promise<void> {
    // Subscribe to agent_requests changes
    this.supabase
      .channel('agent_requests_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'agent_requests' 
        }, 
        (payload: any) => {
          this.handleAgentRequestChange(payload);
        }
      )
      .subscribe();

    // Subscribe to agent_reviews changes
    this.supabase
      .channel('agent_reviews_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'agent_reviews' 
        }, 
        (payload: any) => {
          this.handleAgentReviewChange(payload);
        }
      )
      .subscribe();
  }

  private handleAgentRequestChange(payload: any): void {
    const { new: newRecord, old: oldRecord, eventType } = payload;
    
    if (eventType === 'INSERT' && newRecord) {
      this.updateRequestMetrics(newRecord);
    } else if (eventType === 'UPDATE' && newRecord && oldRecord) {
      this.updateRequestMetrics(newRecord);
    }
  }

  private handleAgentReviewChange(payload: any): void {
    const { new: newRecord, eventType } = payload;
    
    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRecord) {
      this.updateSatisfactionMetrics(newRecord.agent_id);
    }
  }

  private updateRequestMetrics(requestData: any): void {
    const { agent_id, response_time, status, created_at } = requestData;
    const now = Date.now();
    
    if (!this.metricsCache[agent_id]) {
      this.metricsCache[agent_id] = {
        metrics: this.createInitialMetrics(agent_id),
        lastUpdate: now,
        requestBuffer: []
      };
    }

    const cache = this.metricsCache[agent_id];
    const isSuccess = status >= 200 && status < 400;
    
    // Add to request buffer
    cache.requestBuffer.push({
      timestamp: new Date(created_at).getTime(),
      response_time: response_time || 0,
      success: isSuccess
    });

    // Clean old requests (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    cache.requestBuffer = cache.requestBuffer.filter(req => req.timestamp > oneMinuteAgo);

    // Recalculate metrics
    this.recalculateMetrics(agent_id);
    this.broadcastMetrics(agent_id);
  }

  private async updateSatisfactionMetrics(agentId: string): Promise<void> {
    try {
      const { data: reviews, error } = await this.supabase
        .from('agent_reviews')
        .select('rating')
        .eq('agent_id', agentId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('Error fetching reviews:', error);
        return;
      }

      if (!this.metricsCache[agentId]) {
        this.metricsCache[agentId] = {
          metrics: this.createInitialMetrics(agentId),
          lastUpdate: Date.now(),
          requestBuffer: []
        };
      }

      const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviews.length 
        : 0;

      this.metricsCache[agentId].metrics.satisfaction_score = Math.round(avgRating * 100) / 100;
      this.broadcastMetrics(agentId);
    } catch (error) {
      console.error('Error updating satisfaction metrics:', error);
    }
  }

  private recalculateMetrics(agentId: string): void {
    const cache = this.metricsCache[agentId];
    if (!cache) return;

    const now = Date.now();
    const recentRequests = cache.requestBuffer.filter(req => req.timestamp > now - 60000);
    
    // Calculate requests per minute
    cache.metrics.requests_per_minute = recentRequests.length;

    // Calculate average response time
    const responseTimes = recentRequests.map(req => req.response_time).filter(rt => rt > 0);
    cache.metrics.avg_response_time = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length)
      : 0;

    // Calculate error rate
    const errorCount = recentRequests.filter(req => !req.success).length;
    cache.metrics.error_rate = recentRequests.length > 0
      ? Math.round((errorCount / recentRequests.length) * 100 * 100) / 100
      : 0;

    // Update total requests and last updated
    cache.metrics.total_requests = cache.requestBuffer.length;
    cache.metrics.last_updated = new Date().toISOString();
    cache.lastUpdate = now;
  }

  private createInitialMetrics(agentId: string): AgentMetrics {
    return {
      agent_id: agentId,
      requests_per_minute: 0,
      avg_response_time: 0,
      error_rate: 0,
      satisfaction_score: 0,
      total_requests: 0,
      active_users: 0,
      last_updated: new Date().toISOString()
    };
  }

  private broadcastMetrics(agentId?: string): void {
    const metricsToSend = agentId 
      ? { [agentId]: this.metricsCache[agentId]?.metrics }
      : Object.fromEntries(
          Object.entries(this.metricsCache).map(([id, cache]) => [id, cache.metrics])
        );

    const message = JSON.stringify({
      type: 'metrics_update',
      data: metricsToSend,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('Error sending message to client:', error);
          this.clients.delete(client);
        }
      }
    });
  }

  private sendCurrentMetrics(ws: WebSocket): void {
    const currentMetrics = Object.fromEntries(
      Object.entries(this.metricsCache).map(([id, cache]) => [id, cache.metrics])
    );

    const message = JSON.stringify({
      type: 'initial_metrics',
      data: currentMetrics,
      timestamp: new Date().toISOString()
    });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }

  private handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'subscribe_agent':
        if (message.agent_id && typeof message.agent_id === 'string') {
          // Client wants metrics for specific agent
          const agentMetrics = this.metricsCache[message.agent_id]?.metrics;
          if (agentMetrics) {
            ws.send(JSON.stringify({
              type: 'agent_metrics',
              data: { [message.agent_id]: agentMetrics },
              timestamp: new Date().toISOString()
            }));
          }
        }
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      // Clean up old cache entries
      Object.keys(this.metricsCache).forEach(agentId => {
        const cache = this.metricsCache[agentId];
        if (cache.lastUpdate < fiveMinutesAgo) {
          delete this.metricsCache[agentId];
        } else {
          // Clean old requests from buffer
          cache.requestBuffer = cache.requestBuffer.filter(
            req => req.timestamp > now - 60000
          );
        }
      });

      // Remove disconnected clients
      this.clients.forEach(client => {
        if (client.readyState !== WebSocket.OPEN) {
          this.clients.delete(client);
        }
      });
    }, 30000); // Run every 30 seconds
  }

  public async handleUpgrade(request: any, socket: any, head: any): Promise<void> {
    await this.initializeSupabase();
    
    this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      this.wss.emit('connection', ws, request);
    });
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clients.clear();
    this.wss.close();
  }
}

// Global instance to handle connections
let metricsStream: AgentMetricsStream | null = null;

export async function GET(request: NextRequest) {
  try {
    const upgradeHeader = request.headers.get('upgrade');
    
    if (upgradeHeader !== 'websocket') {
      return new Response(
        JSON.stringify({ 
          error: 'WebSocket upgrade required',
          message: 'This endpoint requires WebSocket connection'
        }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize metrics stream if not exists
    if (!metricsStream) {
      metricsStream = new AgentMetricsStream();
    }

    return new Response(null, { 
      status: 101,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade'
      }
    });

  } catch (error) {
    console.error('Error in metrics live API:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to establish WebSocket connection'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle WebSocket upgrade
export async function handleUpgrade(request: any, socket: any, head: any) {
  if (!metricsStream) {
    metricsStream = new AgentMetricsStream();
  }
  
  await metricsStream.handleUpgrade(request, socket, head);
}

// Cleanup on process termination
process.on('SIGTERM', () => {
  if (metricsStream) {
    metricsStream.destroy();
  }
});

process.on('SIGINT', () => {
  if (metricsStream) {
    metricsStream.destroy();
  }
});