import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Validation schemas
const healthCheckSchema = z.object({
  deployment_id: z.string().uuid(),
  check_type: z.enum(['full', 'performance', 'availability', 'satisfaction']).default('full'),
  duration_hours: z.number().min(1).max(168).default(24)
})

const updateThresholdsSchema = z.object({
  deployment_id: z.string().uuid(),
  thresholds: z.object({
    performance: z.object({
      response_time_ms: z.number().min(0),
      error_rate_percent: z.number().min(0).max(100),
      throughput_rps: z.number().min(0)
    }),
    availability: z.object({
      uptime_percent: z.number().min(0).max(100),
      downtime_tolerance_minutes: z.number().min(0)
    }),
    satisfaction: z.object({
      min_score: z.number().min(0).max(10),
      complaint_threshold: z.number().min(0)
    })
  })
})

const triggerCheckSchema = z.object({
  deployment_id: z.string().uuid(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  notify: z.boolean().default(true)
})

interface HealthMetrics {
  performance: {
    avg_response_time: number
    error_rate: number
    throughput: number
    cpu_usage: number
    memory_usage: number
  }
  availability: {
    uptime_percent: number
    total_downtime_minutes: number
    incident_count: number
    mttr_minutes: number
  }
  satisfaction: {
    user_score: number
    complaint_count: number
    satisfaction_trend: number
    nps_score: number
  }
}

interface PredictionResult {
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  predicted_issues: string[]
  confidence_score: number
  time_to_issue_hours: number | null
  recommendations: string[]
}

class HealthMetricsCollector {
  constructor(private supabase: any) {}

  async collectPerformanceMetrics(deploymentId: string, hours: number): Promise<HealthMetrics['performance']> {
    const { data: metrics } = await this.supabase
      .from('performance_metrics')
      .select('*')
      .eq('deployment_id', deploymentId)
      .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false })

    if (!metrics?.length) {
      throw new Error('No performance metrics available')
    }

    return {
      avg_response_time: metrics.reduce((sum, m) => sum + m.response_time, 0) / metrics.length,
      error_rate: (metrics.filter(m => m.status_code >= 400).length / metrics.length) * 100,
      throughput: metrics.length / hours,
      cpu_usage: metrics.reduce((sum, m) => sum + (m.cpu_usage || 0), 0) / metrics.length,
      memory_usage: metrics.reduce((sum, m) => sum + (m.memory_usage || 0), 0) / metrics.length
    }
  }

  async collectAvailabilityMetrics(deploymentId: string, hours: number): Promise<HealthMetrics['availability']> {
    const { data: logs } = await this.supabase
      .from('availability_logs')
      .select('*')
      .eq('deployment_id', deploymentId)
      .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())

    const totalMinutes = hours * 60
    const downtimeMinutes = logs?.reduce((sum, log) => {
      if (log.status === 'down') {
        return sum + (log.duration_minutes || 0)
      }
      return sum
    }, 0) || 0

    const incidents = logs?.filter(log => log.type === 'incident').length || 0
    const mttr = incidents > 0 ? downtimeMinutes / incidents : 0

    return {
      uptime_percent: ((totalMinutes - downtimeMinutes) / totalMinutes) * 100,
      total_downtime_minutes: downtimeMinutes,
      incident_count: incidents,
      mttr_minutes: mttr
    }
  }

  async collectSatisfactionMetrics(deploymentId: string, hours: number): Promise<HealthMetrics['satisfaction']> {
    const { data: feedback } = await this.supabase
      .from('user_feedback')
      .select('*')
      .eq('deployment_id', deploymentId)
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())

    const avgScore = feedback?.reduce((sum, f) => sum + (f.score || 0), 0) / (feedback?.length || 1) || 0
    const complaints = feedback?.filter(f => f.type === 'complaint').length || 0
    const npsScore = this.calculateNPS(feedback || [])

    // Calculate trend (simplified)
    const recentFeedback = feedback?.slice(0, Math.floor(feedback.length / 2)) || []
    const olderFeedback = feedback?.slice(Math.floor(feedback.length / 2)) || []
    const recentAvg = recentFeedback.reduce((sum, f) => sum + f.score, 0) / (recentFeedback.length || 1)
    const olderAvg = olderFeedback.reduce((sum, f) => sum + f.score, 0) / (olderFeedback.length || 1)
    const trend = recentAvg - olderAvg

    return {
      user_score: avgScore,
      complaint_count: complaints,
      satisfaction_trend: trend,
      nps_score: npsScore
    }
  }

  private calculateNPS(feedback: any[]): number {
    if (!feedback.length) return 0
    const promoters = feedback.filter(f => f.score >= 9).length
    const detractors = feedback.filter(f => f.score <= 6).length
    return ((promoters - detractors) / feedback.length) * 100
  }
}

