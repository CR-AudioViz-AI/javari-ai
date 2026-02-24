'use client';

import React, { useState, useEffect } from 'react';

// ============ TYPES ============

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  auto_fix_successful?: boolean;
  resolution?: string;
  created_at: string;
  updated_at: string;
}

interface Enhancement {
  id: string;
  request_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  approval_status?: string;
  upvotes: number;
  ai_estimated_complexity?: string;
  ai_recommendations?: string;
  created_at: string;
}

interface Comment {
  id: string;
  author_type: string;
  author_name: string;
  content: string;
  created_at: string;
}

// ============ COMPONENT ============

export default function SupportDashboard() {
  const [activeTab, setActiveTab] = useState<'tickets' | 'enhancements'>('tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [enhancements, setEnhancements] = useState<Enhancement[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'bug',
    priority: 'medium',
    use_case: '',
    expected_benefit: ''
  });
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'tickets') {
        const res = await fetch('/api/tickets?limit=50');
        const data = await res.json();
        if (data.success) setTickets(data.tickets || []);
      } else {
        const res = await fetch('/api/enhancements?limit=50');
        const data = await res.json();
        if (data.success) setEnhancements(data.enhancements || []);
      }
    } catch (e) {
      console.error('Fetch error:', e);
    }
    setLoading(false);
  };

  const fetchItemDetails = async (id: string, type: 'ticket' | 'enhancement') => {
    try {
      const endpoint = type === 'ticket' ? '/api/tickets' : '/api/enhancements';
      const res = await fetch(`${endpoint}?id=${id}&include_comments=true`);
      const data = await res.json();
      if (data.success) {
        setSelectedItem(type === 'ticket' ? data.ticket : data.enhancement);
        setComments(data.comments || []);
      }
    } catch (e) {
      console.error('Fetch details error:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const endpoint = activeTab === 'tickets' ? '/api/tickets' : '/api/enhancements';
      const body = activeTab === 'tickets'
        ? {
            title: formData.title,
            description: formData.description,
            category: formData.category,
            priority: formData.priority
          }
        : {
            title: formData.title,
            description: formData.description,
            category: formData.category,
            priority: formData.priority,
            use_case: formData.use_case,
            expected_benefit: formData.expected_benefit
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setFormData({
          title: '',
          description: '',
          category: 'bug',
          priority: 'medium',
          use_case: '',
          expected_benefit: ''
        });
        fetchData();
        alert(`${activeTab === 'tickets' ? 'Ticket' : 'Enhancement'} submitted! ${data.ticket?.ticket_number || data.enhancement?.request_number}`);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Failed to submit');
    }
    setSubmitting(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedItem) return;
    setSubmitting(true);

    try {
      const endpoint = activeTab === 'tickets' ? '/api/tickets' : '/api/enhancements';
      const idField = activeTab === 'tickets' ? 'ticket_id' : 'enhancement_id';
      
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [idField]: selectedItem.id,
          action: activeTab === 'tickets' ? undefined : 'comment',
          content: newComment,
          author_type: 'user',
          author_name: 'User'
        })
      });

      const data = await res.json();
      if (data.success) {
        setNewComment('');
        fetchItemDetails(selectedItem.id, activeTab === 'tickets' ? 'ticket' : 'enhancement');
      }
    } catch (e) {
      console.error('Comment error:', e);
    }
    setSubmitting(false);
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
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'text-red-600',
      high: 'text-orange-600',
      medium: 'text-yellow-600',
      low: 'text-green-600'
    };
    return colors[priority] || 'text-gray-600';
  };

  const ticketCategories = ['bug', 'error', 'question', 'account', 'billing', 'feature', 'performance', 'security', 'other'];
  const enhancementCategories = ['feature', 'improvement', 'integration', 'ui_ux', 'performance', 'automation', 'api', 'other'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
              <p className="text-gray-600 text-sm">Submit tickets and enhancement requests</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {activeTab === 'tickets' ? 'New Ticket' : 'New Enhancement'}
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 border-b">
          <button
            onClick={() => { setActiveTab('tickets'); setSelectedItem(null); }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'tickets'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🎫 Support Tickets
          </button>
          <button
            onClick={() => { setActiveTab('enhancements'); setSelectedItem(null); }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'enhancements'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            💡 Enhancement Requests
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">
                {activeTab === 'tickets' ? 'Your Tickets' : 'Your Requests'}
              </h2>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {(activeTab === 'tickets' ? tickets : enhancements).map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => fetchItemDetails(item.id, activeTab === 'tickets' ? 'ticket' : 'enhancement')}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedItem?.id === item.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 font-mono">
                          {item.ticket_number || item.request_number}
                        </p>
                        <p className="font-medium text-gray-900 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(item.status)}`}>
                            {item.status.replace(/_/g, ' ')}
                          </span>
                          <span className={`text-xs font-medium ${getPriorityColor(item.priority)}`}>
                            {item.priority}
                          </span>
                        </div>
                      </div>
                      {activeTab === 'tickets' && item.auto_fix_successful && (
                        <span className="text-green-500" title="Auto-fixed">🤖✓</span>
                      )}
                      {activeTab === 'enhancements' && (
                        <span className="text-sm text-gray-500">👍 {item.upvotes}</span>
                      )}
                    </div>
                  </div>
                ))}
                
                {(activeTab === 'tickets' ? tickets : enhancements).length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No {activeTab} yet. Create one to get started!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detail View */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            {selectedItem ? (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-mono">
                        {selectedItem.ticket_number || selectedItem.request_number}
                      </p>
                      <h2 className="text-xl font-bold text-gray-900">{selectedItem.title}</h2>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-1 text-sm rounded-full ${getStatusColor(selectedItem.status)}`}>
                          {selectedItem.status.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-sm font-medium ${getPriorityColor(selectedItem.priority)}`}>
                          ● {selectedItem.priority}
                        </span>
                        <span className="text-sm text-gray-500 px-2 py-1 bg-gray-100 rounded">
                          {selectedItem.category}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Description */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedItem.description}</p>
                  </div>

                  {/* Enhancement-specific fields */}
                  {activeTab === 'enhancements' && (
                    <>
                      {selectedItem.use_case && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Use Case</h3>
                          <p className="text-gray-700">{selectedItem.use_case}</p>
                        </div>
                      )}
                      {selectedItem.expected_benefit && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Expected Benefit</h3>
                          <p className="text-gray-700">{selectedItem.expected_benefit}</p>
                        </div>
                      )}
                      {selectedItem.ai_recommendations && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                            <span>🤖</span> Javari AI Analysis
                          </h3>
                          <p className="text-purple-800 text-sm">{selectedItem.ai_recommendations}</p>
                          {selectedItem.ai_estimated_complexity && (
                            <p className="text-purple-700 text-sm mt-2">
                              <strong>Complexity:</strong> {selectedItem.ai_estimated_complexity}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Resolution (for tickets) */}
                  {activeTab === 'tickets' && selectedItem.resolution && (
                    <div className={`p-4 rounded-lg ${selectedItem.auto_fix_successful ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        {selectedItem.auto_fix_successful ? '🤖 Auto-Fixed' : '✅ Resolution'}
                      </h3>
                      <p className="text-gray-700">{selectedItem.resolution}</p>
                    </div>
                  )}

                  {/* Comments */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Activity & Comments</h3>
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className={`p-3 rounded-lg ${
                            comment.author_type === 'bot'
                              ? 'bg-purple-50 border border-purple-200'
                              : comment.author_type === 'admin'
                              ? 'bg-blue-50 border border-blue-200'
                              : comment.author_type === 'system'
                              ? 'bg-gray-50 border border-gray-200'
                              : 'bg-white border border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-sm">
                              {comment.author_type === 'bot' && '🤖 '}
                              {comment.author_type === 'admin' && '👤 '}
                              {comment.author_type === 'system' && '⚙️ '}
                              {comment.author_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap prose prose-sm max-w-none">
                            {comment.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Add Comment */}
                <div className="p-4 border-t bg-gray-50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={submitting || !newComment.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 p-8">
                <div className="text-center">
                  <div className="text-4xl mb-4">{activeTab === 'tickets' ? '🎫' : '💡'}</div>
                  <p>Select a {activeTab === 'tickets' ? 'ticket' : 'request'} to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {activeTab === 'tickets' ? '🎫 Create Support Ticket' : '💡 Request Enhancement'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={activeTab === 'tickets' ? 'Brief description of the issue' : 'What would you like to see?'}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {(activeTab === 'tickets' ? ticketCategories : enhancementCategories).map(cat => (
                      <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={activeTab === 'tickets' 
                    ? 'Describe the issue in detail. Include steps to reproduce if applicable.'
                    : 'Describe the enhancement in detail. What problem does it solve?'
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {activeTab === 'enhancements' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Use Case</label>
                    <textarea
                      rows={2}
                      value={formData.use_case}
                      onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                      placeholder="How would you use this feature?"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Benefit</label>
                    <textarea
                      rows={2}
                      value={formData.expected_benefit}
                      onChange={(e) => setFormData({ ...formData, expected_benefit: e.target.value })}
                      placeholder="What benefit would this provide?"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                {activeTab === 'tickets' ? (
                  <>
                    <strong>🤖 Auto-Fix Enabled:</strong> Javari will automatically attempt to resolve your issue.
                    If it can't be auto-fixed, it will be escalated to our team.
                  </>
                ) : (
                  <>
                    <strong>🤖 AI Analysis:</strong> Javari will analyze your request and provide a detailed
                    implementation plan, estimated effort, and potential impacts for review.
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
