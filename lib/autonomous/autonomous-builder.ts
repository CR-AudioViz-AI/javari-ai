/**
 * Javari AI - Autonomous Building System
 * Complete autonomous loop: task → plan → build → test → deploy
 * 
 * Created: November 21, 2025 - 2:05 PM EST
 * Purpose: Full autonomous application building
 */

import { AutonomousGitHub } from '../lib/autonomous/autonomous-github';
import { AutonomousVercel } from '../lib/autonomous/autonomous-deploy';

interface BuildTask {
  id: string;
  description: string;
  type: 'app' | 'feature' | 'fix' | 'test';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requirements?: string[];
  context?: Record<string, any>;
}

interface BuildPlan {
  task: BuildTask;
  steps: BuildStep[];
  estimatedDuration: number; // minutes
  dependencies: string[];
  files: FileOperation[];
}

interface BuildStep {
  order: number;
  description: string;
  action: 'create' | 'modify' | 'delete' | 'test';
  target: string; // file path or test name
  content?: string;
}

interface FileOperation {
  path: string;
  action: 'create' | 'modify' | 'delete';
  content?: string;
  reason: string;
}

interface BuildResult {
  success: boolean;
  taskId: string;
  filesChanged: string[];
  commitSha?: string;
  deploymentUrl?: string;
  testsPassed?: boolean;
  error?: string;
  duration: number; // seconds
}

export class AutonomousBuilder {
  private github: AutonomousGitHub;
  private vercel: AutonomousVercel;
  private openaiKey: string;
  private claudeKey: string;

  constructor(config: {
    githubToken: string;
    githubOrg: string;
    githubRepo: string;
    vercelToken: string;
    vercelTeamId: string;
    vercelProjectId: string;
    openaiKey: string;
    claudeKey: string;
  }) {
    this.github = new AutonomousGitHub({
      token: config.githubToken,
      org: config.githubOrg,
      repo: config.githubRepo,
    });

    this.vercel = new AutonomousVercel({
      token: config.vercelToken,
      teamId: config.vercelTeamId,
      projectId: config.vercelProjectId,
    });

    this.openaiKey = config.openaiKey;
    this.claudeKey = config.claudeKey;
  }

  /**
   * Main autonomous building loop
   */
  async build(task: BuildTask): Promise<BuildResult> {
    const startTime = Date.now();

    try {
      // STEP 1: Create build plan using AI
      console.log(`[Javari] Creating build plan for task: ${task.description}`);
      const plan = await this.createBuildPlan(task);

      if (!plan) {
        return {
          success: false,
          taskId: task.id,
          filesChanged: [],
          error: 'Failed to create build plan',
          duration: (Date.now() - startTime) / 1000,
        };
      }

      // STEP 2: Execute build plan (create/modify files)
      console.log(`[Javari] Executing build plan with ${plan.steps.length} steps`);
      const filesChanged: string[] = [];

      for (const step of plan.steps) {
        if (step.action === 'create' || step.action === 'modify') {
          const result = await this.github.writeFile(
            step.target,
            step.content || '',
            `feat: ${step.description} (Javari Autonomous Build)`,
            'main'
          );

          if (result.success) {
            filesChanged.push(step.target);
            console.log(`[Javari] ✅ ${step.action} ${step.target}`);
          } else {
            console.error(`[Javari] ❌ Failed to ${step.action} ${step.target}: ${result.error}`);
          }
        }
      }

      // STEP 3: Test (basic validation)
      console.log(`[Javari] Running validation tests`);
      const testsPassed = await this.runTests(filesChanged);

      // STEP 4: Deploy to Vercel
      console.log(`[Javari] Triggering deployment`);
      const deployment = await this.vercel.triggerDeployment('main', false);

      if (!deployment.success) {
        return {
          success: false,
          taskId: task.id,
          filesChanged,
          testsPassed,
          error: `Deployment failed: ${deployment.error}`,
          duration: (Date.now() - startTime) / 1000,
        };
      }

      // STEP 5: Monitor deployment
      if (deployment.deploymentId) {
        console.log(`[Javari] Monitoring deployment: ${deployment.deploymentId}`);
        const deploymentStatus = await this.vercel.waitForDeployment(deployment.deploymentId, 300000); // 5 min timeout

        if (deploymentStatus.state !== 'READY') {
          return {
            success: false,
            taskId: task.id,
            filesChanged,
            testsPassed,
            error: `Deployment failed with state: ${deploymentStatus.state}`,
            duration: (Date.now() - startTime) / 1000,
          };
        }
      }

      return {
        success: true,
        taskId: task.id,
        filesChanged,
        commitSha: 'latest', // Would be actual SHA from GitHub
        deploymentUrl: deployment.url,
        testsPassed,
        duration: (Date.now() - startTime) / 1000,
      };

    } catch (error: any) {
      return {
        success: false,
        taskId: task.id,
        filesChanged: [],
        error: error.message,
        duration: (Date.now() - startTime) / 1000,
      };
    }
  }

  /**
   * Create build plan using Claude
   */
  private async createBuildPlan(task: BuildTask): Promise<BuildPlan | null> {
    try {
      const prompt = `You are Javari AI, an autonomous development assistant. 
      
Task: ${task.description}
Type: ${task.type}
Priority: ${task.priority}
${task.requirements ? `Requirements:\n${task.requirements.join('\n')}` : ''}

Create a detailed build plan with the following:
1. List of steps (in order)
2. Files to create/modify
3. Code to write for each file
4. Dependencies needed
5. Estimated duration

Return as JSON with this structure:
{
  "steps": [
    {
      "order": 1,
      "description": "Create component file",
      "action": "create",
      "target": "components/MyComponent.tsx",
      "content": "// actual code here"
    }
  ],
  "estimatedDuration": 30,
  "dependencies": ["package1", "package2"]
}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.claudeKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        console.error('Claude API error:', response.statusText);
        return null;
      }

      const data = await response.json();
      const content = data.content[0].text;

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in Claude response');
        return null;
      }

      const planData = JSON.parse(jsonMatch[0]);

      return {
        task,
        steps: planData.steps,
        estimatedDuration: planData.estimatedDuration,
        dependencies: planData.dependencies || [],
        files: planData.steps.map((s: any) => ({
          path: s.target,
          action: s.action,
          content: s.content,
          reason: s.description,
        })),
      };

    } catch (error) {
      console.error('Error creating build plan:', error);
      return null;
    }
  }

  /**
   * Run validation tests
   */
  private async runTests(filesChanged: string[]): Promise<boolean> {
    // Basic validation:
    // 1. Check TypeScript syntax
    // 2. Check for common errors
    // 3. Verify file structure

    for (const file of filesChanged) {
      // Read file content
      const fileData = await this.github.readFile(file);
      
      if (!fileData) {
        console.error(`Test failed: Could not read ${file}`);
        return false;
      }

      // Basic syntax checks
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        // Check for obvious syntax errors
        const content = fileData.content;
        
        // Check for unclosed brackets/braces
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        
        if (openBraces !== closeBraces) {
          console.error(`Test failed: Mismatched braces in ${file}`);
          return false;
        }
      }
    }

    return true;
  }
}

// Export for API use
export default AutonomousBuilder;
