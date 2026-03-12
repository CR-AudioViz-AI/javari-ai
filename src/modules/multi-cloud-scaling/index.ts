import { EventEmitter } from 'events';
import { 
import { 
import {
import {
import {
import { AWSAdapter } from './providers/aws/AWSAdapter';
import { AzureAdapter } from './providers/azure/AzureAdapter';
import { GCPAdapter } from './providers/gcp/GCPAdapter';
import { DOAdapter } from './providers/digital-ocean/DOAdapter';
import { ScalingAPI } from './api/ScalingAPI';
import { 
import { PolicyValidator } from './policies/PolicyValidator';
import { HealthChecker, HealthStatus } from './monitoring/HealthChecker';
import { AlertManager, Alert, AlertSeverity } from './monitoring/AlertManager';
import { ConfigStore } from './storage/ConfigStore';
import { MetricsStore } from './storage/MetricsStore';
export interface MultiCloudScalingConfig {
export interface ApplicationConfig {
export interface ScalingStatus {
export interface MultiCloudScalingEvents {
    // Initialize storage
    // Initialize core components
    // Initialize cloud providers
    // Initialize policy components
    // Initialize monitoring components
    // Initialize API
      // Validate at least one provider is configured
    // Scaling engine events
    // Metrics collector events
    // Cost optimizer events
    // Availability manager events
    // Health checker events
    // Alert manager events
    // Provider events
      // Initialize storage
      // Load existing applications
      // Start core components
      // Start API server
      // Start scaling loop
      // Stop scaling loop
      // Stop API server
      // Stop monitoring components
      // Stop metrics collection
      // Close storage connections
      // Validate application configuration
      // Validate scaling policies
      // Store application configuration
      // Register with health checker
      // Cancel any ongoing scaling operations
      // Unregister from health checker
      // Remove from storage
      // Execute scaling asynchronously
      // Cancel ongoing provider operations
        // Skip if there's an ongoing scaling operation
        // Get current metrics
        // Evaluate scaling policies
        // Check if scaling is needed
        // Generate scaling decision
          // Optimize decision with cost considerations
          // Validate availability requirements
          // Execute scaling decision
      // Check results
      // Create scaling actions
export default {}
