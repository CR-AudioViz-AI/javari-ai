/**
 * App Monitor - Real-time application health monitoring
 */

import { AppConfig, AppHealthStatus } from './types'

export class AppMonitor {
  private config: AppConfig
  private interval: NodeJS.Timeout | null = null
  private healthCheckInterval: number = 60000 // 1 minute
  private metrics: {
    startTime: number
    requestCount: number
    errorCount: number
    activeUsers: Set<string>
  }

  constructor(config: AppConfig) {
    this.config = config
    this.metrics = {
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      activeUsers: new Set()
    }
  }

  /**
   * Start health monitoring
   */
  async start(): Promise<void> {
    // Initial health check
    await this.performHealthCheck()

    // Set up periodic health checks
    this.interval = setInterval(async () => {
      await this.performHealthCheck()
    }, this.healthCheckInterval)

    console.log(`[AppMonitor] Started for ${this.config.appName}`)
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    console.log('[AppMonitor] Stopped')
  }

  /**
   * Perform health check and report status
   */
  private async performHealthCheck(): Promise<void> {
    const status = this.getHealthStatus()
    
    try {
      await fetch(`${this.config.javariEndpoint}/api/monitoring/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(status)
      })
    } catch (error) {
      console.error('[AppMonitor] Failed to report health status:', error)
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): AppHealthStatus {
    const uptime = Date.now() - this.metrics.startTime
    const errorRate = this.metrics.requestCount > 0 
      ? this.metrics.errorCount / this.metrics.requestCount 
      : 0

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'down' = 'healthy'
    if (errorRate > 0.1) status = 'degraded'
    if (errorRate > 0.5) status = 'down'

    return {
      appId: this.config.appId,
      status,
      uptime,
      lastCheck: new Date().toISOString(),
      metrics: {
        responseTime: this.getAverageResponseTime(),
        errorRate,
        activeUsers: this.metrics.activeUsers.size
      }
    }
  }

  /**
   * Track a request
   */
  trackRequest(duration?: number): void {
    this.metrics.requestCount++
  }

  /**
   * Track an error
   */
  trackError(): void {
    this.metrics.errorCount++
  }

  /**
   * Track active user
   */
  trackUser(userId: string): void {
    this.metrics.activeUsers.add(userId)
  }

  /**
   * Remove inactive user
   */
  removeUser(userId: string): void {
    this.metrics.activeUsers.delete(userId)
  }

  /**
   * Get average response time
   */
  private getAverageResponseTime(): number {
    // In production, this would aggregate actual response times
    return 200 // Placeholder
  }

  /**
   * Set custom health check interval
   */
  setHealthCheckInterval(ms: number): void {
    this.healthCheckInterval = ms
    
    // Restart monitoring with new interval
    if (this.interval) {
      this.stop()
      this.start()
    }
  }
}
