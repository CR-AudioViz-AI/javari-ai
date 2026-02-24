/**
 * Javari App Integration SDK
 * 
 * Comprehensive integration layer for all CR AudioViz AI applications
 * Provides monitoring, analytics, error tracking, and AI-powered features
 * 
 * @package @crav/javari-sdk
 * @version 1.0.0
 */

export { AppMonitor } from './app-monitor'
export { ErrorTracker } from './error-tracker'
export { Analytics } from './analytics'
export { FeatureRequestSystem } from './feature-requests'
export { PerformanceMonitor } from './performance'
export { JavariClient } from './client'

export type {
  AppHealthStatus,
  ErrorReport,
  AnalyticsEvent,
  FeatureRequest,
  PerformanceMetrics
} from './types'
