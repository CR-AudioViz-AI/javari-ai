import { Redis, Cluster } from 'ioredis';
import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
export interface CacheResult<T = any> {
export interface CacheMetadata {
export interface CacheConfig {
export interface WarmingStrategy {
export interface InvalidationOptions {
export interface CacheMetrics {
    // Move to head (mark as recently used)
      // Update existing node
      // Create new node
    // Evict if necessary
      // Update access count
      // Store metadata separately for efficient queries
    // Remove key as dependent
    // Remove key's dependencies
export default {}
