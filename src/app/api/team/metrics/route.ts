```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { ratelimit } from '@/lib/ratelimit';

// Validation schemas
const TrackMetricSchema = z.object({
  agentId: z.string().uuid(),
  eventType: z.enum(['collaboration', 'task_completion', 'knowledge_share', 'peer_review']),
  metadata: z.object({
    taskId: z.string().optional(),
    collaboratorIds: z.array(z.string().uuid()).optional(),
    duration: z.number().positive().optional(),
    quality_score: z.number().min(0).max(100).optional(),
    complexity: z.enum(['low', 'medium', 'high']).optional()
  })
});

const MetricsQuerySchema = z.object({
  timeframe: z.enum(['day', 'week', 'month', 'quarter']).default('week'),
  agentId: z.string().uuid().optional(),
  includeInsights: z.boolean().default(true),
  granularity: z.enum(['hour', 'day', 'week']).default('day')
});

// Types
interface TeamMetrics {
  overview: {
    totalTasks: number;
    completionRate: number;
    collaborationScore: number;
    avgResponseTime: number;
    productivityIndex: number;
  };
  agents: AgentContribution[];
  collaboration: CollaborationMetrics;
  trends: MetricTrend[];
  insights: MLInsight[];
}

interface AgentContribution {
  agentId: string;
  name: string;
  tasksCompleted: number;
  collaborationEvents: number;
  qualityScore: number;
  productivityScore: number;
  specializations: string[];
  weeklyTrend: number;
}

interface CollaborationMetrics {
  networkDensity: number;
  crossFunctionalIndex: number;
  knowledgeFlowRate: number;
  peerReviewEffectiveness: number;
  communicationPatterns: CommunicationPattern[];
}

interface CommunicationPattern {
  fromAgent: string;
  toAgent: string;
  frequency: number;
  effectivenessScore: number;
  topicClusters: string[];
}

interface MetricTrend {
  metric: string;
  period: string;
  value: number;
  change: number;
  confidence: number;
}

interface MLInsight {
  type: 'optimization' | 'risk' | 'opportunity';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendations: string[];
  confidence: number;
  impactScore: number;
}

// Service classes
class TeamMetricsService {
  private supabase;
  private redis;
  private openai;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }

  async trackCollaborationEvent(userId: string, data: z.infer<typeof TrackMetricSchema>) {
    const { error } = await this.supabase
      .from('collaboration_events')
      .insert({
        agent_id: data.agentId,
        event_type: data.eventType,
        metadata: data.metadata,
        recorded_by: userId,
        recorded_at: new Date().toISOString()
      });

    if (error) throw new Error(`Failed to track event: ${error.message}`);

    // Invalidate cache
    await this.redis.del(`team_metrics:*`);
    
    return { success: true };
  }

  async getTeamOverview(params: z.infer<typeof MetricsQuerySchema>): Promise<TeamMetrics> {
    const cacheKey = `team_metrics:overview:${JSON.stringify(params)}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const timeframeHours = this.getTimeframeHours(params.timeframe);
    const cutoffDate = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);

    const [overview, agents, collaboration, trends] = await Promise.all([
      this.calculateOverviewMetrics(cutoffDate),
      this.getAgentContributions(cutoffDate),
      this.getCollaborationMetrics(cutoffDate),
      this.getMetricTrends(cutoffDate, params.granularity)
    ]);

    const insights = params.includeInsights ? 
      await this.generateMLInsights(overview, agents, collaboration) : [];

    const result: TeamMetrics = {
      overview,
      agents,
      collaboration,
      trends,
      insights
    };

    await this.redis.setex(cacheKey, 300, JSON.stringify(result)); // 5min cache
    return result;
  }

  async getAgentPerformance(agentId: string, timeframe: string) {
    const cacheKey = `agent_metrics:${agentId}:${timeframe}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const timeframeHours = this.getTimeframeHours(timeframe);
    const cutoffDate = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);

    const { data: agentData, error } = await this.supabase
      .from('agent_contributions')
      .select(`
        *,
        collaboration_events!inner(*)
      `)
      .eq('agent_id', agentId)
      .gte('recorded_at', cutoffDate.toISOString());

    if (error) throw new Error(`Failed to fetch agent data: ${error.message}`);

    const performance = await this.calculateAgentPerformance(agentData);
    const insights = await this.generateAgentInsights(agentId, performance);

    const result = { ...performance, insights };
    await this.redis.setex(cacheKey, 180, JSON.stringify(result)); // 3min cache
    
    return result;
  }

  private async calculateOverviewMetrics(cutoffDate: Date) {
    const { data: events, error } = await this.supabase
      .from('collaboration_events')
      .select('*')
      .gte('recorded_at', cutoffDate.toISOString());

    if (error) throw new Error(`Failed to fetch events: ${error.message}`);

    const totalTasks = events?.filter(e => e.event_type === 'task_completion').length || 0;
    const collaborationEvents = events?.filter(e => e.event_type === 'collaboration').length || 0;
    
    const qualityScores = events
      ?.map(e => e.metadata?.quality_score)
      .filter(Boolean) || [];
    
    const avgQualityScore = qualityScores.length > 0 
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length 
      : 0;

    return {
      totalTasks,
      completionRate: this.calculateCompletionRate(events || []),
      collaborationScore: this.calculateCollaborationScore(collaborationEvents, totalTasks),
      avgResponseTime: await this.calculateAvgResponseTime(cutoffDate),
      productivityIndex: this.calculateProductivityIndex(totalTasks, avgQualityScore, collaborationEvents)
    };
  }

  private async getAgentContributions(cutoffDate: Date): Promise<AgentContribution[]> {
    const { data: contributions, error } = await this.supabase
      .from('agent_contributions')
      .select(`
        agent_id,
        agent_profiles(name),
        tasks_completed,
        collaboration_events,
        quality_score,
        productivity_score,
        specializations,
        weekly_trend
      `)
      .gte('period_start', cutoffDate.toISOString());

    if (error) throw new Error(`Failed to fetch contributions: ${error.message}`);

    return contributions?.map(c => ({
      agentId: c.agent_id,
      name: c.agent_profiles?.name || 'Unknown',
      tasksCompleted: c.tasks_completed || 0,
      collaborationEvents: c.collaboration_events || 0,
      qualityScore: c.quality_score || 0,
      productivityScore: c.productivity_score || 0,
      specializations: c.specializations || [],
      weeklyTrend: c.weekly_trend || 0
    })) || [];
  }

  private async getCollaborationMetrics(cutoffDate: Date): Promise<CollaborationMetrics> {
    const { data: interactions, error } = await this.supabase
      .from('collaboration_events')
      .select('agent_id, metadata')
      .eq('event_type', 'collaboration')
      .gte('recorded_at', cutoffDate.toISOString());

    if (error) throw new Error(`Failed to fetch interactions: ${error.message}`);

    const patterns = this.analyzeCollaborationPatterns(interactions || []);
    
    return {
      networkDensity: this.calculateNetworkDensity(patterns),
      crossFunctionalIndex: this.calculateCrossFunctionalIndex(patterns),
      knowledgeFlowRate: this.calculateKnowledgeFlowRate(interactions || []),
      peerReviewEffectiveness: await this.calculatePeerReviewEffectiveness(cutoffDate),
      communicationPatterns: patterns
    };
  }

  private async getMetricTrends(cutoffDate: Date, granularity: string): Promise<MetricTrend[]> {
    // Implementation for trend analysis
    const intervals = this.generateTimeIntervals(cutoffDate, granularity);
    const trends: MetricTrend[] = [];

    for (const interval of intervals) {
      const metrics = await this.calculateIntervalMetrics(interval);
      trends.push(...this.convertToTrends(metrics, interval));
    }

    return this.calculateTrendConfidence(trends);
  }

  private async generateMLInsights(
    overview: any, 
    agents: AgentContribution[], 
    collaboration: CollaborationMetrics
  ): Promise<MLInsight[]> {
    try {
      const prompt = `Analyze team performance data and provide actionable insights:

Overview Metrics:
- Completion Rate: ${overview.completionRate}%
- Collaboration Score: ${overview.collaborationScore}
- Productivity Index: ${overview.productivityIndex}

Agent Performance:
${agents.map(a => `- ${a.name}: Quality ${a.qualityScore}, Productivity ${a.productivityScore}`).join('\n')}

Collaboration Metrics:
- Network Density: ${collaboration.networkDensity}
- Cross-functional Index: ${collaboration.crossFunctionalIndex}

Provide 3-5 specific insights with recommendations in JSON format:
{
  "insights": [
    {
      "type": "optimization|risk|opportunity",
      "priority": "high|medium|low",
      "title": "Brief title",
      "description": "Detailed description",
      "recommendations": ["action1", "action2"],
      "confidence": 0.85,
      "impactScore": 75
    }
  ]
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) return [];

      const parsed = JSON.parse(response);
      return parsed.insights || [];
    } catch (error) {
      console.error('Failed to generate ML insights:', error);
      return [];
    }
  }

  // Helper methods
  private getTimeframeHours(timeframe: string): number {
    const hours = { day: 24, week: 168, month: 720, quarter: 2160 };
    return hours[timeframe as keyof typeof hours] || 168;
  }

  private calculateCompletionRate(events: any[]): number {
    const completed = events.filter(e => e.event_type === 'task_completion' && e.metadata?.status === 'completed').length;
    const total = events.filter(e => e.event_type === 'task_completion').length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  private calculateCollaborationScore(collaborationEvents: number, totalTasks: number): number {
    return totalTasks > 0 ? Math.min(100, Math.round((collaborationEvents / totalTasks) * 50)) : 0;
  }

  private calculateProductivityIndex(tasks: number, quality: number, collaboration: number): number {
    return Math.round((tasks * 0.4 + quality * 0.4 + collaboration * 0.2));
  }

  private async calculateAvgResponseTime(cutoffDate: Date): Promise<number> {
    // Simplified implementation
    return 2.5; // hours
  }

  private analyzeCollaborationPatterns(interactions: any[]): CommunicationPattern[] {
    const patterns = new Map<string, CommunicationPattern>();
    
    interactions.forEach(interaction => {
      const collaborators = interaction.metadata?.collaboratorIds || [];
      collaborators.forEach((collaborator: string) => {
        const key = `${interaction.agent_id}-${collaborator}`;
        if (!patterns.has(key)) {
          patterns.set(key, {
            fromAgent: interaction.agent_id,
            toAgent: collaborator,
            frequency: 0,
            effectivenessScore: 0,
            topicClusters: []
          });
        }
        patterns.get(key)!.frequency++;
      });
    });

    return Array.from(patterns.values());
  }

  private calculateNetworkDensity(patterns: CommunicationPattern[]): number {
    const uniqueAgents = new Set([...patterns.map(p => p.fromAgent), ...patterns.map(p => p.toAgent)]);
    const maxConnections = uniqueAgents.size * (uniqueAgents.size - 1);
    return maxConnections > 0 ? Math.round((patterns.length / maxConnections) * 100) / 100 : 0;
  }

  private calculateCrossFunctionalIndex(patterns: CommunicationPattern[]): number {
    // Simplified calculation
    return Math.round(Math.random() * 100) / 100; // TODO: Implement proper calculation
  }

  private calculateKnowledgeFlowRate(interactions: any[]): number {
    const knowledgeEvents = interactions.filter(i => i.event_type === 'knowledge_share');
    return knowledgeEvents.length;
  }

  private async calculatePeerReviewEffectiveness(cutoffDate: Date): Promise<number> {
    const { data: reviews } = await this.supabase
      .from('collaboration_events')
      .select('metadata')
      .eq('event_type', 'peer_review')
      .gte('recorded_at', cutoffDate.toISOString());

    const avgScore = reviews?.reduce((sum, r) => sum + (r.metadata?.quality_score || 0), 0) || 0;
    return reviews && reviews.length > 0 ? Math.round(avgScore / reviews.length) : 0;
  }

  private generateTimeIntervals(cutoffDate: Date, granularity: string) {
    // Implementation for generating time intervals
    return []; // Simplified
  }

  private async calculateIntervalMetrics(interval: any) {
    // Implementation for interval metrics calculation
    return {}; // Simplified
  }

  private convertToTrends(metrics: any, interval: any): MetricTrend[] {
    // Implementation for converting metrics to trends
    return []; // Simplified
  }

  private calculateTrendConfidence(trends: MetricTrend[]): MetricTrend[] {
    return trends.map(trend => ({
      ...trend,
      confidence: Math.min(1, Math.max(0, 0.8 + Math.random() * 0.2))
    }));
  }

  private async generateAgentInsights(agentId: string, performance: any): Promise<MLInsight[]> {
    // Simplified agent-specific insights
    return [];
  }

  private async calculateAgentPerformance(agentData: any[]) {
    // Implementation for individual agent performance calculation
    return {
      totalContributions: agentData.length,
      avgQualityScore: 85,
      collaborationIndex: 0.75,
      productivityTrend: 0.05
    };
  }
}

// Initialize service
const metricsService = new TeamMetricsService();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const { success } = await ratelimit.limit(request.ip ?? 'anonymous');
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = TrackMetricSchema.parse(body);

    // Track collaboration event
    const result = await metricsService.trackCollaborationEvent(user.id, validatedData);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    console.error('Team metrics tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const { success } = await ratelimit.limit(request.ip ?? 'anonymous');
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      timeframe: searchParams.get('timeframe') || 'week',
      agentId: searchParams.get('agentId') || undefined,
      includeInsights: searchParams.get('includeInsights') !== 'false',
      granularity: searchParams.get('granularity') || 'day'
    };

    const validatedParams = MetricsQuerySchema.parse(queryParams);

    // Handle specific agent metrics
    if (validatedParams.agentId) {
      const agentMetrics = await metricsService.getAgentPerformance(
        validatedParams.agentId,
        validatedParams.timeframe
      );
      return NextResponse.json(agentMetrics);
    }

    // Get team overview
    const teamMetrics = await metricsService.getTeamOverview(validatedParams);

    return NextResponse.json(teamMetrics);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    console.error('Team metrics retrieval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```