class HealthScoreCalculator {
  calculateCompositeScore(metrics: HealthMetrics): number {
    const performanceScore = this.calculatePerformanceScore(metrics.performance)
    const availabilityScore = this.calculateAvailabilityScore(metrics.availability)
    const satisfactionScore = this.calculateSatisfactionScore(metrics.satisfaction)

    // Weighted average (availability weighted highest)
    return (performanceScore * 0.3 + availabilityScore * 0.5 + satisfactionScore * 0.2)
  }

  private calculatePerformanceScore(perf: HealthMetrics['performance']): number {
    let score = 100
    
    // Response time penalty
    if (perf.avg_response_time > 2000) score -= 30
    else if (perf.avg_response_time > 1000) score -= 15
    else if (perf.avg_response_time > 500) score -= 5

    // Error rate penalty
    if (perf.error_rate > 5) score -= 40
    else if (perf.error_rate > 1) score -= 20
    else if (perf.error_rate > 0.1) score -= 10

    // Resource usage penalty
    if (perf.cpu_usage > 80) score -= 15
    if (perf.memory_usage > 80) score -= 15

    return Math.max(0, score)
  }

  private calculateAvailabilityScore(avail: HealthMetrics['availability']): number {
    let score = avail.uptime_percent

    // Incident penalty
    if (avail.incident_count > 5) score -= 20
    else if (avail.incident_count > 2) score -= 10

    // MTTR penalty
    if (avail.mttr_minutes > 60) score -= 15
    else if (avail.mttr_minutes > 30) score -= 10

    return Math.max(0, score)
  }

  private calculateSatisfactionScore(sat: HealthMetrics['satisfaction']): number {
    let score = (sat.user_score / 10) * 100

    // Complaint penalty
    if (sat.complaint_count > 10) score -= 30
    else if (sat.complaint_count > 5) score -= 15

    // Trend adjustment
    score += sat.satisfaction_trend * 10

    // NPS adjustment
    if (sat.nps_score < -50) score -= 20
    else if (sat.nps_score > 50) score += 10

    return Math.max(0, Math.min(100, score))
  }
}

class PredictiveHealthAnalyzer {
  constructor(private supabase: any) {}

  async analyzePredictiveHealth(deploymentId: string, metrics: HealthMetrics): Promise<PredictionResult> {
    // Get historical data for ML analysis
    const { data: historicalData } = await this.supabase
      .from('deployments_health')
      .select('*')
      .eq('deployment_id', deploymentId)
      .order('timestamp', { ascending: false })
      .limit(100)

    const trends = this.analyzeTrends(historicalData || [])
    const anomalies = this.detectAnomalies(metrics, historicalData || [])
    
    const riskLevel = this.calculateRiskLevel(metrics, trends, anomalies)
    const predictions = this.generatePredictions(metrics, trends, anomalies)

    return {
      risk_level: riskLevel,
      predicted_issues: predictions.issues,
      confidence_score: predictions.confidence,
      time_to_issue_hours: predictions.timeToIssue,
      recommendations: this.generateRecommendations(riskLevel, predictions.issues)
    }
  }

  private analyzeTrends(historicalData: any[]): any {
    if (historicalData.length < 5) return { stable: true }

    const recentScores = historicalData.slice(0, 10).map(d => d.health_score)
    const olderScores = historicalData.slice(10, 20).map(d => d.health_score)

    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length

    return {
      stable: Math.abs(recentAvg - olderAvg) < 5,
      declining: recentAvg < olderAvg - 5,
      improving: recentAvg > olderAvg + 5,
      volatility: this.calculateVolatility(recentScores)
    }
  }

