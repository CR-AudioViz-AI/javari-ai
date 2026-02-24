/**
 * CR AudioViz AI - Javari Scheduler Dashboard
 * ==========================================
 * 
 * Manage scheduled commands - daily reports, health checks, etc.
 * 
 * @version 1.0.0
 * @date January 1, 2026
 */

'use client'

import { useState, useEffect } from 'react'
import { 
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  Settings,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface Schedule {
  id: string
  name: string
  command: string
  schedule: string
  schedule_description: string
  enabled: boolean
  last_run?: string
  next_run?: string
  created_at: string
}

interface Preset {
  name: string
  command: string
  schedule: string
  description: string
}

export default function SchedulerDashboard() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    command: '',
    schedule: '0 8 * * *'
  })
  
  const loadSchedules = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/javari/scheduler')
      const data = await response.json()
      setSchedules(data.schedules || [])
      setPresets(data.presets || [])
    } catch (error) {
      console.error('Error loading schedules:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => {
    loadSchedules()
  }, [])
  
  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch('/api/javari/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', data: { id, enabled } })
    })
    loadSchedules()
  }
  
  const handleRunNow = async (id: string) => {
    await fetch('/api/javari/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run_now', data: { id } })
    })
    loadSchedules()
  }
  
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule?')) return
    await fetch('/api/javari/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', data: { id } })
    })
    loadSchedules()
  }
  
  const handleAddPreset = async (name: string) => {
    await fetch('/api/javari/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_preset', data: { name, createdBy: 'admin' } })
    })
    loadSchedules()
  }
  
  const handleCreateSchedule = async () => {
    await fetch('/api/javari/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'create', 
        data: {
          ...newSchedule,
          enabled: true,
          createdBy: 'admin'
        }
      })
    })
    setShowAddModal(false)
    setNewSchedule({ name: '', command: '', schedule: '0 8 * * *' })
    loadSchedules()
  }
  
  const enabledCount = schedules.filter(s => s.enabled).length
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Scheduled Commands</h1>
              <p className="text-gray-400">Automate recurring Javari tasks</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
              {enabledCount} Active
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Add Schedule
            </button>
            <button
              onClick={loadSchedules}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Quick Add Presets */}
        <div className="mb-8 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Quick Add Presets
          </h3>
          <div className="grid md:grid-cols-3 gap-3">
            {presets.map((preset, i) => (
              <button
                key={i}
                onClick={() => handleAddPreset(preset.name)}
                className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition"
              >
                <p className="font-medium text-sm">{preset.name}</p>
                <p className="text-xs text-gray-500 mt-1">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>
        
        {/* Schedule List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
              Loading schedules...
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No schedules configured</p>
              <p className="text-sm mt-2">Add a preset or create a custom schedule</p>
            </div>
          ) : (
            schedules.map((schedule) => (
              <div 
                key={schedule.id}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
              >
                <div 
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-800/50 transition"
                  onClick={() => setExpandedId(expandedId === schedule.id ? null : schedule.id)}
                >
                  {/* Enable Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggle(schedule.id, !schedule.enabled)
                    }}
                    className={`w-10 h-6 rounded-full transition relative ${
                      schedule.enabled ? 'bg-green-600' : 'bg-gray-700'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${
                      schedule.enabled ? 'left-5' : 'left-1'
                    }`} />
                  </button>
                  
                  {/* Info */}
                  <div className="flex-1">
                    <p className="font-medium">{schedule.name}</p>
                    <p className="text-sm text-gray-500">{schedule.schedule_description || schedule.schedule}</p>
                  </div>
                  
                  {/* Next Run */}
                  {schedule.next_run && (
                    <div className="text-right text-sm">
                      <p className="text-gray-500">Next run</p>
                      <p className="text-purple-400">{new Date(schedule.next_run).toLocaleString()}</p>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRunNow(schedule.id)
                      }}
                      className="p-2 hover:bg-gray-700 rounded-lg transition"
                      title="Run Now"
                    >
                      <Play className="w-4 h-4 text-green-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(schedule.id)
                      }}
                      className="p-2 hover:bg-gray-700 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                  
                  {expandedId === schedule.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                
                {/* Expanded Details */}
                {expandedId === schedule.id && (
                  <div className="border-t border-gray-800 p-4 bg-gray-800/30">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">Command</p>
                        <p className="bg-gray-900 p-2 rounded">{schedule.command}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Cron Expression</p>
                        <p className="bg-gray-900 p-2 rounded font-mono">{schedule.schedule}</p>
                      </div>
                      {schedule.last_run && (
                        <div>
                          <p className="text-gray-500 mb-1">Last Run</p>
                          <p>{new Date(schedule.last_run).toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-500 mb-1">Created</p>
                        <p>{new Date(schedule.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Add Schedule</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={newSchedule.name}
                    onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                    placeholder="Daily Revenue Report"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Command</label>
                  <input
                    type="text"
                    value={newSchedule.command}
                    onChange={(e) => setNewSchedule({ ...newSchedule, command: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                    placeholder="Run a revenue report"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Schedule (Cron)</label>
                  <select
                    value={newSchedule.schedule}
                    onChange={(e) => setNewSchedule({ ...newSchedule, schedule: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                  >
                    <option value="0 8 * * *">Daily at 8 AM</option>
                    <option value="0 9 * * 1">Weekly (Monday 9 AM)</option>
                    <option value="0 * * * *">Every Hour</option>
                    <option value="*/15 * * * *">Every 15 Minutes</option>
                    <option value="0 0 1 * *">Monthly (1st at midnight)</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSchedule}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Cron Help */}
        <div className="mt-8 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
          <h3 className="font-semibold mb-3">Cron Expression Reference</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="font-mono">
              <p className="text-gray-500 mb-2">Format: minute hour day month weekday</p>
              <p><code className="bg-gray-800 px-2 py-1 rounded">0 8 * * *</code> = Daily 8 AM</p>
              <p><code className="bg-gray-800 px-2 py-1 rounded">0 9 * * 1</code> = Monday 9 AM</p>
            </div>
            <div className="font-mono">
              <p><code className="bg-gray-800 px-2 py-1 rounded">0 * * * *</code> = Every hour</p>
              <p><code className="bg-gray-800 px-2 py-1 rounded">*/15 * * * *</code> = Every 15 min</p>
              <p><code className="bg-gray-800 px-2 py-1 rounded">0 0 1 * *</code> = Monthly</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
