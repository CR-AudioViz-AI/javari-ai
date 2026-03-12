```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { headers } from 'next/headers';

// Types
interface Agent {
  id: string;
  name: string;
  skills: string[];
  specializations: string[];
  performance_score: number;
  availability_status: 'available' | 'busy' | 'offline';
  cost_per_hour: number;
  experience_level: number;
}

interface TaskRequirement {
  skill: string;
  importance: number;
  complexity: number;
}

interface TeamComposition {
  agents: Agent[];
  synergy_score: number;
  estimated_performance: number;
  total_cost: number;
  confidence: number;
}

interface PerformanceMetric {
  agent_ids: string[];
  task_type: string;
  success_rate: number;
  avg_completion_time: number;
  quality_score: number;
}

// Validation Schema
const OptimizeTeamSchema = z.object({
  task_description: z.string().min(10).max(5000),
  task_type: z.enum(['analysis', 'creative', 'technical', 'research', 'mixed']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  budget_constraint: z.number().positive().optional(),
  deadline_hours: z.number().positive().optional(),
  required_skills: z.array(z.string()).optional(),
  team_size_preference: z.object({
    min: z.number().int().min(1).max(20),
    max: z.number().int().min(1).max(20)
  }).optional(),
  exclude_agents: z.array(z.string()).optional()
});

class TaskRequirementParser {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async parseRequirements(taskDescription: string, taskType: string): Promise<TaskRequirement[]> {
    try {
      const prompt = `Analyze this task and extract required skills with importance (1-10) and complexity (1-10):
Task: "${taskDescription}"
Type: ${taskType}

Return JSON array of: {"skill": "skill_name", "importance": number, "complexity": number}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from OpenAI');

      return JSON.parse(content) as TaskRequirement[];
    } catch (error) {
      console.error('Task requirement parsing failed:', error);
      return this.getFallbackRequirements(taskType);
    }
  }

  private getFallbackRequirements(taskType: string): TaskRequirement[] {
    const fallbackMap: Record<string, TaskRequirement[]> = {
      analysis: [
        { skill: 'data_analysis', importance: 9, complexity: 7 },
        { skill: 'pattern_recognition', importance: 8, complexity: 6 }
      ],
      creative: [
        { skill: 'creative_writing', importance: 9, complexity: 6 },
        { skill: 'ideation', importance: 8, complexity: 5 }
      ],
      technical: [
        { skill: 'programming', importance: 10, complexity: 8 },
        { skill: 'system_design', importance: 9, complexity: 9 }
      ],
      research: [
        { skill: 'information_gathering', importance: 10, complexity: 6 },
        { skill: 'fact_verification', importance: 9, complexity: 7 }
      ],
      mixed: [
        { skill: 'problem_solving', importance: 8, complexity: 7 },
        { skill: 'communication', importance: 7, complexity: 5 }
      ]
    };

    return fallbackMap[taskType] || fallbackMap.mixed;
  }
}

class SkillCompatibilityMatrix {
  private compatibilityScores: Map<string, Map<string, number>> = new Map();

  constructor() {
    this.initializeCompatibilityMatrix();
  }

  private initializeCompatibilityMatrix(): void {
    // Define skill synergies (0-1 scale)
    const synergies = [
      ['data_analysis', 'visualization', 0.9],
      ['programming', 'system_design', 0.8],
      ['creative_writing', 'ideation', 0.85],
      ['research', 'fact_verification', 0.9],
      ['communication', 'presentation', 0.8],
      ['problem_solving', 'critical_thinking', 0.9]
    ];

    synergies.forEach(([skill1, skill2, score]) => {
      if (!this.compatibilityScores.has(skill1)) {
        this.compatibilityScores.set(skill1, new Map());
      }
      if (!this.compatibilityScores.has(skill2)) {
        this.compatibilityScores.set(skill2, new Map());
      }
      
      this.compatibilityScores.get(skill1)!.set(skill2, score);
      this.compatibilityScores.get(skill2)!.set(skill1, score);
    });
  }

