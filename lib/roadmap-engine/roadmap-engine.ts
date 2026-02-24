// lib/roadmap-engine/roadmap-engine.ts
/**
 * JAVARI ROADMAP ENGINE - CORE
 * 
 * Autonomous roadmap execution system with multi-AI orchestration
 * Supports Universe 3.5 context loading and continuous execution
 * 
 * JAAE Phase 4 Implementation
 */

import { getProvider, getProviderApiKey } from '../javari/providers';
import type { AIProvider } from '../javari/router/types';

// Roadmap Task Definition
export interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  provider?: AIProvider;
  dependencies: string[];
  result?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  maxRetries: number;
}

// Roadmap State
export interface RoadmapState {
  id: string;
  title: string;
  description: string;
  tasks: RoadmapTask[];
  currentTaskId?: string;
  status: 'idle' | 'planning' | 'executing' | 'complete' | 'failed';
  createdAt: number;
  updatedAt: number;
  metadata: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    progress: number;
  };
}

// Execution Strategy
export type ExecutionStrategy = 
  | 'sequential'      // One task at a time
  | 'parallel'        // All tasks simultaneously
  | 'dependency-driven'; // Respect task dependencies

// Provider Role Mapping
const PROVIDER_ROLES: Record<string, AIProvider> = {
  'planning': 'openai',        // o-series for task breakdown
  'validation': 'anthropic',   // Claude for validation
  'execution': 'mistral',      // Fast execution loops
  'research': 'perplexity',    // Research and web search
  'coding': 'deepseek',        // Code generation
  'fallback': 'groq',          // Fast fallback
};

/**
 * Roadmap Engine - Manages autonomous task execution
 */
export class RoadmapEngine {
  private state: RoadmapState;
  private strategy: ExecutionStrategy;
  private listeners: Array<(state: RoadmapState) => void> = [];

