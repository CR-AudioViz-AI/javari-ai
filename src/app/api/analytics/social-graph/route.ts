```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/auth';

// Redis client for caching
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Request validation schema
const querySchema = z.object({
  analysis_type: z.enum(['influence', 'communities', 'relationships', 'full']).default('full'),
  user_ids: z.string().optional(),
  time_range: z.enum(['24h', '7d', '30d', '90d', '1y']).default('30d'),
  min_interactions: z.string().transform(Number).default('5'),
  include_visualization: z.string().transform(Boolean).default(false),
  community_algorithm: z.enum(['modularity', 'leiden', 'louvain']).default('modularity'),
  max_nodes: z.string().transform(Number).default('1000'),
});

interface GraphNode {
  id: string;
  label: string;
  weight: number;
  properties: {
    user_id: string;
    username: string;
    avatar_url?: string;
    join_date: string;
    total_interactions: number;
    influence_score: number;
    betweenness_centrality: number;
    closeness_centrality: number;
    degree_centrality: number;
    page_rank: number;
    community_id?: string;
  };
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  properties: {
    interaction_count: number;
    interaction_types: string[];
    relationship_strength: number;
    last_interaction: string;
    reciprocity_score: number;
  };
}

interface Community {
  id: string;
  nodes: string[];
  size: number;
  density: number;
  modularity: number;
  central_node: string;
  influence_score: number;
  cohesion_score: number;
  topics: string[];
}

interface SocialGraphAnalytics {
  metadata: {
    analysis_type: string;
    time_range: string;
    node_count: number;
    edge_count: number;
    computation_time: number;
    cache_status: 'hit' | 'miss' | 'partial';
  };
  network_metrics: {
    density: number;
    clustering_coefficient: number;
    average_path_length: number;
    diameter: number;
    assortativity: number;
    small_world_coefficient: number;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities?: Community[];
  influence_ranking?: {
    user_id: string;
    username: string;
    influence_score: number;
    rank: number;
    influence_factors: {
      content_quality: number;
      engagement_rate: number;
      network_position: number;
      reach: number;
    };
  }[];
  relationship_insights?: {
    strongest_connections: Array<{
      user1: string;
      user2: string;
      strength: number;
      interaction_types: string[];
    }>;
    bridge_users: Array<{
      user_id: string;
      bridge_score: number;
      communities_connected: string[];
    }>;
    isolated_users: string[];
  };
  visualization_data?: {
    layout: 'force' | 'circular' | 'hierarchical';
    positions: Record<string, { x: number; y: number }>;
    zoom_levels: Array<{ level: number; visible_nodes: string[] }>;
    color_scheme: Record<string, string>;
  };
}

class SocialGraphAnalyzer {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();

  async buildGraph(userInteractions: any[], timeRangeDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRangeDays);

    // Build nodes from users
    const userMap = new Map();
    for (const interaction of userInteractions) {
      if (!userMap.has(interaction.user_id)) {
        userMap.set(interaction.user_id, {
          user_id: interaction.user_id,
          username: interaction.username,
          avatar_url: interaction.avatar_url,
          join_date: interaction.join_date,
          interactions: []
        });
      }
      userMap.get(interaction.user_id).interactions.push(interaction);
    }

    // Create nodes
    for (const [userId, userData] of userMap) {
      const node: GraphNode = {
        id: userId,
        label: userData.username,
        weight: userData.interactions.length,
        properties: {
          user_id: userId,
          username: userData.username,
          avatar_url: userData.avatar_url,
          join_date: userData.join_date,
          total_interactions: userData.interactions.length,
          influence_score: 0,
          betweenness_centrality: 0,
          closeness_centrality: 0,
          degree_centrality: 0,
          page_rank: 0
        }
      };
      this.nodes.set(userId, node);
      this.adjacencyList.set(userId, new Set());
    }

    // Build edges from interactions
    const edgeMap = new Map();
    for (const interaction of userInteractions) {
      if (new Date(interaction.created_at) < cutoffDate) continue;

      const key = [interaction.user_id, interaction.target_user_id].sort().join('-');
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          users: [interaction.user_id, interaction.target_user_id],
          interactions: [],
          types: new Set()
        });
      }
      
      const edgeData = edgeMap.get(key);
      edgeData.interactions.push(interaction);
      edgeData.types.add(interaction.interaction_type);
    }

    // Create edges
    for (const [key, edgeData] of edgeMap) {
      const [source, target] = edgeData.users;
      if (source === target) continue;

      const weight = this.calculateInteractionWeight(edgeData.interactions);
      const edge: GraphEdge = {
        source,
        target,
        weight,
        properties: {
          interaction_count: edgeData.interactions.length,
          interaction_types: Array.from(edgeData.types),
          relationship_strength: weight,
          last_interaction: Math.max(...edgeData.interactions.map(i => new Date(i.created_at).getTime())).toString(),
          reciprocity_score: this.calculateReciprocity(edgeData.interactions)
        }
      };

      this.edges.set(key, edge);
      this.adjacencyList.get(source)?.add(target);
      this.adjacencyList.get(target)?.add(source);
    }
  }

  private calculateInteractionWeight(interactions: any[]): number {
    const weights = {
      'like': 1,
      'comment': 3,
      'share': 5,
      'mention': 4,
      'reply': 2,
      'follow': 6,
      'collaboration': 10
    };

    let totalWeight = 0;
    const now = Date.now();
    
    for (const interaction of interactions) {
      const baseWeight = weights[interaction.interaction_type] || 1;
      const daysSince = (now - new Date(interaction.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const timeDecay = Math.exp(-daysSince / 30); // Exponential decay over 30 days
      totalWeight += baseWeight * timeDecay;
    }

    return totalWeight;
  }

  private calculateReciprocity(interactions: any[]): number {
    const userInteractions = new Map();
    
    for (const interaction of interactions) {
      const key = `${interaction.user_id}->${interaction.target_user_id}`;
      userInteractions.set(key, (userInteractions.get(key) || 0) + 1);
    }

    const pairs = Array.from(userInteractions.keys()).map(key => {
      const [from, to] = key.split('->');
      const reverse = `${to}->${from}`;
      return {
        forward: userInteractions.get(key) || 0,
        backward: userInteractions.get(reverse) || 0
      };
    });

    if (pairs.length === 0) return 0;

    const reciprocalPairs = pairs.filter(p => p.forward > 0 && p.backward > 0);
    return reciprocalPairs.length / pairs.length;
  }

  calculateCentralityMeasures(): void {
    this.calculateDegreeCentrality();
    this.calculateBetweennessCentrality();
    this.calculateClosenessCentrality();
    this.calculatePageRank();
  }

  private calculateDegreeCentrality(): void {
    const nodeCount = this.nodes.size;
    
    for (const [nodeId, node] of this.nodes) {
      const degree = this.adjacencyList.get(nodeId)?.size || 0;
      node.properties.degree_centrality = nodeCount > 1 ? degree / (nodeCount - 1) : 0;
    }
  }

  private calculateBetweennessCentrality(): void {
    const nodeIds = Array.from(this.nodes.keys());
    const betweenness = new Map();
    
    // Initialize
    for (const nodeId of nodeIds) {
      betweenness.set(nodeId, 0);
    }

    // Brandes algorithm (simplified)
    for (const source of nodeIds) {
      const stack: string[] = [];
      const paths = new Map();
      const sigma = new Map();
      const distance = new Map();
      const delta = new Map();
      const predecessors = new Map();

      // Initialize
      for (const nodeId of nodeIds) {
        paths.set(nodeId, []);
        sigma.set(nodeId, 0);
        distance.set(nodeId, -1);
        delta.set(nodeId, 0);
        predecessors.set(nodeId, []);
      }

      sigma.set(source, 1);
      distance.set(source, 0);

      const queue = [source];
      
      // BFS
      while (queue.length > 0) {
        const current = queue.shift()!;
        stack.push(current);
        
        const neighbors = this.adjacencyList.get(current) || new Set();
        for (const neighbor of neighbors) {
          if (distance.get(neighbor) < 0) {
            queue.push(neighbor);
            distance.set(neighbor, distance.get(current) + 1);
          }
          
          if (distance.get(neighbor) === distance.get(current) + 1) {
            sigma.set(neighbor, sigma.get(neighbor) + sigma.get(current));
            predecessors.get(neighbor).push(current);
          }
        }
      }

      // Accumulation
      while (stack.length > 0) {
        const w = stack.pop()!;
        const preds = predecessors.get(w);
        
        for (const pred of preds) {
          const contribution = (sigma.get(pred) / sigma.get(w)) * (1 + delta.get(w));
          delta.set(pred, delta.get(pred) + contribution);
        }
        
        if (w !== source) {
          betweenness.set(w, betweenness.get(w) + delta.get(w));
        }
      }
    }

    // Normalize
    const n = nodeIds.length;
    const normFactor = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1;
    
    for (const [nodeId, node] of this.nodes) {
      node.properties.betweenness_centrality = (betweenness.get(nodeId) || 0) * normFactor;
    }
  }

  private calculateClosenessCentrality(): void {
    for (const [sourceId] of this.nodes) {
      const distances = this.dijkstra(sourceId);
      const validDistances = Array.from(distances.values()).filter(d => d > 0 && d < Infinity);
      
      if (validDistances.length === 0) {
        this.nodes.get(sourceId)!.properties.closeness_centrality = 0;
        continue;
      }

      const totalDistance = validDistances.reduce((sum, d) => sum + d, 0);
      const closeness = validDistances.length / totalDistance;
      
      this.nodes.get(sourceId)!.properties.closeness_centrality = closeness;
    }
  }

  private dijkstra(source: string): Map<string, number> {
    const distances = new Map();
    const visited = new Set();
    const queue = [{ node: source, distance: 0 }];

    // Initialize distances
    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, nodeId === source ? 0 : Infinity);
    }

    while (queue.length > 0) {
      queue.sort((a, b) => a.distance - b.distance);
      const { node: current, distance: currentDistance } = queue.shift()!;

      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = this.adjacencyList.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;

        const edgeWeight = 1; // Unweighted for closeness centrality
        const newDistance = currentDistance + edgeWeight;

        if (newDistance < distances.get(neighbor)) {
          distances.set(neighbor, newDistance);
          queue.push({ node: neighbor, distance: newDistance });
        }
      }
    }

    return distances;
  }

  private calculatePageRank(dampingFactor = 0.85, maxIterations = 100, tolerance = 1e-6): void {
    const nodeIds = Array.from(this.nodes.keys());
    const nodeCount = nodeIds.length;
    
    if (nodeCount === 0) return;

    let pageRank = new Map();
    let newPageRank = new Map();

    // Initialize
    for (const nodeId of nodeIds) {
      pageRank.set(nodeId, 1 / nodeCount);
    }

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Calculate new PageRank values
      for (const nodeId of nodeIds) {
        newPageRank.set(nodeId, (1 - dampingFactor) / nodeCount);
      }

      for (const nodeId of nodeIds) {
        const neighbors = this.adjacencyList.get(nodeId) || new Set();
        const outDegree = neighbors.size;
        
        if (outDegree > 0) {
          const contribution = dampingFactor * pageRank.get(nodeId) / outDegree;
          
          for (const neighbor of neighbors) {
            newPageRank.set(neighbor, newPageRank.get(neighbor) + contribution);
          }
        }
      }

      // Check for convergence
      let maxDiff = 0;
      for (const nodeId of nodeIds) {
        const diff = Math.abs(newPageRank.get(nodeId) - pageRank.get(nodeId));
        maxDiff = Math.max(maxDiff, diff);
      }

      pageRank = new Map(newPageRank);

      if (maxDiff < tolerance) break;
    }

    // Update nodes with PageRank values
    for (const [nodeId, node] of this.nodes) {
      node.properties.page_rank = pageRank.get(nodeId) || 0;
    }
  }

  detectCommunities(algorithm = 'modularity'): Community[] {
    switch (algorithm) {
      case 'leiden':
        return this.leidenAlgorithm();
      case 'louvain':
        return this.louvainAlgorithm();
      default:
        return this.modularityOptimization();
    }
  }

  private modularityOptimization(): Community[] {
    const communities = new Map<string, Set<string>>();
    const nodeCommunity = new Map<string, string>();
    
    // Initialize each node as its own community
    for (const nodeId of this.nodes.keys()) {
      const communityId = `comm_${nodeId}`;
      communities.set(communityId, new Set([nodeId]));
      nodeCommunity.set(nodeId, communityId);
    }

    let improved = true;
    let iteration = 0;
    const maxIterations = 50;

    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;

      for (const nodeId of this.nodes.keys()) {
        const currentCommunity = nodeCommunity.get(nodeId)!;
        let bestCommunity = currentCommunity;
        let bestModularityGain = 0;

        // Try moving node to neighboring communities
        const neighbors = this.adjacencyList.get(nodeId) || new Set();
        const neighborCommunities = new Set<string>();
        
        for (const neighbor of neighbors) {
          neighborCommunities.add(nodeCommunity.get(neighbor)!);
        }

        for (const targetCommunity of neighborCommunities) {
          if (targetCommunity === currentCommunity) continue;

          const modularityGain = this.calculateModularityGain(nodeId, currentCommunity, targetCommunity);
          
          if (modularityGain > bestModularityGain) {
            bestModularityGain = modularityGain;
            bestCommunity = targetCommunity;
          }
        }

        // Move node if beneficial
        if (bestCommunity !== currentCommunity) {
          communities.get(currentCommunity)?.delete(nodeId);
          communities.get(bestCommunity)?.add(nodeId);
          nodeCommunity.set(nodeId, bestCommunity);
          improved = true;

          // Remove empty communities
          if (communities.get(currentCommunity)?.size === 0) {
            communities.delete(currentCommunity);
          }
        }
      }
    }

    // Convert to Community objects
    return Array.from(communities.entries()).map(([communityId, nodeSet], index) => {
      const nodes = Array.from(nodeSet);
      return this.createCommunity(`${index}`, nodes);
    });
  }

  private calculateModularityGain(nodeId: string, fromCommunity: string, toCommunity: string): number {
    // Simplified modularity gain calculation
    const neighbors = this.adjacencyList.get(nodeId) || new Set();
    const totalEdges = this.edges.size * 2; // Each edge counted twice
    
    let kIn = 0; // Edges from node to target community
    let kOut = 0; // Edges from node to source community
    let degreeNode = neighbors.size;

    for (const neighbor of neighbors) {
      const neighborCommunity = this.getNodeCommunity(neighbor, fromCommunity, toCommunity);
      
      if (neighborCommunity === toCommunity) {
        kIn++;
      } else if (neighborCommunity === fromCommunity) {
        kOut++;
      }
    }

    // Simplified modularity gain (actual calculation is more complex)
    return (kIn - kOut) / totalEdges - (degreeNode * degreeNode) / (totalEdges * totalEdges);
  }

  private getNodeCommunity(nodeId: string, fromCommunity: string, toCommunity: string): string {
    // Helper to determine node's community during modularity calculation
    // This is a simplified version
    return fromCommunity; // Placeholder
  }

  private leidenAlgorithm(): Community[] {
    // Simplified Leiden algorithm implementation
    return this.modularityOptimization(); // Fallback to modularity for now
  }

  private louvainAlgorithm(): Community[] {
    // Simplified Louvain algorithm implementation
    return this.modularityOptimization(); // Fallback to modularity for now
  }

  private createCommunity(id: string, nodeIds: string[]): Community {
    const communityNodes = nodeIds.map(id => this.nodes.get(id)!);
    const communityEdges = Array.from(this.edges.values()).filter(edge => 
      nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
    );

    const size = nodeIds.length;
    const possibleEdges = size * (size - 1) / 2;
    const density = possibleEdges > 0 ? communityEdges.length / possibleEdges : 0;

    // Find central node (highest degree within community)
    const centralNode = nodeIds.reduce((central, nodeId) => {
      const nodeConnections = communityEdges.filter(edge => 
        edge.source === nodeId || edge.target === nodeId
      ).length;
      
      const centralConnections = communityEdges.filter(edge => 
        edge.source === central || edge.target === central
      ).length;

      return nodeConnections > centralConnections ? nodeId : central;
    });

    const influenceScore = communityNodes.reduce((sum, node) => sum + node.properties.influence_score, 0) / size;
    const cohesionScore = density * (1 + influenceScore);

    return {
      id,
      nodes: nodeIds,
      size,
      density,
      modularity: this.calculateCommunityModularity(nodeIds),
      central_node: centralNode,
      influence_score: influenceScore,
      cohesion_score: cohesionScore,
      topics: [] // Would need content analysis to determine topics
    };
  }

  private calculateCommunityModularity(nodeIds: string[]): number {
    // Simplified modularity calculation for a community
    const communityEdges = Array.from(this.edges.values()).filter(edge => 
      nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
    );
    
    const totalEdges = this.edges.size;
    const expectedEdges = nodeIds.length * (nodeIds.length - 1) / (2 * this.nodes.size);
    
    return totalEdges > 0 ? (communityEdges.length - expectedEdges) / totalEdges : 0;
  }

  calculateInfluenceScores(): void {
    for (const [nodeId, node] of this.nodes) {
      const pageRank = node.properties.page_rank;