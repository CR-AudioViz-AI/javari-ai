import { supabase } from '../../lib/supabase';
import { GraphBuilder } from '../../lib/knowledge-graph/graph-builder';
import { SemanticAnalyzer } from '../../lib/knowledge-graph/semantic-analyzer';
import { RelationshipExtractor } from '../../lib/knowledge-graph/relationship-extractor';
import { EmbeddingGenerator } from '../../lib/knowledge-graph/embedding-generator';
import { DataSourceConnectors } from './data-source-connectors';
import { SemanticSearchService } from './semantic-search.service';
import { GraphAlgorithms } from '../../utils/graph-algorithms';
import { NLPProcessors } from '../../utils/nlp-processors';
import {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  EntityType,
  DataSource,
  SemanticQuery,
  GraphTraversalOptions,
  KnowledgeGraphConfig,
  RelationshipType,
  GraphAnalytics,
  GraphUpdateOperation,
  SemanticSearchResult,
  EntityExtractionResult,
  GraphVisualizationData,
  OntologyMapping,
  GraphMetrics,
  KnowledgeGraphError
} from '../../types/knowledge-graph.types';

/**
 * Enterprise Knowledge Graph Service
 * 
 * Provides comprehensive knowledge graph functionality including:
 * - Multi-source data ingestion and processing
 * - Entity extraction and relationship discovery
 * - Semantic search and graph traversal
 * - Knowledge graph analytics and visualization
 * - Real-time graph updates and maintenance
 */
export class KnowledgeGraphService {
  private graphBuilder: GraphBuilder;
  private semanticAnalyzer: SemanticAnalyzer;
  private relationshipExtractor: RelationshipExtractor;
  private embeddingGenerator: EmbeddingGenerator;
  private dataSourceConnectors: DataSourceConnectors;
  private semanticSearch: SemanticSearchService;
  private graphAlgorithms: GraphAlgorithms;
  private nlpProcessors: NLPProcessors;
  private config: KnowledgeGraphConfig;
  private activeGraphs: Map<string, KnowledgeGraph> = new Map();

  constructor(config: KnowledgeGraphConfig) {
    this.config = config;
    this.graphBuilder = new GraphBuilder(config.graphDatabase);
    this.semanticAnalyzer = new SemanticAnalyzer(config.nlpConfig);
    this.relationshipExtractor = new RelationshipExtractor(config.extractionConfig);
    this.embeddingGenerator = new EmbeddingGenerator(config.embeddingConfig);
    this.dataSourceConnectors = new DataSourceConnectors(config.dataSources);
    this.semanticSearch = new SemanticSearchService(config.searchConfig);
    this.graphAlgorithms = new GraphAlgorithms();
    this.nlpProcessors = new NLPProcessors(config.nlpConfig);
  }

