// lib/javari/ingest/registry.ts
// Javari OS Memory Ingestion — Canonical Document Registry
// 2026-02-27 — Stage 2 Build
//
// Registry of all 98 canonical documents in R2 cold-storage/consolidation-docs/
// Metadata includes category, priority, dependencies, and relationships.

import type { CanonicalDocument } from './types';

export const CANONICAL_DOCUMENTS: CanonicalDocument[] = [
  // ═══ ARCHITECTURE ═══
  {
    id: 'arch_001',
    title: 'JAVARI_SYSTEM_CANON',
    path: 'docs/system/JAVARI_SYSTEM_CANON.md',
    bucket: 'cold-storage',
    category: 'architecture',
    version: '1.0',
    lastModified: '2026-02-20',
    sizeBytes: 0, // populated during fetch
    hash: '',
    metadata: {
      priority: 'critical',
      confidentiality: 'internal',
      tags: ['core', 'architecture', 'system'],
      dependencies: [],
      relatedDocs: ['arch_002', 'gov_001']
    }
  },
  {
    id: 'arch_002',
    title: 'AGGREGATION_ARCHITECTURE',
    path: 'docs/AGGREGATION_ARCHITECTURE.md',
    bucket: 'cold-storage',
    category: 'architecture',
    version: '1.0',
    lastModified: '2026-02-15',
    sizeBytes: 0,
    hash: '',
    metadata: {
      priority: 'high',
      confidentiality: 'internal',
      tags: ['architecture', 'multi-ai', 'orchestration'],
      dependencies: ['arch_001'],
      relatedDocs: ['tech_001', 'tech_002']
    }
  },

  // ═══ GOVERNANCE ═══
  {
    id: 'gov_001',
    title: 'CANONICAL_INTEGRATION_GUIDE',
    path: 'CANONICAL_INTEGRATION_GUIDE.md',
    bucket: 'cold-storage',
    category: 'governance',
    version: '1.0',
    lastModified: '2026-02-18',
    sizeBytes: 0,
    hash: '',
    metadata: {
      priority: 'critical',
      confidentiality: 'internal',
      tags: ['governance', 'integration', 'standards'],
      dependencies: ['arch_001'],
      relatedDocs: ['gov_002', 'ops_001']
    }
  },

  // ═══ ROADMAP ═══
  {
    id: 'roadmap_001',
    title: 'MASTER_ROADMAP_V2',
    path: 'MASTER_ROADMAP_V2.md',
    bucket: 'cold-storage',
    category: 'roadmap',
    version: '2.0',
    lastModified: '2026-02-25',
    sizeBytes: 0,
    hash: '',
    metadata: {
      priority: 'critical',
      confidentiality: 'internal',
      tags: ['roadmap', 'planning', 'execution'],
      dependencies: ['arch_001', 'gov_001'],
      relatedDocs: ['roadmap_002', 'ops_002']
    }
  },

  // ═══ SECURITY ═══
  {
    id: 'sec_001',
    title: 'TELEMETRY_RUNBOOK',
    path: 'orchestrator/security/TELEMETRY_RUNBOOK.md',
    bucket: 'cold-storage',
    category: 'security',
    version: '1.0',
    lastModified: '2026-02-10',
    sizeBytes: 0,
    hash: '',
    metadata: {
      priority: 'high',
      confidentiality: 'restricted',
      tags: ['security', 'telemetry', 'monitoring'],
      dependencies: ['arch_001'],
      relatedDocs: ['sec_002', 'ops_003']
    }
  },

  // ═══ TECHNICAL ═══
  {
    id: 'tech_001',
    title: 'MULTI_AI_ORCHESTRATOR',
    path: 'lib/javari/multi-ai/orchestrator.ts',
    bucket: 'cold-storage',
    category: 'technical',
    version: '1.0',
    lastModified: '2026-02-20',
    sizeBytes: 23726,
    hash: '',
    metadata: {
      priority: 'critical',
      confidentiality: 'internal',
      tags: ['technical', 'multi-ai', 'orchestration'],
      dependencies: ['arch_002'],
      relatedDocs: ['tech_002', 'tech_003']
    }
  },
  {
    id: 'tech_002',
    title: 'MULTI_AI_ROUTER',
    path: 'lib/javari/multi-ai/router.ts',
    bucket: 'cold-storage',
    category: 'technical',
    version: '1.0',
    lastModified: '2026-02-20',
    sizeBytes: 15510,
    hash: '',
    metadata: {
      priority: 'critical',
      confidentiality: 'internal',
      tags: ['technical', 'routing', 'multi-model'],
      dependencies: ['arch_002'],
      relatedDocs: ['tech_001', 'tech_003']
    }
  },

  // ═══ OPERATIONS ═══
  {
    id: 'ops_001',
    title: 'COMPLETE_BUILD_SUMMARY',
    path: 'COMPLETE_BUILD_SUMMARY.md',
    bucket: 'cold-storage',
    category: 'operations',
    version: '1.0',
    lastModified: '2026-02-26',
    sizeBytes: 0,
    hash: '',
    metadata: {
      priority: 'medium',
      confidentiality: 'internal',
      tags: ['operations', 'build', 'deployment'],
      dependencies: [],
      relatedDocs: ['ops_002', 'gov_001']
    }
  },

  // NOTE: This is a subset of 98 documents
  // Full registry would include all canonical docs from R2
  // Pattern: Each category has ~15-20 documents
  // Total: 98 documents across 6 categories
];

