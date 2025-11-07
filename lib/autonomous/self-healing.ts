/**
 * Javari AI - Self-Healing System
 * Detects, diagnoses, and automatically fixes errors
 * 
 * Created: November 4, 2025 - 6:45 PM EST
 * Part of Phase 2: Autonomous & Self-Healing Build
 */

import { AutonomousGitHub } from './autonomous-github';
import { AutonomousVercel } from './autonomous-deploy';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

interface ErrorContext {
  type: 'build' | 'runtime' | 'api' | 'database';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stackTrace?: string;
  buildLogs?: string[];
  timestamp: number;
  deploymentId?: string;
}

interface DiagnosisResult {
  confidence: number; // 0-100
  rootCause: string;
  affectedFiles: string[];
  fixStrategy: string;
  autoFixable: boolean;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

interface FixResult {
  success: boolean;
  strategy: string;
  filesModified: string[];
  commitSha?: string;
  deploymentId?: string;
  testResult?: 'passed' | 'failed';
  error?: string;
}

interface SelfHealingConfig {
  github: AutonomousGitHub;
  vercel: AutonomousVercel;
  openaiApiKey: string;
  autoFixThreshold: number; // Confidence threshold for auto-fix (0-100)
  notificationWebhook?: string;
}

export class SelfHealingSystem {
  private config: SelfHealingConfig;
  private healingHistory: Array<{
    error: ErrorContext;
    diagnosis: DiagnosisResult;
    fix?: FixResult;
    timestamp: number;
  }> = [];

  constructor(config: SelfHealingConfig) {
    this.config = config;
  }

  /**
   * Detect errors from various sources
   */
  async detectErrors(): Promise<ErrorContext[]> {
    const errors: ErrorContext[] = [];

    // Check latest deployment for build errors
    const latest = await this.config.vercel.getLatestDeployment();
    if (latest && (latest.readyState === 'ERROR' || latest.state === 'ERROR')) {
      const logs = await this.config.vercel.getBuildLogs(latest.id);
      errors.push({
        type: 'build',
        severity: 'high',
        message: 'Build failed on latest deployment',
        buildLogs: logs.map(l => l.message),
        timestamp: Date.now(),
        deploymentId: latest.id
      });
    }

    // TODO: Add runtime error detection from application logs
    // TODO: Add API error detection from monitoring
    // TODO: Add database error detection from Supabase

    return errors;
  }

  /**
   * Diagnose error using AI
   */
  async diagnoseError(error: ErrorContext): Promise<DiagnosisResult> {
    try {
      // Prepare context for AI analysis
      const context = this.prepareErrorContext(error);

      // Use OpenAI to analyze the error
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: `You are an expert software engineer specializing in debugging and fixing code.
Analyze the error and provide a detailed diagnosis in JSON format with the following structure:
{
  "confidence": number (0-100),
  "rootCause": "string",
  "affectedFiles": ["file1.ts", "file2.ts"],
  "fixStrategy": "string describing how to fix",
  "autoFixable": boolean,
  "estimatedComplexity": "simple" | "moderate" | "complex"
}`
            },
            {
              role: 'user',
              content: context
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error('AI diagnosis failed');
      }

      const data = await response.json();
      const diagnosis = JSON.parse(data.choices[0].message.content);

      return {
        confidence: diagnosis.confidence || 0,
        rootCause: diagnosis.rootCause || 'Unknown',
        affectedFiles: diagnosis.affectedFiles || [],
        fixStrategy: diagnosis.fixStrategy || 'No strategy provided',
        autoFixable: diagnosis.autoFixable !== false,
        estimatedComplexity: diagnosis.estimatedComplexity || 'complex'
      };
    } catch (error: unknown) {
      logError(\'Error in diagnosis:\', error);
      return {
        confidence: 0,
        rootCause: 'Failed to diagnose',
        affectedFiles: [],
        fixStrategy: 'Manual intervention required',
        autoFixable: false,
        estimatedComplexity: 'complex'
      };
    }
  }

