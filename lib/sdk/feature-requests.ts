/**
 * Feature Request System - AI-powered user feedback and feature prioritization
 */

import { AppConfig, FeatureRequest, JavariResponse } from './types'

export class FeatureRequestSystem {
  private config: AppConfig

  constructor(config: AppConfig) {
    this.config = config
  }

  /**
   * Submit a new feature request
   */
  async submit(request: {
    userId: string
    title: string
    description: string
    priority?: 'low' | 'medium' | 'high' | 'critical'
  }): Promise<JavariResponse<FeatureRequest>> {
    try {
      const response = await fetch(
        `${this.config.javariEndpoint}/api/feature-requests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: this.config.appId,
            ...request,
            priority: request.priority || 'medium'
          })
        }
      )

      const data = await response.json()

      if (response.ok) {
        // Trigger AI analysis in background
        this.triggerAIAnalysis(data.id)
      }

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? data.error : undefined,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit request',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Get all feature requests for the app
   */
  async getAll(filters?: {
    status?: string
    priority?: string
    userId?: string
  }): Promise<JavariResponse<FeatureRequest[]>> {
    try {
      const params = new URLSearchParams({
        appId: this.config.appId,
        ...filters
      })

      const response = await fetch(
        `${this.config.javariEndpoint}/api/feature-requests?${params}`,
        { method: 'GET' }
      )

      const data = await response.json()

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? data.error : undefined,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch requests',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Get a specific feature request
   */
  async get(requestId: string): Promise<JavariResponse<FeatureRequest>> {
    try {
      const response = await fetch(
        `${this.config.javariEndpoint}/api/feature-requests/${requestId}`,
        { method: 'GET' }
      )

      const data = await response.json()

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? data.error : undefined,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch request',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Vote on a feature request
   */
  async vote(requestId: string, userId: string): Promise<JavariResponse<void>> {
    try {
      const response = await fetch(
        `${this.config.javariEndpoint}/api/feature-requests/${requestId}/vote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        }
      )

      return {
        success: response.ok,
        error: !response.ok ? 'Failed to vote' : undefined,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to vote',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Update feature request status (admin only)
   */
  async updateStatus(
    requestId: string,
    status: FeatureRequest['status']
  ): Promise<JavariResponse<FeatureRequest>> {
    try {
      const response = await fetch(
        `${this.config.javariEndpoint}/api/feature-requests/${requestId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }
      )

      const data = await response.json()

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? data.error : undefined,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Trigger AI analysis for a feature request
   */
  private async triggerAIAnalysis(requestId: string): Promise<void> {
    try {
      await fetch(
        `${this.config.javariEndpoint}/api/feature-requests/${requestId}/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: this.config.appId })
        }
      )
    } catch (error) {
      console.error('[FeatureRequestSystem] Failed to trigger AI analysis:', error)
    }
  }

  /**
   * Get AI-powered insights for feature requests
   */
  async getInsights(): Promise<JavariResponse<{
    topRequested: FeatureRequest[]
    quickWins: FeatureRequest[]
    highImpact: FeatureRequest[]
    recommendations: string[]
  }>> {
    try {
      const response = await fetch(
        `${this.config.javariEndpoint}/api/feature-requests/insights?appId=${this.config.appId}`,
        { method: 'GET' }
      )

      const data = await response.json()

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? data.error : undefined,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get insights',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Export feature requests for analysis
   */
  async export(format: 'json' | 'csv' = 'json'): Promise<JavariResponse<string>> {
    try {
      const response = await fetch(
        `${this.config.javariEndpoint}/api/feature-requests/export?appId=${this.config.appId}&format=${format}`,
        { method: 'GET' }
      )

      const data = await response.text()

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? 'Export failed' : undefined,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export',
        timestamp: new Date().toISOString()
      }
    }
  }
}
