'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ============ TYPES ============

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  user_email?: string;
  user_name?: string;
  auto_fix_attempted?: boolean;
  auto_fix_successful?: boolean;
  auto_fix_logs?: string;
  resolution?: string;
  resolution_type?: string;
  assigned_bot?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

interface Enhancement {
  id: string;
  request_number: string;
  title: string;
  description: string;
  use_case?: string;
  expected_benefit?: string;
  category: string;
  priority: string;
  status: string;
  approval_status?: string;
  upvotes: number;
  downvotes: number;
  view_count: number;
  ai_implementation_plan?: string;
  ai_estimated_effort?: string;
  ai_estimated_complexity?: string;
  ai_potential_impacts?: any;
  ai_dependencies?: string[];
  ai_recommendations?: string;
  user_email?: string;
  user_name?: string;
  created_at: string;
}

interface Stats {
  tickets: {
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    escalated: number;
    auto_fixed: number;
  };
  enhancements: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    in_development: number;
  };
}

// ============ COMPONENT ============

export default function AdminSupportDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tickets' | 'enhancements'>('overview');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [enhancements, setEnhancements] = useState<Enhancement[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedEnhancement, setSelectedEnhancement] = useState<Enhancement | null>(null);
  const [ticketComments, setTicketComments] = useState<any[]>([]);
  const [enhancementComments, setEnhancementComments] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: ''
  });
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'request_info' | 'resolve' | 'escalate' | null;
    item: any;
  }>({ type: null, item: null });
  const [actionNotes, setActionNotes] = useState('');

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch tickets
      const ticketRes = await fetch('/api/tickets?limit=100');
      const ticketData = await ticketRes.json();
      if (ticketData.success) {
        setTickets(ticketData.tickets || []);
      }

      // Fetch enhancements
      const enhRes = await fetch('/api/enhancements?limit=100');
      const enhData = await enhRes.json();
      if (enhData.success) {
        setEnhancements(enhData.enhancements || []);
      }

      // Calculate stats
      const tix = ticketData.tickets || [];
      const enh = enhData.enhancements || [];
      
      setStats({
        tickets: {
          total: tix.length,
          open: tix.filter((t: Ticket) => t.status === 'open').length,
          in_progress: tix.filter((t: Ticket) => ['in_progress', 'auto_fixing'].includes(t.status)).length,
          resolved: tix.filter((t: Ticket) => t.status === 'resolved').length,
          escalated: tix.filter((t: Ticket) => t.status === 'escalated').length,
          auto_fixed: tix.filter((t: Ticket) => t.auto_fix_successful).length
        },
        enhancements: {
          total: enh.length,
          pending: enh.filter((e: Enhancement) => e.approval_status === 'pending' || !e.approval_status).length,
          approved: enh.filter((e: Enhancement) => e.approval_status === 'approved').length,
          rejected: enh.filter((e: Enhancement) => e.approval_status === 'rejected').length,
          in_development: enh.filter((e: Enhancement) => e.status === 'in_development').length
        }
      });
    } catch (e) {
      console.error('Fetch error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch ticket details
  const fetchTicketDetails = async (ticket: Ticket) => {
    try {
      const res = await fetch(`/api/tickets?id=${ticket.id}&include_comments=true`);
      const data = await res.json();
      if (data.success) {
        setSelectedTicket(data.ticket);
        setTicketComments(data.comments || []);
      }
    } catch (e) {
      console.error('Fetch ticket error:', e);
    }
  };

  // Fetch enhancement details
  const fetchEnhancementDetails = async (enhancement: Enhancement) => {
    try {
      const res = await fetch(`/api/enhancements?id=${enhancement.id}&include_comments=true`);
      const data = await res.json();
      if (data.success) {
        setSelectedEnhancement(data.enhancement);
        setEnhancementComments(data.comments || []);
      }
    } catch (e) {
      console.error('Fetch enhancement error:', e);
    }
  };

  // Handle enhancement actions
  const handleEnhancementAction = async () => {
    if (!actionModal.type || !actionModal.item) return;

    try {
      const res = await fetch('/api/enhancements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: actionModal.item.id,
          action: actionModal.type,
          approved_by: 'Admin',
          reviewed_by: 'Admin',
          review_notes: actionNotes,
          rejection_reason: actionModal.type === 'reject' ? actionNotes : undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setActionModal({ type: null, item: null });
        setActionNotes('');
        fetchData();
        if (selectedEnhancement?.id === actionModal.item.id) {
          fetchEnhancementDetails(actionModal.item);
        }
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Action failed');
    }
  };

  // Handle ticket actions
  const handleTicketAction = async () => {
    if (!actionModal.type || !actionModal.item) return;

    try {
      const updates: any = {
        id: actionModal.item.id,
        actor_type: 'admin',
        actor_name: 'Admin'
      };

      if (actionModal.type === 'resolve') {
        updates.status = 'resolved';
        updates.resolution = actionNotes;
        updates.resolution_type = 'manual_fix';
        updates.resolved_by = 'Admin';
        updates.resolved_at = new Date().toISOString();
      } else if (actionModal.type === 'escalate') {
        updates.status = 'escalated';
        updates.escalated_to = 'Technical Team';
      }

      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const data = await res.json();
      if (data.success) {
        // Add comment
        await fetch('/api/tickets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_id: actionModal.item.id,
            content: actionModal.type === 'resolve' 
              ? `✅ **Ticket Resolved**\n\n${actionNotes}`
              : `⚠️ **Escalated to Technical Team**\n\n${actionNotes || 'This ticket requires specialized attention.'}`,
            author_type: 'admin',
            author_name: 'Admin'
          })
        });

        setActionModal({ type: null, item: null });
        setActionNotes('');
        fetchData();
        if (selectedTicket?.id === actionModal.item.id) {
          fetchTicketDetails(actionModal.item);
        }
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Action failed');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      auto_fixing: 'bg-purple-100 text-purple-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      escalated: 'bg-red-100 text-red-800',
      submitted: 'bg-blue-100 text-blue-800',
      under_review: 'bg-yellow-100 text-yellow-800',
      analysis_complete: 'bg-purple-100 text-purple-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      in_development: 'bg-indigo-100 text-indigo-800',
      pending: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500'
    };
    return colors[priority] || 'bg-gray-500';
  };

  // Filter items
  const filteredTickets = tickets.filter(t => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.category && t.category !== filters.category) return false;
    return true;
  });

  const filteredEnhancements = enhancements.filter(e => {
    if (filters.status && e.status !== filters.status) return false;
    if (filters.priority && e.priority !== filters.priority) return false;
    if (filters.category && e.category !== filters.category) return false;
    return true;
  });

  // Get pending items for overview
  const pendingEnhancements = enhancements.filter(e => 
    e.status === 'analysis_complete' && (!e.approval_status || e.approval_status === 'pending')
  );
  const escalatedTickets = tickets.filter(t => t.status === 'escalated');
  const recentAutoFixed = tickets.filter(t => t.auto_fix_successful).slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">🛠️ Admin Support Dashboard</h1>
              <p className="text-indigo-200 text-sm">Manage tickets and enhancement requests</p>
            </div>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4">
            {(['overview', 'tickets', 'enhancements'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                {tab === 'overview' && '📊 Overview'}
                {tab === 'tickets' && `🎫 Tickets (${tickets.length})`}
                {tab === 'enhancements' && `💡 Enhancements (${enhancements.length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-500">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900">{stats.tickets.total}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-500">Open</p>
                <p className="text-2xl font-bold text-blue-600">{stats.tickets.open}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-500">Escalated</p>
                <p className="text-2xl font-bold text-red-600">{stats.tickets.escalated}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-500">Auto-Fixed</p>
                <p className="text-2xl font-bold text-green-600">{stats.tickets.auto_fixed}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-500">Pending Approval</p>
                <p className="text-2xl font-bold text-orange-600">{stats.enhancements.pending}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-500">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.enhancements.approved}</p>
              </div>
            </div>

            {/* Pending Enhancements */}
            {pendingEnhancements.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-orange-50">
                  <h2 className="font-semibold text-orange-900">⏳ Pending Enhancement Approvals ({pendingEnhancements.length})</h2>
                </div>
                <div className="divide-y">
                  {pendingEnhancements.map(enh => (
                    <div
                      key={enh.id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setActiveTab('enhancements'); fetchEnhancementDetails(enh); }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-gray-500 font-mono">{enh.request_number}</p>
                          <p className="font-medium text-gray-900">{enh.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`w-2 h-2 rounded-full ${getPriorityColor(enh.priority)}`}></span>
                            <span className="text-sm text-gray-500">{enh.priority}</span>
                            <span className="text-sm text-gray-400">•</span>
                            <span className="text-sm text-gray-500">{enh.ai_estimated_complexity || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'approve', item: enh }); }}
                            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Approve
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'reject', item: enh }); }}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Escalated Tickets */}
            {escalatedTickets.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-red-50">
                  <h2 className="font-semibold text-red-900">🚨 Escalated Tickets ({escalatedTickets.length})</h2>
                </div>
                <div className="divide-y">
                  {escalatedTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setActiveTab('tickets'); fetchTicketDetails(ticket); }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-gray-500 font-mono">{ticket.ticket_number}</p>
                          <p className="font-medium text-gray-900">{ticket.title}</p>
                          <p className="text-sm text-gray-500">{ticket.category} • {ticket.priority}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'resolve', item: ticket }); }}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Auto-Fixes */}
            {recentAutoFixed.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-green-50">
                  <h2 className="font-semibold text-green-900">🤖 Recent Auto-Fixes</h2>
                </div>
                <div className="divide-y">
                  {recentAutoFixed.map(ticket => (
                    <div
                      key={ticket.id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setActiveTab('tickets'); fetchTicketDetails(ticket); }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-green-500">✓</span>
                        <div>
                          <p className="text-sm font-mono text-gray-500">{ticket.ticket_number}</p>
                          <p className="font-medium text-gray-900">{ticket.title}</p>
                        </div>
                        <span className="ml-auto text-sm text-gray-400">
                          {new Date(ticket.resolved_at || ticket.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ticket List */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Filters */}
              <div className="p-3 border-b bg-gray-50 flex gap-2">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="">All Priority</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="divide-y max-h-[700px] overflow-y-auto">
                {filteredTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => fetchTicketDetails(ticket)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedTicket?.id === ticket.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${getPriorityColor(ticket.priority)}`}></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 font-mono">{ticket.ticket_number}</p>
                        <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace(/_/g, ' ')}
                          </span>
                          {ticket.auto_fix_successful && <span title="Auto-fixed">🤖✓</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ticket Detail */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
              {selectedTicket ? (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-gray-500 font-mono">{selectedTicket.ticket_number}</p>
                        <h2 className="text-xl font-bold text-gray-900">{selectedTicket.title}</h2>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-1 text-sm rounded-full ${getStatusColor(selectedTicket.status)}`}>
                            {selectedTicket.status.replace(/_/g, ' ')}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${getPriorityColor(selectedTicket.priority)}`}></span>
                          <span className="text-sm text-gray-500">{selectedTicket.priority}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                          <>
                            <button
                              onClick={() => setActionModal({ type: 'resolve', item: selectedTicket })}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Resolve
                            </button>
                            {selectedTicket.status !== 'escalated' && (
                              <button
                                onClick={() => setActionModal({ type: 'escalate', item: selectedTicket })}
                                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                Escalate
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                    </div>

                    {selectedTicket.user_email && (
                      <div className="text-sm text-gray-500">
                        Submitted by: {selectedTicket.user_name || 'Anonymous'} ({selectedTicket.user_email})
                      </div>
                    )}

                    {selectedTicket.auto_fix_logs && (
                      <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                        <h3 className="text-gray-400 mb-2">Auto-Fix Logs:</h3>
                        <pre className="whitespace-pre-wrap">{selectedTicket.auto_fix_logs}</pre>
                      </div>
                    )}

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Activity</h3>
                      <div className="space-y-3">
                        {ticketComments.map(comment => (
                          <div key={comment.id} className={`p-3 rounded-lg ${
                            comment.author_type === 'bot' ? 'bg-purple-50 border border-purple-200' :
                            comment.author_type === 'admin' ? 'bg-blue-50 border border-blue-200' :
                            'bg-gray-50 border border-gray-200'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{comment.author_name}</span>
                              <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 p-8">
                  Select a ticket to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* Enhancements Tab */}
        {activeTab === 'enhancements' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Enhancement List */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-3 border-b bg-gray-50 flex gap-2">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="">All Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="analysis_complete">Analysis Complete</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="in_development">In Development</option>
                </select>
              </div>

              <div className="divide-y max-h-[700px] overflow-y-auto">
                {filteredEnhancements.map(enh => (
                  <div
                    key={enh.id}
                    onClick={() => fetchEnhancementDetails(enh)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedEnhancement?.id === enh.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${getPriorityColor(enh.priority)}`}></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 font-mono">{enh.request_number}</p>
                        <p className="font-medium text-gray-900 truncate">{enh.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(enh.approval_status || enh.status)}`}>
                            {(enh.approval_status || enh.status).replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500">👍 {enh.upvotes}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Enhancement Detail */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
              {selectedEnhancement ? (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-gray-500 font-mono">{selectedEnhancement.request_number}</p>
                        <h2 className="text-xl font-bold text-gray-900">{selectedEnhancement.title}</h2>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-1 text-sm rounded-full ${getStatusColor(selectedEnhancement.approval_status || selectedEnhancement.status)}`}>
                            {(selectedEnhancement.approval_status || selectedEnhancement.status).replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-gray-500">👍 {selectedEnhancement.upvotes} 👁️ {selectedEnhancement.view_count}</span>
                        </div>
                      </div>
                      {selectedEnhancement.status === 'analysis_complete' && (!selectedEnhancement.approval_status || selectedEnhancement.approval_status === 'pending') && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setActionModal({ type: 'approve', item: selectedEnhancement })}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setActionModal({ type: 'reject', item: selectedEnhancement })}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setActionModal({ type: 'request_info', item: selectedEnhancement })}
                            className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          >
                            Request Info
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedEnhancement.description}</p>
                    </div>

                    {selectedEnhancement.use_case && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Use Case</h3>
                        <p className="text-gray-700">{selectedEnhancement.use_case}</p>
                      </div>
                    )}

                    {selectedEnhancement.ai_implementation_plan && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h3 className="font-semibold text-purple-900 mb-2">🤖 Javari AI Implementation Plan</h3>
                        <div className="text-sm text-purple-800 whitespace-pre-wrap">{selectedEnhancement.ai_implementation_plan}</div>
                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <strong>Estimated Effort:</strong> {selectedEnhancement.ai_estimated_effort || 'N/A'}
                          </div>
                          <div>
                            <strong>Complexity:</strong> {selectedEnhancement.ai_estimated_complexity || 'N/A'}
                          </div>
                        </div>
                        {selectedEnhancement.ai_dependencies && selectedEnhancement.ai_dependencies.length > 0 && (
                          <div className="mt-3">
                            <strong>Dependencies:</strong>
                            <ul className="list-disc list-inside text-sm mt-1">
                              {selectedEnhancement.ai_dependencies.map((dep, i) => (
                                <li key={i}>{dep}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Activity</h3>
                      <div className="space-y-3">
                        {enhancementComments.map(comment => (
                          <div key={comment.id} className={`p-3 rounded-lg ${
                            comment.author_type === 'bot' ? 'bg-purple-50 border border-purple-200' :
                            comment.author_type === 'admin' ? 'bg-blue-50 border border-blue-200' :
                            'bg-gray-50 border border-gray-200'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{comment.author_name}</span>
                              <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap prose prose-sm max-w-none">{comment.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 p-8">
                  Select an enhancement to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionModal.type && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b">
              <h2 className="text-lg font-bold">
                {actionModal.type === 'approve' && '✅ Approve Enhancement'}
                {actionModal.type === 'reject' && '❌ Reject Enhancement'}
                {actionModal.type === 'request_info' && '❓ Request More Information'}
                {actionModal.type === 'resolve' && '✅ Resolve Ticket'}
                {actionModal.type === 'escalate' && '⚠️ Escalate Ticket'}
              </h2>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                {actionModal.item?.ticket_number || actionModal.item?.request_number}: {actionModal.item?.title}
              </p>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionModal.type === 'approve' ? 'Add approval notes (optional)...' :
                  actionModal.type === 'reject' ? 'Provide rejection reason...' :
                  actionModal.type === 'request_info' ? 'What information is needed?' :
                  actionModal.type === 'resolve' ? 'Describe the resolution...' :
                  'Add notes...'
                }
                rows={4}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => { setActionModal({ type: null, item: null }); setActionNotes(''); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => actionModal.item?.ticket_number ? handleTicketAction() : handleEnhancementAction()}
                className={`px-4 py-2 text-white rounded-lg ${
                  actionModal.type === 'reject' || actionModal.type === 'escalate'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
