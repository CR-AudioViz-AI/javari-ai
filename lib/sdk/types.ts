/**
 * Type definitions for Javari App Integration SDK
 */

export interface AppConfig {
  appId: string
  appName: string
  version: string
  environment: 'development' | 'staging' | 'production'
  javariEndpoint?: string
}

export interface AppHealthStatus {
  appId: string
  status: 'healthy' | 'degraded' | 'down'
  uptime: number
  lastCheck: string
  metrics: {
    responseTime: number
    errorRate: number
    activeUsers: number
    cpuUsage?: number
    memoryUsage?: number
  }
}

export interface ErrorReport {
  id: string
  appId: string
  timestamp: string
  level: 'error' | 'warning' | 'critical'
  message: string
  stack?: string
  context: {
    userId?: string
    route?: string
    userAgent?: string
    metadata?: Record<string, any>
  }
  resolved: boolean
  autoFixAttempted: boolean
}

export interface AnalyticsEvent {
  eventName: string
  appId: string
  userId?: string
  timestamp: string
  properties: Record<string, any>
  sessionId?: string
}

export interface FeatureRequest {
  id: string
  appId: string
  userId: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'submitted' | 'reviewing' | 'planned' | 'in_progress' | 'completed' | 'rejected'
  votes: number
  createdAt: string
  updatedAt: string
  aiAnalysis?: {
    feasibility: number
    estimatedEffort: string
    suggestedImplementation?: string
  }
}

export interface PerformanceMetrics {
  appId: string
  timestamp: string
  metrics: {
    pageLoadTime: number
    timeToInteractive: number
    firstContentfulPaint: number
    largestContentfulPaint: number
    cumulativeLayoutShift: number
    firstInputDelay: number
  }
  route?: string
  deviceType?: 'mobile' | 'tablet' | 'desktop'
}

export interface JavariResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}
