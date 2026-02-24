/**
 * Analytics - Event tracking and user behavior insights
 */

import { AppConfig, AnalyticsEvent } from './types'

export class Analytics {
  private config: AppConfig
  private eventQueue: AnalyticsEvent[] = []
  private sessionId: string
  private userId?: string
  private flushInterval: NodeJS.Timeout | null = null

  constructor(config: AppConfig) {
    this.config = config
    this.sessionId = this.generateSessionId()
    
    // Auto-flush every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flush()
    }, 10000)
  }

  /**
   * Track an analytics event
   */
  async track(
    eventName: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    const event: AnalyticsEvent = {
      eventName,
      appId: this.config.appId,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      properties: {
        ...properties,
        appVersion: this.config.version,
        environment: this.config.environment,
        sessionId: this.sessionId
      },
      sessionId: this.sessionId
    }

    this.eventQueue.push(event)

    // Flush immediately for important events
    const criticalEvents = ['purchase', 'signup', 'error', 'crash']
    if (criticalEvents.includes(eventName)) {
      await this.flush()
    }
  }

  /**
   * Track page view
   */
  async pageView(path: string, properties: Record<string, any> = {}): Promise<void> {
    await this.track('page_view', {
      path,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      ...properties
    })
  }

  /**
   * Track user interaction
   */
  async interaction(
    element: string,
    action: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    await this.track('interaction', {
      element,
      action,
      ...properties
    })
  }

  /**
   * Track feature usage
   */
  async featureUsed(
    featureName: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    await this.track('feature_used', {
      feature: featureName,
      ...properties
    })
  }

  /**
   * Track conversion event
   */
  async conversion(
    conversionType: string,
    value?: number,
    properties: Record<string, any> = {}
  ): Promise<void> {
    await this.track('conversion', {
      type: conversionType,
      value,
      ...properties
    })
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId
    this.track('user_identified', { userId })
  }

  /**
   * Clear user ID (on logout)
   */
  clearUserId(): void {
    this.userId = undefined
    this.track('user_logged_out')
  }

  /**
   * Set custom user properties
   */
  async setUserProperties(properties: Record<string, any>): Promise<void> {
    await this.track('user_properties_updated', properties)
  }

  /**
   * Start a timed event
   */
  startTimer(eventName: string): () => Promise<void> {
    const startTime = Date.now()
    
    return async () => {
      const duration = Date.now() - startTime
      await this.track(eventName, { duration })
    }
  }

  /**
   * Track A/B test exposure
   */
  async trackExperiment(
    experimentName: string,
    variant: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    await this.track('experiment_exposure', {
      experiment: experimentName,
      variant,
      ...properties
    })
  }

  /**
   * Flush events to Javari API
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const events = [...this.eventQueue]
    this.eventQueue = []

    try {
      await fetch(`${this.config.javariEndpoint}/api/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: this.config.appId,
          events
        })
      })
    } catch (error) {
      console.error('[Analytics] Failed to flush events:', error)
      // Re-add to queue if flush fails
      this.eventQueue.push(...events)
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Clean up and flush remaining events
   */
  async destroy(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    await this.flush()
  }

  /**
   * Get analytics statistics
   */
  getStats(): {
    queueSize: number
    sessionId: string
    userId?: string
  } {
    return {
      queueSize: this.eventQueue.length,
      sessionId: this.sessionId,
      userId: this.userId
    }
  }
}
