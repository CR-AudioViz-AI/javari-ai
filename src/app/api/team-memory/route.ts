```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { z } from 'zod';
import { ratelimit } from '@/lib/redis';

// Validation schemas
const createMemorySchema = z.object({
  team_id: z.string().uuid(),
  content: z.string().min(1).max(10000),
  context: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

const retrieveMemorySchema = z.object({
  team_id: z.string().uuid(),
  context: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(10),
  similarity_threshold: z.coerce.number().min(0).max(1).default(0.7),
  tags: z.string().optional().transform(val => val ? val.split(',') : undefined),
});

const consolidateMemorySchema = z.object({
  team_id: z.string().uuid(),
  memory_ids: z.array(z.string().uuid()),
  strategy: z.enum(['merge', 'hierarchical', 'temporal']).default('merge'),
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Team Memory Service
class TeamMemoryService {
  private supabase;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async createMemory(data: z.infer<typeof createMemorySchema>, userId: string) {
    try {
      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(data.content);
      
      // Create memory entry
      const { data: memory, error } = await this.supabase
        .from('team_memories')
        .insert({
          team_id: data.team_id,
          content: data.content,
          context: data.context,
          tags: data.tags || [],
          metadata: data.metadata || {},
          priority: data.priority,
          embedding,
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Build knowledge graph connections
      await this.buildKnowledgeConnections(memory.id, memory.content, memory.team_id);

      return memory;
    } catch (error) {
      console.error('Error creating memory:', error);
      throw new Error('Failed to create team memory');
    }
  }

  async retrieveMemories(params: z.infer<typeof retrieveMemorySchema>) {
    try {
      let query = this.supabase
        .from('team_memories')
        .select(`
          *,
          created_by_profile:profiles!team_memories_created_by_fkey(id, email, full_name),
          memory_connections:memory_edges!memory_edges_source_id_fkey(
            target_id,
            relationship_type,
            strength,
            target:team_memories!memory_edges_target_id_fkey(id, content, context)
          )
        `)
        .eq('team_id', params.team_id)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      // Apply tag filtering
      if (params.tags && params.tags.length > 0) {
        query = query.overlaps('tags', params.tags);
      }

      let memories;
      
      if (params.context) {
        // Semantic search using context
        const contextEmbedding = await this.generateEmbedding(params.context);
        
        const { data, error } = await query
          .rpc('match_team_memories', {
            query_embedding: contextEmbedding,
            match_threshold: params.similarity_threshold,
            match_count: params.limit,
            team_id_param: params.team_id
          });

        if (error) throw error;
        memories = data;
      } else {
        // Standard retrieval
        const { data, error } = await query.limit(params.limit);
        if (error) throw error;
        memories = data;
      }

      return memories;
    } catch (error) {
      console.error('Error retrieving memories:', error);
      throw new Error('Failed to retrieve team memories');
    }
  }

  async consolidateMemories(data: z.infer<typeof consolidateMemorySchema>, userId: string) {
    try {
      // Retrieve memories to consolidate
      const { data: memories, error } = await this.supabase
        .from('team_memories')
        .select('*')
        .in('id', data.memory_ids)
        .eq('team_id', data.team_id);

      if (error) throw error;

      if (!memories || memories.length < 2) {
        throw new Error('At least 2 memories required for consolidation');
      }

      // Apply consolidation strategy
      const consolidatedMemory = await this.applyConsolidationStrategy(
        memories,
        data.strategy,
        userId
      );

      // Update knowledge graph
      await this.updateKnowledgeGraphForConsolidation(
        data.memory_ids,
        consolidatedMemory.id,
        data.team_id
      );

      return consolidatedMemory;
    } catch (error) {
      console.error('Error consolidating memories:', error);
      throw new Error('Failed to consolidate memories');
    }
  }

  async getKnowledgeGraph(teamId: string) {
    try {
      const { data: nodes, error: nodesError } = await this.supabase
        .from('team_memories')
        .select('id, content, context, tags, priority, created_at')
        .eq('team_id', teamId)
        .eq('deleted', false);

      if (nodesError) throw nodesError;

      const { data: edges, error: edgesError } = await this.supabase
        .from('memory_edges')
        .select('source_id, target_id, relationship_type, strength')
        .in('source_id', nodes.map(n => n.id));

      if (edgesError) throw edgesError;

      return {
        nodes: nodes.map(node => ({
          id: node.id,
          label: this.extractMemoryLabel(node.content),
          content: node.content,
          context: node.context,
          tags: node.tags,
          priority: node.priority,
          created_at: node.created_at,
        })),
        edges: edges.map(edge => ({
          source: edge.source_id,
          target: edge.target_id,
          type: edge.relationship_type,
          weight: edge.strength,
        })),
      };
    } catch (error) {
      console.error('Error getting knowledge graph:', error);
      throw new Error('Failed to retrieve knowledge graph');
    }
  }

  async softDeleteMemory(memoryId: string, teamId: string, userId: string) {
    try {
      const { error } = await this.supabase
        .from('team_memories')
        .update({
          deleted: true,
          deleted_by: userId,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .eq('team_id', teamId);

      if (error) throw error;

      // Update knowledge graph connections
      await this.supabase
        .from('memory_edges')
        .update({ active: false })
        .or(`source_id.eq.${memoryId},target_id.eq.${memoryId}`);

      return { success: true };
    } catch (error) {
      console.error('Error deleting memory:', error);
      throw new Error('Failed to delete memory');
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  }

  private async buildKnowledgeConnections(memoryId: string, content: string, teamId: string) {
    try {
      // Find semantically similar memories
      const embedding = await this.generateEmbedding(content);
      
      const { data: similarMemories } = await this.supabase
        .rpc('match_team_memories', {
          query_embedding: embedding,
          match_threshold: 0.8,
          match_count: 5,
          team_id_param: teamId
        });

      if (similarMemories && similarMemories.length > 0) {
        const connections = similarMemories
          .filter((mem: any) => mem.id !== memoryId)
          .map((mem: any) => ({
            source_id: memoryId,
            target_id: mem.id,
            relationship_type: 'semantic_similarity',
            strength: mem.similarity,
            created_at: new Date().toISOString(),
          }));

        if (connections.length > 0) {
          await this.supabase.from('memory_edges').insert(connections);
        }
      }
    } catch (error) {
      console.error('Error building knowledge connections:', error);
    }
  }

  private async applyConsolidationStrategy(
    memories: any[],
    strategy: string,
    userId: string
  ) {
    let consolidatedContent: string;
    let consolidatedContext: string | null = null;
    let consolidatedTags: string[] = [];
    let consolidatedMetadata: any = {};

    switch (strategy) {
      case 'merge':
        consolidatedContent = memories.map(m => m.content).join('\n\n---\n\n');
        consolidatedTags = [...new Set(memories.flatMap(m => m.tags || []))];
        break;

      case 'hierarchical':
        const primaryMemory = memories.reduce((prev, current) =>
          prev.priority === 'high' ? prev : current
        );
        consolidatedContent = `Primary: ${primaryMemory.content}\n\nRelated:\n${
          memories.filter(m => m.id !== primaryMemory.id)
            .map(m => `- ${m.content}`)
            .join('\n')
        }`;
        break;

      case 'temporal':
        const sortedMemories = memories.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        consolidatedContent = sortedMemories
          .map((m, i) => `[${i + 1}] ${m.content}`)
          .join('\n\n');
        break;

      default:
        consolidatedContent = memories.map(m => m.content).join('\n\n');
    }

    // Create consolidated memory
    const embedding = await this.generateEmbedding(consolidatedContent);
    
    const { data: consolidatedMemory, error } = await this.supabase
      .from('team_memories')
      .insert({
        team_id: memories[0].team_id,
        content: consolidatedContent,
        context: consolidatedContext,
        tags: consolidatedTags,
        metadata: {
          ...consolidatedMetadata,
          consolidation: {
            strategy,
            source_memories: memories.map(m => m.id),
            consolidated_at: new Date().toISOString(),
            consolidated_by: userId,
          },
        },
        priority: 'high',
        embedding,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Soft delete original memories
    await this.supabase
      .from('team_memories')
      .update({
        deleted: true,
        deleted_by: userId,
        deleted_at: new Date().toISOString(),
        consolidated_into: consolidatedMemory.id,
      })
      .in('id', memories.map(m => m.id));

    return consolidatedMemory;
  }

  private async updateKnowledgeGraphForConsolidation(
    originalMemoryIds: string[],
    consolidatedMemoryId: string,
    teamId: string
  ) {
    try {
      // Get all edges involving original memories
      const { data: edges } = await this.supabase
        .from('memory_edges')
        .select('*')
        .or(
          originalMemoryIds
            .map(id => `source_id.eq.${id},target_id.eq.${id}`)
            .join(',')
        );

      if (edges && edges.length > 0) {
        // Create new edges for consolidated memory
        const newEdges = edges
          .filter(edge => !originalMemoryIds.includes(edge.target_id) || 
                         !originalMemoryIds.includes(edge.source_id))
          .map(edge => ({
            source_id: originalMemoryIds.includes(edge.source_id) 
              ? consolidatedMemoryId : edge.source_id,
            target_id: originalMemoryIds.includes(edge.target_id) 
              ? consolidatedMemoryId : edge.target_id,
            relationship_type: edge.relationship_type,
            strength: edge.strength,
            created_at: new Date().toISOString(),
          }));

        // Remove duplicate edges
        const uniqueEdges = newEdges.filter((edge, index, self) =>
          index === self.findIndex(e => 
            e.source_id === edge.source_id && e.target_id === edge.target_id
          )
        );

        if (uniqueEdges.length > 0) {
          await this.supabase.from('memory_edges').insert(uniqueEdges);
        }

        // Deactivate old edges
        await this.supabase
          .from('memory_edges')
          .update({ active: false })
          .or(
            originalMemoryIds
              .map(id => `source_id.eq.${id},target_id.eq.${id}`)
              .join(',')
          );
      }
    } catch (error) {
      console.error('Error updating knowledge graph:', error);
    }
  }

  private extractMemoryLabel(content: string): string {
    // Extract first sentence or first 50 characters as label
    const firstSentence = content.match(/^[^.!?]*[.!?]/);
    return firstSentence ? 
      firstSentence[0].trim() : 
      content.slice(0, 50) + (content.length > 50 ? '...' : '');
  }
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await ratelimit.limit(identifier);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createMemorySchema.parse(body);

    // Authorization - check team membership
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', validatedData.team_id)
      .eq('user_id', session.user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to team' },
        { status: 403 }
      );
    }

    const memoryService = new TeamMemoryService(supabase);
    const memory = await memoryService.createMemory(validatedData, session.user.id);

    return NextResponse.json({
      success: true,
      data: memory,
    });
  } catch (error) {
    console.error('POST /api/team-memory error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const params = Object.fromEntries(searchParams.entries());
    
    // Handle knowledge graph request
    if (params.graph === 'true') {
      const teamId = params.team_id;
      if (!teamId) {
        return NextResponse.json(
          { error: 'team_id required for knowledge graph' },
          { status: 400 }
        );
      }

      // Check team access
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', session.user.id)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: 'Access denied to team' },
          { status: 403 }
        );
      }

      const memoryService = new TeamMemoryService(supabase);
      const knowledgeGraph = await memoryService.getKnowledgeGraph(teamId);

      return NextResponse.json({
        success: true,
        data: knowledgeGraph,
      });
    }

    // Regular memory retrieval
    const validatedParams = retrieveMemorySchema.parse(params);

    // Authorization - check team membership
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', validatedParams.team_id)
      .eq('user_id', session.user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to team' },
        { status: 403 }
      );
    }

    const memoryService = new TeamMemoryService(supabase);
    const memories = await memoryService.retrieveMemories(validatedParams);

    return NextResponse.json({
      success: true,
      data: memories,
    });
  } catch (error) {
    console.error('GET /api/team-memory error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = consolidateMemorySchema.parse(body);

    // Authorization - check team membership and admin/owner role
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', validatedData.team_id)
      .eq('user_id', session.user.id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions for memory consolidation' },
        { status: 403 }
      );
    }

    const memoryService = new TeamMemoryService(supabase);
    const consolidatedMemory = await memoryService.consolidateMemories(
      validatedData, 
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: consolidatedMemory,
    });
  } catch (error) {
    console.error('PUT /api/team-memory error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
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
    const supabase = createRouteHandlerClient({ cookies });
    
    // Authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const memoryId = searchParams.get('id');
    const teamId = searchParams.get('team_id');

    if (!memoryId || !teamId) {
      return NextResponse.json(
        { error: 'Memory ID and team ID required' },
        { status: 400 }
      );
    }

    // Authorization - check if user can delete (owner of memory or team admin/owner)
    const { data: memory } = await supabase
      .from('team_memories')
      .select('created_by')
      .eq('id', memoryId)
      .eq('team_id', teamId)
      .single();

    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', session.user.id)
      .single();

    const canDelete = memory.created_by === session.user.id || 
                     (membership && ['admin', 'owner'].includes(membership.role));

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete this memory' },
        { status: 403 }
      );
    }

    const memoryService = new TeamMemoryService(supabase);
    const result = await memoryService.softDelete