  calculateTeamSynergy(agents: Agent[]): number {
    if (agents.length < 2) return 1.0;

    let totalSynergy = 0;
    let pairCount = 0;

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const synergy = this.calculateAgentPairSynergy(agents[i], agents[j]);
        totalSynergy += synergy;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalSynergy / pairCount : 1.0;
  }

  private calculateAgentPairSynergy(agent1: Agent, agent2: Agent): number {
    let maxSynergy = 0;

    agent1.skills.forEach(skill1 => {
      agent2.skills.forEach(skill2 => {
        const synergy = this.compatibilityScores.get(skill1)?.get(skill2) || 0.5;
        maxSynergy = Math.max(maxSynergy, synergy);
      });
    });

    return maxSynergy;
  }
}

class PerformanceAnalyzer {
  constructor(private supabase: any) {}

  async getHistoricalPerformance(agentIds: string[], taskType: string): Promise<number> {
    try {
      const { data: performances } = await this.supabase
        .from('team_performance')
        .select('*')
        .eq('task_type', taskType)
        .contains('agent_ids', agentIds)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!performances || performances.length === 0) {
        return this.calculateBaselinePerformance(agentIds);
      }

      const avgSuccessRate = performances.reduce((sum: number, p: PerformanceMetric) => 
        sum + p.success_rate, 0) / performances.length;
      
      const avgQuality = performances.reduce((sum: number, p: PerformanceMetric) => 
        sum + p.quality_score, 0) / performances.length;

      return (avgSuccessRate * 0.6) + (avgQuality * 0.4);
    } catch (error) {
      console.error('Performance analysis failed:', error);
      return this.calculateBaselinePerformance(agentIds);
    }
  }

  private async calculateBaselinePerformance(agentIds: string[]): Promise<number> {
    try {
      const { data: agents } = await this.supabase
        .from('agents')
        .select('performance_score')
        .in('id', agentIds);

      if (!agents || agents.length === 0) return 0.5;

      const avgScore = agents.reduce((sum: number, agent: Agent) => 
        sum + agent.performance_score, 0) / agents.length;
      
      return Math.min(avgScore / 10, 1.0);
    } catch (error) {
      console.error('Baseline performance calculation failed:', error);
      return 0.5;
    }
  }
}

class TeamSizeOptimizer {
  optimizeTeamSize(
    requirements: TaskRequirement[],
    availableAgents: Agent[],
    constraints: { min?: number; max?: number; budget?: number }
  ): { min: number; max: number } {
    const complexity = requirements.reduce((sum, req) => sum + req.complexity, 0) / requirements.length;
    const importance = requirements.reduce((sum, req) => sum + req.importance, 0) / requirements.length;
    
    // Base team size calculation
    let baseSize = Math.ceil((complexity + importance) / 4);
    
    // Apply constraints
    const min = Math.max(constraints.min || 1, 1);
    const max = Math.min(constraints.max || 10, availableAgents.length);
    
    // Budget constraint
    if (constraints.budget) {
      const avgCost = availableAgents.reduce((sum, agent) => sum + agent.cost_per_hour, 0) / availableAgents.length;
      const maxByBudget = Math.floor(constraints.budget / (avgCost * 8)); // 8 hour estimate
      return { min, max: Math.min(max, maxByBudget) };
    }
    
    return { 
      min: Math.max(min, baseSize - 1), 
      max: Math.min(max, baseSize + 2) 
    };
  }
}

class TeamCompositionOptimizer {
  constructor(
    private skillMatrix: SkillCompatibilityMatrix,
    private performanceAnalyzer: PerformanceAnalyzer,
    private teamSizeOptimizer: TeamSizeOptimizer
  ) {}

