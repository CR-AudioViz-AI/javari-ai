import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';
import { Redis } from 'ioredis';
export interface Transaction {
export interface RiskAssessment {
export interface RiskFactor {
export interface FraudRule {
export interface VelocityData {
export interface DeviceFingerprint {
export interface FraudAlert {
export interface FraudPreventionConfig {
export interface PatternAnalysis {
    // Amount-based clustering
    // Merchant-based clustering
    // Time-based clustering
    // Simple rule evaluation - in production, use a proper rule engine
      // Track hourly velocity
      // Track daily velocity
    // Check country restrictions
    // Check location velocity (impossible travel)
    // Check if device is known
export default {}
