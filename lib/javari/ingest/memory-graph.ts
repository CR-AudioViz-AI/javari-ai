// lib/javari/ingest/memory-graph.ts
import type { MemoryNode, MemoryEdge, MemoryGraph, CanonicalDocument } from './types';
import { generateId } from './utils';

export class MemoryGraphBuilder {
  private graph: MemoryGraph = {
    nodes: new Map(),
    edges: new Map(),
    adjacency: new Map()
  };

  addDocument(doc: CanonicalDocument): MemoryNode {
    const node: MemoryNode = {
      id: doc.id,
      type: 'document',
      name: doc.title,
      metadata: { ...doc.metadata, path: doc.path, category: doc.category },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.graph.nodes.set(node.id, node);
    this.graph.adjacency.set(node.id, new Set());
    
    return node;
  }

  addEdge(sourceId: string, targetId: string, relationship: MemoryEdge['relationship'], weight: number = 1.0): MemoryEdge {
    const edge: MemoryEdge = {
      id: generateId('edge'),
      sourceId,
      targetId,
      relationship,
      weight
    };
    
    this.graph.edges.set(edge.id, edge);
    this.graph.adjacency.get(sourceId)?.add(targetId);
    
    return edge;
  }

  buildFromDocuments(docs: CanonicalDocument[]): MemoryGraph {
    docs.forEach(doc => {
      this.addDocument(doc);
      
      doc.metadata.dependencies?.forEach(depId => {
        this.addEdge(doc.id, depId, 'depends_on');
      });
      
      doc.metadata.relatedDocs?.forEach(relatedId => {
        this.addEdge(doc.id, relatedId, 'references', 0.5);
      });
    });
    
    return this.graph;
  }

  getGraph(): MemoryGraph {
    return this.graph;
  }
}