  constructor(
    title: string,
    description: string,
    strategy: ExecutionStrategy = 'dependency-driven'
  ) {
    this.strategy = strategy;
    this.state = {
      id: `roadmap-${Date.now()}`,
      title,
      description,
      tasks: [],
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        progress: 0,
      },
    };
  }

  /**
   * Initialize roadmap with tasks breakdown
   * Uses OpenAI o-series for intelligent task decomposition
   */
  async initialize(userPrompt: string): Promise<void> {
    this.updateStatus('planning');

    try {
      // Use OpenAI for task breakdown
      const provider = getProvider('openai', getProviderApiKey('openai'));
      
      const planningPrompt = `You are a roadmap planning AI. Break down this request into discrete, executable tasks:

REQUEST: ${userPrompt}

Return a JSON array of tasks with this structure:
[
  {
    "id": "task-1",
    "title": "Task title",
    "description": "Detailed description",
    "dependencies": [],
    "provider": "openai|anthropic|mistral|perplexity|deepseek"
  }
]

Consider:
- Each task should be atomic and testable
- Tasks should have clear success criteria
- Include dependencies for proper sequencing
- Assign appropriate AI provider based on task type
- Planning/reasoning → openai
- Validation/review → anthropic
- Fast execution → mistral
- Research/search → perplexity
- Code generation → deepseek`;

      let taskPlan = '';
      for await (const chunk of provider.generateStream(planningPrompt, {
        temperature: 0.3,
        maxTokens: 4000,
      })) {
        taskPlan += chunk;
      }

      // Parse task breakdown
      const tasksMatch = taskPlan.match(/\[[\s\S]*\]/);
      if (!tasksMatch) {
        throw new Error('Failed to parse task breakdown');
      }

      const parsedTasks = JSON.parse(tasksMatch[0]);
      
      // Create roadmap tasks
      this.state.tasks = parsedTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: 'pending',
        provider: t.provider || 'mistral',
        dependencies: t.dependencies || [],
        retryCount: 0,
        maxRetries: 3,
      }));

      this.state.metadata.totalTasks = this.state.tasks.length;
      this.updateStatus('executing');
      this.notifyListeners();

    } catch (error) {
      this.updateStatus('failed');
      throw new Error(`Roadmap initialization failed: ${error}`);
    }
  }

  /**
   * Execute roadmap using selected strategy
   */
  async execute(): Promise<void> {
    if (this.state.status !== 'executing') {
      throw new Error('Roadmap must be initialized before execution');
    }

    try {
      switch (this.strategy) {
        case 'sequential':
          await this.executeSequential();
          break;
        case 'parallel':
          await this.executeParallel();
          break;
        case 'dependency-driven':
          await this.executeDependencyDriven();
          break;
      }

      this.updateStatus('complete');
      
    } catch (error) {
      this.updateStatus('failed');
      throw error;
    }
  }

  /**
   * Execute tasks one at a time
   */
  private async executeSequential(): Promise<void> {
    for (const task of this.state.tasks) {
      await this.executeTask(task);
    }
  }

  /**
   * Execute all tasks in parallel
   */
  private async executeParallel(): Promise<void> {
    await Promise.all(
      this.state.tasks.map(task => this.executeTask(task))
    );
  }

  /**
   * Execute tasks respecting dependencies
   */
  private async executeDependencyDriven(): Promise<void> {
    const completed = new Set<string>();
    const pending = new Set(this.state.tasks.map(t => t.id));

    while (pending.size > 0) {
      // Find tasks ready to execute (all dependencies met)
      const ready = this.state.tasks.filter(task => 
        pending.has(task.id) &&
        task.dependencies.every(dep => completed.has(dep))
      );

      if (ready.length === 0 && pending.size > 0) {
        throw new Error('Circular dependency or missing tasks detected');
      }

      // Execute ready tasks in parallel
      await Promise.all(
        ready.map(async task => {
          await this.executeTask(task);
          completed.add(task.id);
          pending.delete(task.id);
        })
      );
    }
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTask(task: RoadmapTask): Promise<void> {
    this.state.currentTaskId = task.id;
    task.status = 'running';
    task.startedAt = Date.now();
    this.notifyListeners();

    try {
      // Get provider for this task
      const providerName = task.provider || 'mistral';
      const provider = getProvider(providerName, getProviderApiKey(providerName));

      // Execute task
      let result = '';
      for await (const chunk of provider.generateStream(task.description, {
        rolePrompt: `You are executing a roadmap task. Provide clear, actionable output.`,
        temperature: 0.7,
        maxTokens: 2000,
      })) {
        result += chunk;
      }

      // Validate result with Claude if critical task
      if (task.dependencies.length > 0 || task.title.includes('validate')) {
        const validator = getProvider('anthropic', getProviderApiKey('anthropic'));
        let validationResult = '';
        
        for await (const chunk of validator.generateStream(
          `Validate this task output:\n\nTASK: ${task.title}\nOUTPUT: ${result}\n\nRespond with VALID or INVALID and explanation.`,
          { temperature: 0.1, maxTokens: 500 }
        )) {
          validationResult += chunk;
        }

        if (validationResult.toLowerCase().includes('invalid')) {
          throw new Error(`Validation failed: ${validationResult}`);
        }
      }

      task.result = result;
      task.status = 'complete';
      task.completedAt = Date.now();
      this.state.metadata.completedTasks++;
      
    } catch (error) {
      task.retryCount++;
      
      if (task.retryCount >= task.maxRetries) {
        task.status = 'failed';
        task.error = String(error);
        this.state.metadata.failedTasks++;
      } else {
        // Retry task
        await new Promise(resolve => setTimeout(resolve, 1000 * task.retryCount));
        return this.executeTask(task);
      }
    } finally {
      this.updateProgress();
      this.notifyListeners();
    }
  }

  /**
   * Update progress calculation
   */
  private updateProgress(): void {
    const total = this.state.metadata.totalTasks;
    const completed = this.state.metadata.completedTasks;
    this.state.metadata.progress = total > 0 ? (completed / total) * 100 : 0;
  }

  /**
   * Update engine status
   */
  private updateStatus(status: RoadmapState['status']): void {
    this.state.status = status;
    this.state.updatedAt = Date.now();
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: (state: RoadmapState) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Get current state
   */
  getState(): RoadmapState {
    return { ...this.state };
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): RoadmapTask | undefined {
    return this.state.tasks.find(t => t.id === taskId);
  }
}
