```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';

// Types
interface SecurityEvent {
  id: string;
  timestamp: string;
  event_type: string;
  source_ip: string;
  user_id?: string;
  action: string;
  resource: string;
  status: string;
  metadata: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface AnomalyScore {
  score: number;
  confidence: number;
  features: string[];
  explanation: string;
}

interface ThreatClassification {
  category: string;
  subcategory: string;
  confidence: number;
  indicators: string[];
}

interface RiskScore {
  overall: number;
  components: {
    frequency: number;
    severity: number;
    anomaly: number;
    pattern: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface SecurityPattern {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  threshold: number;
  severity: string;
}

interface AnalyticsRequest {
  events?: SecurityEvent[];
  timeRange?: {
    start: string;
    end: string;
  };
  filters?: {
    event_types?: string[];
    severity?: string[];
    source_ips?: string[];
    user_ids?: string[];
  };
  analysis_type: 'real_time' | 'batch' | 'historical';
  include_ml_analysis?: boolean;
  include_patterns?: boolean;
  include_predictions?: boolean;
}

interface AnalyticsResponse {
  summary: {
    total_events: number;
    unique_sources: number;
    high_risk_events: number;
    anomalies_detected: number;
  };
  risk_score: RiskScore;
  anomalies: Array<SecurityEvent & { anomaly_score: AnomalyScore }>;
  threats: Array<SecurityEvent & { threat_classification: ThreatClassification }>;
  patterns: SecurityPattern[];
  alerts: Array<{
    id: string;
    level: 'info' | 'warning' | 'critical';
    message: string;
    events: string[];
    timestamp: string;
  }>;
  predictions?: {
    next_hour_risk: number;
    trending_threats: string[];
    recommended_actions: string[];
  };
  metrics: {
    processing_time_ms: number;
    events_per_second: number;
    accuracy_score: number;
  };
}

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class SecurityEventAnalyzer {
  private anomalyModel: tf.LayersModel | null = null;
  private threatModel: tf.LayersModel | null = null;

  async initialize(): Promise<void> {
    try {
      // Load pre-trained models (in production, load from cloud storage)
      this.anomalyModel = await tf.loadLayersModel('/models/anomaly_detector.json');
      this.threatModel = await tf.loadLayersModel('/models/threat_classifier.json');
    } catch (error) {
      console.warn('ML models not available, using rule-based fallback');
    }
  }

  async analyzeEvents(events: SecurityEvent[]): Promise<{
    anomalies: Array<SecurityEvent & { anomaly_score: AnomalyScore }>;
    threats: Array<SecurityEvent & { threat_classification: ThreatClassification }>;
  }> {
    const anomalies: Array<SecurityEvent & { anomaly_score: AnomalyScore }> = [];
    const threats: Array<SecurityEvent & { threat_classification: ThreatClassification }> = [];

    for (const event of events) {
      // Anomaly detection
      const anomalyScore = await this.detectAnomaly(event);
      if (anomalyScore.score > 0.7) {
        anomalies.push({ ...event, anomaly_score: anomalyScore });
      }

      // Threat classification
      const threatClassification = await this.classifyThreat(event);
      if (threatClassification.confidence > 0.6) {
        threats.push({ ...event, threat_classification: threatClassification });
      }
    }

    return { anomalies, threats };
  }

  private async detectAnomaly(event: SecurityEvent): Promise<AnomalyScore> {
    if (this.anomalyModel) {
      const features = this.extractFeatures(event);
      const prediction = this.anomalyModel.predict(tf.tensor2d([features])) as tf.Tensor;
      const score = await prediction.data();
      
      return {
        score: score[0],
        confidence: Math.min(score[0] * 1.2, 1.0),
        features: this.getFeatureNames(),
        explanation: this.generateAnomalyExplanation(event, score[0])
      };
    }

    // Fallback rule-based detection
    return this.ruleBasedAnomalyDetection(event);
  }

  private async classifyThreat(event: SecurityEvent): Promise<ThreatClassification> {
    if (this.threatModel) {
      const features = this.extractFeatures(event);
      const prediction = this.threatModel.predict(tf.tensor2d([features])) as tf.Tensor;
      const probabilities = await prediction.data();
      
      const categories = ['brute_force', 'sql_injection', 'xss', 'privilege_escalation', 'data_exfiltration'];
      const maxIndex = probabilities.indexOf(Math.max(...Array.from(probabilities)));
      
      return {
        category: categories[maxIndex],
        subcategory: this.getSubcategory(categories[maxIndex], event),
        confidence: probabilities[maxIndex],
        indicators: this.getThreatIndicators(event)
      };
    }

    // Fallback rule-based classification
    return this.ruleBasedThreatClassification(event);
  }

  private extractFeatures(event: SecurityEvent): number[] {
    return [
      this.encodeEventType(event.event_type),
      this.encodeIP(event.source_ip),
      this.encodeAction(event.action),
      this.encodeStatus(event.status),
      this.encodeSeverity(event.severity),
      this.getTimeFeatures(event.timestamp),
      Object.keys(event.metadata).length
    ].flat();
  }

  private encodeEventType(type: string): number {
    const types = { 'login': 1, 'api_access': 2, 'file_access': 3, 'admin_action': 4 };
    return types[type as keyof typeof types] || 0;
  }

  private encodeIP(ip: string): number {
    const parts = ip.split('.').map(Number);
    return parts.reduce((acc, part, i) => acc + part * Math.pow(256, 3 - i), 0) / Math.pow(2, 32);
  }

  private encodeAction(action: string): number {
    const actions = { 'read': 1, 'write': 2, 'delete': 3, 'execute': 4 };
    return actions[action as keyof typeof actions] || 0;
  }

  private encodeStatus(status: string): number {
    const statuses = { 'success': 1, 'failure': 0, 'blocked': -1 };
    return statuses[status as keyof typeof statuses] || 0;
  }

  private encodeSeverity(severity: string): number {
    const severities = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    return severities[severity as keyof typeof severities] || 1;
  }

  private getTimeFeatures(timestamp: string): number[] {
    const date = new Date(timestamp);
    return [
      date.getHours() / 24,
      date.getDay() / 7,
      date.getDate() / 31,
      date.getMonth() / 12
    ];
  }

  private getFeatureNames(): string[] {
    return ['event_type', 'source_ip', 'action', 'status', 'severity', 'hour', 'day', 'date', 'month', 'metadata_count'];
  }

  private generateAnomalyExplanation(event: SecurityEvent, score: number): string {
    if (score > 0.9) return 'Highly unusual pattern detected across multiple dimensions';
    if (score > 0.8) return 'Significant deviation from normal behavior';
    if (score > 0.7) return 'Moderate anomaly in event characteristics';
    return 'Minor deviation detected';
  }

  private ruleBasedAnomalyDetection(event: SecurityEvent): AnomalyScore {
    let score = 0;
    const features: string[] = [];

    // Check for unusual timing
    const hour = new Date(event.timestamp).getHours();
    if (hour < 6 || hour > 22) {
      score += 0.3;
      features.push('unusual_timing');
    }

    // Check for failed attempts
    if (event.status === 'failure') {
      score += 0.4;
      features.push('failed_attempt');
    }

    // Check for admin actions
    if (event.action.includes('admin') || event.action.includes('delete')) {
      score += 0.3;
      features.push('sensitive_action');
    }

    return {
      score: Math.min(score, 1.0),
      confidence: score > 0.5 ? 0.7 : 0.4,
      features,
      explanation: this.generateAnomalyExplanation(event, score)
    };
  }

  private ruleBasedThreatClassification(event: SecurityEvent): ThreatClassification {
    // Simple rule-based classification
    if (event.event_type === 'login' && event.status === 'failure') {
      return {
        category: 'brute_force',
        subcategory: 'password_attack',
        confidence: 0.8,
        indicators: ['multiple_failed_logins', 'unusual_timing']
      };
    }

    return {
      category: 'unknown',
      subcategory: 'unclassified',
      confidence: 0.3,
      indicators: []
    };
  }

  private getSubcategory(category: string, event: SecurityEvent): string {
    const subcategories: Record<string, string> = {
      'brute_force': 'password_attack',
      'sql_injection': 'database_attack',
      'xss': 'script_injection',
      'privilege_escalation': 'unauthorized_access',
      'data_exfiltration': 'data_theft'
    };
    return subcategories[category] || 'unspecified';
  }

  private getThreatIndicators(event: SecurityEvent): string[] {
    const indicators: string[] = [];
    
    if (event.status === 'failure') indicators.push('failed_attempt');
    if (event.severity === 'high' || event.severity === 'critical') indicators.push('high_severity');
    if (event.metadata?.user_agent?.includes('bot')) indicators.push('automated_tool');
    
    return indicators;
  }
}

class PatternMatcher {
  async findPatterns(events: SecurityEvent[]): Promise<SecurityPattern[]> {
    const { data: patterns } = await supabase
      .from('security_patterns')
      .select('*');

    if (!patterns) return [];

    const matchedPatterns: SecurityPattern[] = [];

    for (const pattern of patterns) {
      if (this.matchPattern(events, pattern)) {
        matchedPatterns.push(pattern);
      }
    }

    return matchedPatterns;
  }

  private matchPattern(events: SecurityEvent[], pattern: SecurityPattern): boolean {
    const matchCount = events.filter(event => 
      pattern.indicators.some(indicator => 
        this.eventMatchesIndicator(event, indicator)
      )
    ).length;

    return matchCount >= pattern.threshold;
  }

  private eventMatchesIndicator(event: SecurityEvent, indicator: string): boolean {
    return event.event_type.includes(indicator) ||
           event.action.includes(indicator) ||
           JSON.stringify(event.metadata).includes(indicator);
  }
}

class RiskScoreCalculator {
  calculateRiskScore(
    events: SecurityEvent[],
    anomalies: Array<SecurityEvent & { anomaly_score: AnomalyScore }>,
    threats: Array<SecurityEvent & { threat_classification: ThreatClassification }>,
    patterns: SecurityPattern[]
  ): RiskScore {
    const frequencyScore = this.calculateFrequencyScore(events);
    const severityScore = this.calculateSeverityScore(events);
    const anomalyScore = this.calculateAnomalyScore(anomalies);
    const patternScore = this.calculatePatternScore(patterns);

    const overall = (frequencyScore + severityScore + anomalyScore + patternScore) / 4;

    return {
      overall: Math.min(overall, 1.0),
      components: {
        frequency: frequencyScore,
        severity: severityScore,
        anomaly: anomalyScore,
        pattern: patternScore
      },
      trend: this.calculateTrend(events)
    };
  }

  private calculateFrequencyScore(events: SecurityEvent[]): number {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentEvents = events.filter(e => new Date(e.timestamp) > oneHourAgo);
    const frequency = recentEvents.length / 100; // Normalize to 100 events/hour baseline
    
    return Math.min(frequency, 1.0);
  }

  private calculateSeverityScore(events: SecurityEvent[]): number {
    const severityWeights = { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 };
    const totalWeight = events.reduce((sum, event) => 
      sum + severityWeights[event.severity], 0);
    
    return events.length > 0 ? totalWeight / events.length : 0;
  }

  private calculateAnomalyScore(anomalies: Array<SecurityEvent & { anomaly_score: AnomalyScore }>): number {
    if (anomalies.length === 0) return 0;
    
    const avgScore = anomalies.reduce((sum, a) => sum + a.anomaly_score.score, 0) / anomalies.length;
    return avgScore;
  }

  private calculatePatternScore(patterns: SecurityPattern[]): number {
    if (patterns.length === 0) return 0;
    
    const criticalPatterns = patterns.filter(p => p.severity === 'critical').length;
    const highPatterns = patterns.filter(p => p.severity === 'high').length;
    
    return Math.min((criticalPatterns * 0.8 + highPatterns * 0.6) / 10, 1.0);
  }

  private calculateTrend(events: SecurityEvent[]): 'increasing' | 'decreasing' | 'stable' {
    const now = new Date();
    const oneHour = 60 * 60 * 1000;
    
    const recent = events.filter(e => new Date(e.timestamp) > new Date(now.getTime() - oneHour)).length;
    const previous = events.filter(e => {
      const timestamp = new Date(e.timestamp);
      return timestamp > new Date(now.getTime() - 2 * oneHour) && 
             timestamp <= new Date(now.getTime() - oneHour);
    }).length;

    if (recent > previous * 1.2) return 'increasing';
    if (recent < previous * 0.8) return 'decreasing';
    return 'stable';
  }
}

class AlertGenerator {
  generateAlerts(
    events: SecurityEvent[],
    anomalies: Array<SecurityEvent & { anomaly_score: AnomalyScore }>,
    threats: Array<SecurityEvent & { threat_classification: ThreatClassification }>,
    riskScore: RiskScore
  ) {
    const alerts: Array<{
      id: string;
      level: 'info' | 'warning' | 'critical';
      message: string;
      events: string[];
      timestamp: string;
    }> = [];

    // High-risk score alert
    if (riskScore.overall > 0.8) {
      alerts.push({
        id: `risk-${Date.now()}`,
        level: 'critical',
        message: `Critical risk level detected: ${(riskScore.overall * 100).toFixed(1)}%`,
        events: events.slice(0, 10).map(e => e.id),
        timestamp: new Date().toISOString()
      });
    }

    // Anomaly alerts
    const highAnomalies = anomalies.filter(a => a.anomaly_score.score > 0.8);
    if (highAnomalies.length > 0) {
      alerts.push({
        id: `anomaly-${Date.now()}`,
        level: 'warning',
        message: `${highAnomalies.length} high-confidence anomalies detected`,
        events: highAnomalies.map(a => a.id),
        timestamp: new Date().toISOString()
      });
    }

    // Threat alerts
    const criticalThreats = threats.filter(t => t.threat_classification.confidence > 0.8);
    if (criticalThreats.length > 0) {
      alerts.push({
        id: `threat-${Date.now()}`,
        level: 'critical',
        message: `${criticalThreats.length} high-confidence threats identified`,
        events: criticalThreats.map(t => t.id),
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }
}

// Main handler
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: AnalyticsRequest = await request.json();
    
    // Validate request
    if (!body.analysis_type) {
      return NextResponse.json(
        { error: 'Missing required field: analysis_type' },
        { status: 400 }
      );
    }

    // Get events
    let events: SecurityEvent[] = [];
    
    if (body.events) {
      events = body.events;
    } else {
      // Fetch from database
      let query = supabase
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false });

      if (body.timeRange) {
        query = query
          .gte('timestamp', body.timeRange.start)
          .lte('timestamp', body.timeRange.end);
      }

      if (body.filters) {
        if (body.filters.event_types) {
          query = query.in('event_type', body.filters.event_types);
        }
        if (body.filters.severity) {
          query = query.in('severity', body.filters.severity);
        }
        if (body.filters.source_ips) {
          query = query.in('source_ip', body.filters.source_ips);
        }
      }

      const { data, error } = await query.limit(1000);
      
      if (error) throw error;
      events = data || [];
    }

    // Initialize analyzer
    const analyzer = new SecurityEventAnalyzer();
    await analyzer.initialize();

    const patternMatcher = new PatternMatcher();
    const riskCalculator = new RiskScoreCalculator();
    const alertGenerator = new AlertGenerator();

    // Perform analysis
    const { anomalies, threats } = body.include_ml_analysis 
      ? await analyzer.analyzeEvents(events)
      : { anomalies: [], threats: [] };

    const patterns = body.include_patterns 
      ? await patternMatcher.findPatterns(events)
      : [];

    const riskScore = riskCalculator.calculateRiskScore(events, anomalies, threats, patterns);
    const alerts = alertGenerator.generateAlerts(events, anomalies, threats, riskScore);

    // Calculate metrics
    const processingTime = Date.now() - startTime;
    const eventsPerSecond = events.length / (processingTime / 1000);

    // Build response
    const response: AnalyticsResponse = {
      summary: {
        total_events: events.length,
        unique_sources: new Set(events.map(e => e.source_ip)).size,
        high_risk_events: events.filter(e => e.severity === 'high' || e.severity === 'critical').length,
        anomalies_detected: anomalies.length
      },
      risk_score: riskScore,
      anomalies,
      threats,
      patterns,
      alerts,
      metrics: {
        processing_time_ms: processingTime,
        events_per_second: eventsPerSecond,
        accuracy_score: 0.85 // Placeholder - would come from model evaluation
      }
    };

    // Add predictions if requested
    if (body.include_predictions) {
      response.predictions = {
        next_hour_risk: Math.min(riskScore.overall * 1.2, 1.0),
        trending_threats: threats.map(t => t.threat_classification.category).slice(0, 5),
        recommended_actions: [
          'Monitor failed login attempts',
          'Review access patterns',
          'Update security rules'
        ]
      };
    }

    // Store analysis results
    await supabase.from('security_analytics_results').insert({
      analysis_type: body.analysis_type,
      events_count: events.length,
      risk_score: riskScore.overall,
      anomalies_count: anomalies.length,
      threats_count: threats.length,
      patterns_count: patterns.length,
      alerts_count: alerts.length,
      processing_time_ms: processingTime,
      created_at: new Date().toISOString()
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Security analytics error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get recent analytics results
    const { data: results, error } = await supabase
      .from('security_analytics_results')
      .select('*')
      .order('created_at', { ascending: false })
      .range(