  private detectAnomalies(current: HealthMetrics, historical: any[]): string[] {
    const anomalies: string[] = []

    if (historical.length < 5) return anomalies

    const avgResponseTime = historical.reduce((sum, h) => sum + (h.avg_response_time || 0), 0) / historical.length
    if (current.performance.avg_response_time > avgResponseTime * 2) {
      anomalies.push('response_time_spike')
    }

    const avgErrorRate = historical.reduce((sum, h) => sum + (h.error_rate || 0), 0) / historical.length
    if (current.performance.error_rate > avgErrorRate * 3) {
      anomalies.push('error_rate_spike')
    }

    const avgUptime = historical.reduce((sum, h) => sum + (h.uptime_percent || 100), 0) / historical.length
    if (current.availability.uptime_percent < avgUptime - 5) {
      anomalies.push('availability_drop')
    }

    return anomalies
  }

  private calculateRiskLevel(metrics: HealthMetrics, trends: any, anomalies: string[]): PredictionResult['risk_level'] {
    let riskScore = 0

    // Performance risks
    if (metrics.performance.avg_response_time > 2000) riskScore += 2
    if (metrics.performance.error_rate > 5) riskScore += 3
    if (metrics.performance.cpu_usage > 80) riskScore += 1

    // Availability risks
    if (metrics.availability.uptime_percent < 99) riskScore += 2
    if (metrics.availability.incident_count > 3) riskScore += 1

    // Satisfaction risks
    if (metrics.satisfaction.user_score < 7) riskScore += 1
    if (metrics.satisfaction.satisfaction_trend < -0.5) riskScore += 2

    // Trend risks
    if (trends.declining) riskScore += 2
    if (trends.volatility > 10) riskScore += 1

    // Anomaly risks
    riskScore += anomalies.length

    if (riskScore >= 8) return 'critical'
    if (riskScore >= 5) return 'high'
    if (riskScore >= 3) return 'medium'
    return 'low'
  }

  private generatePredictions(metrics: HealthMetrics, trends: any, anomalies: string[]): {
    issues: string[]
    confidence: number
    timeToIssue: number | null
  } {
    const issues: string[] = []
    let confidence = 0.5
    let timeToIssue: number | null = null

    if (metrics.performance.error_rate > 2 && trends.declining) {
      issues.push('service_degradation')
      confidence += 0.3
      timeToIssue = 4
    }

    if (metrics.performance.cpu_usage > 75 && trends.volatility > 5) {
      issues.push('resource_exhaustion')
      confidence += 0.2
      timeToIssue = timeToIssue ? Math.min(timeToIssue, 2) : 2
    }

    if (metrics.availability.uptime_percent < 99.5 && anomalies.includes('availability_drop')) {
      issues.push('potential_outage')
      confidence += 0.4
      timeToIssue = timeToIssue ? Math.min(timeToIssue, 1) : 1
    }

    if (metrics.satisfaction.satisfaction_trend < -0.3) {
      issues.push('user_experience_decline')
      confidence += 0.1
    }

    return {
      issues,
      confidence: Math.min(1, confidence),
      timeToIssue
    }
  }

  private generateRecommendations(riskLevel: string, issues: string[]): string[] {
    const recommendations: string[] = []

    if (issues.includes('service_degradation')) {
      recommendations.push('Review error logs and implement circuit breakers')
      recommendations.push('Scale horizontally to distribute load')
    }

    if (issues.includes('resource_exhaustion')) {
      recommendations.push('Increase resource allocation')
      recommendations.push('Optimize application performance')
    }

    if (issues.includes('potential_outage')) {
      recommendations.push('Activate incident response plan')
      recommendations.push('Prepare rollback procedures')
    }

    if (issues.includes('user_experience_decline')) {
      recommendations.push('Investigate user journey bottlenecks')
      recommendations.push('Conduct user satisfaction survey')
    }

    if (riskLevel === 'critical') {
      recommendations.unshift('URGENT: Consider immediate rollback or hotfix')
    }

    return recommendations
  }

  private calculateVolatility(scores: number[]): number {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
    return Math.sqrt(variance)
  }
}

class AlertManager {
  constructor(private supabase: any) {}

