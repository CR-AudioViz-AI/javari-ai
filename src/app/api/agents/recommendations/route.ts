```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import OpenAI from 'openai';
import { z } from 'zod';

// Validation schemas
const RecommendationRequestSchema = z.object({
  userId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  projectType: z.string().optional(),
  excludeAgentIds: z.array(z.string().uuid()).optional().default([]),
});

// Types
interface UserInteraction {
  user_id: string;
  agent_id: string;
  interaction_type: 'view' | 'use' | 'favorite' | 'rate';
  rating?: number;
  duration_seconds?: number;
  created_at: string;
}

interface AgentMetrics {
  agent_id: string;
  success_rate: number;
  avg_rating: number;
  total_uses: number;
  avg_response_time: number;
  user_satisfaction: number;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  capabilities: string[];
  performance_score: number;
}

interface RecommendationScore {
  agentId: string;
  score: number;
  reasons: string[];
  confidence: number;
}

class UserBehaviorAnalyzer {
  static analyzeInteractionPatterns(interactions: UserInteraction[]) {
    const patterns = {
      preferredCategories: {} as Record<string, number>,
      interactionWeights: {} as Record<string, number>,
      avgSessionDuration: 0,
      ratingTrend: 0,
    };

    const weights = {
      view: 1,
      use: 3,
      favorite: 5,
      rate: 2,
    };

    interactions.forEach(interaction => {
      const weight = weights[interaction.interaction_type];
      patterns.interactionWeights[interaction.agent_id] = 
        (patterns.interactionWeights[interaction.agent_id] || 0) + weight;
      
      if (interaction.rating) {
        patterns.ratingTrend += interaction.rating;
      }
    });

    return patterns;
  }

  static calculateUserVector(interactions: UserInteraction[], agents: Agent[]) {
    const agentMap = new Map(agents.map(a => [a.id, a]));
    const categoryScores = {} as Record<string, number>;
    const tagScores = {} as Record<string, number>;
    
    interactions.forEach(interaction => {
      const agent = agentMap.get(interaction.agent_id);
      if (!agent) return;

      const weight = this.getInteractionWeight(interaction);
      
      // Category scoring
      categoryScores[agent.category] = 
        (categoryScores[agent.category] || 0) + weight;
      
      // Tag scoring
      agent.tags.forEach(tag => {
        tagScores[tag] = (tagScores[tag] || 0) + weight;
      });
    });

    return { categoryScores, tagScores };
  }

  private static getInteractionWeight(interaction: UserInteraction): number {
    const baseWeights = { view: 1, use: 3, favorite: 5, rate: 2 };
    let weight = baseWeights[interaction.interaction_type];

    if (interaction.rating) {
      weight *= (interaction.rating / 5);
    }

    if (interaction.duration_seconds) {
      weight *= Math.min(interaction.duration_seconds / 300, 2); // Cap at 5 minutes
    }

    return weight;
  }
}

class CollaborativeFilter {
  static async findSimilarUsers(
    targetUserId: string,
    userInteractions: Map<string, UserInteraction[]>,
    agents: Agent[]
  ): Promise<string[]> {
    const targetVector = UserBehaviorAnalyzer.calculateUserVector(
      userInteractions.get(targetUserId) || [],
      agents
    );

    const similarities: Array<{ userId: string; similarity: number }> = [];

    for (const [userId, interactions] of userInteractions.entries()) {
      if (userId === targetUserId) continue;

      const userVector = UserBehaviorAnalyzer.calculateUserVector(interactions, agents);
      const similarity = this.calculateCosineSimilarity(targetVector, userVector);
      
      if (similarity > 0.1) {
        similarities.push({ userId, similarity });
      }
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map(s => s.userId);
  }

  private static calculateCosineSimilarity(vectorA: any, vectorB: any): number {
    const allCategories = new Set([
      ...Object.keys(vectorA.categoryScores),
      ...Object.keys(vectorB.categoryScores)
    ]);

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (const category of allCategories) {
      const scoreA = vectorA.categoryScores[category] || 0;
      const scoreB = vectorB.categoryScores[category] || 0;

      dotProduct += scoreA * scoreB;
      magnitudeA += scoreA * scoreA;
      magnitudeB += scoreB * scoreB;
    }

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
  }

  static generateCollaborativeRecommendations(
    similarUsers: string[],
    userInteractions: Map<string, UserInteraction[]>,
    targetUserId: string,
    excludeAgentIds: string[]
  ): RecommendationScore[] {
    const targetInteractions = new Set(
      (userInteractions.get(targetUserId) || []).map(i => i.agent_id)
    );

    const agentScores = {} as Record<string, number>;
    const agentReasons = {} as Record<string, string[]>;

    similarUsers.forEach(userId => {
      const interactions = userInteractions.get(userId) || [];
      
      interactions.forEach(interaction => {
        if (targetInteractions.has(interaction.agent_id)) return;
        if (excludeAgentIds.includes(interaction.agent_id)) return;

        const weight = UserBehaviorAnalyzer.getInteractionWeight(interaction);
        agentScores[interaction.agent_id] = 
          (agentScores[interaction.agent_id] || 0) + weight;
        
        if (!agentReasons[interaction.agent_id]) {
          agentReasons[interaction.agent_id] = [];
        }
        agentReasons[interaction.agent_id].push('Similar users found this helpful');
      });
    });

    return Object.entries(agentScores).map(([agentId, score]) => ({
      agentId,
      score,
      reasons: [...new Set(agentReasons[agentId])],
      confidence: Math.min(score / 10, 1),
    }));
  }
}

class ContentBasedFilter {
  static async generateEmbeddings(
    openai: OpenAI,
    agents: Agent[]
  ): Promise<Map<string, number[]>> {
    const embeddings = new Map<string, number[]>();

    for (const agent of agents) {
      const text = `${agent.name} ${agent.description} ${agent.tags.join(' ')} ${agent.capabilities.join(' ')}`;
      
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
        });

        embeddings.set(agent.id, response.data[0].embedding);
      } catch (error) {
        console.error(`Failed to generate embedding for agent ${agent.id}:`, error);
      }
    }

    return embeddings;
  }

  static calculateContentSimilarity(
    targetUserVector: any,
    agents: Agent[],
    embeddings: Map<string, number[]>,
    excludeAgentIds: string[]
  ): RecommendationScore[] {
    const recommendations: RecommendationScore[] = [];

    agents.forEach(agent => {
      if (excludeAgentIds.includes(agent.id)) return;

      let score = 0;
      const reasons: string[] = [];

      // Category preference scoring
      const categoryScore = targetUserVector.categoryScores[agent.category] || 0;
      if (categoryScore > 0) {
        score += categoryScore * 0.3;
        reasons.push(`Matches your ${agent.category} preferences`);
      }

      // Tag preference scoring
      agent.tags.forEach(tag => {
        const tagScore = targetUserVector.tagScores[tag] || 0;
        if (tagScore > 0) {
          score += tagScore * 0.2;
          reasons.push(`Tagged with ${tag}`);
        }
      });

      // Performance scoring
      score += agent.performance_score * 0.3;
      if (agent.performance_score > 0.8) {
        reasons.push('High performance rating');
      }

      if (score > 0) {
        recommendations.push({
          agentId: agent.id,
          score,
          reasons: [...new Set(reasons)],
          confidence: Math.min(score / 5, 1),
        });
      }
    });

    return recommendations;
  }
}

class RecommendationEngine {
  private supabase;
  private redis;
  private openai;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateRecommendations(
    userId: string,
    limit: number,
    projectType?: string,
    excludeAgentIds: string[] = []
  ): Promise<any[]> {
    // Check cache first
    const cacheKey = `recommendations:${userId}:${projectType || 'all'}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const recommendations = JSON.parse(cached);
      return recommendations.filter((r: any) => !excludeAgentIds.includes(r.id));
    }

    // Fetch data
    const [userInteractions, agents, allInteractions] = await Promise.all([
      this.fetchUserInteractions(userId),
      this.fetchAgents(projectType),
      this.fetchAllUserInteractions(),
    ]);

    if (userInteractions.length === 0) {
      // Cold start: return popular agents
      return this.getColdStartRecommendations(agents, limit, excludeAgentIds);
    }

    // Generate user behavior vector
    const userVector = UserBehaviorAnalyzer.calculateUserVector(userInteractions, agents);

    // Collaborative filtering
    const similarUsers = await CollaborativeFilter.findSimilarUsers(
      userId,
      allInteractions,
      agents
    );

    const collaborativeRecs = CollaborativeFilter.generateCollaborativeRecommendations(
      similarUsers,
      allInteractions,
      userId,
      excludeAgentIds
    );

    // Content-based filtering
    const embeddings = await ContentBasedFilter.generateEmbeddings(this.openai, agents);
    const contentRecs = ContentBasedFilter.calculateContentSimilarity(
      userVector,
      agents,
      embeddings,
      excludeAgentIds
    );

    // Merge and rank recommendations
    const mergedRecs = this.mergeRecommendations(collaborativeRecs, contentRecs);
    const topRecs = mergedRecs.slice(0, limit);

    // Enrich with agent details
    const enrichedRecs = await this.enrichRecommendations(topRecs, agents);

    // Cache results
    await this.redis.setex(cacheKey, 3600, JSON.stringify(enrichedRecs)); // 1 hour cache

    return enrichedRecs;
  }

  private async fetchUserInteractions(userId: string): Promise<UserInteraction[]> {
    const { data, error } = await this.supabase
      .from('user_agent_interactions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    if (error) throw error;
    return data || [];
  }

  private async fetchAgents(projectType?: string): Promise<Agent[]> {
    let query = this.supabase
      .from('agents')
      .select(`
        id,
        name,
        description,
        category,
        tags,
        capabilities,
        performance_score
      `)
      .eq('status', 'active');

    if (projectType) {
      query = query.or(`category.eq.${projectType},tags.cs.{${projectType}}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  private async fetchAllUserInteractions(): Promise<Map<string, UserInteraction[]>> {
    const { data, error } = await this.supabase
      .from('user_agent_interactions')
      .select('*')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    const interactionMap = new Map<string, UserInteraction[]>();
    (data || []).forEach(interaction => {
      if (!interactionMap.has(interaction.user_id)) {
        interactionMap.set(interaction.user_id, []);
      }
      interactionMap.get(interaction.user_id)!.push(interaction);
    });

    return interactionMap;
  }

  private async getColdStartRecommendations(
    agents: Agent[],
    limit: number,
    excludeAgentIds: string[]
  ): Promise<any[]> {
    const filtered = agents
      .filter(agent => !excludeAgentIds.includes(agent.id))
      .sort((a, b) => b.performance_score - a.performance_score)
      .slice(0, limit);

    return filtered.map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      tags: agent.tags,
      capabilities: agent.capabilities,
      recommendationScore: agent.performance_score,
      reasons: ['Popular choice', 'High performance rating'],
      confidence: 0.5,
    }));
  }

  private mergeRecommendations(
    collaborative: RecommendationScore[],
    contentBased: RecommendationScore[]
  ): RecommendationScore[] {
    const merged = new Map<string, RecommendationScore>();

    // Add collaborative recommendations with weight
    collaborative.forEach(rec => {
      merged.set(rec.agentId, {
        ...rec,
        score: rec.score * 0.6, // 60% weight for collaborative
      });
    });

    // Add/merge content-based recommendations
    contentBased.forEach(rec => {
      const existing = merged.get(rec.agentId);
      if (existing) {
        existing.score += rec.score * 0.4; // 40% weight for content-based
        existing.reasons = [...new Set([...existing.reasons, ...rec.reasons])];
        existing.confidence = Math.max(existing.confidence, rec.confidence);
      } else {
        merged.set(rec.agentId, {
          ...rec,
          score: rec.score * 0.4,
        });
      }
    });

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score);
  }

  private async enrichRecommendations(
    recommendations: RecommendationScore[],
    agents: Agent[]
  ): Promise<any[]> {
    const agentMap = new Map(agents.map(a => [a.id, a]));

    return recommendations.map(rec => {
      const agent = agentMap.get(rec.agentId);
      if (!agent) return null;

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        tags: agent.tags,
        capabilities: agent.capabilities,
        recommendationScore: rec.score,
        reasons: rec.reasons,
        confidence: rec.confidence,
      };
    }).filter(Boolean);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = {
      userId: searchParams.get('userId'),
      limit: searchParams.get('limit'),
      projectType: searchParams.get('projectType'),
      excludeAgentIds: searchParams.getAll('excludeAgentIds'),
    };

    const validatedParams = RecommendationRequestSchema.parse(params);

    const engine = new RecommendationEngine();
    const recommendations = await engine.generateRecommendations(
      validatedParams.userId,
      validatedParams.limit,
      validatedParams.projectType,
      validatedParams.excludeAgentIds
    );

    // Log analytics
    await engine.supabase
      .from('recommendation_analytics')
      .insert({
        user_id: validatedParams.userId,
        request_params: params,
        result_count: recommendations.length,
        created_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        metadata: {
          total: recommendations.length,
          requestId: crypto.randomUUID(),
          generatedAt: new Date().toISOString(),
        },
      },
    });

  } catch (error) {
    console.error('Recommendation engine error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to generate recommendations',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, agentId, interactionType, rating, sessionDuration } = body;

    if (!userId || !agentId || !interactionType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Record interaction
    const { error } = await supabase
      .from('user_agent_interactions')
      .insert({
        user_id: userId,
        agent_id: agentId,
        interaction_type: interactionType,
        rating: rating || null,
        duration_seconds: sessionDuration || null,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Invalidate user's recommendation cache
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    const pattern = `recommendations:${userId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return NextResponse.json({
      success: true,
      message: 'Interaction recorded successfully',
    });

  } catch (error) {
    console.error('Failed to record interaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record interaction' },
      { status: 500 }
    );
  }
}
```