  /**
   * Create a new knowledge graph from multiple data sources
   */
  async createKnowledgeGraph(
    graphId: string,
    dataSources: DataSource[],
    ontologyMappings?: OntologyMapping[]
  ): Promise<KnowledgeGraph> {
    try {
      console.log(`Creating knowledge graph: ${graphId}`);

      // Initialize graph structure
      const graph = await this.graphBuilder.createGraph(graphId, {
        ontologyMappings,
        entityTypes: this.config.entityTypes,
        relationshipTypes: this.config.relationshipTypes
      });

      // Process each data source
      const processingPromises = dataSources.map(async (source) => {
        return this.processDataSource(graphId, source);
      });

      const processingResults = await Promise.allSettled(processingPromises);
      
      // Aggregate successful results
      const successfulResults = processingResults
        .filter((result): result is PromiseFulfilledResult<EntityExtractionResult> => 
          result.status === 'fulfilled')
        .map(result => result.value);

      // Build graph relationships
      await this.buildGraphRelationships(graphId, successfulResults);

      // Generate embeddings for semantic search
      await this.generateGraphEmbeddings(graphId, graph);

      // Calculate initial analytics
      const analytics = await this.calculateGraphAnalytics(graphId);

      const finalGraph: KnowledgeGraph = {
        ...graph,
        analytics,
        lastUpdated: new Date(),
        status: 'active'
      };

      this.activeGraphs.set(graphId, finalGraph);

      // Store in Supabase
      await this.persistKnowledgeGraph(finalGraph);

      console.log(`Knowledge graph created successfully: ${graphId}`);
      return finalGraph;

    } catch (error) {
      console.error(`Failed to create knowledge graph ${graphId}:`, error);
      throw new KnowledgeGraphError(
        `Knowledge graph creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GRAPH_CREATION_ERROR',
        { graphId, dataSources }
      );
    }
  }

  /**
   * Process a single data source for entity extraction
   */
  private async processDataSource(
    graphId: string,
    dataSource: DataSource
  ): Promise<EntityExtractionResult> {
    try {
      console.log(`Processing data source: ${dataSource.type}`);

      // Connect to data source
      const connector = await this.dataSourceConnectors.getConnector(dataSource.type);
      const documents = await connector.extractDocuments(dataSource);

      // Process documents in batches
      const batchSize = this.config.processingBatchSize || 50;
      const batches = this.chunkArray(documents, batchSize);
      const allEntities: GraphNode[] = [];
      const allRelationships: GraphEdge[] = [];

      for (const batch of batches) {
        const batchPromises = batch.map(async (document) => {
          // Extract text content
          const textContent = await this.nlpProcessors.extractText(document);
          
          // Perform entity recognition
          const entities = await this.semanticAnalyzer.extractEntities(textContent);
          
          // Extract relationships
          const relationships = await this.relationshipExtractor.extractRelationships(
            textContent,
            entities
          );

          return { entities, relationships };
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Aggregate batch results
        batchResults.forEach(({ entities, relationships }) => {
          allEntities.push(...entities);
          allRelationships.push(...relationships);
        });
      }

      // Deduplicate entities and relationships
      const uniqueEntities = this.deduplicateEntities(allEntities);
      const uniqueRelationships = this.deduplicateRelationships(allRelationships);

      return {
        dataSource,
        entities: uniqueEntities,
        relationships: uniqueRelationships,
        processedAt: new Date(),
        documentCount: documents.length
      };

    } catch (error) {
      console.error(`Error processing data source ${dataSource.type}:`, error);
      throw error;
    }
  }

  /**
   * Build relationships between extracted entities
   */
  private async buildGraphRelationships(
    graphId: string,
    extractionResults: EntityExtractionResult[]
  ): Promise<void> {
    try {
      // Combine all entities and relationships
      const allEntities = extractionResults.flatMap(result => result.entities);
      const allRelationships = extractionResults.flatMap(result => result.relationships);

      // Add entities to graph
      for (const entity of allEntities) {
        await this.graphBuilder.addNode(graphId, entity);
      }

      // Add relationships to graph
      for (const relationship of allRelationships) {
        await this.graphBuilder.addEdge(graphId, relationship);
      }

      // Discover implicit relationships using graph algorithms
      const implicitRelationships = await this.discoverImplicitRelationships(
        graphId,
        allEntities
      );

      // Add implicit relationships
      for (const relationship of implicitRelationships) {
        await this.graphBuilder.addEdge(graphId, relationship);
      }

      console.log(`Built graph with ${allEntities.length} entities and ${allRelationships.length + implicitRelationships.length} relationships`);

    } catch (error) {
      console.error('Error building graph relationships:', error);
      throw error;
    }
  }

  /**
   * Discover implicit relationships using graph algorithms
   */
  private async discoverImplicitRelationships(
    graphId: string,
    entities: GraphNode[]
  ): Promise<GraphEdge[]> {
    try {
      const implicitRelationships: GraphEdge[] = [];

      // Group entities by type for relationship discovery
      const entityGroups = this.groupEntitiesByType(entities);

      // Apply relationship discovery algorithms
      for (const [entityType, entityGroup] of entityGroups) {
        // Discover co-occurrence relationships
        const coOccurrenceRels = await this.findCoOccurrenceRelationships(entityGroup);
        implicitRelationships.push(...coOccurrenceRels);

        // Discover semantic similarity relationships
        const semanticSimilarityRels = await this.findSemanticSimilarityRelationships(entityGroup);
        implicitRelationships.push(...semanticSimilarityRels);

        // Discover hierarchical relationships
        const hierarchicalRels = await this.findHierarchicalRelationships(entityGroup);
        implicitRelationships.push(...hierarchicalRels);
      }

      return implicitRelationships;

    } catch (error) {
      console.error('Error discovering implicit relationships:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  private async generateGraphEmbeddings(
    graphId: string,
    graph: KnowledgeGraph
  ): Promise<void> {
    try {
      console.log(`Generating embeddings for graph: ${graphId}`);

      // Generate node embeddings
      for (const node of graph.nodes) {
        const embedding = await this.embeddingGenerator.generateNodeEmbedding(node);
        
        // Store embedding in Supabase vector store
        await supabase
          .from('knowledge_graph_embeddings')
          .upsert({
            graph_id: graphId,
            node_id: node.id,
            embedding,
            node_type: node.type,
            properties: node.properties,
            created_at: new Date().toISOString()
          });
      }

      // Generate relationship embeddings
      for (const edge of graph.edges) {
        const embedding = await this.embeddingGenerator.generateEdgeEmbedding(edge);
        
        await supabase
          .from('knowledge_graph_edge_embeddings')
          .upsert({
            graph_id: graphId,
            edge_id: edge.id,
            embedding,
            relationship_type: edge.type,
            source_id: edge.sourceId,
            target_id: edge.targetId,
            properties: edge.properties,
            created_at: new Date().toISOString()
          });
      }

      console.log(`Generated embeddings for ${graph.nodes.length} nodes and ${graph.edges.length} edges`);

    } catch (error) {
      console.error('Error generating graph embeddings:', error);
      throw error;
    }
  }

  /**
   * Perform semantic search across the knowledge graph
   */
  async semanticSearch(
    graphId: string,
    query: SemanticQuery
  ): Promise<SemanticSearchResult[]> {
    try {
      console.log(`Performing semantic search on graph: ${graphId}`);

      // Generate query embedding
      const queryEmbedding = await this.embeddingGenerator.generateQueryEmbedding(query.text);

      // Search for similar nodes
      const { data: nodeResults } = await supabase.rpc('match_knowledge_graph_nodes', {
        graph_id: graphId,
        query_embedding: queryEmbedding,
        match_threshold: query.similarity_threshold || 0.7,
        match_count: query.limit || 20
      });

      // Search for similar relationships
      const { data: edgeResults } = await supabase.rpc('match_knowledge_graph_edges', {
        graph_id: graphId,
        query_embedding: queryEmbedding,
        match_threshold: query.similarity_threshold || 0.7,
        match_count: query.limit || 20
      });

      // Combine and rank results
      const combinedResults = await this.combineSearchResults(
        nodeResults || [],
        edgeResults || [],
        query
      );

      // Apply graph traversal for expanded results
      if (query.expand_results) {
        const expandedResults = await this.expandSearchResults(
          graphId,
          combinedResults,
          query.traversal_options
        );
        return expandedResults;
      }

      return combinedResults;

    } catch (error) {
      console.error(`Error in semantic search for graph ${graphId}:`, error);
      throw new KnowledgeGraphError(
        `Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEARCH_ERROR',
        { graphId, query }
      );
    }
  }

