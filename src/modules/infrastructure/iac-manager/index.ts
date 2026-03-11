```typescript
import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { z } from 'zod';

/**
 * Infrastructure as Code Manager
 * Comprehensive Terraform orchestration with automated provisioning,
 * drift detection, and compliance validation
 */

interface IaCConfig {
  supabaseUrl: string;
  supabaseKey: string;
  terraformPath?: string;
  workspaceDir: string;
  vaultUrl?: string;
  vaultToken?: string;
  cloudProviders: CloudProviderConfig[];
  compliancePolicies: CompliancePolicy[];
  notificationEndpoints: NotificationEndpoint[];
}

interface CloudProviderConfig {
  provider: 'aws' | 'azure' | 'gcp';
  region: string;
  credentials: Record<string, string>;
  tags: Record<string, string>;
}

interface CompliancePolicy {
  id: string;
  name: string;
  type: 'security' | 'governance' | 'cost' | 'performance';
  rules: PolicyRule[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface PolicyRule {
  resource: string;
  condition: string;
  value: any;
  message: string;
}

interface NotificationEndpoint {
  type: 'webhook' | 'email' | 'slack' | 'siem';
  url: string;
  credentials?: Record<string, string>;
}

interface TerraformPlan {
  id: string;
  workspaceId: string;
  planFile: string;
  changes: ResourceChange[];
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  createdAt: Date;
  analyzedAt?: Date;
  appliedAt?: Date;
}

interface ResourceChange {
  address: string;
  action: 'create' | 'update' | 'delete' | 'no-change';
  resourceType: string;
  changes: Record<string, any>;
  dependencies: string[];
}

interface InfrastructureState {
  workspaceId: string;
  resources: ManagedResource[];
  lastSync: Date;
  stateHash: string;
  version: number;
}

interface ManagedResource {
  address: string;
  type: string;
  provider: string;
  attributes: Record<string, any>;
  dependencies: string[];
  tags: Record<string, string>;
  compliance: ComplianceStatus[];
}

interface ComplianceStatus {
  policyId: string;
  status: 'compliant' | 'non-compliant' | 'warning';
  violations: PolicyViolation[];
  lastChecked: Date;
}

interface PolicyViolation {
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  remediation?: string;
}

interface DriftDetection {
  workspaceId: string;
  driftedResources: DriftedResource[];
  detectedAt: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoRemediate: boolean;
}

interface DriftedResource {
  address: string;
  expectedState: Record<string, any>;
  actualState: Record<string, any>;
  differences: StateDifference[];
}

interface StateDifference {
  attribute: string;
  expected: any;
  actual: any;
  impact: 'configuration' | 'security' | 'cost' | 'performance';
}

interface DeploymentPipeline {
  id: string;
  name: string;
  environments: DeploymentEnvironment[];
  approvalGates: ApprovalGate[];
  rollbackStrategy: RollbackStrategy;
}

interface DeploymentEnvironment {
  name: string;
  workspaceId: string;
  variables: Record<string, string>;
  provisionOrder: number;
}

interface ApprovalGate {
  environment: string;
  type: 'manual' | 'automated';
  conditions: ApprovalCondition[];
  approvers?: string[];
  timeout: number;
}

interface ApprovalCondition {
  type: 'compliance' | 'testing' | 'security' | 'cost';
  threshold: any;
  required: boolean;
}

interface RollbackStrategy {
  type: 'automatic' | 'manual';
  triggers: RollbackTrigger[];
  maxRetries: number;
}

interface RollbackTrigger {
  condition: string;
  timeout: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const TerraformPlanSchema = z.object({
  format_version: z.string(),
  terraform_version: z.string(),
  planned_values: z.object({
    root_module: z.object({
      resources: z.array(z.any()).optional(),
      child_modules: z.array(z.any()).optional()
    }).optional()
  }).optional(),
  resource_changes: z.array(z.object({
    address: z.string(),
    mode: z.string(),
    type: z.string(),
    provider_name: z.string(),
    change: z.object({
      actions: z.array(z.string()),
      before: z.any().optional(),
      after: z.any().optional(),
      after_unknown: z.any().optional()
    })
  })).optional(),
  configuration: z.object({
    root_module: z.any()
  }).optional()
});

/**
 * Terraform Orchestrator
 * Core Terraform execution engine with state management
 */
class TerraformOrchestrator extends EventEmitter {
  private terraformPath: string;
  private workspaceDir: string;

  constructor(terraformPath: string = 'terraform', workspaceDir: string) {
    super();
    this.terraformPath = terraformPath;
    this.workspaceDir = workspaceDir;
  }

  /**
   * Initialize Terraform workspace
   */
  async initWorkspace(workspaceId: string, config: Record<string, any>): Promise<void> {
    try {
      const workspacePath = path.join(this.workspaceDir, workspaceId);
      await fs.mkdir(workspacePath, { recursive: true });

      // Write Terraform configuration
      const configContent = this.generateTerraformConfig(config);
      await fs.writeFile(path.join(workspacePath, 'main.tf'), configContent);

      // Initialize Terraform
      await this.executeTerraform(['init'], workspacePath);

      this.emit('workspace:initialized', { workspaceId });
    } catch (error) {
      this.emit('error', { operation: 'initWorkspace', error });
      throw error;
    }
  }

  /**
   * Generate Terraform plan
   */
  async generatePlan(workspaceId: string, variables?: Record<string, any>): Promise<TerraformPlan> {
    try {
      const workspacePath = path.join(this.workspaceDir, workspaceId);
      const planFile = `${workspaceId}-${Date.now()}.tfplan`;
      const planPath = path.join(workspacePath, planFile);

      // Prepare variables
      const args = ['plan', '-out', planFile];
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          args.push('-var', `${key}=${value}`);
        }
      }

      // Generate plan
      await this.executeTerraform(args, workspacePath);

      // Show plan in JSON format
      const planJson = await this.executeTerraform(
        ['show', '-json', planFile],
        workspacePath
      );

      const planData = JSON.parse(planJson);
      const validatedPlan = TerraformPlanSchema.parse(planData);

      const changes = this.parsePlanChanges(validatedPlan);

      const plan: TerraformPlan = {
        id: crypto.randomUUID(),
        workspaceId,
        planFile: planPath,
        changes,
        status: 'pending',
        createdAt: new Date()
      };

      this.emit('plan:generated', { plan });
      return plan;
    } catch (error) {
      this.emit('error', { operation: 'generatePlan', error });
      throw error;
    }
  }

  /**
   * Apply Terraform plan
   */
  async applyPlan(plan: TerraformPlan): Promise<void> {
    try {
      const workspacePath = path.dirname(plan.planFile);
      const planFile = path.basename(plan.planFile);

      await this.executeTerraform(['apply', '-auto-approve', planFile], workspacePath);

      plan.status = 'applied';
      plan.appliedAt = new Date();

      this.emit('plan:applied', { plan });
    } catch (error) {
      this.emit('error', { operation: 'applyPlan', error });
      throw error;
    }
  }

  /**
   * Destroy infrastructure
   */
  async destroy(workspaceId: string, variables?: Record<string, any>): Promise<void> {
    try {
      const workspacePath = path.join(this.workspaceDir, workspaceId);

      const args = ['destroy', '-auto-approve'];
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          args.push('-var', `${key}=${value}`);
        }
      }

      await this.executeTerraform(args, workspacePath);

      this.emit('infrastructure:destroyed', { workspaceId });
    } catch (error) {
      this.emit('error', { operation: 'destroy', error });
      throw error;
    }
  }

  /**
   * Get current state
   */
  async getState(workspaceId: string): Promise<any> {
    try {
      const workspacePath = path.join(this.workspaceDir, workspaceId);
      const stateJson = await this.executeTerraform(['show', '-json'], workspacePath);
      return JSON.parse(stateJson);
    } catch (error) {
      this.emit('error', { operation: 'getState', error });
      throw error;
    }
  }

  /**
   * Execute Terraform command
   */
  private async executeTerraform(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.terraformPath, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Terraform command failed: ${stderr}`));
        }
      });
    });
  }

  /**
   * Generate Terraform configuration
   */
  private generateTerraformConfig(config: Record<string, any>): string {
    // Basic Terraform configuration template
    // In production, this would be more sophisticated
    return `
terraform {
  required_version = ">= 1.0"
  required_providers {
    ${Object.keys(config.providers || {}).map(provider => `
    ${provider} = {
      source  = "${config.providers[provider].source}"
      version = "${config.providers[provider].version}"
    }`).join('')}
  }
}

${Object.entries(config.resources || {}).map(([name, resource]: [string, any]) => `
resource "${resource.type}" "${name}" {
  ${Object.entries(resource.config || {}).map(([key, value]) => `
  ${key} = ${JSON.stringify(value)}`).join('')}
}`).join('')}
    `.trim();
  }

  /**
   * Parse Terraform plan changes
   */
  private parsePlanChanges(planData: any): ResourceChange[] {
    const changes: ResourceChange[] = [];

    if (planData.resource_changes) {
      for (const change of planData.resource_changes) {
        changes.push({
          address: change.address,
          action: this.determineAction(change.change.actions),
          resourceType: change.type,
          changes: change.change.after || {},
          dependencies: [] // Would need to parse from configuration
        });
      }
    }

    return changes;
  }

  /**
   * Determine action from Terraform actions array
   */
  private determineAction(actions: string[]): ResourceChange['action'] {
    if (actions.includes('create')) return 'create';
    if (actions.includes('delete')) return 'delete';
    if (actions.includes('update')) return 'update';
    return 'no-change';
  }
}