  async optimizeTeam(
    requirements: TaskRequirement[],
    availableAgents: Agent[],
    constraints: any,
    taskType: string
  ): Promise<TeamComposition[]> {
    const sizeConstraints = this.teamSizeOptimizer.optimizeTeamSize(
      requirements,
      availableAgents,
      constraints
    );

    const compositions: TeamComposition[] = [];

    // Generate multiple team compositions using genetic algorithm approach
    for (let size = sizeConstraints.min; size <= sizeConstraints.max; size++) {
      const teamCombinations = this.generateTeamCombinations(availableAgents, size, 20);
      
      for (const team of teamCombinations) {
        const composition = await this.evaluateTeamComposition(team, requirements, taskType);
        compositions.push(composition);
      }
    }

    // Sort by overall score and return top 5
    return compositions
      .sort((a, b) => this.calculateOverallScore(b) - this.calculateOverallScore(a))
      .slice(0, 5);
  }

  private generateTeamCombinations(agents: Agent[], size: number, maxCombinations: number): Agent[][] {
    const combinations: Agent[][] = [];
    
    // Greedy approach with randomization for diversity
    for (let i = 0; i < maxCombinations; i++) {
      const team = this.selectTeamGreedy(agents, size);
      if (team.length === size && !this.isDuplicateTeam(team, combinations)) {
        combinations.push(team);
      }
    }

    return combinations;
  }

  private selectTeamGreedy(agents: Agent[], size: number): Agent[] {
    const available = [...agents].sort(() => Math.random() - 0.5); // Shuffle for diversity
    const selected: Agent[] = [];
    
    while (selected.length < size && available.length > 0) {
      const bestIndex = this.findBestNextAgent(available, selected);
      selected.push(...available.splice(bestIndex, 1));
    }

    return selected;
  }

  private findBestNextAgent(available: Agent[], current: Agent[]): number {
    let bestScore = -1;
    let bestIndex = 0;

    available.forEach((agent, index) => {
      const testTeam = [...current, agent];
      const synergy = this.skillMatrix.calculateTeamSynergy(testTeam);
      const performance = agent.performance_score / 10;
      const score = (synergy * 0.6) + (performance * 0.4);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  private isDuplicateTeam(team: Agent[], existing: Agent[][]): boolean {
    const teamIds = team.map(a => a.id).sort();
    return existing.some(existingTeam => {
      const existingIds = existingTeam.map(a => a.id).sort();
      return JSON.stringify(teamIds) === JSON.stringify(existingIds);
    });
  }

  private async evaluateTeamComposition(
    team: Agent[],
    requirements: TaskRequirement[],
    taskType: string
  ): Promise<TeamComposition> {
    const synergyScore = this.skillMatrix.calculateTeamSynergy(team);
    const skillCoverage = this.calculateSkillCoverage(team, requirements);
    const estimatedPerformance = await this.performanceAnalyzer.getHistoricalPerformance(
      team.map(a => a.id),
      taskType
    );
    const totalCost = team.reduce((sum, agent) => sum + agent.cost_per_hour, 0);
    
    // Calculate confidence based on various factors
    const experienceLevel = team.reduce((sum, agent) => sum + agent.experience_level, 0) / team.length;
    const confidence = Math.min(
      (synergyScore * 0.3) + (skillCoverage * 0.4) + (experienceLevel / 10 * 0.3),
      1.0
    );

    return {
      agents: team,
      synergy_score: synergyScore,
      estimated_performance: estimatedPerformance,
      total_cost: totalCost,
      confidence
    };
  }

  private calculateSkillCoverage(team: Agent[], requirements: TaskRequirement[]): number {
    let totalCoverage = 0;
    let totalImportance = 0;

    requirements.forEach(req => {
      const coverage = team.some(agent => agent.skills.includes(req.skill)) ? 1 : 0;
      totalCoverage += coverage * req.importance;
      totalImportance += req.importance;
    });

    return totalImportance > 0 ? totalCoverage / totalImportance : 0;
  }

  private calculateOverallScore(composition: TeamComposition): number {
    return (
      composition.synergy_score * 0.25 +
      composition.estimated_performance * 0.35 +
      composition.confidence * 0.25 +
      (1 - Math.min(composition.total_cost / 1000, 1)) * 0.15 // Lower cost is better
    );
  }
}

// Initialize services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

const taskParser = new TaskRequirementParser(process.env.OPENAI_API_KEY!);
const skillMatrix = new SkillCompatibilityMatrix();
const performanceAnalyzer = new PerformanceAnalyzer(supabase);
const teamSizeOptimizer = new TeamSizeOptimizer();
const teamOptimizer = new TeamCompositionOptimizer(skillMatrix, performanceAnalyzer, teamSizeOptimizer);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting check
    const headersList = headers();
    const forwarded = headersList.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    
    if (redis) {
      const rateLimitKey = `team_optimize_rate_limit:${ip}`;
      const requests = await redis.incr(rateLimitKey);
      if (requests === 1) {
        await redis.expire(rateLimitKey, 300); // 5 minute window
      }
      if (requests > 10) {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429 }
        );
      }
    }

