```tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Users, Target, Brain, Shield, Activity, ArrowRight, RefreshCw } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface ExecutiveMetric {
  id: string
  name: string
  value: number
  previousValue: number
  unit: string
  category: 'financial' | 'operational' | 'strategic' | 'risk'
  trend: 'up' | 'down' | 'stable'
  confidence: number
  timestamp: string
}

interface RiskAssessment {
  id: string
  category: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  score: number
  impact: number
  probability: number
  description: string
  mitigation: string
  owner: string
  dueDate: string
}

interface PredictiveInsight {
  id: string
  metric: string
  prediction: number
  confidence: number
  timeframe: string
  factors: string[]
  scenario: 'optimistic' | 'realistic' | 'pessimistic'
}

interface StrategicRecommendation {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  impact: number
  effort: number
  roi: number
  category: string
  aiGenerated: boolean
  timestamp: string
}

interface KPIDataPoint {
  date: string
  revenue: number
  profit: number
  customers: number
  satisfaction: number
  efficiency: number
}

interface BusinessAlert {
  id: string
  type: 'opportunity' | 'risk' | 'anomaly' | 'milestone'
  severity: 'info' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  actionRequired: boolean
}

interface ExecutiveDecisionSupportDashboardProps {
  timeframe?: '1M' | '3M' | '6M' | '1Y'
  refreshInterval?: number
  enableRealtime?: boolean
  customFilters?: Record<string, any>
  onMetricClick?: (metric: ExecutiveMetric) => void
  onRecommendationAction?: (recommendation: StrategicRecommendation) => void
  className?: string
}

const ExecutiveDecisionSupportDashboard: React.FC<ExecutiveDecisionSupportDashboardProps> = ({
  timeframe = '3M',
  refreshInterval = 30000,
  enableRealtime = true,
  customFilters = {},
  onMetricClick,
  onRecommendationAction,
  className = ''
}) => {
  const [executiveMetrics, setExecutiveMetrics] = useState<ExecutiveMetric[]>([])
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([])
  const [predictiveInsights, setPredictiveInsights] = useState<PredictiveInsight[]>([])
  const [recommendations, setRecommendations] = useState<StrategicRecommendation[]>([])
  const [kpiData, setKpiData] = useState<KPIDataPoint[]>([])
  const [alerts, setAlerts] = useState<BusinessAlert[]>([])
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Mock data generation functions
  const generateMockExecutiveMetrics = (): ExecutiveMetric[] => [
    {
      id: '1',
      name: 'Total Revenue',
      value: 45600000,
      previousValue: 43200000,
      unit: 'USD',
      category: 'financial',
      trend: 'up',
      confidence: 0.92,
      timestamp: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Profit Margin',
      value: 23.5,
      previousValue: 21.8,
      unit: '%',
      category: 'financial',
      trend: 'up',
      confidence: 0.88,
      timestamp: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Active Customers',
      value: 125000,
      previousValue: 118000,
      unit: 'count',
      category: 'operational',
      trend: 'up',
      confidence: 0.95,
      timestamp: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Market Share',
      value: 18.7,
      previousValue: 19.2,
      unit: '%',
      category: 'strategic',
      trend: 'down',
      confidence: 0.85,
      timestamp: new Date().toISOString()
    }
  ]

  const generateMockRiskAssessments = (): RiskAssessment[] => [
    {
      id: '1',
      category: 'Cybersecurity',
      riskLevel: 'high',
      score: 75,
      impact: 8,
      probability: 6,
      description: 'Potential data breach vulnerability in customer portal',
      mitigation: 'Implement advanced threat detection and user authentication',
      owner: 'CISO',
      dueDate: '2024-02-15'
    },
    {
      id: '2',
      category: 'Market Competition',
      riskLevel: 'medium',
      score: 60,
      impact: 7,
      probability: 5,
      description: 'New competitor entering primary market segment',
      mitigation: 'Accelerate product innovation and customer retention programs',
      owner: 'CMO',
      dueDate: '2024-03-01'
    },
    {
      id: '3',
      category: 'Supply Chain',
      riskLevel: 'medium',
      score: 55,
      impact: 6,
      probability: 4,
      description: 'Potential supplier disruption in key component',
      mitigation: 'Diversify supplier base and increase inventory buffer',
      owner: 'COO',
      dueDate: '2024-02-28'
    }
  ]

  const generateMockPredictiveInsights = (): PredictiveInsight[] => [
    {
      id: '1',
      metric: 'Revenue Growth',
      prediction: 15.2,
      confidence: 0.87,
      timeframe: 'Next Quarter',
      factors: ['Market expansion', 'New product launch', 'Seasonal trends'],
      scenario: 'realistic'
    },
    {
      id: '2',
      metric: 'Customer Churn',
      prediction: 8.3,
      confidence: 0.91,
      timeframe: 'Next Month',
      factors: ['Service quality', 'Competitor pricing', 'Product satisfaction'],
      scenario: 'pessimistic'
    }
  ]

  const generateMockRecommendations = (): StrategicRecommendation[] => [
    {
      id: '1',
      title: 'Accelerate Digital Transformation',
      description: 'Invest in cloud infrastructure and automation to improve operational efficiency by 25%',
      priority: 'high',
      impact: 9,
      effort: 7,
      roi: 185,
      category: 'Technology',
      aiGenerated: true,
      timestamp: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Expand Into Asian Markets',
      description: 'Strategic market entry into Southeast Asia could increase revenue by 20-30%',
      priority: 'medium',
      impact: 8,
      effort: 8,
      roi: 145,
      category: 'Growth',
      aiGenerated: true,
      timestamp: new Date().toISOString()
    }
  ]

  const generateMockKPIData = (): KPIDataPoint[] => {
    const data: KPIDataPoint[] = []
    const baseDate = new Date()
    baseDate.setMonth(baseDate.getMonth() - 6)

    for (let i = 0; i < 24; i++) {
      const date = new Date(baseDate)
      date.setWeek(date.getWeek() + i)
      
      data.push({
        date: date.toISOString().split('T')[0],
        revenue: 1800000 + Math.random() * 400000,
        profit: 300000 + Math.random() * 100000,
        customers: 120000 + Math.random() * 10000,
        satisfaction: 7.5 + Math.random() * 1.5,
        efficiency: 75 + Math.random() * 20
      })
    }
    return data
  }

  const generateMockAlerts = (): BusinessAlert[] => [
    {
      id: '1',
      type: 'opportunity',
      severity: 'info',
      title: 'New Market Opportunity Detected',
      message: 'AI analysis suggests potential for expansion in renewable energy sector',
      timestamp: new Date().toISOString(),
      actionRequired: true
    },
    {
      id: '2',
      type: 'risk',
      severity: 'warning',
      title: 'Customer Satisfaction Declining',
      message: 'NPS scores have dropped 5 points in the last month',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      actionRequired: true
    }
  ]

  // Data loading and real-time updates
  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true)
      try {
        // In a real implementation, these would be API calls to Supabase
        setExecutiveMetrics(generateMockExecutiveMetrics())
        setRiskAssessments(generateMockRiskAssessments())
        setPredictiveInsights(generateMockPredictiveInsights())
        setRecommendations(generateMockRecommendations())
        setKpiData(generateMockKPIData())
        setAlerts(generateMockAlerts())
        setLastUpdated(new Date())
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()

    // Set up refresh interval
    if (enableRealtime && refreshInterval > 0) {
      const interval = setInterval(loadDashboardData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [selectedTimeframe, enableRealtime, refreshInterval])

  // Computed values
  const overallRiskScore = useMemo(() => {
    if (riskAssessments.length === 0) return 0
    return Math.round(riskAssessments.reduce((sum, risk) => sum + risk.score, 0) / riskAssessments.length)
  }, [riskAssessments])

  const highPriorityRecommendations = useMemo(() => {
    return recommendations.filter(rec => rec.priority === 'high').length
  }, [recommendations])

  const criticalAlerts = useMemo(() => {
    return alerts.filter(alert => alert.severity === 'error' && alert.actionRequired).length
  }, [alerts])

  // Helper functions
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }

  const getRiskColor = (level: string): string => {
    switch (level) {
      case 'low': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'high': return 'text-orange-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Component renders
  const MetricsOverviewPanel: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {executiveMetrics.map((metric) => (
        <Card 
          key={metric.id} 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onMetricClick?.(metric)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
            {metric.trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : metric.trend === 'down' ? (
              <TrendingDown className="h-4 w-4 text-red-600" />
            ) : (
              <Activity className="h-4 w-4 text-gray-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metric.unit === 'USD' ? formatCurrency(metric.value) : 
               metric.unit === '%' ? `${metric.value}%` : 
               formatNumber(metric.value)}
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
              <span>
                {metric.trend === 'up' ? '+' : metric.trend === 'down' ? '-' : ''}
                {Math.abs(((metric.value - metric.previousValue) / metric.previousValue * 100)).toFixed(1)}%
              </span>
              <Badge variant="outline" className="text-xs">
                {Math.round(metric.confidence * 100)}% confidence
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const PredictiveAnalyticsWidget: React.FC = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Predictive Analytics
        </CardTitle>
        <CardDescription>AI-powered forecasts and trend predictions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {predictiveInsights.map((insight) => (
            <div key={insight.id} className="space-y-3">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold">{insight.metric}</h4>
                <Badge variant={insight.scenario === 'optimistic' ? 'default' : 
                                insight.scenario === 'realistic' ? 'secondary' : 'destructive'}>
                  {insight.scenario}
                </Badge>
              </div>
              <div className="text-2xl font-bold">
                {insight.prediction}%
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Confidence</span>
                  <span>{Math.round(insight.confidence * 100)}%</span>
                </div>
                <Progress value={insight.confidence * 100} className="h-2" />
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Key factors:</strong> {insight.factors.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const RiskAssessmentMatrix: React.FC = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Risk Assessment Matrix
        </CardTitle>
        <CardDescription>Current risk landscape and mitigation status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-bold">
            Overall Risk Score: <span className={getRiskColor(overallRiskScore > 70 ? 'high' : overallRiskScore > 40 ? 'medium' : 'low')}>
              {overallRiskScore}
            </span>
          </div>
          <Progress value={overallRiskScore} className="w-32" />
        </div>
        <div className="space-y-4">
          {riskAssessments.map((risk) => (
            <div key={risk.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold">{risk.category}</h4>
                <Badge className={getRiskColor(risk.riskLevel)}>
                  {risk.riskLevel.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{risk.description}</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Impact:</span> {risk.impact}/10
                </div>
                <div>
                  <span className="font-medium">Probability:</span> {risk.probability}/10
                </div>
                <div>
                  <span className="font-medium">Owner:</span> {risk.owner}
                </div>
              </div>
              <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                <strong>Mitigation:</strong> {risk.mitigation}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const StrategicRecommendationsCard: React.FC = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Strategic Recommendations
        </CardTitle>
        <CardDescription>AI-generated strategic insights and action items</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div key={rec.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold">{rec.title}</h4>
                  {rec.aiGenerated && (
                    <Badge variant="outline" className="mt-1">
                      <Brain className="h-3 w-3 mr-1" />
                      AI Generated
                    </Badge>
                  )}
                </div>
                <Badge className={getPriorityColor(rec.priority)}>
                  {rec.priority.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                  <span className="font-medium">Impact:</span> {rec.impact}/10
                </div>
                <div>
                  <span className="font-medium">Effort:</span> {rec.effort}/10
                </div>
                <div>
                  <span className="font-medium">ROI:</span> {rec.roi}%
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={() => onRecommendationAction?.(rec)}
                className="w-full"
              >
                Take Action <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const KPITrendChart: React.FC = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>KPI Trends</CardTitle>
        <CardDescription>Key performance indicators over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kpiData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
              <Line yAxisId="left" type="monotone" dataKey="profit" stroke="#82ca9d" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="customers" stroke="#ffc658" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )

  const AlertsNotificationCenter: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Business Alerts ({criticalAlerts} Critical)
        </CardTitle>
        <CardDescription>Real-time notifications and action items</CardDescription>
      </CardHeader>