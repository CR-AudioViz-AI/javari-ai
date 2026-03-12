```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as tf from '@tensorflow/tfjs-node';
import Redis from 'ioredis';
import WebSocket from 'ws';

// Types
interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  network_latency: number;
  error_rate: number;
  response_time: number;
  active_connections: number;
  timestamp: string;
}

interface FailureScenario {
  id: string;
  type: 'latency' | 'error' | 'resource' | 'network' | 'dependency';
  severity: 'low' | 'medium' | 'high';
  duration: number;
  target: string;
  parameters: Record<string, any>;
  expected_impact: number;
  recovery_time: number;
}

interface ChaosExecution {
  id: string;
  scenario_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
  start_time: string;
  end_time?: string;
  actual_impact: number;
  recovery_metrics: Record<string, number>;
  lessons_learned: string[];
}

interface SafetyThreshold {
  metric: string;
  max_value: number;
  min_value?: number;
  auto_abort: boolean;
}

class ChaosOrchestrator {
  private supabase: any;
  private openai: OpenAI;
  private redis: Redis;
  private model: tf.LayersModel | null = null;
  private safetyThresholds: SafetyThreshold[] = [
    { metric: 'error_rate', max_value: 0.05, auto_abort: true },
    { metric: 'response_time', max_value: 5000, auto_abort: true },
    { metric: 'cpu_usage', max_value: 0.9, auto_abort: true },
    { metric: 'memory_usage', max_value: 0.95, auto_abort: true }
  ];

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    this.redis = new Redis(process.env.REDIS_URL!);
    this.initializeModel();
  }

  private async initializeModel() {
    try {
      // Load pre-trained model for failure prediction
      this.model = await tf.loadLayersModel('/models/chaos-predictor.json');
    } catch (error) {
      console.warn('Model not found, using rule-based approach');
    }
  }

  async analyzeSystemState(): Promise<SystemMetrics> {
    const { data, error } = await this.supabase
      .from('system_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) throw new Error(`Failed to fetch system metrics: ${error.message}`);
    return data;
  }

  async generateFailureScenarios(metrics: SystemMetrics): Promise<FailureScenario[]> {
    const systemContext = {
      current_load: metrics.cpu_usage + metrics.memory_usage,
      error_baseline: metrics.error_rate,
      response_baseline: metrics.response_time,
      stability_score: this.calculateStabilityScore(metrics)
    };

    const prompt = `
      Based on the following system state, recommend 3-5 intelligent chaos engineering scenarios:
      
      System Context:
      - Current Load: ${systemContext.current_load}
      - Error Baseline: ${systemContext.error_baseline}
      - Response Baseline: ${systemContext.response_baseline}
      - Stability Score: ${systemContext.stability_score}
      
      Generate scenarios that will test resilience without causing service disruption.
      Focus on: gradual degradation, dependency failures, resource constraints.
      
      Return JSON array with: type, severity, duration, target, parameters, expected_impact.
    `;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const scenarios = JSON.parse(completion.choices[0].message.content!);
    return scenarios.scenarios.map((s: any) => ({
      ...s,
      id: `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recovery_time: this.estimateRecoveryTime(s)
    }));
  }

  private calculateStabilityScore(metrics: SystemMetrics): number {
    const weights = {
      cpu: 0.25,
      memory: 0.25,
      error_rate: 0.3,
      response_time: 0.2
    };

    const normalizedCpu = Math.max(0, 1 - metrics.cpu_usage);
    const normalizedMemory = Math.max(0, 1 - metrics.memory_usage);
    const normalizedErrors = Math.max(0, 1 - metrics.error_rate * 20);
    const normalizedResponse = Math.max(0, 1 - metrics.response_time / 10000);

    return (
      weights.cpu * normalizedCpu +
      weights.memory * normalizedMemory +
      weights.error_rate * normalizedErrors +
      weights.response_time * normalizedResponse
    );
  }

  private estimateRecoveryTime(scenario: FailureScenario): number {
    const baseRecovery = {
      low: 30,
      medium: 90,
      high: 300
    };
    
    const complexityMultiplier = {
      latency: 1,
      error: 1.2,
      resource: 1.5,
      network: 2,
      dependency: 2.5
    };

    return baseRecovery[scenario.severity] * complexityMultiplier[scenario.type];
  }

  async executeChaosScenario(scenario: FailureScenario): Promise<ChaosExecution> {
    const execution: ChaosExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scenario_id: scenario.id,
      status: 'pending',
      start_time: new Date().toISOString(),
      actual_impact: 0,
      recovery_metrics: {},
      lessons_learned: []
    };

    try {
      // Store execution state in Redis
      await this.redis.setex(`chaos:execution:${execution.id}`, 3600, JSON.stringify(execution));

      // Log to Supabase
      await this.supabase.from('chaos_executions').insert(execution);

      execution.status = 'running';
      await this.redis.setex(`chaos:execution:${execution.id}`, 3600, JSON.stringify(execution));

      // Execute the chaos scenario
      await this.performChaosInjection(scenario, execution);

      // Monitor and collect metrics
      const monitoringResults = await this.monitorChaosImpact(scenario, execution);
      
      execution.actual_impact = monitoringResults.impact;
      execution.recovery_metrics = monitoringResults.recovery;
      execution.lessons_learned = await this.extractLessonsLearned(scenario, monitoringResults);
      execution.status = 'completed';
      execution.end_time = new Date().toISOString();

    } catch (error: any) {
      execution.status = 'failed';
      execution.end_time = new Date().toISOString();
      execution.lessons_learned.push(`Execution failed: ${error.message}`);
    }

    // Update final state
    await this.redis.setex(`chaos:execution:${execution.id}`, 86400, JSON.stringify(execution));
    await this.supabase.from('chaos_executions').update(execution).eq('id', execution.id);

    return execution;
  }

  private async performChaosInjection(scenario: FailureScenario, execution: ChaosExecution) {
    const injectionStrategies = {
      latency: async () => {
        // Inject artificial delays
        await this.redis.setex(
          `chaos:latency:${scenario.target}`,
          scenario.duration,
          scenario.parameters.delay_ms.toString()
        );
      },
      error: async () => {
        // Inject error responses
        await this.redis.setex(
          `chaos:errors:${scenario.target}`,
          scenario.duration,
          JSON.stringify({
            error_rate: scenario.parameters.error_percentage,
            error_types: scenario.parameters.error_types
          })
        );
      },
      resource: async () => {
        // Simulate resource constraints
        await this.redis.setex(
          `chaos:resource:${scenario.target}`,
          scenario.duration,
          JSON.stringify({
            cpu_limit: scenario.parameters.cpu_throttle,
            memory_limit: scenario.parameters.memory_limit
          })
        );
      },
      network: async () => {
        // Inject network partitions/delays
        await this.redis.setex(
          `chaos:network:${scenario.target}`,
          scenario.duration,
          JSON.stringify({
            packet_loss: scenario.parameters.packet_loss,
            bandwidth_limit: scenario.parameters.bandwidth_limit
          })
        );
      },
      dependency: async () => {
        // Simulate dependency failures
        await this.redis.setex(
          `chaos:dependency:${scenario.target}`,
          scenario.duration,
          JSON.stringify({
            service: scenario.parameters.dependent_service,
            failure_mode: scenario.parameters.failure_mode
          })
        );
      }
    };

    await injectionStrategies[scenario.type]();
  }

  private async monitorChaosImpact(scenario: FailureScenario, execution: ChaosExecution) {
    const startTime = Date.now();
    const monitoringInterval = 10000; // 10 seconds
    const metrics: SystemMetrics[] = [];
    let safetyViolations = 0;

    return new Promise((resolve) => {
      const monitor = setInterval(async () => {
        const currentMetrics = await this.analyzeSystemState();
        metrics.push(currentMetrics);

        // Check safety thresholds
        const violations = this.checkSafetyThresholds(currentMetrics);
        if (violations.length > 0) {
          safetyViolations += violations.length;
          
          // Auto-abort if critical thresholds exceeded
          const criticalViolations = violations.filter(v => v.auto_abort);
          if (criticalViolations.length > 0 || safetyViolations > 5) {
            clearInterval(monitor);
            await this.abortChaosExecution(scenario);
            resolve({
              impact: this.calculateImpactScore(metrics),
              recovery: { auto_abort: true, violations: violations.length },
              aborted: true
            });
            return;
          }
        }

        // Check if scenario duration completed
        if (Date.now() - startTime >= scenario.duration * 1000) {
          clearInterval(monitor);
          await this.cleanupChaosInjection(scenario);
          
          // Wait for recovery and measure
          setTimeout(async () => {
            const recoveryMetrics = await this.measureRecovery(scenario);
            resolve({
              impact: this.calculateImpactScore(metrics),
              recovery: recoveryMetrics,
              aborted: false
            });
          }, scenario.recovery_time * 1000);
        }
      }, monitoringInterval);
    });
  }

  private checkSafetyThresholds(metrics: SystemMetrics): SafetyThreshold[] {
    return this.safetyThresholds.filter(threshold => {
      const value = metrics[threshold.metric as keyof SystemMetrics] as number;
      if (threshold.min_value && value < threshold.min_value) return true;
      if (value > threshold.max_value) return true;
      return false;
    });
  }

  private calculateImpactScore(metrics: SystemMetrics[]): number {
    if (metrics.length === 0) return 0;

    const baseline = metrics[0];
    const impactMetrics = metrics.slice(1);

    const avgErrorIncrease = impactMetrics.reduce((sum, m) => 
      sum + Math.max(0, m.error_rate - baseline.error_rate), 0) / impactMetrics.length;
    
    const avgResponseIncrease = impactMetrics.reduce((sum, m) => 
      sum + Math.max(0, (m.response_time - baseline.response_time) / baseline.response_time), 0) / impactMetrics.length;

    return Math.min(1, (avgErrorIncrease * 10) + (avgResponseIncrease * 0.5));
  }

  private async abortChaosExecution(scenario: FailureScenario) {
    await this.cleanupChaosInjection(scenario);
    await this.redis.setex(`chaos:aborted:${scenario.id}`, 300, 'true');
  }

  private async cleanupChaosInjection(scenario: FailureScenario) {
    const cleanupKeys = [
      `chaos:latency:${scenario.target}`,
      `chaos:errors:${scenario.target}`,
      `chaos:resource:${scenario.target}`,
      `chaos:network:${scenario.target}`,
      `chaos:dependency:${scenario.target}`
    ];

    await Promise.all(cleanupKeys.map(key => this.redis.del(key)));
  }

  private async measureRecovery(scenario: FailureScenario): Promise<Record<string, number>> {
    const postChaosMetrics = await this.analyzeSystemState();
    
    return {
      error_rate_recovery: Math.max(0, 1 - postChaosMetrics.error_rate),
      response_time_recovery: Math.max(0, 1 - (postChaosMetrics.response_time / 10000)),
      system_stability: this.calculateStabilityScore(postChaosMetrics),
      recovery_duration: scenario.recovery_time
    };
  }

  private async extractLessonsLearned(scenario: FailureScenario, results: any): Promise<string[]> {
    const prompt = `
      Analyze this chaos engineering experiment and extract key lessons:
      
      Scenario: ${JSON.stringify(scenario)}
      Results: ${JSON.stringify(results)}
      
      Provide 3-5 actionable insights about system resilience and areas for improvement.
    `;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    });

    return completion.choices[0].message.content!
      .split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, 5);
  }
}