  /**
   * Traverse the knowledge graph following relationships
   */
  async traverseGraph(
    graphId: string,
    startNodeId: string,
    options: GraphTraversalOptions
  ): Promise<GraphNode[]> {
    try {
      console.log(`Traversing graph ${graphId} from node ${startNodeId}`);

      const graph = await this.getKnowledgeGraph(graphId);
      if (!graph) {
        throw new Error(`Knowledge graph not found: ${graphId}`);
      }

      // Use graph algorithms for traversal
      const traversalResult = await this.graphAlgorithms.traverse(
        graph,
        startNodeId,
        options
      );

      return traversalResult.nodes;

    } catch (error) {
      console.error(`Error traversing graph ${graphId}:`, error);
      throw new KnowledgeGraphError(
        `Graph traversal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRAVERSAL_ERROR',
        { graphId, startNodeId, options }
      );
    }
  }

  /**
   * Update the knowledge graph with new data
   */
  async updateKnowledgeGraph(
    graphId: string,
    operations: GraphUpdateOperation[]
  ): Promise<void> {
    try {
      console.log(`Updating knowledge graph: ${graphId}`);

      const graph = this.activeGraphs.get(graphId);
      if (!graph) {
        throw new Error(`Knowledge graph not found: ${graphId}`);
      }

      // Process update operations
      for (const operation of operations) {
        switch (operation.type) {
          case 'ADD_NODE':
            await this.graphBuilder.addNode(graphId, operation.node!);
            break;
          case 'UPDATE_NODE':
            await this.graphBuilder.updateNode(graphId, operation.node!);
            break;
          case 'DELETE_NODE':
            await this.graphBuilder.deleteNode(graphId, operation.nodeId!);
            break;
          case 'ADD_EDGE':
            await this.graphBuilder.addEdge(graphId, operation.edge!);
            break;
          case 'UPDATE_EDGE':
            await this.graphBuilder.updateEdge(graphId, operation.edge!);
            break;
          case 'DELETE_EDGE':
            await this.graphBuilder.deleteEdge(graphId, operation.edgeId!);
            break;
        }
      }

      // Regenerate embeddings for affected nodes/edges
      await this.regenerateEmbeddings(graphId, operations);

      // Update analytics
      const analytics = await this.calculateGraphAnalytics(graphId);
      graph.analytics = analytics;
      graph.lastUpdated = new Date();

      // Persist changes
      await this.persistKnowledgeGraph(graph);

      console.log(`Knowledge graph updated: ${graphId}`);

    } catch (error) {
      console.error(`Error updating knowledge graph ${graphId}:`, error);
      throw new KnowledgeGraphError(
        `Knowledge graph update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPDATE_ERROR',
        { graphId, operations }
      );
    }
  }

