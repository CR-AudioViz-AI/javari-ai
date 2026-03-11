/**
 * Agent Task Delegation Microservice
 * Intelligently delegates tasks among team members based on capabilities, workload, and complexity
 * 
 * @fileoverview Core service implementation for CR AudioViz AI task delegation
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import CircuitBreaker from 'opossum';
import winston from 'winston';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/**
 * Agent capability and status interfaces
 */
interface AgentCapability {
  agentId: string;
  skills: string[];
  specializations: string[];
  experienceLevel: 'junior' | 'mid' | 'senior' | 'expert';
  maxConcurrentTasks: number;
  preferredTaskTypes: string[];
  availabilityScore: number;
}

interface AgentWorkload {
  agentId: string;
  currentTasks: number;
  averageCompletionTime: number;
  successRate: number;
  lastActive: Date;
  predictedCapacity: number;
  burnoutRisk: number;
}

interface TaskComplexity {
  taskId: string;
  estimatedHours: number;
  skillsRequired: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  complexityScore: number;
  riskLevel: number;
}

interface DelegationTask {
  id: string;
  title: string;
  description: string;
  type: string;
  requiredSkills: string[];
  estimatedEffort: number;
  priority: number;
  deadline?: Date;
  dependencies: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  createdBy: string;
}

interface AssignmentDecision {
  taskId: string;
  assignedAgentId: string;
  confidence: number;
  reasoning: string[];
  alternativeAgents: string[];
  estimatedCompletion: Date;
  riskFactors: string[];
}

interface DelegationMetrics {
  totalTasks: number;
  successfulAssignments: number;
  averageAssignmentTime: number;
  agentUtilization: Record<string, number>;
  queueLength: number;
  failedDelegations: number;
}

/**
 * Core delegation engine with intelligent task assignment
 */
class DelegationEngine {
  private capabilities: Map<string, AgentCapability> = new Map();
  private workloads: Map<string, AgentWorkload> = new Map();
  private readonly logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Calculate weighted assignment score for agent-task pair
   */
  private calculateAssignmentScore(
    agent: AgentCapability,
    workload: AgentWorkload,
    task: DelegationTask,
    complexity: TaskComplexity
  ): number {
    const tracer = trace.getTracer('delegation-engine');
    const span = tracer.startSpan('calculate_assignment_score');
    
    try {
      // Skill matching score (0-1)
      const skillMatch = this.calculateSkillMatch(agent.skills, task.requiredSkills);
      
      // Workload capacity score (0-1)
      const capacityScore = Math.max(0, 1 - (workload.currentTasks / agent.maxConcurrentTasks));
      
      // Experience alignment score (0-1)
      const experienceScore = this.calculateExperienceAlignment(
        agent.experienceLevel,
        complexity.complexityScore
      );
      
      // Availability and performance score (0-1)
      const performanceScore = (agent.availabilityScore * workload.successRate) / 100;
      
      // Preference match score (0-1)
      const preferenceScore = agent.preferredTaskTypes.includes(task.type) ? 1 : 0.5;
      
      // Burnout risk penalty (0-1)
      const burnoutPenalty = Math.max(0, 1 - workload.burnoutRisk);
      
      // Weighted final score
      const weights = {
        skill: 0.3,
        capacity: 0.25,
        experience: 0.2,
        performance: 0.15,
        preference: 0.05,
        burnout: 0.05
      };
      
      const finalScore = (
        skillMatch * weights.skill +
        capacityScore * weights.capacity +
        experienceScore * weights.experience +
        performanceScore * weights.performance +
        preferenceScore * weights.preference +
        burnoutPenalty * weights.burnout
      );
      
      span.setAttributes({
        'agent.id': agent.agentId,
        'task.id': task.id,
        'score.final': finalScore,
        'score.skill': skillMatch,
        'score.capacity': capacityScore,
        'score.experience': experienceScore
      });
      
      return finalScore;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Calculate skill matching score between agent and task
   */
  private calculateSkillMatch(agentSkills: string[], requiredSkills: string[]): number {
    if (requiredSkills.length === 0) return 1;
    
    const matchedSkills = requiredSkills.filter(skill => 
      agentSkills.some(agentSkill => 
        agentSkill.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(agentSkill.toLowerCase())
      )
    );
    
    return matchedSkills.length / requiredSkills.length;
  }

  /**
   * Calculate experience level alignment with task complexity
   */
  private calculateExperienceAlignment(level: string, complexity: number): number {
    const experienceLevels = { junior: 1, mid: 2, senior: 3, expert: 4 };
    const agentLevel = experienceLevels[level as keyof typeof experienceLevels];
    
    // Optimal alignment curve
    const optimalComplexity = agentLevel * 2.5;
    const difference = Math.abs(complexity - optimalComplexity);
    
    return Math.max(0, 1 - (difference / 10));
  }

  /**
   * Find best agent for task delegation
   */
  async findBestAgent(
    task: DelegationTask,
    complexity: TaskComplexity,
    excludeAgents: string[] = []
  ): Promise<AssignmentDecision | null> {
    const tracer = trace.getTracer('delegation-engine');
    const span = tracer.startSpan('find_best_agent');
    
    try {
      const candidates: Array<{ agent: AgentCapability; workload: AgentWorkload; score: number }> = [];
      
      for (const [agentId, agent] of this.capabilities) {
        if (excludeAgents.includes(agentId)) continue;
        
        const workload = this.workloads.get(agentId);
        if (!workload || workload.currentTasks >= agent.maxConcurrentTasks) continue;
        
        const score = this.calculateAssignmentScore(agent, workload, task, complexity);
        candidates.push({ agent, workload, score });
      }
      
      if (candidates.length === 0) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'No available agents' });
        return null;
      }
      
      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);
      