// Rate limiting middleware
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, limit: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimiter.has(identifier)) {
    rateLimiter.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  const record = rateLimiter.get(identifier)!;
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, scenario_id, parameters } = body;

    // Rate limiting
    const clientId = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`chaos:${clientId}`, 3, 300000)) { // 3 requests per 5 minutes
      return NextResponse.json(
        { error: 'Rate limit exceeded. Chaos engineering operations are limited for safety.' },
        { status: 429 }
      );
    }

    // Input validation
    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }

    const orchestrator = new ChaosOrchestrator();

    switch (action) {
      case 'analyze_system': {
        const metrics = await orchestrator.analyzeSystemState();
        const scenarios = await orchestrator.generateFailureScenarios(metrics);
        
        return NextResponse.json({
          system_metrics: metrics,
          recommended_scenarios: scenarios,
          safety_status: 'active',
          timestamp: new Date().toISOString()
        });
      }

      case 'execute_scenario': {
        if (!scenario_id) {
          return NextResponse.json({ error: 'Scenario ID required' }, { status: 400 });
        }

        // Additional safety check
        const currentMetrics = await orchestrator.analyzeSystemState();
        if (currentMetrics.error_rate > 0.02 || currentMetrics.cpu_usage > 0.8) {
          return NextResponse.json({
            error: 'System not in safe state for chaos engineering',
            current_metrics: currentMetrics
          }, { status: 423 });
        }

        const scenarios = await orchestrator.generateFailureScenarios(currentMetrics);
        const scenario = scenarios.find(s => s.id === scenario_id);
        
        if (!scenario) {
          return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
        }

        const execution = await orchestrator.executeChaosScenario(scenario);
        
        return NextResponse.json({
          execution_id: execution.id,
          status: execution.status,
          estimated_duration: scenario.duration,
          monitoring_enabled: true
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Chaos Engineering API Error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const execution_id = searchParams.get('execution_id');
    const action = searchParams.get('action') || 'status';

    const orchestrator = new ChaosOrchestrator();

    switch (action) {
      case 'status': {
        if (!execution_id) {
          return NextResponse.json({ error: 'Execution ID required' }, { status: 400 });
        }

        const redis = new Redis(process.env.REDIS_URL!);
        const executionData = await redis.get(`chaos:execution:${execution_id}`);
        
        if (!executionData) {
          return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
        }

        const execution = JSON.parse(executionData);
        return NextResponse.json(execution);
      }

      case 'metrics': {
        const metrics = await orchestrator.analyzeSystemState();
        return NextResponse.json({
          current_metrics: metrics,
          safety_thresholds: orchestrator['safetyThresholds'],
          system_health: metrics.error_rate < 0.01 ? 'healthy' : 'degraded'
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Chaos Engineering GET Error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable'
      },
      { status: 500 }
    );
  }
}
```