/**
 * Error Tracker - Comprehensive error capture and auto-fix system
 */

import { AppConfig, ErrorReport } from './types'

export class ErrorTracker {
  private config: AppConfig
  private errorQueue: ErrorReport[] = []
  private maxQueueSize: number = 100
  private flushInterval: NodeJS.Timeout | null = null
  private globalHandlersRegistered: boolean = false

  constructor(config: AppConfig) {
    this.config = config
  }

  /**
   * Register global error handlers
   */
  registerGlobalHandlers(): void {
    if (this.globalHandlersRegistered || typeof window === 'undefined') {
      return
    }

    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        level: 'error',
        context: {
          route: window.location.pathname,
          userAgent: navigator.userAgent
        }
      })
    })

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        level: 'error',
        context: {
          route: window.location.pathname,
          userAgent: navigator.userAgent
        }
      })
    })

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flushErrors()
    }, 30000) // Flush every 30 seconds

    this.globalHandlersRegistered = true
    console.log('[ErrorTracker] Global handlers registered')
  }

  /**
   * Unregister global error handlers
   */
  unregisterGlobalHandlers(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    this.globalHandlersRegistered = false
  }

  /**
   * Capture an error
   */
  captureError(error: {
    message: string
    stack?: string
    level?: 'error' | 'warning' | 'critical'
    context?: Record<string, any>
  }): string {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      appId: this.config.appId,
      timestamp: new Date().toISOString(),
      level: error.level || 'error',
      message: error.message,
      stack: error.stack,
      context: {
        ...error.context,
        appVersion: this.config.version,
        environment: this.config.environment
      },
      resolved: false,
      autoFixAttempted: false
    }

    // Add to queue
    this.errorQueue.push(errorReport)

    // Flush immediately if critical or queue is full
    if (error.level === 'critical' || this.errorQueue.length >= this.maxQueueSize) {
      this.flushErrors()
    }

    // Attempt auto-fix for known patterns
    this.attemptAutoFix(errorReport)

    return errorReport.id
  }

  /**
   * Capture and wrap errors from async functions
   */
  async captureAsyncError<T>(
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      this.captureError({
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        level: 'error',
        context
      })
      throw error
    }
  }

  /**
   * Flush errors to Javari API
   */
  private async flushErrors(): Promise<void> {
    if (this.errorQueue.length === 0) return

    const errors = [...this.errorQueue]
    this.errorQueue = []

    try {
      await fetch(`${this.config.javariEndpoint}/api/monitoring/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: this.config.appId,
          errors
        })
      })
    } catch (error) {
      console.error('[ErrorTracker] Failed to flush errors:', error)
      // Re-add to queue if flush fails
      this.errorQueue.push(...errors)
    }
  }

  /**
   * Attempt auto-fix for known error patterns
   */
  private async attemptAutoFix(error: ErrorReport): Promise<void> {
    // Pattern matching for common errors
    const patterns = [
      {
        pattern: /Cannot find module/i,
        fix: 'missing_dependency',
        action: async () => {
          console.log('[ErrorTracker] Auto-fix: Detected missing dependency')
          // Trigger Javari to analyze and suggest fix
          await this.requestAutoFix(error, 'missing_dependency')
        }
      },
      {
        pattern: /Network request failed/i,
        fix: 'network_retry',
        action: async () => {
          console.log('[ErrorTracker] Auto-fix: Network issue detected')
          // Could trigger automatic retry logic
        }
      },
      {
        pattern: /Out of memory/i,
        fix: 'memory_cleanup',
        action: async () => {
          console.log('[ErrorTracker] Auto-fix: Memory issue detected')
          // Trigger memory optimization
        }
      }
    ]

    for (const { pattern, fix, action } of patterns) {
      if (pattern.test(error.message)) {
        error.autoFixAttempted = true
        await action()
        break
      }
    }
  }

  /**
   * Request auto-fix from Javari
   */
  private async requestAutoFix(error: ErrorReport, fixType: string): Promise<void> {
    try {
      await fetch(`${this.config.javariEndpoint}/api/auto-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId: error.id,
          appId: this.config.appId,
          fixType,
          error
        })
      })
    } catch (err) {
      console.error('[ErrorTracker] Failed to request auto-fix:', err)
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get error statistics
   */
  getStats(): {
    queueSize: number
    totalCaptured: number
  } {
    return {
      queueSize: this.errorQueue.length,
      totalCaptured: 0 // Would track in production
    }
  }
}
