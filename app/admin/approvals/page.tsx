/**
 * CR AudioViz AI - Javari Approval Queue
 * ======================================
 * 
 * Admin dashboard for approving/rejecting dangerous operations
 * that Javari flagged for human review.
 * 
 * @version 1.0.0
 * @date January 1, 2026
 */

'use client'

import { useState, useEffect } from 'react'
import { 
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  DollarSign,
  Database,
  Mail,
  RefreshCw,
  Eye,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface PendingApproval {
  id: string
  command_text: string
  category: string
  parameters: any
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'approved' | 'rejected'
  requested_by: string
  requested_at: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
}

export default function ApprovalQueue() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const loadApprovals = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/javari/approvals')
      const data = await response.json()
      setApprovals(data.approvals || [])
    } catch (error) {
      console.error('Error loading approvals:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => {
    loadApprovals()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadApprovals, 30000)
    return () => clearInterval(interval)
  }, [])
  
  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      await fetch('/api/javari/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'approve', 
          id,
          approvedBy: 'Roy Henderson'
        })
      })
      await loadApprovals()
    } catch (error) {
      console.error('Error approving:', error)
    } finally {
      setActionLoading(null)
    }
  }
  
  const handleReject = async (id: string, reason: string) => {
    setActionLoading(id)
    try {
      await fetch('/api/javari/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reject', 
          id,
          rejectedBy: 'Roy Henderson',
          reason
        })
      })
      await loadApprovals()
    } catch (error) {
      console.error('Error rejecting:', error)
    } finally {
      setActionLoading(null)
    }
  }
  
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
    }
  }
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'users': return <User className="w-5 h-5" />
      case 'pricing': return <DollarSign className="w-5 h-5" />
      case 'database': return <Database className="w-5 h-5" />
      case 'marketing': return <Mail className="w-5 h-5" />
      default: return <Shield className="w-5 h-5" />
    }
  }
  
  const filteredApprovals = approvals.filter(a => 
    filter === 'all' || a.status === filter
  )
  
  const pendingCount = approvals.filter(a => a.status === 'pending').length
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Approval Queue</h1>
              <p className="text-gray-400">Review and approve dangerous operations</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {pendingCount > 0 && (
              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                {pendingCount} Pending
              </span>
            )}
            <button
              onClick={loadApprovals}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
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
        
        {/* Approval List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
              Loading approvals...
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No {filter === 'all' ? '' : filter} approvals found</p>
              {filter === 'pending' && (
                <p className="text-sm mt-2">All caught up! 🎉</p>
              )}
            </div>
          ) : (
            filteredApprovals.map((approval) => (
              <div 
                key={approval.id}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
              >
                {/* Main Row */}
                <div 
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-800/50 transition"
                  onClick={() => setExpandedId(expandedId === approval.id ? null : approval.id)}
                >
                  {/* Category Icon */}
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-purple-400">
                    {getCategoryIcon(approval.category)}
                  </div>
                  
                  {/* Command Info */}
                  <div className="flex-1">
                    <p className="font-medium">{approval.command_text}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className="capitalize">{approval.category}</span>
                      <span>•</span>
                      <span>{new Date(approval.requested_at).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {/* Risk Badge */}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskColor(approval.risk_level)}`}>
                    {approval.risk_level.toUpperCase()}
                  </span>
                  
                  {/* Status Badge */}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    approval.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    approval.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {approval.status === 'pending' ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    ) : approval.status === 'approved' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Rejected
                      </span>
                    )}
                  </span>
                  
                  {/* Expand Icon */}
                  {expandedId === approval.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                
                {/* Expanded Details */}
                {expandedId === approval.id && (
                  <div className="border-t border-gray-800 p-4 bg-gray-800/30">
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Parameters</p>
                        <pre className="bg-gray-900 p-3 rounded-lg text-sm overflow-x-auto">
                          {JSON.stringify(approval.parameters, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Request Details</p>
                        <div className="bg-gray-900 p-3 rounded-lg text-sm space-y-2">
                          <p><span className="text-gray-500">Requested by:</span> {approval.requested_by}</p>
                          <p><span className="text-gray-500">Time:</span> {new Date(approval.requested_at).toLocaleString()}</p>
                          {approval.approved_by && (
                            <p><span className="text-gray-500">Handled by:</span> {approval.approved_by}</p>
                          )}
                          {approval.rejection_reason && (
                            <p><span className="text-gray-500">Reason:</span> {approval.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    {approval.status === 'pending' && (
                      <div className="flex gap-3 pt-4 border-t border-gray-700">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleApprove(approval.id)
                          }}
                          disabled={actionLoading === approval.id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition disabled:opacity-50"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Approve & Execute
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const reason = prompt('Rejection reason (optional):')
                            handleReject(approval.id, reason || 'No reason provided')
                          }}
                          disabled={actionLoading === approval.id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition disabled:opacity-50"
                        >
                          <XCircle className="w-5 h-5" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {/* Risk Level Legend */}
        <div className="mt-8 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
          <h3 className="font-semibold mb-3">Risk Level Guide</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Low - Safe operations</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Medium - Review recommended</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              <span>High - Careful review</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span>Critical - Destructive action</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