  async processAlerts(deploymentId: string, healthScore: number, prediction: PredictionResult): Promise<void> {
    const alerts = []

    if (prediction.risk_level === 'critical') {
      alerts.push({
        level: 'critical',
        message: `Critical health risk detected for deployment ${deploymentId}`,
        predicted_issues: prediction.predicted_issues,
        time_to_issue: prediction.time_to_issue_hours
      })
    } else if (prediction.risk_level === 'high' && healthScore < 70) {
      alerts.push({
        level: 'high',
        message: `High health risk with low score (${healthScore.toFixed(1)}) for deployment ${deploymentId}`,
        predicted_issues: prediction.predicted_issues,
        time_to_issue: prediction.time_to_issue_hours
      })
    }

    if (alerts.length > 0) {
      await this.supabase.from('health_alerts').insert(
        alerts.map(alert => ({
          deployment_id: deploymentId,
          ...alert,
          timestamp: new Date().toISOString()
        }))
      )
    }
  }
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Retrieve current health status with predictions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawParams = Object.fromEntries(searchParams)
    
    const { deployment_id, check_type, duration_hours } = healthCheckSchema.parse(rawParams)

    const collector = new HealthMetricsCollector(supabase)
    const calculator = new HealthScoreCalculator()
    const analyzer = new PredictiveHealthAnalyzer(supabase)

    const metrics: HealthMetrics = {
      performance: await collector.collectPerformanceMetrics(deployment_id, duration_hours),
      availability: await collector.collectAvailabilityMetrics(deployment_id, duration_hours),
      satisfaction: await collector.collectSatisfactionMetrics(deployment_id, duration_hours)
    }

    const healthScore = calculator.calculateCompositeScore(metrics)
    const prediction = await analyzer.analyzePredictiveHealth(deployment_id, metrics)

    // Store health assessment
    await supabase.from('deployments_health').insert({
      deployment_id,
      health_score: healthScore,
      metrics,
      prediction_data: prediction,
      timestamp: new Date().toISOString()
    })

    const alertManager = new AlertManager(supabase)
    await alertManager.processAlerts(deployment_id, healthScore, prediction)

    return NextResponse.json({
      success: true,
      data: {
        deployment_id,
        health_score: healthScore,
        status: healthScore >= 90 ? 'excellent' : healthScore >= 75 ? 'good' : healthScore >= 60 ? 'fair' : 'poor',
        metrics,
        prediction,
        assessed_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Health assessment error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Health assessment failed' },
      { status: 500 }
    )
  }
}

// POST: Trigger manual health check
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deployment_id, priority, notify } = triggerCheckSchema.parse(body)

    // Queue health check job
    await supabase.from('health_check_queue').insert({
      deployment_id,
      priority,
      notify,
      status: 'queued',
      created_at: new Date().toISOString()
    })

    // Trigger immediate check for high/critical priority
    if (priority === 'high' || priority === 'critical') {
      const collector = new HealthMetricsCollector(supabase)
      const calculator = new HealthScoreCalculator()
      const analyzer = new PredictiveHealthAnalyzer(supabase)

      const metrics: HealthMetrics = {
        performance: await collector.collectPerformanceMetrics(deployment_id, 1),
        availability: await collector.collectAvailabilityMetrics(deployment_id, 1),
        satisfaction: await collector.collectSatisfactionMetrics(deployment_id, 1)
      }

      const healthScore = calculator.calculateCompositeScore(metrics)
      const prediction = await analyzer.analyzePredictiveHealth(deployment_id, metrics)

      await supabase.from('deployments_health').insert({
        deployment_id,
        health_score: healthScore,
        metrics,
        prediction_data: prediction,
        check_type: 'manual',
        priority,
        timestamp: new Date().toISOString()
      })

      if (notify) {
        const alertManager = new AlertManager(supabase)
        await alertManager.processAlerts(deployment_id, healthScore, prediction)
      }

      return NextResponse.json({
        success: true,
        data: {
          check_id: deployment_id,
          immediate_result: {
            health_score: healthScore,
            prediction,
            status: 'completed'
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        check_id: deployment_id,
        status: 'queued',
        priority,
        estimated_completion: new Date(Date.now() + (priority === 'medium' ? 5 : 15) * 60000)
      }
    })

  } catch (error) {
    console.error('Manual health check error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Health check trigger failed' },
      { status: 500 }
    )
  }
}

// PUT: Update health thresholds
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { deployment_id, thresholds } = updateThresholdsSchema.parse(body)

    await supabase.from('deployment_health_thresholds').upsert({
      deployment_id,
      ...thresholds,
      updated_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      data: {
        deployment_id,
        thresholds,
        updated_at: new Date().toISOString()