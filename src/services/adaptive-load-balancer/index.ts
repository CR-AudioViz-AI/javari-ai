import { EventEmitter } from 'events';
export interface GeoLocation {
export interface ServiceEndpoint {
export interface PerformanceMetrics {
export interface CircuitBreakerConfig {
export interface LoadBalancerConfig {
export interface RoutingDecision {
export interface RequestContext {
    // Keep only last 100 metrics entries
    // Calculate inverse response time weights
    // Calculate inverse distance weights
    // Calculate inverse connection weights
      // Weighted combination: 40% response time, 35% geography, 25% connections
export default {}
