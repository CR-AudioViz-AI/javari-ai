import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { AgentManager } from '../ai-agents/agent-manager.js';
import { AgentPool } from '../ai-agents/agent-pool.js';
import { DecisionTree } from '../decision-engine/decision-tree.js';
import { TeamPerformance } from '../analytics/team-performance.js';
export interface AgentInsight {
export interface ConsensusData {
export interface CollectiveDecision {
export interface ConsensusConfig {
export interface WeightingConfig {
      // Run all validation rules
      // Check confidence threshold
      // Check consensus threshold
      // Check participant diversity
export default {}
