import { EventEmitter } from 'events';
import { supabase } from '../database/supabase.js';
import { AgentRegistry } from './agent-registry.js';
import { CommunicationBus } from './communication-bus.js';
import { DecisionContext } from './decision-context.js';
import { encryptData, decryptData, generateHash } from '../utils/crypto.js';
export interface AgentDelegate {
export interface Vote {
export interface ConsensusProposal {
export interface NegotiationResponse {
export interface Conflict {
export interface ConflictResolution {
export interface VotingProtocol {
export interface ConsensusResult {
      // Verify acceptance from conflicting agents
      // Store encrypted decision record
      // Store individual votes
      // Store negotiation history
      // Get decision record
      // Get votes
      // Get negotiations
      // Validate proposal
      // Set up consensus tracking
      // Notify eligible agents
      // Start vote collection
      // Check if we can proceed with current votes
export default {}