/**
 * Provisioning Engine
 * Automated resource provisioning with rollback capabilities
 */
class ProvisioningEngine extends EventEmitter {
  private orchestrator: TerraformOrchestrator;
  private stateManager: StateManager;

  constructor(orchestrator: TerraformOrchestrator, stateManager: StateManager) {
    super();
    this.orchestrator = orchestrator;
    this.stateManager = stateManager;
  }

  /**
   * Provision infrastructure with rollback capability
   */
  async provision(
    workspaceId: string,
    config: Record<string, any>,
    rollbackStrategy: RollbackStrategy
  ): Promise<void> {
    const checkpointId = crypto.randomUUID();

    try {
      // Create checkpoint
      await this.stateManager.createCheckpoint(workspaceId, checkpointId);

      // Generate and analyze plan
      const plan = await this.orchestrator.generatePlan(workspaceId, config.variables);
      
      // Apply changes
      await this.orchestrator.applyPlan(plan);

      // Update state
      const newState = await this.orchestrator.getState(workspaceId);
      await this.stateManager.updateState(workspaceId, newState);

      this.emit('provisioning:completed', { workspaceId, plan });
    } catch (error) {
      this.emit('error', { operation: 'provision', error });

      // Attempt rollback based on strategy
      if (rollbackStrategy.type === 'automatic') {
        await this.rollback(workspaceId, checkpointId);
      }

      throw error;
    }
  }

