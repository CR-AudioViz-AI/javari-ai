/**
 * Performance Monitor - Web vitals and performance tracking
 */

import { AppConfig, PerformanceMetrics } from './types'

export class PerformanceMonitor {
  private config: AppConfig
  private observer: PerformanceObserver | null = null
  private metricsQueue: PerformanceMetrics[] = []
  private flushInterval: NodeJS.Timeout | null = null

  constructor(config: AppConfig) {
    this.config = config
  }

  /**
   * Start performance tracking
   */
  startTracking(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      console.warn('[PerformanceMonitor] PerformanceObserver not available')
      return
    }

    // Track Core Web Vitals
    this.trackWebVitals()
    
    // Track navigation timing
    this.trackNavigationTiming()
    
    // Track resource timing
    this.trackResourceTiming()

    // Auto-flush every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush()
    }, 30000)

    console.log('[PerformanceMonitor] Tracking started')
  }

  /**
   * Stop performance tracking
   */
  stopTracking(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }

    // Final flush
    this.flush()

    console.log('[PerformanceMonitor] Tracking stopped')
  }

  /**
   * Track Core Web Vitals (LCP, FID, CLS)
   */
  private trackWebVitals(): void {
    if (typeof window === 'undefined') return

    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as any
        
        if (lastEntry) {
          this.recordMetric('lcp', lastEntry.renderTime || lastEntry.loadTime)
        }
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
    } catch (e) {
      console.warn('[PerformanceMonitor] LCP tracking failed:', e)
    }

    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: any) => {
          const delay = entry.processingStart - entry.startTime
          this.recordMetric('fid', delay)
        })
      })
      fidObserver.observe({ entryTypes: ['first-input'] })
    } catch (e) {
      console.warn('[PerformanceMonitor] FID tracking failed:', e)
    }

    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        })
        this.recordMetric('cls', clsValue)
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    } catch (e) {
      console.warn('[PerformanceMonitor] CLS tracking failed:', e)
    }
  }

  /**
   * Track navigation timing
   */
  private trackNavigationTiming(): void {
    if (typeof window === 'undefined' || !window.performance) return

    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      if (navigation) {
        const metrics: PerformanceMetrics = {
          appId: this.config.appId,
          timestamp: new Date().toISOString(),
          metrics: {
            pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
            timeToInteractive: navigation.domInteractive - navigation.fetchStart,
            firstContentfulPaint: this.getFirstContentfulPaint(),
            largestContentfulPaint: 0, // Will be updated by LCP observer
            cumulativeLayoutShift: 0, // Will be updated by CLS observer
            firstInputDelay: 0 // Will be updated by FID observer
          },
          route: window.location.pathname,
          deviceType: this.getDeviceType()
        }

        this.metricsQueue.push(metrics)
      }
    })
  }

  /**
   * Track resource timing
   */
  private trackResourceTiming(): void {
    if (typeof window === 'undefined' || !window.performance) return

    const resourceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      
      // Track slow resources
      entries.forEach((entry: any) => {
        if (entry.duration > 1000) { // Slower than 1 second
          console.warn('[PerformanceMonitor] Slow resource detected:', {
            name: entry.name,
            duration: entry.duration,
            type: entry.initiatorType
          })
        }
      })
    })

    try {
      resourceObserver.observe({ entryTypes: ['resource'] })
    } catch (e) {
      console.warn('[PerformanceMonitor] Resource tracking failed:', e)
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(name: string, value: number): void {
    // Find or create metrics entry for current page
    let currentMetrics = this.metricsQueue.find(m => 
      m.route === (typeof window !== 'undefined' ? window.location.pathname : '')
    )

    if (!currentMetrics) {
      currentMetrics = {
        appId: this.config.appId,
        timestamp: new Date().toISOString(),
        metrics: {
          pageLoadTime: 0,
          timeToInteractive: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          cumulativeLayoutShift: 0,
          firstInputDelay: 0
        },
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
        deviceType: this.getDeviceType()
      }
      this.metricsQueue.push(currentMetrics)
    }

    // Update specific metric
    switch (name) {
      case 'lcp':
        currentMetrics.metrics.largestContentfulPaint = value
        break
      case 'fid':
        currentMetrics.metrics.firstInputDelay = value
        break
      case 'cls':
        currentMetrics.metrics.cumulativeLayoutShift = value
        break
    }
  }

  /**
   * Get First Contentful Paint
   */
  private getFirstContentfulPaint(): number {
    if (typeof window === 'undefined' || !window.performance) return 0

    const paintEntries = performance.getEntriesByType('paint')
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')
    
    return fcpEntry ? fcpEntry.startTime : 0
  }

  /**
   * Detect device type
   */
  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop'

    const width = window.innerWidth
    
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }

  /**
   * Flush metrics to Javari API
   */
  private async flush(): Promise<void> {
    if (this.metricsQueue.length === 0) return

    const metrics = [...this.metricsQueue]
    this.metricsQueue = []

    try {
      await fetch(`${this.config.javariEndpoint}/api/monitoring/performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: this.config.appId,
          metrics
        })
      })
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to flush metrics:', error)
      // Re-add to queue if flush fails
      this.metricsQueue.push(...metrics)
    }
  }

  /**
   * Get current performance stats
   */
  getStats(): {
    queueSize: number
    tracking: boolean
  } {
    return {
      queueSize: this.metricsQueue.length,
      tracking: this.observer !== null
    }
  }

  /**
   * Manually track a custom performance metric
   */
  trackCustomMetric(name: string, value: number, metadata?: Record<string, any>): void {
    console.log(`[PerformanceMonitor] Custom metric: ${name} = ${value}`, metadata)
    
    // Could send to analytics or custom metrics endpoint
  }
}