      const bestCandidate = candidates[0];
      const alternativeAgents = candidates.slice(1, 4).map(c => c.agent.agentId);
      
      const estimatedCompletion = new Date();
      estimatedCompletion.setHours(
        estimatedCompletion.getHours() + 
        (task.estimatedEffort * (1 + complexity.riskLevel))
      );
      
      const reasoning = [
        `Skill match: ${(this.calculateSkillMatch(bestCandidate.agent.skills, task.requiredSkills) * 100).toFixed(1)}%`,
        `Current workload: ${bestCandidate.workload.currentTasks}/${bestCandidate.agent.maxConcurrentTasks}`,
        `Success rate: ${bestCandidate.workload.successRate}%`,
        `Experience alignment: ${bestCandidate.agent.experienceLevel} level for complexity ${complexity.complexityScore}`
      ];
      
      const riskFactors = [];
      if (bestCandidate.workload.burnoutRisk > 0.7) {
        riskFactors.push('High burnout risk detected');
      }
      if (complexity.riskLevel > 0.8) {
        riskFactors.push('High task complexity');
      }
      if (task.deadline && task.deadline < estimatedCompletion) {
        riskFactors.push('Tight deadline constraint');
      }
      
      span.setAttributes({
        'assignment.agent_id': bestCandidate.agent.agentId,
        'assignment.confidence': bestCandidate.score,
        'assignment.alternatives_count': alternativeAgents.length
      });
      
      return {
        taskId: task.id,
        assignedAgentId: bestCandidate.agent.agentId,
        confidence: bestCandidate.score,
        reasoning,
        alternativeAgents,
        estimatedCompletion,
        riskFactors
      };
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Update agent capability information
   */
  updateAgentCapability(capability: AgentCapability): void {
    this.capabilities.set(capability.agentId, capability);
    this.logger.info('Updated agent capability', { agentId: capability.agentId });
  }

  /**
   * Update agent workload information
   */
  updateAgentWorkload(workload: AgentWorkload): void {
    this.workloads.set(workload.agentId, workload);
    this.logger.debug('Updated agent workload', { agentId: workload.agentId });
  }
}

/**
 * Real-time workload analyzer with predictive capacity modeling
 */
class WorkloadAnalyzer {
  private readonly redis: Redis;
  private readonly logger: winston.Logger;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Start continuous workload analysis
   */
  startAnalysis(): void {
    this.analysisInterval = setInterval(async () => {
      await this.analyzeWorkloads();
    }, 30000); // Every 30 seconds
    
    this.logger.info('Workload analysis started');
  }