  /**
   * Rollback to previous state
   */
  async rollback(workspaceId: string, checkpointId: string): Promise<void> {
    try {
      const checkpoint = await this.stateManager.getCheckpoint(workspaceId, checkpointId);
      await this.stateManager.restoreCheckpoint(workspaceId, checkpoint);

      this.emit('rollback:completed', { workspaceId, checkpointId });
    } catch (error) {
      this.emit('error', { operation: 'rollback', error });
      throw error;
    }
  }

  /**
   * Validate provisioning prerequisites
   */
  async validatePrerequisites(
    workspaceId: string,
    config: Record<string, any>
  ): Promise<boolean> {
    try {
      // Check workspace accessibility
      const workspacePath = path.join(this.orchestrator['workspaceDir'], workspaceId);
      await fs.access(workspacePath);

      // Validate Terraform configuration
      await this.orchestrator.executeTerraform(['validate'], workspacePath);

      // Check resource dependencies
      // Implementation would check if dependent resources exist

      return true;
    } catch (error) {
      this.emit('error', { operation: 'validatePrerequisites', error });
      return false;
    }
  }
}

/**
 * Drift Detector
 * Real-time configuration drift monitoring and alerting
 */
class DriftDetector extends EventEmitter {
  private orchestrator: TerraformOrchestrator;
  private stateManager: StateManager;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(orchestrator: TerraformOrchestrator, stateManager: StateManager) {
    super();
    this.orchestrator = orchestrator;
    this.stateManager = stateManager;
  }

  /**
   * Start drift monitoring for workspace
   */
  startMonitoring(workspaceId: string, intervalMinutes: number = 30): void {
    const interval = setInterval(async () => {
      try {
        const drift = await this.detectDrift(workspaceId);
        if (drift.driftedResources.length > 0) {
          this.emit('drift:detected', drift);
        }
      } catch (error) {
        this.emit('error', { operation: 'drift:monitor', error });
      }
    }, intervalMinutes * 60 * 1000);

    this.intervals.set(workspaceId, interval);
  }

  /**
   * Stop drift monitoring
   */
  stopMonitoring(workspaceId: string): void {
    const interval = this.intervals.get(workspaceId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(workspaceId);
    }
  }

  /**
   * Detect configuration drift
   */
  async detectDrift(workspaceId: string): Promise<DriftDetection> {
    try {
      // Get current state from Terraform
      const currentState = await this.orchestrator.getState(workspaceId);
      
      // Get expected state from state manager
      const expectedState = await this.stateManager.getState(workspaceId);

      // Compare states and identify drift
      const driftedResources = this.compareStates(
        expectedState.resources,
        currentState.values?.root_module?.resources || []
      );

      const drift: DriftDetection = {
        workspaceId,
        driftedResources,
        detectedAt: new Date(),
        severity: this.calculateDriftSeverity(driftedResources),
        autoRemediate: driftedResources.every(r => 
          r.differences.every(d => d.impact !== 'security')
        )
      };

      return drift;
    } catch (error) {
      this.emit('error', { operation: 'detectDrift', error });
      throw error;
    }
  }

  /**
   * Remediate detected drift
   */
  async remediateDrift(drift: DriftDetection): Promise<void> {
    try {
      if (!drift.autoRemediate) {
        throw new Error('Manual remediation required for security-related drift');
      }

      // Generate plan to fix drift
      const plan = await this.orchestrator.generatePlan(drift.workspaceId);
      
      // Apply corrective changes
      await this.orchestrator.applyPlan(plan);

      this.emit('drift:remediated', { drift, plan });
    } catch (error) {
      this.emit('error', { operation: 'remediateDrift', error });
      throw error;
    }
  }

  /**
   * Compare expected and actual states
   */
  private compareStates(
    expectedResources: ManagedResource[],
    actualResources: any[]
  ): DriftedResource[] {
    const driftedResources: DriftedResource[] = [];

    for (const expected of expectedResources) {
      const actual = actualResources.find(r => r.address === expected.address);
      
      if (!actual) {
        // Resource missing entirely
        driftedResources.push({
          address: expected.address,
          expectedState: expected.attributes,
          actualState: {},
          differences: [{
            attribute: '_existence',
            expected: 'exists',
            actual: 'missing',
            impact: 'configuration'
          }]
        });
        continue;
      }

      // Compare attributes
      const differences = this.compareAttributes(expected.attributes, actual.values);
      
      if (differences.length > 0) {
        driftedResources.push({
          address: expected.address,
          expectedState: expected.attributes,
          actualState: actual.values,
          differences
        });
      }
    }

    return driftedResources;
  }

  /**
   * Compare resource attributes
   */
  private compareAttributes(expected: Record<string, any>, actual: Record<string, any>): StateDifference[] {
    const differences: StateDifference[] = [];

    // Compare all expected attributes
    for (const [key, expectedValue] of Object.entries(expected)) {
      const actualValue = actual[key];
      
      if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
        differences.push({
          attribute: key,
          expected: expectedValue,
          actual: actualValue,
          impact: this.determineImpact(key, expectedValue, actualValue)
        });
      }
    }

    return differences;
  }

  /**
   * Determine impact of attribute change
   */
  private determineImpact(
    attribute: string,
    expected: any,
    actual: any
  ): StateDifference['impact'] {
    // Security-related attributes
    if (attribute.includes('security') || attribute.includes('iam') || 
        attribute.includes('policy') || attribute.includes('encryption')) {
      return 'security';
    }

    // Cost-related attributes
    if (attribute.includes('size') || attribute.includes('capacity') || 
        attribute.includes('instance_type')) {
      return 'cost';
    }

    // Performance-related attributes
    if (attribute.includes('performance') || attribute.includes('throughput') || 
        attribute.includes('iops')) {
      return 'performance';
    }

    return 'configuration';
  }

  /**
   * Calculate overall drift severity
   */
  private calculateDriftSeverity(driftedResources: DriftedResource[]): DriftDetection['severity'] {
    if (driftedResources.length === 0) return 'low';

    const hasSecurityImpact = driftedResources.some(r => 
      r.differences.some(d => d.impact === 'security')
    );
    
    if (hasSecurityImpact) return 'critical';

    const resourceCount = driftedResources.length;
    if (resourceCount > 10) return 'high';
    if (resourceCount > 5) return 'medium';
    
    return 'low';
  }
}

/**
 * Compliance Validator
 * Policy-as-code validation against security/governance rules
 */
class ComplianceValidator extends EventEmitter {
  private policies: Map<string, CompliancePolicy> = new Map();

  /**
   * Add compliance policy
   */
  addPolicy(policy: CompliancePolicy): void {
    this.policies.set(policy.id, policy);
    this.emit('policy:added', { policy });
  }

  /**
   * Remove compliance policy
   */
  removePolicy(policyId: string): void {
    this.