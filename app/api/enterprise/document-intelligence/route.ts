```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { z } from 'zod';
import { ratelimit } from '@/lib/ratelimit';
import { validateApiKey } from '@/lib/auth';
import crypto from 'crypto';

// Environment variables validation
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Validation schemas
const DocumentAnalysisSchema = z.object({
  document_id: z.string().min(1),
  content: z.string().optional(),
  file_url: z.string().url().optional(),
  document_type: z.enum(['contract', 'report', 'communication', 'policy', 'invoice', 'other']).optional(),
  metadata: z.record(z.any()).optional(),
  compliance_rules: z.array(z.string()).optional(),
  extract_entities: z.boolean().default(true),
  generate_summary: z.boolean().default(true),
  risk_assessment: z.boolean().default(true),
  knowledge_graph: z.boolean().default(false),
}).refine(data => data.content || data.file_url, {
  message: "Either content or file_url must be provided"
});

// Types
interface DocumentAnalysis {
  id: string;
  document_id: string;
  document_type: string;
  content_summary: string;
  key_entities: Entity[];
  compliance_status: ComplianceResult;
  risk_assessment: RiskAssessment;
  insights: string[];
  confidence_score: number;
  processing_time_ms: number;
  knowledge_graph_nodes?: KnowledgeNode[];
  created_at: string;
}

interface Entity {
  type: string;
  value: string;
  confidence: number;
  context: string;
  position: { start: number; end: number };
}

interface ComplianceResult {
  overall_status: 'compliant' | 'non_compliant' | 'requires_review';
  rule_violations: RuleViolation[];
  recommendations: string[];
  score: number;
}

interface RuleViolation {
  rule_id: string;
  rule_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggested_action: string;
}

interface RiskAssessment {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: RiskFactor[];
  mitigation_strategies: string[];
  risk_score: number;
}

interface RiskFactor {
  category: string;
  description: string;
  impact: number;
  probability: number;
  mitigation_priority: number;
}

interface KnowledgeNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, any>;
  relationships: Relationship[];
}

interface Relationship {
  target_node_id: string;
  relationship_type: string;
  properties: Record<string, any>;
}

// Document Analysis Engine
class DocumentAnalysisEngine {
  private complianceRules: Map<string, any> = new Map();
  private riskPatterns: Map<string, RegExp> = new Map();

  constructor() {
    this.initializeComplianceRules();
    this.initializeRiskPatterns();
  }

  private initializeComplianceRules() {
    this.complianceRules.set('gdpr', {
      patterns: [/personal\s+data/gi, /data\s+processing/gi, /consent/gi],
      requirements: ['data_protection_clause', 'consent_mechanism', 'right_to_erasure']
    });
    this.complianceRules.set('hipaa', {
      patterns: [/health\s+information/gi, /medical\s+records/gi, /phi/gi],
      requirements: ['encryption_clause', 'access_controls', 'audit_trail']
    });
    this.complianceRules.set('sox', {
      patterns: [/financial\s+reporting/gi, /internal\s+controls/gi, /audit/gi],
      requirements: ['financial_controls', 'audit_compliance', 'reporting_accuracy']
    });
  }

  private initializeRiskPatterns() {
    this.riskPatterns.set('liability', /liability|indemnification|damages|penalty/gi);
    this.riskPatterns.set('termination', /terminate|cancel|breach|default/gi);
    this.riskPatterns.set('intellectual_property', /intellectual\s+property|copyright|patent|trademark/gi);
    this.riskPatterns.set('confidentiality', /confidential|proprietary|trade\s+secret/gi);
  }

  async analyzeDocument(
    documentId: string,
    content: string,
    options: {
      documentType?: string;
      complianceRules?: string[];
      extractEntities?: boolean;
      generateSummary?: boolean;
      riskAssessment?: boolean;
      knowledgeGraph?: boolean;
    }
  ): Promise<DocumentAnalysis> {
    const startTime = Date.now();
    
    try {
      // Extract document type if not provided
      const documentType = options.documentType || await this.classifyDocument(content);
      
      // Parallel processing for efficiency
      const [
        summary,
        entities,
        complianceResult,
        riskAssessment,
        insights,
        knowledgeGraphNodes
      ] = await Promise.all([
        options.generateSummary ? this.generateSummary(content, documentType) : Promise.resolve(''),
        options.extractEntities ? this.extractEntities(content) : Promise.resolve([]),
        this.checkCompliance(content, options.complianceRules || []),
        options.riskAssessment ? this.assessRisk(content, documentType) : Promise.resolve({
          overall_risk: 'low' as const,
          risk_factors: [],
          mitigation_strategies: [],
          risk_score: 0
        }),
        this.extractInsights(content, documentType),
        options.knowledgeGraph ? this.generateKnowledgeGraph(content, entities) : Promise.resolve(undefined)
      ]);

      const processingTime = Date.now() - startTime;
      const confidenceScore = this.calculateConfidenceScore(entities, complianceResult, riskAssessment);

      const analysis: DocumentAnalysis = {
        id: crypto.randomUUID(),
        document_id: documentId,
        document_type: documentType,
        content_summary: summary,
        key_entities: entities,
        compliance_status: complianceResult,
        risk_assessment: riskAssessment,
        insights,
        confidence_score: confidenceScore,
        processing_time_ms: processingTime,
        knowledge_graph_nodes: knowledgeGraphNodes,
        created_at: new Date().toISOString()
      };

      // Store results in Supabase
      await this.storeAnalysisResults(analysis);
      
      return analysis;
    } catch (error) {
      throw new Error(`Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async classifyDocument(content: string): Promise<string> {
    const prompt = `Classify the following document into one of these categories: contract, report, communication, policy, invoice, other.
    
Document content (first 500 characters):
${content.substring(0, 500)}

Respond with only the category name.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content?.toLowerCase().trim() || 'other';
  }

  private async generateSummary(content: string, documentType: string): Promise<string> {
    const prompt = `Provide a concise executive summary of this ${documentType} document. Focus on key points, decisions, obligations, and important dates.

Document content:
${content.substring(0, 4000)}

Summary:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.3
    });

    return response.choices[0]?.message?.content || '';
  }

  private async extractEntities(content: string): Promise<Entity[]> {
    const prompt = `Extract key entities from this document. For each entity, provide:
- type (person, organization, date, amount, location, contract_term, etc.)
- value (the actual entity text)
- context (surrounding text for context)

Document content:
${content.substring(0, 3000)}

Respond in JSON format as an array of entities.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.2
    });

    try {
      const entitiesData = JSON.parse(response.choices[0]?.message?.content || '[]');
      return entitiesData.map((entity: any) => ({
        type: entity.type || 'unknown',
        value: entity.value || '',
        confidence: entity.confidence || 0.8,
        context: entity.context || '',
        position: entity.position || { start: 0, end: 0 }
      }));
    } catch {
      return [];
    }
  }

  private async checkCompliance(content: string, rules: string[]): Promise<ComplianceResult> {
    const violations: RuleViolation[] = [];
    let totalScore = 100;

    for (const ruleId of rules) {
      const rule = this.complianceRules.get(ruleId);
      if (!rule) continue;

      const hasPatterns = rule.patterns.some((pattern: RegExp) => pattern.test(content));
      
      if (hasPatterns) {
        // Use AI to check detailed compliance
        const complianceCheck = await this.aiComplianceCheck(content, ruleId);
        if (!complianceCheck.compliant) {
          violations.push({
            rule_id: ruleId,
            rule_name: ruleId.toUpperCase(),
            severity: complianceCheck.severity,
            description: complianceCheck.description,
            suggested_action: complianceCheck.suggestedAction
          });
          totalScore -= complianceCheck.severity === 'critical' ? 30 : 
                       complianceCheck.severity === 'high' ? 20 :
                       complianceCheck.severity === 'medium' ? 10 : 5;
        }
      }
    }

    const overallStatus = violations.some(v => v.severity === 'critical') ? 'non_compliant' :
                         violations.some(v => v.severity === 'high') ? 'requires_review' : 'compliant';

    return {
      overall_status: overallStatus,
      rule_violations: violations,
      recommendations: violations.map(v => v.suggested_action),
      score: Math.max(0, totalScore)
    };
  }

  private async aiComplianceCheck(content: string, ruleId: string): Promise<{
    compliant: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestedAction: string;
  }> {
    const prompt = `Analyze this document for ${ruleId.toUpperCase()} compliance. Identify any violations and provide recommendations.

Document content:
${content.substring(0, 2000)}

Respond in JSON format with: compliant (boolean), severity, description, suggestedAction`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.2
    });

    try {
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        compliant: result.compliant || true,
        severity: result.severity || 'low',
        description: result.description || '',
        suggestedAction: result.suggestedAction || ''
      };
    } catch {
      return {
        compliant: true,
        severity: 'low',
        description: 'Unable to assess compliance',
        suggestedAction: 'Manual review recommended'
      };
    }
  }

  private async assessRisk(content: string, documentType: string): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = [];
    
    // Pattern-based risk detection
    for (const [category, pattern] of this.riskPatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        const riskFactor = await this.analyzeRiskFactor(content, category, matches);
        if (riskFactor) {
          riskFactors.push(riskFactor);
        }
      }
    }

    // AI-powered risk assessment
    const aiRiskAssessment = await this.aiRiskAssessment(content, documentType);
    riskFactors.push(...aiRiskAssessment.factors);

    const riskScore = this.calculateRiskScore(riskFactors);
    const overallRisk = riskScore >= 80 ? 'critical' :
                       riskScore >= 60 ? 'high' :
                       riskScore >= 30 ? 'medium' : 'low';

    return {
      overall_risk: overallRisk,
      risk_factors: riskFactors,
      mitigation_strategies: this.generateMitigationStrategies(riskFactors),
      risk_score: riskScore
    };
  }

  private async analyzeRiskFactor(content: string, category: string, matches: RegExpMatchArray): Promise<RiskFactor | null> {
    const context = this.extractContext(content, matches[0], 200);
    
    const prompt = `Analyze this ${category} risk in the document context:

Context: ${context}

Provide impact (0-100), probability (0-100), and mitigation_priority (0-100) as JSON.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.2
      });

      const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        category,
        description: `${category} risk identified: ${matches[0]}`,
        impact: analysis.impact || 50,
        probability: analysis.probability || 50,
        mitigation_priority: analysis.mitigation_priority || 50
      };
    } catch {
      return null;
    }
  }

  private async aiRiskAssessment(content: string, documentType: string): Promise<{ factors: RiskFactor[] }> {
    const prompt = `Identify and assess risks in this ${documentType} document. Focus on legal, financial, operational, and compliance risks.

Document content:
${content.substring(0, 2000)}

Respond with JSON array of risk factors, each having: category, description, impact (0-100), probability (0-100), mitigation_priority (0-100)`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3
      });

      const factors = JSON.parse(response.choices[0]?.message?.content || '[]');
      return { factors: factors.slice(0, 10) }; // Limit to top 10 risks
    } catch {
      return { factors: [] };
    }
  }

  private extractContext(content: string, match: string, contextLength: number): string {
    const index = content.indexOf(match);
    if (index === -1) return match;
    
    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(content.length, index + match.length + contextLength / 2);
    
    return content.substring(start, end);
  }

  private calculateRiskScore(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0;
    
    const weightedScore = riskFactors.reduce((sum, factor) => {
      return sum + (factor.impact * factor.probability * factor.mitigation_priority) / 10000;
    }, 0);
    
    return Math.min(100, weightedScore / riskFactors.length * 100);
  }

  private generateMitigationStrategies(riskFactors: RiskFactor[]): string[] {
    const strategies = new Set<string>();
    
    const highPriorityFactors = riskFactors
      .filter(factor => factor.mitigation_priority > 70)
      .sort((a, b) => b.mitigation_priority - a.mitigation_priority);
    
    for (const factor of highPriorityFactors.slice(0, 5)) {
      switch (factor.category) {
        case 'liability':
          strategies.add('Review and strengthen indemnification clauses');
          strategies.add('Obtain appropriate insurance coverage');
          break;
        case 'termination':
          strategies.add('Establish clear termination procedures and notice requirements');
          strategies.add('Include cure periods for non-material breaches');
          break;
        case 'intellectual_property':
          strategies.add('Implement robust IP protection and assignment clauses');
          strategies.add('Conduct IP due diligence before execution');
          break;
        case 'confidentiality':
          strategies.add('Strengthen data protection and confidentiality measures');
          strategies.add('Implement access controls and audit trails');
          break;
        default:
          strategies.add(`Address ${factor.category} risks through targeted contract amendments`);
      }
    }
    
    return Array.from(strategies);
  }

  private async extractInsights(content: string, documentType: string): Promise<string[]> {
    const prompt = `Extract 5-7 key business insights from this ${documentType} document. Focus on strategic implications, opportunities, and actionable recommendations.

Document content:
${content.substring(0, 2000)}

Provide insights as a JSON array of strings.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.4
      });

      const insights = JSON.parse(response.choices[0]?.message?.content || '[]');
      return Array.isArray(insights) ? insights.slice(0, 7) : [];
    } catch {
      return [];
    }
  }

  private async generateKnowledgeGraph(content: string, entities: Entity[]): Promise<KnowledgeNode[]> {
    const nodes: KnowledgeNode[] = [];
    
    // Create nodes from entities
    for (const entity of entities.slice(0, 20)) { // Limit for performance
      const node: KnowledgeNode = {
        id: crypto.randomUUID(),
        type: entity.type,
        label: entity.value,
        properties: {
          confidence: entity.confidence,
          context: entity.context,
          position: entity.position
        },
        relationships: []
      };
      nodes.push(node);
    }

    // Use AI to identify relationships
    if (nodes.length > 1) {
      const relationships = await this.identifyRelationships(content, nodes);
      this.assignRelationships(nodes, relationships);
    }

    return nodes;
  }

  private async identifyRelationships(content: string, nodes: KnowledgeNode[]): Promise<Array<{
    source: string;
    target: string;
    type: string;
    properties: Record<string, any>;
  }>> {
    const nodeList = nodes.map(n => `${n.id}: ${n.type} - ${n.label}`).join('\n');
    
    const prompt = `Identify relationships between these entities from the document context:

Entities:
${nodeList}

Document context:
${content.substring(0, 1500)}

Respond with JSON array of relationships: [{source: "node_id", target: "node_id", type: "relationship_type", properties: {}}]`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3
      });

      return JSON.parse(response.choices[0]?.message?.content || '[]');
    } catch {
      return [];
    }
  }

  private assignRelationships(nodes: KnowledgeNode[], relationships: Array<{
    source: string;
    target: string;
    type: string;
    properties: Record<string, any>;
  }>): void {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    for (const rel of relationships) {
      const sourceNode = nodeMap.get(rel.source);
      if (sourceNode) {
        sourceNode.relationships.push({
          target_node_id: rel.target,
          relationship_type: rel.type,
          properties: rel.properties
        });
      }
    }
  }

  private calculateConfidenceScore(
    entities: Entity[],
    compliance: ComplianceResult,
    risk: RiskAssessment
  ): number {
    const entityConfidence = entities.length > 0 
      ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length 
      : 0.5;
    
    const complianceConfidence = compliance.rule_violations.length === 0 ? 0.9 : 0.7;
    const riskConfidence = risk.risk_factors.length > 0 ? 0.8 : 0.6;
    
    return Math.round((entityConfidence * 0.4 + complianceConfidence * 0.3 + riskConfidence * 0.3) * 100) / 100;
  }

  private async storeAnalysisResults(analysis: DocumentAnalysis): Promise<void> {
    try {
      const { error } = await supabase
        .from('document_intelligence_analyses')
        .insert({
          id: analysis.id,
          document_id: analysis.document_id,
          document_type: analysis.document_type,
          content_summary: analysis.content_summary,
          key_entities: analysis.key_entities,
          compliance_status: