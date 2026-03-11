import { createClient } from '@supabase/supabase-js';
import React, { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Agent capability definition
 */
interface AgentCapability {
  id: string;
  name: string;
  level: number; // 1-10 proficiency scale
  category: 'technical' | 'creative' | 'analytical' | 'communication' | 'domain';
  certifications?: string[];
  lastUpdated: Date;
}

/**
 * Agent profile with capabilities and status
 */
interface AgentProfile {
  id: string;
  name: string;
  type: 'ai' | 'human' | 'hybrid';
  capabilities: AgentCapability[];
  availability: 'available' | 'busy' | 'offline';
  workload: number; // 0-100 current capacity usage
  timezone: string;
  performanceRating: number; // 1-10 overall rating
  collaborationPreferences: string[];
  metadata: Record<string, any>;
}

/**
 * Task requirement specification
 */
interface TaskRequirement {
  capability: string;
  level: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedHours?: number;
  dependencies?: string[];
}

/**
 * Team formation task specification
 */
interface TeamFormationTask {
  id: string;
  name: string;
  description: string;
  requirements: TaskRequirement[];
  maxTeamSize: number;
  deadline?: Date;
  budget?: number;
  constraints?: {
    timezone?: string[];
    excludeAgents?: string[];
    requireAgents?: string[];
    maxWorkload?: number;
  };
}

/**
 * Collaboration history record
 */
interface CollaborationHistory {
  agentA: string;
  agentB: string;
  projectsCount: number;
  successRate: number;
  avgRating: number;
  conflictCount: number;
  synergyScore: number;
  lastCollaboration: Date;
}

/**
 * Team composition result
 */
interface TeamComposition {
  agents: AgentProfile[];
  score: number;
  coverage: Record<string, number>;
  estimatedCost?: number;
  estimatedDuration?: number;
  riskFactors: string[];
  recommendations: string[];
}

/**
 * Team assembly options
 */
interface TeamAssemblyOptions {
  optimizeFor: 'speed' | 'quality' | 'cost' | 'balanced';
  allowPartialMatch: boolean;
  maxIterations: number;
  diversityWeight: number;
  experienceWeight: number;
  availabilityWeight: number;
  synergyWeight: number;
}

/**
 * Task requirement parser for extracting capability needs
 */
class TaskRequirementParser {
  private capabilityKeywords: Map<string, string[]> = new Map([
    ['technical', ['programming', 'coding', 'development', 'engineering', 'architecture']],
    ['creative', ['design', 'creative', 'artistic', 'visual', 'ui', 'ux']],
    ['analytical', ['analysis', 'data', 'research', 'statistics', 'modeling']],
    ['communication', ['writing', 'documentation', 'presentation', 'marketing']],
    ['domain', ['business', 'domain', 'industry', 'specialist', 'expert']]
  ]);

  /**
   * Parse task description to extract capability requirements
   */
  parseRequirements(description: string): TaskRequirement[] {
    const requirements: TaskRequirement[] = [];
    const words = description.toLowerCase().split(/\W+/);
    const capabilityMatches = new Map<string, number>();

    // Analyze text for capability keywords
    for (const [category, keywords] of this.capabilityKeywords) {
      let matches = 0;
      for (const keyword of keywords) {
        matches += words.filter(word => word.includes(keyword)).length;
      }
      if (matches > 0) {
        capabilityMatches.set(category, matches);
      }
    }

    // Convert matches to requirements
    for (const [capability, count] of capabilityMatches) {
      requirements.push({
        capability,
        level: Math.min(Math.ceil(count * 2), 10),
        priority: count > 3 ? 'high' : count > 1 ? 'medium' : 'low'
      });
    }

    return requirements;
  }

  /**
   * Validate and normalize requirements
   */
  validateRequirements(requirements: TaskRequirement[]): TaskRequirement[] {
    return requirements.map(req => ({
      ...req,
      level: Math.max(1, Math.min(10, req.level)),
      priority: req.priority || 'medium'
    }));
  }
}

/**
 * Agent capability matching and compatibility scoring
 */
class CapabilityMatcher {
  /**
   * Calculate capability match score between agent and requirement
   */
  calculateCapabilityScore(agent: AgentProfile, requirement: TaskRequirement): number {
    const capability = agent.capabilities.find(cap => 
      cap.category === requirement.capability || cap.name === requirement.capability
    );

    if (!capability) return 0;

    const levelMatch = Math.max(0, 1 - Math.abs(capability.level - requirement.level) / 10);
    const priorityMultiplier = this.getPriorityMultiplier(requirement.priority);
    
    return levelMatch * priorityMultiplier;
  }

  /**
   * Calculate overall compatibility score for agent and task
   */
  calculateCompatibilityScore(agent: AgentProfile, task: TeamFormationTask): number {
    if (agent.availability === 'offline') return 0;
    
    let totalScore = 0;
    let totalWeight = 0;

    for (const requirement of task.requirements) {
      const capabilityScore = this.calculateCapabilityScore(agent, requirement);
      const weight = this.getPriorityMultiplier(requirement.priority);
      
      totalScore += capabilityScore * weight;
      totalWeight += weight;
    }

    const baseScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const availabilityBonus = this.getAvailabilityBonus(agent);
    const workloadPenalty = agent.workload / 100;

    return Math.max(0, baseScore * availabilityBonus * (1 - workloadPenalty));
  }

  /**
   * Get priority multiplier for scoring
   */
  private getPriorityMultiplier(priority: string): number {
    switch (priority) {
      case 'critical': return 2.0;
      case 'high': return 1.5;
      case 'medium': return 1.0;
      case 'low': return 0.7;
      default: return 1.0;
    }
  }

  /**
   * Get availability bonus multiplier
   */
  private getAvailabilityBonus(agent: AgentProfile): number {
    switch (agent.availability) {
      case 'available': return 1.0;
      case 'busy': return 0.5;
      case 'offline': return 0.0;
      default: return 0.0;
    }
  }
}

/**
 * Historical collaboration analysis for synergy calculation
 */
class CollaborationAnalyzer {
  private collaborationHistory: Map<string, CollaborationHistory> = new Map();

  /**
   * Load collaboration history from database
   */
  async loadCollaborationHistory(supabase: any): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('collaboration_metrics')
        .select('*');

      if (error) throw error;

      this.collaborationHistory.clear();
      data.forEach((record: any) => {
        const key = `${record.agent_a}_${record.agent_b}`;
        this.collaborationHistory.set(key, {
          agentA: record.agent_a,
          agentB: record.agent_b,
          projectsCount: record.projects_count || 0,
          successRate: record.success_rate || 0,
          avgRating: record.avg_rating || 0,
          conflictCount: record.conflict_count || 0,
          synergyScore: record.synergy_score || 0,
          lastCollaboration: new Date(record.last_collaboration)
        });
      });
    } catch (error) {
      console.error('Failed to load collaboration history:', error);
      throw new Error('Collaboration history loading failed');
    }
  }

  /**
   * Calculate synergy score between two agents
   */
  calculateSynergyScore(agentA: string, agentB: string): number {
    const key1 = `${agentA}_${agentB}`;
    const key2 = `${agentB}_${agentA}`;
    
    const history = this.collaborationHistory.get(key1) || this.collaborationHistory.get(key2);
    
    if (!history) return 0.5; // Neutral score for unknown pairs

    const successWeight = history.successRate;
    const ratingWeight = history.avgRating / 10;
    const experienceWeight = Math.min(history.projectsCount / 10, 1);
    const conflictPenalty = Math.max(0, 1 - history.conflictCount / 5);
    
    return (successWeight * 0.3 + ratingWeight * 0.3 + experienceWeight * 0.2 + conflictPenalty * 0.2);
  }

  /**
   * Calculate team synergy score
   */
  calculateTeamSynergy(agents: AgentProfile[]): number {
    if (agents.length < 2) return 1.0;

    let totalSynergy = 0;
    let pairCount = 0;

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        totalSynergy += this.calculateSynergyScore(agents[i].id, agents[j].id);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalSynergy / pairCount : 1.0;
  }

  /**
   * Identify potential team conflicts
   */
  identifyPotentialConflicts(agents: AgentProfile[]): string[] {
    const conflicts: string[] = [];

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const synergyScore = this.calculateSynergyScore(agents[i].id, agents[j].id);
        if (synergyScore < 0.3) {
          conflicts.push(`Potential conflict between ${agents[i].name} and ${agents[j].name}`);
        }
      }
    }

    return conflicts;
  }
}

/**
 * Genetic algorithm-based team optimizer
 */
class TeamOptimizer {
  private matcher: CapabilityMatcher;
  private analyzer: CollaborationAnalyzer;

  constructor(matcher: CapabilityMatcher, analyzer: CollaborationAnalyzer) {
    this.matcher = matcher;
    this.analyzer = analyzer;
  }

  /**
   * Optimize team composition using genetic algorithm
   */
  optimizeTeam(
    agents: AgentProfile[],
    task: TeamFormationTask,
    options: TeamAssemblyOptions
  ): TeamComposition {
    const populationSize = 50;
    const generations = options.maxIterations;
    
    // Create initial population
    let population = this.createInitialPopulation(agents, task, populationSize);
    
    // Evolve population
    for (let gen = 0; gen < generations; gen++) {
      const scored = population.map(individual => ({
        agents: individual,
        score: this.calculateTeamFitness(individual, task, options)
      }));

      // Selection
      scored.sort((a, b) => b.score - a.score);
      const survivors = scored.slice(0, populationSize / 2);
      
      // Reproduction
      const offspring: AgentProfile[][] = [];
      while (offspring.length < populationSize / 2) {
        const parent1 = this.selectParent(survivors);
        const parent2 = this.selectParent(survivors);
        const child = this.crossover(parent1.agents, parent2.agents, task);
        offspring.push(this.mutate(child, agents, 0.1));
      }

      population = [...survivors.map(s => s.agents), ...offspring];
    }

    // Return best solution
    const finalScored = population.map(individual => ({
      agents: individual,
      score: this.calculateTeamFitness(individual, task, options)
    }));

    finalScored.sort((a, b) => b.score - a.score);
    const best = finalScored[0];

    return {
      agents: best.agents,
      score: best.score,
      coverage: this.calculateCoverage(best.agents, task),
      riskFactors: this.analyzer.identifyPotentialConflicts(best.agents),
      recommendations: this.generateRecommendations(best.agents, task)
    };
  }

  /**
   * Create initial population of team compositions
   */
  private createInitialPopulation(
    agents: AgentProfile[],
    task: TeamFormationTask,
    size: number
  ): AgentProfile[][] {
    const population: AgentProfile[][] = [];
    const availableAgents = agents.filter(agent => 
      agent.availability !== 'offline' &&
      !task.constraints?.excludeAgents?.includes(agent.id)
    );

    for (let i = 0; i < size; i++) {
      const teamSize = Math.min(
        Math.floor(Math.random() * task.maxTeamSize) + 1,
        availableAgents.length
      );
      
      const team: AgentProfile[] = [];
      const shuffled = [...availableAgents].sort(() => Math.random() - 0.5);
      
      for (let j = 0; j < teamSize; j++) {
        team.push(shuffled[j]);
      }
      
      population.push(team);
    }

    return population;
  }

  /**
   * Calculate fitness score for a team composition
   */
  private calculateTeamFitness(
    team: AgentProfile[],
    task: TeamFormationTask,
    options: TeamAssemblyOptions
  ): number {
    const capabilityScore = this.calculateTeamCapabilityScore(team, task);
    const synergyScore = this.analyzer.calculateTeamSynergy(team);
    const diversityScore = this.calculateDiversityScore(team);
    const availabilityScore = this.calculateAvailabilityScore(team);

    return (
      capabilityScore * 0.4 +
      synergyScore * options.synergyWeight * 0.3 +
      diversityScore * options.diversityWeight * 0.2 +
      availabilityScore * options.availabilityWeight * 0.1
    );
  }

  /**
   * Calculate team capability coverage score
   */
  private calculateTeamCapabilityScore(team: AgentProfile[], task: TeamFormationTask): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const requirement of task.requirements) {
      let bestScore = 0;
      for (const agent of team) {
        const score = this.matcher.calculateCapabilityScore(agent, requirement);
        bestScore = Math.max(bestScore, score);
      }
      
      const weight = this.matcher['getPriorityMultiplier'](requirement.priority);
      totalScore += bestScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Calculate team diversity score
   */
  private calculateDiversityScore(team: AgentProfile[]): number {
    if (team.length <= 1) return 1.0;

    const capabilities = new Set<string>();
    const types = new Set<string>();
    
    team.forEach(agent => {
      agent.capabilities.forEach(cap => capabilities.add(cap.category));
      types.add(agent.type);
    });

    const capabilityDiversity = capabilities.size / 5; // Max 5 categories
    const typeDiversity = types.size / 3; // Max 3 types

    return (capabilityDiversity + typeDiversity) / 2;
  }

  /**
   * Calculate team availability score
   */
  private calculateAvailabilityScore(team: AgentProfile[]): number {
    const avgWorkload = team.reduce((sum, agent) => sum + agent.workload, 0) / team.length;
    return Math.max(0, 1 - avgWorkload / 100);
  }

  /**
   * Select parent for reproduction
   */
  private selectParent(scoredPopulation: { agents: AgentProfile[]; score: number }[]): { agents: AgentProfile[]; score: number } {
    const totalScore = scoredPopulation.reduce((sum, individual) => sum + individual.score, 0);
    let random = Math.random() * totalScore;
    
    for (const individual of scoredPopulation) {
      random -= individual.score;
      if (random <= 0) return individual;
    }
    
    return scoredPopulation[0];
  }

  /**
   * Create offspring through crossover
   */
  private crossover(parent1: AgentProfile[], parent2: AgentProfile[], task: TeamFormationTask): AgentProfile[] {
    const maxSize = task.maxTeamSize;
    const combined = [...new Set([...parent1, ...parent2])];
    const childSize = Math.min(Math.floor(Math.random() * maxSize) + 1, combined.length);
    
    return combined.slice(0, childSize);
  }

  /**
   * Mutate team composition
   */
  private mutate(team: AgentProfile[], allAgents: AgentProfile[], mutationRate: number): AgentProfile[] {
    if (Math.random() > mutationRate) return team;

    const availableAgents = allAgents.filter(agent => 
      agent.availability !== 'offline' && !team.includes(agent)
    );

    if (availableAgents.length === 0) return team;

    const mutated = [...team];
    
    if (Math.random() < 0.5 && mutated.length > 1) {
      // Remove random agent
      mutated.splice(Math.floor(Math.random() * mutated.length), 1);
    } else if (availableAgents.length > 0) {
      // Add random agent
      const randomAgent = availableAgents[Math.floor(Math.random() * availableAgents.length)];
      mutated.push(randomAgent);
    }

    return mutated;
  }

  /**
   * Calculate requirement coverage for team
   */
  private calculateCoverage(team: AgentProfile[], task: TeamFormationTask): Record<string, number> {
    const coverage: Record<string, number> = {};

    for (const requirement of task.requirements) {
      let bestScore = 0;
      for (const agent of team) {
        const score = this.matcher.calculateCapabilityScore(agent, requirement);
        bestScore = Math.max(bestScore, score);
      }
      coverage[requirement.capability] = bestScore;
    }

    return coverage;
  }

  /**
   * Generate recommendations for team improvement
   */
  private generateRecommendations(team: AgentProfile[], task: TeamFormationTask): string[] {
    const recommendations: string[] = [];
    const coverage = this.calculateCoverage(team, task);

    // Check for low coverage areas
    for (const [capability, score] of Object.entries(coverage)) {
      if (score < 0.7) {
        recommendations.push(`Consider adding more expertise in ${capability}`);
      }
    }

    // Check team size
    if (team.length < task.maxTeamSize / 2) {
      recommendations.push('Team might benefit from additional members');
    }

    // Check workload distribution
    const avgWorkload = team.reduce((sum, agent) => sum + agent.workload, 0) / team.length;
    if (avgWorkload > 80) {
      recommendations.push('Team members have high workload - consider timeline adjustment');
    }

    return recommendations;
  }
}

/**
 * Agent pool manager for tracking availability
 */
class AgentPoolManager {
  private agents: Map<string, AgentProfile> = new Map();
  private lastUpdate: Date = new Date();

  /**
   * Load agent pool from database
   */
  async loadAgents(supabase: any): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select(`
          *,
          agent_capabilities(*)
        `);

      if (error) throw error;

      this.agents.clear();
      data.forEach((record: any) => {
        const agent: AgentProfile = {
          id: record.id,
          name: record.name,
          type: record.type,
          capabilities: record.agent_capabilities?.map((cap: any) => ({
            id: cap.id,
            name: cap.name,
            level: cap.level,
            category: cap.category,
            certifications: cap.certifications,
            lastUpdated: new Date(cap.last_updated)
          })) || [],
          availability: record.availability || 'available',
          workload: record.workload || 0,
          timezone: record.timezone,
          performanceRating: record.performance_rating || 5,
          collaborationPreferences: record.collaboration_preferences || [],
          metadata: record.metadata || {}
        };
        this.agents.set(agent.id, agent);
      });

      this.lastUpdate = new Date();
    } catch (error) {
      console.error('Failed to load agent pool:', error);
      throw new Error('Agent pool loading failed');
    }
  }

  /**
   * Get all available agents
   */
  getAvailableAgents(): AgentProfile[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.availability !== 'offline'
    );
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): AgentProfile | undefined {
    return this.agents.get(id);
  }

  /**
   * Update agent availability
   */
  async updateAgentAvailability(
    supabase: any,
    agentId: string, 
    availability: AgentProfile['availability'],
    workload?: number
  ): Promise<void> {
    try {
      const updates: any = { availability };
      if (workload !== undefined) updates.workload = workload;

      const { error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', agentId);

      if (error) throw error;

      const agent = this.agents.get(agentId);
      if (agent) {
        agent.availability = availability;
        if (workload !== undefined) agent.workload = workload;
      }
    } catch (error) {
      console.error('Failed to update agent availability:', error);
      throw new Error('Agent availability update failed');
    }
  }

  /**
   *