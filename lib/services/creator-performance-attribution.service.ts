import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
export interface RevenueStream {
export interface ChannelPerformance {
export interface ProductPerformance {
export interface TimePeriod {
export interface AttributionModel {
export interface GrowthTrend {
export interface PerformanceMetrics {
export interface AttributionReport {
export interface AttributionQuery {
export interface TimeSeriesPoint {
    // Calculate growth rate (simplified)
    // Simple linear regression for forecasting
    // Calculate R-squared as confidence measure
    // Simplified confidence calculation
    // Calculate period-over-period growth (simplified)
    // Revenue insights
export default {}