/**
 * Get document by ID
 */
export function getDocumentById(id: string): CanonicalDocument | undefined {
  return CANONICAL_DOCUMENTS.find(doc => doc.id === id);
}

/**
 * Get documents by category
 */
export function getDocumentsByCategory(
  category: CanonicalDocument['category']
): CanonicalDocument[] {
  return CANONICAL_DOCUMENTS.filter(doc => doc.category === category);
}

/**
 * Get documents by priority
 */
export function getDocumentsByPriority(
  priority: 'critical' | 'high' | 'medium' | 'low'
): CanonicalDocument[] {
  return CANONICAL_DOCUMENTS.filter(doc => doc.metadata.priority === priority);
}

/**
 * Get document dependencies (recursive)
 */
export function getDocumentDependencies(id: string): string[] {
  const doc = getDocumentById(id);
  if (!doc || !doc.metadata.dependencies) return [];
  
  const deps = new Set<string>(doc.metadata.dependencies);
  
  for (const depId of doc.metadata.dependencies) {
    const subDeps = getDocumentDependencies(depId);
    subDeps.forEach(d => deps.add(d));
  }
  
  return Array.from(deps);
}

/**
 * Get ingestion order (topological sort by dependencies)
 */
export function getIngestionOrder(): CanonicalDocument[] {
  const visited = new Set<string>();
  const order: CanonicalDocument[] = [];
  
  function visit(doc: CanonicalDocument) {
    if (visited.has(doc.id)) return;
    visited.add(doc.id);
    
    // Visit dependencies first
    if (doc.metadata.dependencies) {
      for (const depId of doc.metadata.dependencies) {
        const depDoc = getDocumentById(depId);
        if (depDoc) visit(depDoc);
      }
    }
    
    order.push(doc);
  }
  
  // Sort by priority, then visit
  const sorted = [...CANONICAL_DOCUMENTS].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const aPri = priorityOrder[a.metadata.priority || 'medium'];
    const bPri = priorityOrder[b.metadata.priority || 'medium'];
    return aPri - bPri;
  });
  
  sorted.forEach(visit);
  
  return order;
}

/**
 * Estimate total ingestion cost for all documents
 */
export function estimateTotalCost(
  avgChunksPerDoc: number = 50,
  avgTokensPerChunk: number = 500,
  provider: 'openai' | 'mistral' | 'voyage' = 'openai'
): number {
  const totalDocs = CANONICAL_DOCUMENTS.length;
  const totalChunks = totalDocs * avgChunksPerDoc;
  const totalTokens = totalChunks * avgTokensPerChunk;
  
  const costPer1MTokens = {
    openai: 0.13,
    mistral: 0.10,
    voyage: 0.12
  };
  
  return (totalTokens / 1_000_000) * (costPer1MTokens[provider] || 0.13);
}
