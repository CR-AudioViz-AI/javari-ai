```typescript
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Eye, 
  Zap, 
  Brain,
  Network,
  Target,
  Bell,
  Search,
  BarChart3,
  FileText,
  Activity,
  Globe,
  Lock,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

/**
 * Threat intelligence data types
 */
interface ThreatIndicator {
  id: string;
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email';
  value: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  firstSeen: Date;
  lastSeen: Date;
  sources: string[];
  tags: string[];
  malwareFamily?: string;
  campaignId?: string;
}

interface SecurityEvent {
  id: string;
  timestamp: Date;
  sourceIp: string;
  destinationIp: string;
  eventType: string;
  severity: number;
  description: string;
  indicators: string[];
  mitreTactics: string[];
  mitreReferences: string[];
  rawData: Record<string, any>;
}

interface AttackPrediction {
  id: string;
  timestamp: Date;
  attackType: string;
  probability: number;
  confidenceScore: number;
  targetAssets: string[];
  predictedTimeframe: string;
  recommendations: string[];
  mitigationSteps: string[];
}

interface ThreatFeed {
  id: string;
  name: string;
  url: string;
  format: 'stix' | 'taxii' | 'json' | 'csv' | 'xml';
  updateFrequency: number;
  lastUpdate: Date;
  status: 'active' | 'inactive' | 'error';
  credibility: number;
}

interface DefenseAction {
  id: string;
  timestamp: Date;
  actionType: 'block_ip' | 'quarantine_file' | 'isolate_host' | 'update_rules';
  target: string;
  triggeredBy: string;
  status: 'pending' | 'executed' | 'failed';
  effectiveness: number;
}

interface RiskScore {
  overall: number;
  categories: {
    malware: number;
    phishing: number;
    dataExfiltration: number;
    lateral_movement: number;
    persistence: number;
  };
  trends: {
    direction: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
  };
}

/**
 * Threat Intelligence Service
 */
class ThreatIntelligenceService {
  private supabase: any;
  private mlModel: tf.LayersModel | null = null;
  private threatCache: Map<string, ThreatIndicator> = new Map();
  private eventBuffer: SecurityEvent[] = [];

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
    this.loadMLModel();
  }

  /**
   * Load machine learning model for threat prediction
   */
  private async loadMLModel(): Promise<void> {
    try {
      this.mlModel = await tf.loadLayersModel('/models/threat-prediction.json');
    } catch (error) {
      console.error('Failed to load ML model:', error);
    }
  }

  /**
   * Ingest threat indicators from external feeds
   */
  async ingestThreatFeeds(feeds: ThreatFeed[]): Promise<void> {
    const results = await Promise.allSettled(
      feeds.map(feed => this.processThreatFeed(feed))
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to process feed ${feeds[index].name}:`, result.reason);
      }
    });
  }

  /**
   * Process individual threat feed
   */
  private async processThreatFeed(feed: ThreatFeed): Promise<ThreatIndicator[]> {
    try {
      const response = await fetch(feed.url);
      const data = await response.text();
      
      let indicators: ThreatIndicator[] = [];
      
      switch (feed.format) {
        case 'stix':
          indicators = this.parseSTIXFeed(data);
          break;
        case 'json':
          indicators = this.parseJSONFeed(data);
          break;
        case 'csv':
          indicators = this.parseCSVFeed(data);
          break;
        default:
          throw new Error(`Unsupported feed format: ${feed.format}`);
      }

      await this.storeThreatIndicators(indicators);
      return indicators;
    } catch (error) {
      throw new Error(`Feed processing failed: ${error}`);
    }
  }

  /**
   * Parse STIX formatted threat feed
   */
  private parseSTIXFeed(data: string): ThreatIndicator[] {
    // Simplified STIX parsing - in production, use proper STIX library
    const indicators: ThreatIndicator[] = [];
    try {
      const stixData = JSON.parse(data);
      if (stixData.objects) {
        stixData.objects.forEach((obj: any) => {
          if (obj.type === 'indicator') {
            indicators.push(this.stixToIndicator(obj));
          }
        });
      }
    } catch (error) {
      console.error('STIX parsing error:', error);
    }
    return indicators;
  }

  /**
   * Convert STIX object to ThreatIndicator
   */
  private stixToIndicator(stixObj: any): ThreatIndicator {
    const pattern = stixObj.pattern || '';
    const type = this.extractIndicatorType(pattern);
    const value = this.extractIndicatorValue(pattern);

    return {
      id: stixObj.id || this.generateId(),
      type,
      value,
      confidence: stixObj.confidence || 50,
      severity: this.mapSeverity(stixObj.labels),
      firstSeen: new Date(stixObj.created || Date.now()),
      lastSeen: new Date(stixObj.modified || Date.now()),
      sources: [stixObj.created_by_ref || 'unknown'],
      tags: stixObj.labels || [],
      malwareFamily: stixObj.malware_family,
      campaignId: stixObj.campaign_id
    };
  }

  /**
   * Parse JSON formatted threat feed
   */
  private parseJSONFeed(data: string): ThreatIndicator[] {
    try {
      const jsonData = JSON.parse(data);
      return Array.isArray(jsonData) 
        ? jsonData.map(item => this.jsonToIndicator(item))
        : [this.jsonToIndicator(jsonData)];
    } catch (error) {
      console.error('JSON parsing error:', error);
      return [];
    }
  }

  /**
   * Parse CSV formatted threat feed
   */
  private parseCSVFeed(data: string): ThreatIndicator[] {
    const lines = data.split('\n');
    const headers = lines[0]?.split(',') || [];
    const indicators: ThreatIndicator[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length === headers.length) {
        indicators.push(this.csvToIndicator(headers, values));
      }
    }

    return indicators;
  }

  /**
   * Convert CSV row to ThreatIndicator
   */
  private csvToIndicator(headers: string[], values: string[]): ThreatIndicator {
    const data: Record<string, string> = {};
    headers.forEach((header, index) => {
      data[header.trim()] = values[index]?.trim() || '';
    });

    return {
      id: data.id || this.generateId(),
      type: (data.type as any) || 'ip',
      value: data.value || data.indicator || '',
      confidence: parseInt(data.confidence) || 50,
      severity: (data.severity as any) || 'medium',
      firstSeen: new Date(data.firstSeen || Date.now()),
      lastSeen: new Date(data.lastSeen || Date.now()),
      sources: data.source ? [data.source] : ['csv'],
      tags: data.tags ? data.tags.split(';') : [],
      malwareFamily: data.malwareFamily,
      campaignId: data.campaignId
    };
  }

  /**
   * Analyze security patterns using ML
   */
  async analyzeSecurityPatterns(events: SecurityEvent[]): Promise<AttackPrediction[]> {
    if (!this.mlModel || events.length === 0) {
      return [];
    }

    try {
      const features = this.extractFeatures(events);
      const predictions = this.mlModel.predict(features) as tf.Tensor;
      const predictionData = await predictions.data();
      
      return this.interpretPredictions(predictionData, events);
    } catch (error) {
      console.error('Pattern analysis failed:', error);
      return [];
    }
  }

  /**
   * Extract features for ML model
   */
  private extractFeatures(events: SecurityEvent[]): tf.Tensor {
    const features = events.map(event => [
      event.severity,
      event.sourceIp.split('.').reduce((acc, octet) => acc + parseInt(octet), 0),
      event.eventType.length,
      event.indicators.length,
      new Date(event.timestamp).getHours(),
      event.mitreTactics.length
    ]);

    return tf.tensor2d(features);
  }

  /**
   * Interpret ML predictions
   */
  private interpretPredictions(predictionData: Float32Array, events: SecurityEvent[]): AttackPrediction[] {
    const predictions: AttackPrediction[] = [];
    
    for (let i = 0; i < predictionData.length; i++) {
      const probability = predictionData[i];
      if (probability > 0.7) {
        predictions.push({
          id: this.generateId(),
          timestamp: new Date(),
          attackType: this.classifyAttackType(events[i]),
          probability,
          confidenceScore: probability * 0.9,
          targetAssets: [events[i].destinationIp],
          predictedTimeframe: '1-4 hours',
          recommendations: this.generateRecommendations(events[i]),
          mitigationSteps: this.generateMitigationSteps(events[i])
        });
      }
    }

    return predictions;
  }

  /**
   * Execute automated defense actions
   */
  async executeDefenseActions(predictions: AttackPrediction[]): Promise<DefenseAction[]> {
    const actions: DefenseAction[] = [];

    for (const prediction of predictions) {
      if (prediction.probability > 0.8) {
        const action = await this.createDefenseAction(prediction);
        actions.push(action);
        await this.executeAction(action);
      }
    }

    return actions;
  }

  /**
   * Create defense action based on prediction
   */
  private async createDefenseAction(prediction: AttackPrediction): Promise<DefenseAction> {
    return {
      id: this.generateId(),
      timestamp: new Date(),
      actionType: this.selectActionType(prediction),
      target: prediction.targetAssets[0],
      triggeredBy: prediction.id,
      status: 'pending',
      effectiveness: 0
    };
  }

  /**
   * Calculate risk scores
   */
  calculateRiskScore(indicators: ThreatIndicator[], events: SecurityEvent[]): RiskScore {
    const categoryScores = {
      malware: this.calculateCategoryRisk(indicators, events, 'malware'),
      phishing: this.calculateCategoryRisk(indicators, events, 'phishing'),
      dataExfiltration: this.calculateCategoryRisk(indicators, events, 'data-exfiltration'),
      lateral_movement: this.calculateCategoryRisk(indicators, events, 'lateral-movement'),
      persistence: this.calculateCategoryRisk(indicators, events, 'persistence')
    };

    const overall = Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / 5;

    return {
      overall: Math.round(overall * 100) / 100,
      categories: categoryScores,
      trends: {
        direction: this.calculateTrend(events),
        confidence: 0.85
      }
    };
  }

  /**
   * Store threat indicators in database
   */
  private async storeThreatIndicators(indicators: ThreatIndicator[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('threat_indicators')
        .upsert(indicators);
      
      if (error) throw error;

      // Update cache
      indicators.forEach(indicator => {
        this.threatCache.set(indicator.value, indicator);
      });
    } catch (error) {
      console.error('Failed to store indicators:', error);
    }
  }

  // Utility methods
  private generateId(): string {
    return `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractIndicatorType(pattern: string): ThreatIndicator['type'] {
    if (pattern.includes('file:hashes')) return 'hash';
    if (pattern.includes('domain-name')) return 'domain';
    if (pattern.includes('ipv4-addr')) return 'ip';
    if (pattern.includes('url')) return 'url';
    if (pattern.includes('email-addr')) return 'email';
    return 'ip';
  }

  private extractIndicatorValue(pattern: string): string {
    const match = pattern.match(/'([^']+)'/);
    return match ? match[1] : pattern;
  }

  private mapSeverity(labels: string[]): ThreatIndicator['severity'] {
    if (labels?.some(label => label.includes('critical'))) return 'critical';
    if (labels?.some(label => label.includes('high'))) return 'high';
    if (labels?.some(label => label.includes('medium'))) return 'medium';
    return 'low';
  }

  private jsonToIndicator(item: any): ThreatIndicator {
    return {
      id: item.id || this.generateId(),
      type: item.type || 'ip',
      value: item.value || item.indicator || '',
      confidence: item.confidence || 50,
      severity: item.severity || 'medium',
      firstSeen: new Date(item.firstSeen || item.first_seen || Date.now()),
      lastSeen: new Date(item.lastSeen || item.last_seen || Date.now()),
      sources: Array.isArray(item.sources) ? item.sources : [item.source || 'unknown'],
      tags: Array.isArray(item.tags) ? item.tags : [],
      malwareFamily: item.malwareFamily || item.malware_family,
      campaignId: item.campaignId || item.campaign_id
    };
  }

  private classifyAttackType(event: SecurityEvent): string {
    if (event.mitreTactics.includes('credential-access')) return 'Credential Theft';
    if (event.mitreTactics.includes('lateral-movement')) return 'Lateral Movement';
    if (event.mitreTactics.includes('exfiltration')) return 'Data Exfiltration';
    if (event.mitreTactics.includes('command-and-control')) return 'C2 Communication';
    return 'Unknown Attack';
  }

  private generateRecommendations(event: SecurityEvent): string[] {
    return [
      'Monitor network traffic for suspicious patterns',
      'Review access logs for affected systems',
      'Implement additional network segmentation',
      'Update security signatures and rules'
    ];
  }

  private generateMitigationSteps(event: SecurityEvent): string[] {
    return [
      `Block source IP: ${event.sourceIp}`,
      'Isolate affected systems',
      'Reset potentially compromised credentials',
      'Apply security patches to vulnerable systems'
    ];
  }

  private selectActionType(prediction: AttackPrediction): DefenseAction['actionType'] {
    if (prediction.attackType.includes('Credential')) return 'isolate_host';
    if (prediction.attackType.includes('C2')) return 'block_ip';
    if (prediction.attackType.includes('Exfiltration')) return 'quarantine_file';
    return 'update_rules';
  }

  private async executeAction(action: DefenseAction): Promise<void> {
    try {
      // Simulate action execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      action.status = 'executed';
      action.effectiveness = Math.random() * 0.3 + 0.7;
    } catch (error) {
      action.status = 'failed';
      console.error('Action execution failed:', error);
    }
  }

  private calculateCategoryRisk(indicators: ThreatIndicator[], events: SecurityEvent[], category: string): number {
    const relevantIndicators = indicators.filter(indicator => 
      indicator.tags.some(tag => tag.toLowerCase().includes(category))
    );
    const relevantEvents = events.filter(event => 
      event.mitreTactics.some(tactic => tactic.toLowerCase().includes(category))
    );

    const indicatorRisk = relevantIndicators.reduce((sum, indicator) => {
      const severityWeight = { low: 0.25, medium: 0.5, high: 0.75, critical: 1 };
      return sum + (severityWeight[indicator.severity] * indicator.confidence / 100);
    }, 0) / Math.max(indicators.length, 1);

    const eventRisk = relevantEvents.reduce((sum, event) => sum + event.severity, 0) / Math.max(events.length * 10, 1);

    return Math.min((indicatorRisk + eventRisk) / 2, 1);
  }

  private calculateTrend(events: SecurityEvent[]): 'increasing' | 'decreasing' | 'stable' {
    if (events.length < 10) return 'stable';

    const recent = events.slice(-5).reduce((sum, event) => sum + event.severity, 0);
    const previous = events.slice(-10, -5).reduce((sum, event) => sum + event.severity, 0);

    if (recent > previous * 1.2) return 'increasing';
    if (recent < previous * 0.8) return 'decreasing';
    return 'stable';
  }
}

/**
 * Dashboard Component
 */
interface ThreatIntelligenceDashboardProps {
  userId: string;
}

const ThreatIntelligenceDashboard: React.FC<ThreatIntelligenceDashboardProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [threatService] = useState(() => new ThreatIntelligenceService());
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [predictions, setPredictions] = useState<AttackPrediction[]>([]);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      // Load initial data
      const mockIndicators: ThreatIndicator[] = [
        {
          id: '1',
          type: 'ip',
          value: '192.168.1.100',
          confidence: 85,
          severity: 'high',
          firstSeen: new Date('2024-01-15'),
          lastSeen: new Date(),
          sources: ['misp', 'virustotal'],
          tags: ['malware', 'botnet'],
          malwareFamily: 'Zeus'
        }
      ];
      
      setIndicators(mockIndicators);
      
      const mockEvents: SecurityEvent[] = [
        {
          id: '1',
          timestamp: new Date(),
          sourceIp: '192.168.1.100',
          destinationIp: '10.0.0.50',
          eventType: 'suspicious_connection',
          severity: 8,
          description: 'Suspicious outbound connection detected',
          indicators: ['192.168.1.100'],
          mitreTactics: ['command-and-control'],
          mitreReferences: ['T1071'],
          rawData: {}
        }
      ];

      const riskData = threatService.calculateRiskScore(mockIndicators, mockEvents);
      setRiskScore(riskData);

      const predictionsData = await threatService.analyzeSecurityPatterns(mockEvents);
      setPredictions(predictionsData);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Threats</p>
            <p className="text-3xl font-bold text-red-600">{indicators.length}</p>
          </div>
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Risk Score</p>
            <p className="text-3xl font-bold text-orange-600">
              {riskScore ? Math.round(riskScore.overall * 100) : 0}
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-orange-600" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Predictions</p>
            <p className="text-3xl font-bold text-blue-600">{predictions.length}</p>
          </div>
          <Brain className