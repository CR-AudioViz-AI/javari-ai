```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const redis = new Redis(process.env.REDIS_URL!);

// Request validation schema
const searchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(50).default(20),
  threshold: z.number().min(0).max(1).default(0.7),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Rate limiting configuration
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

// Query preprocessing
function preprocessQuery(query: string): string {
  // Remove common stopwords and enhance context
  const stopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const words = query.toLowerCase().split(/\s+/);
  const filteredWords = words.filter(word => !stopwords.includes(word) && word.length > 2);
  
  // Add context for agent search
  const contextualQuery = filteredWords.join(' ') + ' AI agent assistant tool';
  return contextualQuery;
}

// Generate query embedding
async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error);
    throw new Error('Failed to generate query embedding');
  }
}

// Perform vector similarity search
async function performVectorSearch(
  embedding: number[],
  limit: number,
  threshold: number,
  category?: string,
  tags?: string[]
) {
  try {
    let query = supabase
      .rpc('match_agents_semantic', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
      });

    // Apply filters if provided
    if (category) {
      query = query.eq('category', category);
    }

    if (tags && tags.length > 0) {
      query = query.contains('tags', tags);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase search error:', error);
      throw new Error('Vector search failed');
    }

    return data || [];
  } catch (error) {
    console.error('Vector search error:', error);
    throw new Error('Failed to perform semantic search');
  }
}

// Rank and enrich results
async function rankAndEnrichResults(results: any[]) {
  try {
    // Get additional metadata and popularity scores
    const agentIds = results.map(r => r.id);
    
    const { data: agentStats, error } = await supabase
      .from('agent_usage_stats')
      .select('agent_id, usage_count, rating_avg, rating_count')
      .in('agent_id', agentIds);

    if (error) {
      console.error('Agent stats error:', error);
    }

    // Create stats lookup
    const statsLookup = new Map();
    agentStats?.forEach(stat => {
      statsLookup.set(stat.agent_id, stat);
    });

    // Enrich and rank results
    const enrichedResults = results.map(agent => {
      const stats = statsLookup.get(agent.id) || {
        usage_count: 0,
        rating_avg: 0,
        rating_count: 0
      };

      // Calculate composite score (similarity + popularity)
      const popularityScore = Math.log(stats.usage_count + 1) * 0.1;
      const ratingScore = (stats.rating_avg || 0) * 0.2;
      const compositeScore = agent.similarity + popularityScore + ratingScore;

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        tags: agent.tags,
        price_tier: agent.price_tier,
        created_by: agent.created_by,
        similarity_score: Math.round(agent.similarity * 100) / 100,
        composite_score: Math.round(compositeScore * 100) / 100,
        usage_count: stats.usage_count,
        rating_avg: Math.round((stats.rating_avg || 0) * 10) / 10,
        rating_count: stats.rating_count,
        avatar_url: agent.avatar_url,
        is_verified: agent.is_verified,
        created_at: agent.created_at,
      };
    });

    // Sort by composite score
    return enrichedResults.sort((a, b) => b.composite_score - a.composite_score);
  } catch (error) {
    console.error('Result enrichment error:', error);
    // Return basic results if enrichment fails
    return results.map(agent => ({
      ...agent,
      similarity_score: Math.round(agent.similarity * 100) / 100,
      composite_score: Math.round(agent.similarity * 100) / 100,
    }));
  }
}

// Log search analytics
async function logSearchAnalytics(
  query: string,
  userId: string | null,
  resultCount: number,
  searchTime: number
) {
  try {
    await supabase
      .from('user_search_history')
      .insert({
        user_id: userId,
        search_query: query,
        result_count: resultCount,
        search_time_ms: searchTime,
        search_type: 'semantic',
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Search analytics error:', error);
    // Don't throw - analytics failure shouldn't break search
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success, pending, limit, reset, remaining } = await limiter.check(
      10, // 10 requests per minute
      identifier
    );

    if (!success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          limit,
          remaining,
          reset: new Date(reset)
        },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = searchRequestSchema.parse(body);
    const { query, limit, threshold, category, tags } = validatedData;

    // Get user ID from auth header (optional)
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { data: { user } } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        userId = user?.id || null;
      } catch (error) {
        // Continue without user ID if auth fails
      }
    }

    // Check cache first
    const cacheKey = `semantic_search:${JSON.stringify({ query, limit, threshold, category, tags })}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const results = JSON.parse(cached);
      
      // Still log analytics for cached results
      await logSearchAnalytics(
        query,
        userId,
        results.agents.length,
        Date.now() - startTime
      );

      return NextResponse.json({
        ...results,
        cached: true,
        search_time_ms: Date.now() - startTime,
      });
    }

    // Preprocess query
    const processedQuery = preprocessQuery(query);

    // Generate embedding
    const queryEmbedding = await generateQueryEmbedding(processedQuery);

    // Perform vector search
    const searchResults = await performVectorSearch(
      queryEmbedding,
      limit,
      threshold,
      category,
      tags
    );

    // Rank and enrich results
    const rankedResults = await rankAndEnrichResults(searchResults);

    // Prepare response
    const response = {
      query: query,
      processed_query: processedQuery,
      total_results: rankedResults.length,
      agents: rankedResults,
      search_time_ms: Date.now() - startTime,
      threshold_used: threshold,
      cached: false,
    };

    // Cache results for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(response));

    // Log analytics
    await logSearchAnalytics(
      query,
      userId,
      rankedResults.length,
      Date.now() - startTime
    );

    return NextResponse.json(response);

  } catch (error) {
    console.error('Semantic search error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        search_time_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    // Test OpenAI connection
    await openai.models.list();
    
    // Test Supabase connection
    const { error } = await supabase.from('marketplace_agents').select('count').limit(1);
    if (error) throw error;

    // Test Redis connection
    await redis.ping();

    return NextResponse.json({
      status: 'healthy',
      services: {
        openai: 'connected',
        supabase: 'connected',
        redis: 'connected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```