import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger.util';
import { supabase } from '../../config/supabase';
import { redisClient } from '../../config/redis';
import { encryptionService } from '../security/encryption.service';
import { agentRegistryService } from './agent-registry.service';
import { monitoringService } from '../monitoring/monitoring.service';
export interface AgentMessage {
export interface RoutingConfig {
export interface MessageAck {
export interface DeliveryMetrics {
    // Initialize priority queues
      // Remove lowest priority message if queue is full
    // Set acknowledgment timeout
    // Clear timeout
      // Verify sender is authenticated
      // Verify recipient exists (if direct message)
      // Validate message structure
    // Keep only last 1000 delivery times for rolling average
      // Validate message security
      // Encrypt message if enabled
      // Handle different delivery patterns
    // Process messages every 10ms
      // Check if message has expired
      // Track for delivery guarantee
      // Decrypt message if needed
      // Send via Supabase Realtime
      // Store in Redis for offline agents
    // Set expiration for the key (24 hours)
export default {}