  /**
   * Stop workload analysis
   */
  stopAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
  }

  /**
   * Analyze current workloads and predict capacity
   */
  private async analyzeWorkloads(): Promise<void> {
    const tracer = trace.getTracer('workload-analyzer');
    const span = tracer.startSpan('analyze_workloads');
    
    try {
      const agentIds = await this.redis.smembers('active_agents');
      
      for (const agentId of agentIds) {
        const workloadData = await this.redis.hgetall(`workload:${agentId}`);
        
        if (Object.keys(workloadData).length === 0) continue;
        
        const currentTasks = parseInt(workloadData.currentTasks) || 0;
        const completedToday = parseInt(workloadData.completedToday) || 0;
        const averageTime = parseFloat(workloadData.averageCompletionTime) || 0;
        
        // Calculate burnout risk based on workload patterns
        const burnoutRisk = this.calculateBurnoutRisk({
          currentTasks,
          completedToday,
          averageTime,
          lastBreak: new Date(workloadData.lastBreak || Date.now())
        });
        
        // Predict future capacity
        const predictedCapacity = this.predictCapacity({
          currentTasks,
          historicalAverage: averageTime,
          timeOfDay: new Date().getHours()
        });
        
        await this.redis.hmset(`workload:${agentId}`, {
          burnoutRisk: burnoutRisk.toString(),
          predictedCapacity: predictedCapacity.toString(),
          lastAnalyzed: new Date().toISOString()
        });
      }
      
      span.setAttributes({
        'analysis.agents_processed': agentIds.length
      });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      this.logger.error('Workload analysis failed', { error });
    } finally {
      span.end();
    }
  }

  /**
   * Calculate burnout risk score (0-1)
   */
  private calculateBurnoutRisk(data: {
    currentTasks: number;
    completedToday: number;
    averageTime: number;
    lastBreak: Date;
  }): number {
    const hoursWithoutBreak = (Date.now() - data.lastBreak.getTime()) / (1000 * 60 * 60);
    const workloadFactor = Math.min(1, data.currentTasks / 10);
    const intensityFactor = Math.min(1, data.completedToday / 15);
    const fatigueFactor = Math.min(1, hoursWithoutBreak / 4);
    
    return (workloadFactor + intensityFactor + fatigueFactor) / 3;
  }

  /**
   * Predict agent capacity for next period
   */
  private predictCapacity(data: {
    currentTasks: number;
    historicalAverage: number;
    timeOfDay: number;
  }): number {
    // Time-of-day productivity multiplier
    const productivityCurve = [
      0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, // 0-7 AM
      1.0, 0.9, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9, // 8-15 PM
      0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.3, 0.3  // 16-23 PM
    ];
    
    const timeMultiplier = productivityCurve[data.timeOfDay] || 0.5;
    const baseCapacity = Math.max(1, 10 - data.currentTasks);
    
    return baseCapacity * timeMultiplier;
  }
}

/**
 * Task complexity scorer using heuristic analysis
 */
