import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/realtime-js';
export interface PerformanceMetric {
export interface WebVitalMetric {
export interface SystemHealth {
export interface AnomalyDetection {
export interface AlertConfig {
export interface PerformanceAnalyticsConfig {
export interface PerformanceEventHandlers {
    // Add type-specific processing
    // Update historical data
    // Statistical anomaly detection
    // Keep only last 100 values
    // Default thresholds by metric type
    // Core Web Vitals thresholds
    // Here you would integrate with actual notification services
    // For now, we'll just log the alert
    // Collect initial navigation metrics
      // Apply sampling rate
export default {}
