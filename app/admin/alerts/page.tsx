/**
 * CR AudioViz AI - Javari Alerts Dashboard
 * =========================================
 * 
 * Real-time proactive alerts from Javari monitoring
 * 
 * @version 1.0.0
 * @date January 1, 2026
 */

'use client'

import { useState, useEffect } from 'react'
import { 
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  CheckCircle,
  RefreshCw,
  Check,
  Clock,
  Filter
} from 'lucide-react'

interface Alert {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  source?: string
  data?: any
  acknowledged: boolean
  acknowledged_by?: string
  acknowledged_at?: string
  created_at: string
}

export default function AlertsDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('unread')
  const [stats, setStats] = useState({ total: 0, unacknowledged: 0, critical: 0 })
  
  const loadAlerts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === 'unread') params.set('acknowledged', 'false')
      if (filter === 'critical') params.set('severity', 'critical')
      
      const response = await fetch(`/api/javari/alerts?${params}`)
      const data = await response.json()
      setAlerts(data.alerts || [])
      setStats(data.stats || { total: 0, unacknowledged: 0, critical: 0 })
    } catch (error) {
      console.error('Error loading alerts:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [filter])
  
  const handleAcknowledge = async (id: string) => {
    await fetch('/api/javari/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge', data: { id } })
    })
    loadAlerts()
  }
  
  const handleAcknowledgeAll = async () => {
    await fetch('/api/javari/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge_all' })
    })
    loadAlerts()
  }
  
  const handleRunChecks = async () => {
    setIsLoading(true)
    await fetch('/api/javari/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run_checks' })
    })
    loadAlerts()
  }
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />
      case 'error': return <AlertCircle className="w-5 h-5 text-orange-500" />
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      default: return <Info className="w-5 h-5 text-blue-500" />
    }
  }
  
  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 border-red-500/30'
      case 'error': return 'bg-orange-500/10 border-orange-500/30'
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30'
      default: return 'bg-blue-500/10 border-blue-500/30'
    }
  }
  
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center relative">
              <Bell className="w-6 h-6" />
              {stats.unacknowledged > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-xs flex items-center justify-center">
                  {stats.unacknowledged}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">Proactive Alerts</h1>
              <p className="text-gray-400">Javari is watching your business</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunChecks}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Run Checks
            </button>
            {stats.unacknowledged > 0 && (
              <button
                onClick={handleAcknowledgeAll}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
              >
                <Check className="w-4 h-4" />
                Acknowledge All
              </button>
            )}
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-sm">Total Alerts</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-gray-900 border border-yellow-500/30 rounded-xl p-4">
            <p className="text-gray-500 text-sm">Unread</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.unacknowledged}</p>
          </div>
          <div className="bg-gray-900 border border-red-500/30 rounded-xl p-4">
            <p className="text-gray-500 text-sm">Critical</p>
            <p className="text-2xl font-bold text-red-400">{stats.critical}</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['unread', 'all', 'critical'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg capitalize transition ${
                filter === f 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        
        {/* Alerts List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
              Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No alerts to show</p>
              <p className="text-sm mt-2">Everything is running smoothly! 🎉</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id}
                className={`p-4 rounded-xl border ${getSeverityBg(alert.severity)} ${
                  alert.acknowledged ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{alert.title}</h3>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(alert.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-400 mt-1">{alert.message}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="px-2 py-1 bg-gray-800 rounded capitalize">{alert.alert_type.replace(/_/g, ' ')}</span>
                        {alert.source && <span>from {alert.source}</span>}
                      </div>
                      {!alert.acknowledged && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded transition flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Acknowledge
                        </button>
                      )}
                      {alert.acknowledged && (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Acknowledged
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Legend */}
        <div className="mt-8 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
          <h3 className="font-semibold mb-3">Alert Severity Levels</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span>Info - Good news</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span>Warning - Attention needed</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span>Error - Action required</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span>Critical - Urgent</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