class TaskComplexityScorer {
  private readonly logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Calculate task complexity score
   */
  async scoreTask(task: DelegationTask): Promise<TaskComplexity> {
    const tracer = trace.getTracer('complexity-scorer');
    const span = tracer.startSpan('score_task_complexity');
    
    try {
      // Base complexity from estimated effort
      const effortScore = Math.min(10, task.estimatedEffort) / 10;
      
      // Skills complexity
      const skillsScore = Math.min(1, task.requiredSkills.length / 5);
      
      // Dependencies complexity
      const depsScore = Math.min(1, task.dependencies.length / 3);
      
      // Priority urgency factor
      const priorityMultiplier = { low: 1, medium: 1.2, high: 1.5, critical: 2 };
      const urgencyFactor = priorityMultiplier[task.priority as keyof typeof priorityMultiplier] || 1;
      
      // Text analysis complexity (basic keyword matching)
      const textComplexity = this.analyzeTextComplexity(task.description);
      
      // Final complexity score (0-10)
      const complexityScore = ((effortScore + skillsScore + depsScore + textComplexity) / 4) * urgencyFactor;
      
      // Risk level based on complexity and constraints
      const riskLevel = this.calculateRiskLevel(task, complexityScore);
      
      span.setAttributes({
        'task.id': task.id,
        'complexity.score': complexityScore,
        'complexity.risk_level': riskLevel
      });
      
      return {
        taskId: task.id,
        estimatedHours: task.estimatedEffort,
        skillsRequired: task.requiredSkills,
        priority: task.priority as 'low' | 'medium' | 'high' | 'critical',
        dependencies: task.dependencies,
        complexityScore: Math.round(complexityScore * 10) / 10,
        riskLevel: Math.round(riskLevel * 10) / 10
      };
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Analyze text complexity using keyword patterns
   */
  private analyzeTextComplexity(text: string): number {
    const complexKeywords = [
      'integration', 'architecture', 'migration', 'optimization', 'algorithm',
      'machine learning', 'ai', 'database', 'security', 'performance',
      'scalability', 'microservice', 'distributed', 'concurrent', 'async'
    ];
    
    const textLower = text.toLowerCase();
    const keywordCount = complexKeywords.filter(keyword => 
      textLower.includes(keyword)
    ).length;
    
    const lengthFactor = Math.min(1, text.length / 500);
    const keywordFactor = Math.min(1, keywordCount / 5);
    
    return (lengthFactor + keywordFactor) / 2;
  }

  /**
   * Calculate risk level for task execution
   */
  private calculateRiskLevel(task: DelegationTask, complexityScore: number): number {
    let risk = complexityScore / 10;
    
    // Deadline pressure
    if (task.deadline) {
      const hoursUntilDeadline = (task.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilDeadline < task.estimatedEffort * 1.5) {
        risk += 0.3;
      }
    }
    
    // Dependencies risk
    if (task.dependencies.length > 2) {
      risk += 0.2;
    }
    
    // New task type risk
    const commonTypes = ['development', 'testing', 'documentation', 'review'];
    if (!commonTypes.includes(task.type)) {
      risk += 0.1;
    }
    
    return Math.min(1, risk);
  }
}

/**
 * Priority-based task queue with deadlock prevention
 */
class TaskQueue {
  private readonly redis: Redis;
  private readonly logger: winston.Logger;
  private readonly queueKey = 'delegation_queue';
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Add task to delegation queue
   */
  async enqueue(task: DelegationTask, complexity: TaskComplexity): Promise<void> {
    const tracer = trace.getTracer('task-queue');
    const span = tracer.startSpan('enqueue_task');
    
    try {
      // Calculate priority score for queue ordering
      const priorityScore = this.calculatePriorityScore(task, complexity);
      
      const queueItem = {
        task,
        complexity,
        priorityScore,
        enqueuedAt: new Date().toISOString(),
        attempts: 0
      };
      
      // Add to Redis sorted set with priority score
      await this.redis.zadd(this.queueKey, priorityScore, JSON.stringify(queueItem));
      
      span.setAttributes({
        'task.id': task.id,
        'queue.priority_score': priorityScore
      });
      
      this.logger.info('Task enqueued for delegation', { 
        taskId: task.id, 
        priority: priorityScore 
      });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get next task from queue (highest priority)
   */
  async dequeue(): Promise<{ task: DelegationTask; complexity: TaskComplexity } | null> {
    const tracer = trace.getTracer('task-queue');
    const span = tracer.startSpan('dequeue_task');
    
    try {
      // Get highest priority item (ZREVRANGE gets highest score first)
      const items = await this.redis.zrevrange(this.queueKey, 0, 0, 'WITHSCORES');
      
      if (items.length === 0) {
        return null;
      }
      
      const itemData = JSON.parse(items[0]);
      const score = parseFloat(items[1]);
      
      // Remove from queue
      await this.redis.zrem(this.queueKey, items[0]);
      
      span.setAttributes({
        'task.id': itemData.task.id,
        'queue.priority_score': score
      });
      
      return {
        task: itemData.task,
        complexity: itemData.complexity
      };
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get queue length
   */
  async getLength(): Promise<number>