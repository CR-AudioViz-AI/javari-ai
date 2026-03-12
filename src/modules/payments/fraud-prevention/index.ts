import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
export interface TransactionData {
export interface Address {
export interface FraudRiskAssessment {
export interface RiskFactor {
export interface FraudRecommendation {
export interface FraudPattern {
export interface FraudAlert {
export interface ModelConfig {
export interface CrossMerchantIntelligence {
export interface BlacklistEntry {
export interface MerchantRiskMetrics {
export interface ExtractedFeatures {
    // Lower variance = higher confidence
    // Implementation for online learning would go here
    // Velocity check
    // Amount anomaly check
    // Geographic anomaly check
    // Time-based anomaly check
    // Device fingerprint check
      // In production, integrate with IP geolocation service
    // Check against user's typical locations
    // Add current location to user's typical locations
    // Mock implementation - in production, integrate with IP geolocation service
    // Add device to user's known devices
      // Store training data in database
      // Trigger model retraining if we have enough new data
      // Re-add failed items to queue
    // Get last retraining date
      // Cache pattern for quick access
    // Cache blacklist entry
export default {}