  /**
   * Calculate analytics for the knowledge graph
   */
  async calculateGraphAnalytics(graphId: string): Promise<GraphAnalytics> {
    try {
      const graph = await this.getKnowledgeGraph(graphId);
      if (!graph) {
        throw new Error(`Knowledge graph not found: ${graphId}`);
      }

      const metrics = await this.graphAlgorithms.calculateMetrics(graph);

      return {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        entityTypeDistribution: this.calculateEntityTypeDistribution(graph.nodes),
        relationshipTypeDistribution: this.calculateRelationshipTypeDistribution(graph.edges),
        centralityMeasures: metrics.centrality,
        clusteringCoefficient: metrics.clustering,
        graphDensity: metrics.density,
        connectedComponents: metrics.components,
        averagePathLength: metrics.averagePathLength,
        calculatedAt: new Date()
      };

    } catch (error) {
      console.error(`Error calculating graph analytics for ${graphId}:`, error);
      throw error;
    }
  }

  /**
   * Get visualization data for the knowledge graph
   */
  async getVisualizationData(
    graphId: string,
    options?: {
      maxNodes?: number;
      maxEdges?: number;
      entityTypes?: EntityType[];
      relationshipTypes?: RelationshipType[];
    }
  ): Promise<GraphVisualizationData> {
    try {
      const graph = await this.getKnowledgeGraph(graphId);
      if (!graph) {
        throw new Error(`Knowledge graph not found: ${graphId}`);
      }

      // Filter nodes and edges based on options
      let filteredNodes = graph.nodes;
      let filteredEdges = graph.edges;

      if (options?.entityTypes) {
        filteredNodes = filteredNodes.filter(node => 
          options.entityTypes!.includes(node.type as EntityType)
        );
      }

      if (options?.relationshipTypes) {
        filteredEdges = filteredEdges.filter(edge => 
          options.relationshipTypes!.includes(edge.type as RelationshipType)
        );
      }

      // Limit nodes and edges if specified
      if (options?.maxNodes && filteredNodes.length > options.maxNodes) {
        // Prioritize high-centrality nodes
        const analytics = graph.analytics;
        if (analytics?.centralityMeasures) {
          filteredNodes = filteredNodes
            .sort((a, b) => 
              (analytics.centralityMeasures[b.id] || 0) - (analytics.centralityMeasures[a.id] || 0)
            )
            .slice(0, options.maxNodes);
        } else {
          filteredNodes = filteredNodes.slice(0, options.maxNodes);
        }
      }

      if (options?.maxEdges && filteredEdges.length > options.maxEdges) {
        filteredEdges = filteredEdges.slice(0, options.maxEdges);
      }

      // Calculate layout coordinates
      const layoutData = await this.graphAlgorithms.calculateLayout(
        { nodes: filteredNodes, edges: filteredEdges }
      );

      return {
        nodes: filteredNodes.map(node => ({
          ...node,
          x: layoutData.nodePositions[node.id]?.x || 0,
          y: layoutData.nodePositions[node.id]?.y || 0
        })),
        edges: filteredEdges,
        layout: layoutData,
        analytics: graph.analytics
      };

    } catch (error) {
      console.error(`Error getting visualization data for ${graphId}:`, error);
      throw error;
    }
  }

