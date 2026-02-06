/**
 * CLAUDE BUILDER
 * 
 * Executes build commands from architect
 * Performs file operations and commits to GitHub
 */

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { BuildCommand } from './architectGateway';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const BUILDER_MODEL = 'claude-sonnet-4-20250514';

export interface BuildResult {
  ok: boolean;
  modifiedFiles: string[];
  createdFiles: string[];
  deletedFiles: string[];
  commitId?: string;
  buildLogs: string[];
  errors: string[];
}

/**
 * Claude Builder - Executes file operations
 */
export class ClaudeBuilder {
  private workingDir: string;
  private buildLogs: string[] = [];
  private errors: string[] = [];

  constructor(workingDir: string = '/home/claude') {
    this.workingDir = workingDir;
  }

  /**
   * Execute build commands
   */
  async build(commands: BuildCommand[]): Promise<BuildResult> {
    console.log(`[BUILDER] Executing ${commands.length} build commands...`);

    const modifiedFiles: string[] = [];
    const createdFiles: string[] = [];
    const deletedFiles: string[] = [];

    try {
      // Execute commands in order
      for (const command of commands) {
        await this.executeCommand(command, {
          modifiedFiles,
          createdFiles,
          deletedFiles,
        });
      }

      // Commit changes to GitHub
      const commitId = await this.commitChanges(
        createdFiles,
        modifiedFiles,
        deletedFiles
      );

      this.log(`Build completed successfully. Commit: ${commitId}`);

      return {
        ok: true,
        modifiedFiles,
        createdFiles,
        deletedFiles,
        commitId,
        buildLogs: this.buildLogs,
        errors: this.errors,
      };

    } catch (error: any) {
      this.error(`Build failed: ${error.message}`);

      return {
        ok: false,
        modifiedFiles,
        createdFiles,
        deletedFiles,
        buildLogs: this.buildLogs,
        errors: this.errors,
      };
    }
  }

  /**
   * Execute single build command
   */
  private async executeCommand(
    command: BuildCommand,
    tracking: {
      modifiedFiles: string[];
      createdFiles: string[];
      deletedFiles: string[];
    }
  ): Promise<void> {
    this.log(`Executing: ${command.id} (${command.type})`);
    this.log(`Target: ${command.target}`);

    const fullPath = path.join(this.workingDir, command.target);

    try {
      switch (command.type) {
        case 'create_file':
          await this.createFile(fullPath, command.content!);
          tracking.createdFiles.push(command.target);
          break;

        case 'modify_file':
          await this.modifyFile(fullPath, command.content!);
          tracking.modifiedFiles.push(command.target);
          break;

        case 'delete_file':
          await this.deleteFile(fullPath);
          tracking.deletedFiles.push(command.target);
          break;

        case 'run_command':
          await this.runCommand(command.content!);
          break;

        default:
          throw new Error(`Unknown command type: ${command.type}`);
      }

      this.log(`✓ ${command.id} completed`);

    } catch (error: any) {
      this.error(`✗ ${command.id} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create file
   */
  private async createFile(filePath: string, content: string): Promise<void> {
    // Create directory if doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');
    
    this.log(`Created: ${filePath} (${content.length} bytes)`);
  }

  /**
   * Modify file
   */
  private async modifyFile(filePath: string, content: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    
    this.log(`Modified: ${filePath} (${content.length} bytes)`);
  }

  /**
   * Delete file
   */
  private async deleteFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      this.log(`File already deleted: ${filePath}`);
      return;
    }

    fs.unlinkSync(filePath);
    
    this.log(`Deleted: ${filePath}`);
  }

  /**
   * Run shell command
   */
  private async runCommand(command: string): Promise<void> {
    this.log(`Running: ${command}`);

    try {
      const output = execSync(command, {
        cwd: this.workingDir,
        encoding: 'utf-8',
      });

      this.log(`Output: ${output}`);
    } catch (error: any) {
      this.error(`Command failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Commit changes to GitHub
   */
  private async commitChanges(
    createdFiles: string[],
    modifiedFiles: string[],
    deletedFiles: string[]
  ): Promise<string> {
    this.log('Committing changes to GitHub...');

    try {
      // Stage all changes
      const allFiles = [...createdFiles, ...modifiedFiles, ...deletedFiles];
      
      if (allFiles.length === 0) {
        this.log('No files to commit');
        return 'no_changes';
      }

      // Git add
      for (const file of allFiles) {
        try {
          execSync(`git add "${file}"`, { cwd: this.workingDir });
        } catch (error) {
          this.log(`Warning: Could not stage ${file}`);
        }
      }

      // Git commit
      const commitMessage = this.generateCommitMessage(
        createdFiles,
        modifiedFiles,
        deletedFiles
      );

      const commitOutput = execSync(
        `git commit -m "${commitMessage}"`,
        { cwd: this.workingDir, encoding: 'utf-8' }
      );

      // Extract commit ID
      const commitId = this.extractCommitId(commitOutput);

      // Git push
      try {
        execSync('git push', { cwd: this.workingDir });
        this.log(`Pushed to GitHub: ${commitId}`);
      } catch (error) {
        this.log('Warning: Could not push to GitHub (push manually)');
      }

      return commitId;

    } catch (error: any) {
      this.error(`Commit failed: ${error.message}`);
      return 'commit_failed';
    }
  }

  /**
   * Generate commit message
   */
  private generateCommitMessage(
    created: string[],
    modified: string[],
    deleted: string[]
  ): string {
    const parts: string[] = [];

    if (created.length > 0) {
      parts.push(`Created ${created.length} file(s)`);
    }

    if (modified.length > 0) {
      parts.push(`Modified ${modified.length} file(s)`);
    }

    if (deleted.length > 0) {
      parts.push(`Deleted ${deleted.length} file(s)`);
    }

    return `Multi-AI Chamber: ${parts.join(', ')}`;
  }

  /**
   * Extract commit ID from git output
   */
  private extractCommitId(output: string): string {
    const match = output.match(/\[.*?([a-f0-9]{7,})\]/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Log message
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.buildLogs.push(logMessage);
    console.log(`[BUILDER] ${message}`);
  }

  /**
   * Log error
   */
  private error(message: string): void {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ERROR: ${message}`;
    this.errors.push(errorMessage);
    this.buildLogs.push(errorMessage);
    console.error(`[BUILDER] ${message}`);
  }

  /**
   * Use Claude API for complex refactoring
   */
  async refactorWithClaude(
    filePath: string,
    instructions: string
  ): Promise<string> {
    const fileContent = fs.readFileSync(
      path.join(this.workingDir, filePath),
      'utf-8'
    );

    const message = await anthropic.messages.create({
      model: BUILDER_MODEL,
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `Refactor this file according to these instructions:

INSTRUCTIONS:
${instructions}

FILE CONTENT:
${fileContent}

Return ONLY the complete refactored file content, no explanations.`,
      }],
    });

    const refactoredContent = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    return refactoredContent;
  }
}

export default ClaudeBuilder;