    // Validate request
    const body = await request.json();
    const validatedData = OptimizeTeamSchema.parse(body);

    // Check cache
    const cacheKey = `team_composition:${JSON.stringify(validatedData)}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json(JSON.parse(cached));
      }
    }

    // Parse task requirements
    const requirements = await taskParser.parseRequirements(
      validatedData.task_description,
      validatedData.task_type
    );

    // Get available agents
    let agentsQuery = supabase
      .from('agents')
      .select('*')
      .eq('availability_status', 'available');

    if (validatedData.required_skills?.length) {
      agentsQuery = agentsQuery.overlaps('skills', validatedData.required_skills);
    }

    if (validatedData.exclude_agents?.length) {
      agentsQuery = agentsQuery.not('id', 'in', `(${validatedData.exclude_agents.join(',')})`);
    }

    const { data: availableAgents, error: agentsError } = await agentsQuery;

    if (agentsError) {
      console.error('Database error:', agentsError);
      return NextResponse.json(
        { error: 'Failed to fetch available agents' },
        { status: 500 }
      );
    }

    if (!availableAgents || availableAgents.length === 0) {
      return NextResponse.json(
        { error: 'No available agents match the requirements' },
        { status: 404 }
      );
    }

    // Optimize team compositions
    const compositions = await teamOptimizer.optimizeTeam(
      requirements,
      availableAgents,
      {
        min: validatedData.team_size_preference?.min,
        max: validatedData.team_size_preference?.max,
        budget: validatedData.budget_constraint
      },
      validatedData.task_type
    );

    const response = {
      success: true,
      task_analysis: {
        parsed_requirements: requirements,
        task_type: validatedData.task_type,
        priority: validatedData.priority
      },
      recommended_compositions: compositions,
      metadata: {
        total_available_agents: availableAgents.length,
        compositions_evaluated: compositions.length,
        optimization_timestamp: new Date().toISOString()
      }
    };

    // Cache response
    if (redis) {
      await redis.setex(cacheKey, 300, JSON.stringify(response)); // 5 minute cache
    }

    // Log optimization request
    await supabase
      .from('optimization_logs')
      .insert({
        task_type: validatedData.task_type,
        requirements_count: requirements.length,
        agents_evaluated: availableAgents.length,
        compositions_generated: compositions.length,
        ip_address: ip,
        created_at: new Date().toISOString()
      })
      .catch(console.error);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Team optimization error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    if (agentId) {
      // Get agent's team history
      const { data: teamHistory, error } = await supabase
        .from('team_performance')
        .select('*')
        .contains('agent_ids', [agentId])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        agent_id: agentId,
        team_history: teamHistory || []
      });
    }

    // Get optimization statistics
    const { data: stats, error: statsError } = await supabase
      .from('optimization_logs')
      .select('task_type, count(*)')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .group('task_type');

    if (statsError) throw statsError;

    return NextResponse.json({
      success: true,
      daily_statistics: stats || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('GET request error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```