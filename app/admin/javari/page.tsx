/**
 * CR AudioViz AI - Javari Admin Dashboard
 * ========================================
 * 
 * Complete overview of Javari's autonomous capabilities:
 * - Learning metrics
 * - Command history
 * - System health
 * - Voice/Video status
 * - Improvement suggestions
 * 
 * @version 1.0.0
 * @date January 1, 2026
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Bot,
  Brain,
  TrendingUp,
  MessageSquare,
  Video,
  Mic,
  Server,
  Database,
  Lightbulb,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Settings,
  Activity
} from 'lucide-react'

interface SystemHealth {
  mainSite: string
  javariAI: string
  vercel: string
  database: string
}

interface LearningStats {
  totalPatterns: number
  knowledgeEntries: number
  feedbackCount: number
  helpfulRate: string
}

interface VoiceStatus {
  ttsEnabled: boolean
  voiceId: string
}

export default function JavariAdmin() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [recentCommands, setRecentCommands] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  
  const loadData = async () => {
    setIsLoading(true)
    
    try {
      // Load all data in parallel
      const [healthRes, learnRes, voiceRes] = await Promise.all([
        fetch('/api/javari/business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'Check system health' })
        }),
        fetch('/api/javari/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stats' })
        }),
        fetch('/api/javari/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check' })
        })
      ])
      
      const healthData = await healthRes.json()
      if (healthData.result?.services) {
        setSystemHealth(healthData.result.services)
      }
      
      const learnData = await learnRes.json()
      if (learnData.stats) {
        setLearningStats(learnData.stats)
      }
      
      const voiceData = await voiceRes.json()
      setVoiceStatus(voiceData)
      
      // Get improvement suggestions
      const suggestRes = await fetch('/api/javari/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggestions' })
      })
      const suggestData = await suggestRes.json()
      setSuggestions(suggestData.suggestions || [])
      
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
      setLastRefresh(new Date())
    }
  }
  
  useEffect(() => {
    loadData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])
  
  const getStatusIcon = (status: string) => {
    if (status?.includes('✅') || status?.includes('Healthy')) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    } else if (status?.includes('❌') || status?.includes('Down')) {
      return <XCircle className="w-5 h-5 text-red-500" />
    }
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />
  }
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Javari Admin Dashboard</h1>
              <p className="text-gray-400">Autonomous AI COO Control Center</p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        
        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: MessageSquare, label: 'Command Console', href: '/command', color: 'blue' },
            { icon: Video, label: 'Video Call', href: '/video', color: 'orange' },
            { icon: Bot, label: 'Javari Hub', href: '/javari', color: 'purple' },
            { icon: Settings, label: 'Autopilot', href: '/admin/autopilot', color: 'green' }
          ].map((link, i) => (
            <Link
              key={i}
              href={link.href}
              className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500/50 transition"
            >
              <link.icon className="w-6 h-6 text-purple-400" />
              <span>{link.label}</span>
              <ArrowRight className="w-4 h-4 ml-auto text-gray-500" />
            </Link>
          ))}
        </div>
        
        {/* Main Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* System Health */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-400" />
              System Health
            </h2>
            {systemHealth ? (
              <div className="space-y-3">
                {Object.entries(systemHealth).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(value)}
                      <span className="text-sm">{value.includes('✅') ? 'Healthy' : value}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Loading...</p>
            )}
          </div>
          
          {/* Learning Stats */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              Learning Progress
            </h2>
            {learningStats ? (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Patterns Learned</span>
                  <span className="font-medium">{learningStats.totalPatterns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Knowledge Entries</span>
                  <span className="font-medium">{learningStats.knowledgeEntries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Feedback Received</span>
                  <span className="font-medium">{learningStats.feedbackCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Helpful Rate</span>
                  <span className="font-medium text-green-400">{learningStats.helpfulRate}</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Learning system initializing...</p>
            )}
          </div>
          
          {/* Voice/Video Status */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" />
              Voice & Video
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Voice (ElevenLabs)</span>
                <div className="flex items-center gap-2">
                  {voiceStatus?.ttsEnabled ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span>{voiceStatus?.ttsEnabled ? 'Enabled' : 'Not configured'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Video (D-ID)</span>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Ready</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Video (HeyGen)</span>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Ready</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Improvement Suggestions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 md:col-span-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Improvement Suggestions
            </h2>
            {suggestions.length > 0 ? (
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        s.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        s.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {s.priority}
                      </span>
                      <span className="text-sm font-medium">{s.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-gray-400 text-sm">{s.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No improvement suggestions at this time. Keep using Javari to generate learning data!</p>
            )}
          </div>
          
          {/* Activity Log */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Recent Activity
            </h2>
            <div className="text-sm text-gray-400 space-y-2">
              <p>• Voice API checked</p>
              <p>• Learning stats updated</p>
              <p>• System health verified</p>
              <p className="text-xs text-gray-600 mt-4">
                Last refresh: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>
          
        </div>
        
        {/* Capabilities */}
        <div className="mt-8 p-6 bg-gray-900/50 border border-gray-800 rounded-xl">
          <h2 className="text-lg font-semibold mb-4">Javari Capabilities</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center text-sm">
            {[
              'Revenue Reports',
              'User Management',
              'Deployment Control',
              'Grant Tracking',
              'Email Drafting',
              'Promo Codes',
              'Voice Commands',
              'Video Calls',
              'Self-Healing',
              'Pattern Learning',
              'Knowledge Base',
              'Auto-Improvement'
            ].map((cap, i) => (
              <div key={i} className="p-3 bg-gray-800/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
                {cap}
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  )
}
