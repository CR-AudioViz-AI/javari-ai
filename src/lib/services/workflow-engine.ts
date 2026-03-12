import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';
export interface WorkflowTask {
export interface WorkflowDefinition {
export interface RetryPolicy {
export interface ErrorHandlingConfig {
export interface WorkflowTrigger {
export interface NotificationConfig {
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export interface TaskExecutionResult {
export interface ExecutionContext {
export interface AgentInstance {
export interface WorkflowExecutionOptions {
export interface WorkflowEngineConfig {
      // Acquire distributed lock
      // Load workflow definition
      // Parse and validate workflow
      // Create execution context
      // Store execution record
      // Start execution
    // Continue execution
    // Cancel running tasks
    // Release lock
    // Load from database
      // Schedule initial tasks (those without dependencies)
    // Find tasks that are ready to run
      // Update context variables with task output
      // Schedule dependent tasks
      // Handle task failure
    // Check if workflow is complete
    // Check if all tasks are complete
    // Check if no tasks are currently running and no new tasks can be scheduled
        // Deadlock - no tasks can run
    // Release lock
    // Handle error notifications
    // Release lock
    // Release lock
    // Implementation depends on agent types and their cancellation mechanisms
    // Implementation would depend on notification services integration
          // Update last seen timestamp
        // Try JSON first
          // Try YAML
    // Validate required fields
export default {}