  /**
   * Get knowledge graph by ID
   */
  async getKnowledgeGraph(graphId: string): Promise<KnowledgeGraph | null> {
    try {
      // Check active graphs first
      if (this.activeGraphs.has(graphId)) {
        return this.activeGraphs.get(graphId)!;
      }

      // Load from database
      const { data, error } = await supabase
        .from('knowledge_graphs')
        .select('*')
        .eq('id', graphId)
        .single();

      if (error) {
        console.error(`Error loading knowledge graph ${graphId}:`, error);
        return null;
      }

      const graph = data as KnowledgeGraph;
      this.activeGraphs.set(graphId, graph);
      return graph;

    } catch (error) {
      console.error(`Error getting knowledge graph ${graphId}:`, error);
      return null;
    }
  }

  /**
   * Delete a knowledge graph
   */
  async deleteKnowledgeGraph(graphId: string): Promise<void> {
    try {
      console.log(`Deleting knowledge graph: ${graphId}`);

      // Delete from graph database
      await this.graphBuilder.deleteGraph(graphId);

      // Delete embeddings
      await supabase
        .from('knowledge_graph_embeddings')
        .delete()
        .eq('graph_id', graphId);

      await supabase
        .from('knowledge_graph_edge_embeddings')
        .delete()
        .eq('graph_id', graphId);

      // Delete from Supabase
      await supabase
        .from('knowledge_graphs')
        .delete()
        .eq('id', graphId);

      // Remove from active graphs
      this.activeGraphs.delete(graphId);

      console.log(`Knowledge graph deleted: ${graphId}`);

    } catch (error) {
      console.error(`Error deleting knowledge graph ${graphId}:`, error);
      throw new KnowledgeGraphError(
        `Knowledge graph deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETION_ERROR',
        { graphId }
      );
    }
  }

  // Private helper methods

  private async persistKnowledgeGraph(graph: KnowledgeGraph): Promise<void> {
    const { error } = await supabase
      .from('knowledge_graphs')
      .upsert({
        id: graph.id,
        name: graph.name,
        description: graph.description,
        nodes: graph.nodes,
        edges: graph.edges,
        analytics: graph.analytics,
        ontology_mappings: graph.ontologyMappings,
        config: graph.config,
        status: graph.status,
        created_at: graph.createdAt?.toISOString(),
        updated_at: graph.lastUpdated?.toISOString()
      });

    if (error) {
      throw new Error(`Failed to persist knowledge graph: ${error.message}`);
    }
  }

  private deduplicateEntities(entities: GraphNode[]): GraphNode[] {
    const uniqueEntities = new Map<string, GraphNode>();
    
    entities.forEach(entity => {
      const key = `${entity.type}:${entity.properties.name || entity.id}`;
      if (!uniqueEntities.has(key)) {
        uniqueEntities.set(key, entity);
      }
    });