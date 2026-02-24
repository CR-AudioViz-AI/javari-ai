/**
 * MULTI-AI CHAMBER CONTROLLER
 * 
 * Orchestrates the 3-AI system:
 * - ChatGPT (o1/o3) = Architect (designs solution)
 * - Claude (Sonnet 4) = Builder (implements code)
 * - Javari = Observer + Learning Engine (learns patterns)
 */

import { ArchitectGateway, ArchitectOutput } from './architectGateway';
import { ClaudeBuilder, BuildResult } from './claudeBuilder';
import { LearningObserver, ObservationResult } from './observer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ChamberRequest {
  goal: string;
  context?: {
    files?: string[];
    requirements?: string[];
    constraints?: string[];
  };
  userId: string;
  sessionId?: string;
}

export interface ChamberStep {
  step: number;
  phase: 'architect' | 'builder' | 'observer' | 'complete';
  timestamp: Date;
  agent: 'chatgpt' | 'claude' | 'javari';
  output: any;
  duration?: number;
}

export interface ChamberResult {
  success: boolean;
  sessionId: string;
  steps: ChamberStep[];
  architectOutput?: ArchitectOutput;
  buildResult?: BuildResult;
  observationResult?: ObservationResult;
  error?: string;
  totalDuration: number;
}

/**
 * Multi-AI Chamber Controller
 */
export class ChamberController {
  private sessionId: string;
  private userId: string;
  private steps: ChamberStep[] = [];
  private startTime: Date;

  constructor(userId: string, sessionId?: string) {
    this.userId = userId;
    this.sessionId = sessionId || this.generateSessionId();
    this.startTime = new Date();
  }

  /**
   * Execute complete multi-AI chamber workflow
   */
  async execute(request: ChamberRequest): Promise<ChamberResult> {
    try {
      console.log(`[CHAMBER] Starting session ${this.sessionId} for goal:`, request.goal);

      // PHASE 1: ARCHITECT (ChatGPT)
      const architectOutput = await this.runArchitect(request);

      // PHASE 2: BUILDER (Claude)
      const buildResult = await this.runBuilder(architectOutput);

      // PHASE 3: OBSERVER (Javari)
      const observationResult = await this.runObserver(
        request,
        architectOutput,
        buildResult
      );

      // Mark complete
      this.addStep({
        phase: 'complete',
        agent: 'javari',
        output: {
          message: 'Multi-AI chamber execution complete',
          filesModified: buildResult.modifiedFiles.length,
          filesCreated: buildResult.createdFiles.length,
          commitId: buildResult.commitId,
        },
      });

      const totalDuration = Date.now() - this.startTime.getTime();

      const result: ChamberResult = {
        success: true,
        sessionId: this.sessionId,
        steps: this.steps,
        architectOutput,
        buildResult,
        observationResult,
        totalDuration,
      };

      // Store session in database
      await this.storeSession(result);

      return result;

    } catch (error: any) {
      console.error('[CHAMBER] Execution error:', error);

      const totalDuration = Date.now() - this.startTime.getTime();

      const result: ChamberResult = {
        success: false,
        sessionId: this.sessionId,
        steps: this.steps,
        error: error.message,
        totalDuration,
      };

      await this.storeSession(result);

      return result;
    }
  }

  /**
   * PHASE 1: Run Architect (ChatGPT)
   */
  private async runArchitect(request: ChamberRequest): Promise<ArchitectOutput> {
    const stepStart = Date.now();

    console.log('[CHAMBER] PHASE 1: Architect (ChatGPT) analyzing goal...');

    const architect = new ArchitectGateway();
    const architectOutput = await architect.design(request.goal, request.context);

    const duration = Date.now() - stepStart;

    this.addStep({
      phase: 'architect',
      agent: 'chatgpt',
      output: architectOutput,
      duration,
    });

    console.log(`[CHAMBER] Architect completed in ${duration}ms`);
    console.log(`[CHAMBER] Build commands: ${architectOutput.buildCommands.length}`);

    return architectOutput;
  }

  /**
   * PHASE 2: Run Builder (Claude)
   */
  private async runBuilder(architectOutput: ArchitectOutput): Promise<BuildResult> {
    const stepStart = Date.now();

    console.log('[CHAMBER] PHASE 2: Builder (Claude) executing build...');

    const builder = new ClaudeBuilder();
    const buildResult = await builder.build(architectOutput.buildCommands);

    const duration = Date.now() - stepStart;

    this.addStep({
      phase: 'builder',
      agent: 'claude',
      output: buildResult,
      duration,
    });

    console.log(`[CHAMBER] Builder completed in ${duration}ms`);
    console.log(`[CHAMBER] Files created: ${buildResult.createdFiles.length}`);
    console.log(`[CHAMBER] Files modified: ${buildResult.modifiedFiles.length}`);
    console.log(`[CHAMBER] Commit ID: ${buildResult.commitId}`);

    return buildResult;
  }