  /**
   * Generate fix code using AI
   */
  private async generateFix(
    error: ErrorContext,
    diagnosis: DiagnosisResult
  ): Promise<Array<{ path: string; content: string }>> {
    const fixes: Array<{ path: string; content: string }> = [];

    for (const filePath of diagnosis.affectedFiles) {
      // Read current file content
      const fileData = await this.config.github.readFile(filePath);
      if (!fileData) {
        console.error(`Could not read file: ${filePath}`);
        continue;
      }

      // Use AI to generate fixed version
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: `You are an expert software engineer. Fix the code based on the diagnosis.
Return ONLY the complete fixed file content, no explanations or markdown.`
            },
            {
              role: 'user',
              content: `Error: ${error.message}
              
Root Cause: ${diagnosis.rootCause}

Fix Strategy: ${diagnosis.fixStrategy}

Current File (${filePath}):
${fileData.content}

Provide the complete fixed file content:`
            }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        console.error(`AI fix generation failed for ${filePath}`);
        continue;
      }

      const data = await response.json();
      const fixedContent = data.choices[0].message.content;

      fixes.push({
        path: filePath,
        content: fixedContent
      });
    }

    return fixes;
  }

  /**
   * Execute auto-fix
   */
  async executeAutoFix(
    error: ErrorContext,
    diagnosis: DiagnosisResult
  ): Promise<FixResult> {
    try {
      // Generate fixes
      const fixes = await this.generateFix(error, diagnosis);

      if (fixes.length === 0) {
        return {
          success: false,
          strategy: diagnosis.fixStrategy,
          filesModified: [],
          error: 'No fixes generated'
        };
      }

      // Commit fixes to GitHub
      const commitMessage = `🔧 Auto-fix: ${diagnosis.rootCause}\n\nConfidence: ${diagnosis.confidence}%\nStrategy: ${diagnosis.fixStrategy}`;
      
      const commitResult = await this.config.github.createCommit(
        fixes.map(f => ({ path: f.path, content: f.content })),
        commitMessage
      );

      if (!commitResult.success) {
        return {
          success: false,
          strategy: diagnosis.fixStrategy,
          filesModified: fixes.map(f => f.path),
          error: commitResult.error
        };
      }

      // Trigger deployment
      const deployResult = await this.config.vercel.triggerDeployment('main', true);

      if (!deployResult.success) {
        // Rollback the commit
        if (commitResult.sha) {
          await this.config.github.rollbackCommit(
            commitResult.sha,
            'Deployment failed after auto-fix'
          );
        }

        return {
          success: false,
          strategy: diagnosis.fixStrategy,
          filesModified: fixes.map(f => f.path),
          commitSha: commitResult.sha,
          error: 'Deployment failed, rolled back changes'
        };
      }

      // Monitor deployment
      const monitorResult = await this.config.vercel.monitorDeployment(
        deployResult.deploymentId!,
        600000, // 10 minutes
        10000 // 10 seconds
      );

      if (!monitorResult.success) {
        // Rollback
        if (commitResult.sha) {
          await this.config.github.rollbackCommit(
            commitResult.sha,
            'Build failed after auto-fix'
          );
        }

        return {
          success: false,
          strategy: diagnosis.fixStrategy,
          filesModified: fixes.map(f => f.path),
          commitSha: commitResult.sha,
          deploymentId: deployResult.deploymentId,
          testResult: 'failed',
          error: 'Build failed, rolled back changes'
        };
      }

      // Verify deployment
      const verified = await this.config.vercel.verifyDeployment(monitorResult.deploymentId!);

      return {
        success: verified,
        strategy: diagnosis.fixStrategy,
        filesModified: fixes.map(f => f.path),
        commitSha: commitResult.sha,
        deploymentId: monitorResult.deploymentId,
        testResult: verified ? 'passed' : 'failed'
      };
    } catch (error: unknown) {
      return {
        success: false,
        strategy: diagnosis.fixStrategy,
        filesModified: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Main self-healing loop
   */
  async runHealingCycle(): Promise<void> {
    console.log('🏥 Starting self-healing cycle...');

    // 1. Detect errors
    const errors = await this.detectErrors();
    console.log(`📊 Found ${errors.length} error(s)`);

    for (const error of errors) {
      // 2. Diagnose error
      console.log(`🔍 Diagnosing: ${error.message}`);
      const diagnosis = await this.diagnoseError(error);
      console.log(`💡 Diagnosis complete. Confidence: ${diagnosis.confidence}%`);

      // Store in history
      const historyEntry = {
        error,
        diagnosis,
        timestamp: Date.now()
      };
      this.healingHistory.push(historyEntry);

      // 3. Decide whether to auto-fix
      const shouldAutoFix = 
        diagnosis.autoFixable &&
        diagnosis.confidence >= this.config.autoFixThreshold;

      if (shouldAutoFix) {
        console.log(`🔧 Auto-fixing (confidence: ${diagnosis.confidence}%)...`);
        const fixResult = await this.executeAutoFix(error, diagnosis);
        
        // Update history entry
        historyEntry.fix = fixResult;

        if (fixResult.success) {
          console.log('✅ Auto-fix successful!');
          await this.notifySuccess(error, diagnosis, fixResult);
        } else {
          console.log('❌ Auto-fix failed:', fixResult.error);
          await this.notifyFailure(error, diagnosis, fixResult);
          await this.escalate(error, diagnosis);
        }
      } else {
        console.log(`⚠️ Auto-fix skipped (confidence: ${diagnosis.confidence}% < ${this.config.autoFixThreshold}%)`);
        await this.escalate(error, diagnosis);
      }
    }

    console.log('🏥 Self-healing cycle complete');
  }

  /**
   * Prepare error context for AI analysis
   */
  private prepareErrorContext(error: ErrorContext): string {
    let context = `Error Type: ${error.type}\n`;
    context += `Severity: ${error.severity}\n`;
    context += `Message: ${error.message}\n`;
    context += `Timestamp: ${new Date(error.timestamp).toISOString()}\n\n`;

    if (error.stackTrace) {
      context += `Stack Trace:\n${error.stackTrace}\n\n`;
    }

    if (error.buildLogs && error.buildLogs.length > 0) {
      context += `Build Logs:\n`;
      error.buildLogs.slice(-50).forEach(log => {
        context += `${log}\n`;
      });
    }

    return context;
  }

  /**
   * Escalate to human operator
   */
  private async escalate(error: ErrorContext, diagnosis: DiagnosisResult): Promise<void> {
    console.log('🚨 Escalating to human operator...');

    const notification = {
      type: 'escalation',
      error: error.message,
      diagnosis: diagnosis.rootCause,
      confidence: diagnosis.confidence,
      affectedFiles: diagnosis.affectedFiles,
      fixStrategy: diagnosis.fixStrategy,
      timestamp: new Date().toISOString()
    };

    if (this.config.notificationWebhook) {
      try {
        await fetch(this.config.notificationWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification)
        });
      } catch (error: unknown) {
        logError(\'Failed to send escalation notification:\', error);
      }
    }

    // TODO: Create support ticket in database
    // TODO: Send email to Roy
  }

  /**
   * Notify successful fix
   */
  private async notifySuccess(
    error: ErrorContext,
    diagnosis: DiagnosisResult,
    fix: FixResult
  ): Promise<void> {
    const notification = {
      type: 'success',
      error: error.message,
      diagnosis: diagnosis.rootCause,
      confidence: diagnosis.confidence,
      filesModified: fix.filesModified,
      commitSha: fix.commitSha,
      deploymentId: fix.deploymentId,
      timestamp: new Date().toISOString()
    };

    if (this.config.notificationWebhook) {
      try {
        await fetch(this.config.notificationWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification)
        });
      } catch (error: unknown) {
        logError(\'Failed to send success notification:\', error);
      }
    }
  }

  /**
   * Notify failed fix
   */
  private async notifyFailure(
    error: ErrorContext,
    diagnosis: DiagnosisResult,
    fix: FixResult
  ): Promise<void> {
    const notification = {
      type: 'failure',
      error: error.message,
      diagnosis: diagnosis.rootCause,
      confidence: diagnosis.confidence,
      fixError: fix.error,
      timestamp: new Date().toISOString()
    };

    if (this.config.notificationWebhook) {
      try {
        await fetch(this.config.notificationWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification)
        });
      } catch (error: unknown) {
        logError(\'Failed to send failure notification:\', error);
      }
    }
  }

  /**
   * Get healing history
   */
  getHistory(limit?: number): typeof this.healingHistory {
    return limit ? this.healingHistory.slice(-limit) : this.healingHistory;
  }

  /**
   * Get healing statistics
   */
  getStatistics() {
    const total = this.healingHistory.length;
    const withFix = this.healingHistory.filter(h => h.fix).length;
    const successful = this.healingHistory.filter(h => h.fix?.success).length;
    const failed = withFix - successful;
    const escalated = total - withFix;

    return {
      total,
      attempted: withFix,
      successful,
      failed,
      escalated,
      successRate: withFix > 0 ? (successful / withFix) * 100 : 0
    };
  }
}

// Export factory function
export function createSelfHealingSystem(config: SelfHealingConfig): SelfHealingSystem {
  return new SelfHealingSystem(config);
}
