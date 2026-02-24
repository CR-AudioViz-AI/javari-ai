/**
 * Javari Client - Main SDK entry point
 * Initializes and manages all SDK modules
 */

import { AppConfig, JavariResponse } from './types'
import { AppMonitor } from './app-monitor'
import { ErrorTracker } from './error-tracker'
import { Analytics } from './analytics'
import { FeatureRequestSystem } from './feature-requests'
import { PerformanceMonitor } from './performance'

export class JavariClient {
  private config: AppConfig
  public monitor: AppMonitor
  public errorTracker: ErrorTracker
  public analytics: Analytics
  public featureRequests: FeatureRequestSystem
  public performance: PerformanceMonitor
  
  private initialized: boolean = false

  constructor(config: AppConfig) {
    this.config = {
      ...config,
      javariEndpoint: config.javariEndpoint || process.env.NEXT_PUBLIC_JAVARI_ENDPOINT || 'https://crav-javari.vercel.app'
    }

    // Initialize modules
    this.monitor = new AppMonitor(this.config)
    this.errorTracker = new ErrorTracker(this.config)
    this.analytics = new Analytics(this.config)
    this.featureRequests = new FeatureRequestSystem(this.config)
    this.performance = new PerformanceMonitor(this.config)
  }

  /**
   * Initialize the SDK and start monitoring
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[Javari SDK] Already initialized')
      return
    }

    try {
      // Start health monitoring
      await this.monitor.start()
      
      // Register error handlers
      this.errorTracker.registerGlobalHandlers()
      
      // Initialize performance tracking
      if (typeof window !== 'undefined') {
        this.performance.startTracking()
      }

      this.initialized = true
      console.log(`[Javari SDK] Initialized for ${this.config.appName} v${this.config.version}`)
      
      // Send initialization event
      await this.analytics.track('sdk_initialized', {
        appId: this.config.appId,
        appName: this.config.appName,
        version: this.config.version,
        environment: this.config.environment
      })
    } catch (error) {
      console.error('[Javari SDK] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Shutdown the SDK gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return

    try {
      await this.monitor.stop()
      this.errorTracker.unregisterGlobalHandlers()
      this.performance.stopTracking()
      
      this.initialized = false
      console.log('[Javari SDK] Shutdown complete')
    } catch (error) {
      console.error('[Javari SDK] Shutdown error:', error)
    }
  }

  /**
   * Get SDK status
   */
  getStatus(): { initialized: boolean; config: AppConfig } {
    return {
      initialized: this.initialized,
      config: this.config
    }
  }

  /**
   * Make authenticated request to Javari API
   */
  async apiRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<JavariResponse<T>> {
    const url = `${this.config.javariEndpoint}/api${endpoint}`
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-App-ID': this.config.appId,
          'X-App-Version': this.config.version,
          ...options.headers
        }
      })

      const data = await response.json()
      
      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? data.error || 'Request failed' : undefined,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }
}