  /**
   * PHASE 3: Run Observer (Javari)
   */
  private async runObserver(
    request: ChamberRequest,
    architectOutput: ArchitectOutput,
    buildResult: BuildResult
  ): Promise<ObservationResult> {
    const stepStart = Date.now();

    console.log('[CHAMBER] PHASE 3: Observer (Javari) learning from execution...');

    const observer = new LearningObserver();
    const observationResult = await observer.observe(
      this.sessionId,
      request,
      architectOutput,
      buildResult
    );

    const duration = Date.now() - stepStart;

    this.addStep({
      phase: 'observer',
      agent: 'javari',
      output: observationResult,
      duration,
    });

    console.log(`[CHAMBER] Observer completed in ${duration}ms`);
    console.log(`[CHAMBER] Patterns learned: ${observationResult.patternsLearned.length}`);
    console.log(`[CHAMBER] Memory updated: ${observationResult.memoryUpdated}`);

    return observationResult;
  }

  /**
   * Add step to execution log
   */
  private addStep(stepData: Omit<ChamberStep, 'step' | 'timestamp'>): void {
    this.steps.push({
      step: this.steps.length + 1,
      timestamp: new Date(),
      ...stepData,
    });
  }

  /**
   * Store session in database
   */
  private async storeSession(result: ChamberResult): Promise<void> {
    try {
      await supabase.from('chamber_sessions').insert({
        session_id: this.sessionId,
        user_id: this.userId,
        success: result.success,
        steps: result.steps,
        architect_output: result.architectOutput,
        build_result: result.buildResult,
        observation_result: result.observationResult,
        error: result.error,
        total_duration: result.totalDuration,
      });
    } catch (error) {
      console.error('[CHAMBER] Failed to store session:', error);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `chamber_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stream execution progress
   */
  async *executeStream(request: ChamberRequest): AsyncGenerator<ChamberStep, ChamberResult> {
    try {
      // PHASE 1: Architect
      const architectStepStart = Date.now();
      const architect = new ArchitectGateway();
      const architectOutput = await architect.design(request.goal, request.context);

      const architectStep: ChamberStep = {
        step: 1,
        phase: 'architect',
        timestamp: new Date(),
        agent: 'chatgpt',
        output: architectOutput,
        duration: Date.now() - architectStepStart,
      };
      this.steps.push(architectStep);
      yield architectStep;

      // PHASE 2: Builder
      const builderStepStart = Date.now();
      const builder = new ClaudeBuilder();
      const buildResult = await builder.build(architectOutput.buildCommands);

      const builderStep: ChamberStep = {
        step: 2,
        phase: 'builder',
        timestamp: new Date(),
        agent: 'claude',
        output: buildResult,
        duration: Date.now() - builderStepStart,
      };
      this.steps.push(builderStep);
      yield builderStep;

      // PHASE 3: Observer
      const observerStepStart = Date.now();
      const observer = new LearningObserver();
      const observationResult = await observer.observe(
        this.sessionId,
        request,
        architectOutput,
        buildResult
      );

      const observerStep: ChamberStep = {
        step: 3,
        phase: 'observer',
        timestamp: new Date(),
        agent: 'javari',
        output: observationResult,
        duration: Date.now() - observerStepStart,
      };
      this.steps.push(observerStep);
      yield observerStep;

      // Complete
      const completeStep: ChamberStep = {
        step: 4,
        phase: 'complete',
        timestamp: new Date(),
        agent: 'javari',
        output: { message: 'Execution complete' },
      };
      this.steps.push(completeStep);
      yield completeStep;

      const totalDuration = Date.now() - this.startTime.getTime();

      const result: ChamberResult = {
        success: true,
        sessionId: this.sessionId,
        steps: this.steps,
        architectOutput,
        buildResult,
        observationResult,
        totalDuration,
      };

      await this.storeSession(result);

      return result;

    } catch (error: any) {
      console.error('[CHAMBER] Stream execution error:', error);

      const result: ChamberResult = {
        success: false,
        sessionId: this.sessionId,
        steps: this.steps,
        error: error.message,
        totalDuration: Date.now() - this.startTime.getTime(),
      };

      await this.storeSession(result);

      return result;
    }
  }
}

export default ChamberController;
