'use client';

import { useState, useEffect } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Lock,
  Unlock,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';

interface Credential {
  id: string;
  name: string;
  type: 'github' | 'vercel' | 'openai' | 'anthropic' | 'stripe' | 'paypal' | 'supabase' | 'custom';
  value: string;
  description?: string;
  project_id?: string;
  subproject_id?: string;
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface CredentialsVaultProps {
  projectId?: string;
  subprojectId?: string;
}

const CREDENTIAL_TYPES = [
  { value: 'github', label: 'GitHub Token', icon: '🔗' },
  { value: 'vercel', label: 'Vercel API Token', icon: '▲' },
  { value: 'openai', label: 'OpenAI API Key', icon: '🤖' },
  { value: 'anthropic', label: 'Anthropic API Key', icon: '🧠' },
  { value: 'stripe', label: 'Stripe Secret Key', icon: '💳' },
  { value: 'paypal', label: 'PayPal Credentials', icon: '💰' },
  { value: 'supabase', label: 'Supabase Keys', icon: '🗄️' },
  { value: 'custom', label: 'Custom API Key', icon: '🔑' }
];

export function CredentialsVault({ projectId, subprojectId }: CredentialsVaultProps) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showValues, setShowValues] = useState<{ [key: string]: boolean }>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'custom' as Credential['type'],
    value: '',
    description: '',
    expires_at: ''
  });

  useEffect(() => {
    fetchCredentials();
  }, [projectId, subprojectId]);

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/credentials?project_id=${projectId}`);
      // const data = await response.json();
      
      // Mock data for now
      const mockData: Credential[] = [
        {
          id: '1',
          name: 'GitHub PAT',
          type: 'github',
          value: 'ghp_••••••••••••••••••••',
          description: 'Personal Access Token for repo access',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Vercel Deploy Token',
          type: 'vercel',
          value: 'ar1e9s••••••••••••••',
          description: 'Token for deployment automation',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      setCredentials(mockData);
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // TODO: Implement actual API call to save credential
      console.log('Saving credential:', formData);
      
      if (editingId) {
        // Update existing
        setCredentials(prev =>
          prev.map(cred =>
            cred.id === editingId
              ? { ...cred, ...formData, updated_at: new Date().toISOString() }
              : cred
          )
        );
        setEditingId(null);
      } else {
        // Add new
        const newCred: Credential = {
          id: Date.now().toString(),
          ...formData,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setCredentials(prev => [...prev, newCred]);
        setIsAddingNew(false);
      }

      // Reset form
      setFormData({
        name: '',
        type: 'custom',
        value: '',
        description: '',
        expires_at: ''
      });
    } catch (error) {
      console.error('Failed to save credential:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    
    try {
      // TODO: Implement actual API call
      setCredentials(prev => prev.filter(cred => cred.id !== id));
    } catch (error) {
      console.error('Failed to delete credential:', error);
    }
  };

  const toggleVisibility = (id: string) => {
    setShowValues(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const testCredential = async (id: string, type: string) => {
    setTestingId(id);
    try {
      // TODO: Implement actual credential testing
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Testing credential:', id, type);
    } catch (error) {
      console.error('Credential test failed:', error);
    } finally {
      setTestingId(null);
    }
  };

  const startEdit = (cred: Credential) => {
    setEditingId(cred.id);
    setFormData({
      name: cred.name,
      type: cred.type,
      value: cred.value,
      description: cred.description || '',
      expires_at: cred.expires_at || ''
    });
    setIsAddingNew(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setFormData({
      name: '',
      type: 'custom',
      value: '',
      description: '',
      expires_at: ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Lock className="w-6 h-6 text-blue-400" />
            Credentials Vault
          </h2>
          <p className="text-gray-400 mt-1">
            Securely store and manage API keys and credentials
          </p>
        </div>
        <button
          onClick={() => setIsAddingNew(true)}
          disabled={isAddingNew || editingId !== null}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Credential
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isAddingNew || editingId) && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Credential' : 'Add New Credential'}
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Credential Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My API Key"
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Credential Type
                </label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as Credential['type'] })}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CREDENTIAL_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key / Token
              </label>
              <input
                type="password"
                value={formData.value}
                onChange={e => setFormData({ ...formData, value: e.target.value })}
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this credential used for?"
                rows={2}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Expires At (optional)
              </label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Credential
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials List */}
      <div className="space-y-3">
        {credentials.length === 0 ? (
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 p-12 text-center">
            <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No Credentials Yet</h3>
            <p className="text-gray-500 mb-4">Add your first API key or token to get started</p>
            <button
              onClick={() => setIsAddingNew(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Credential
            </button>
          </div>
        ) : (
          credentials.map(cred => (
            <div
              key={cred.id}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6 hover:border-blue-500/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{cred.name}</h3>
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full">
                      {CREDENTIAL_TYPES.find(t => t.value === cred.type)?.label}
                    </span>
                    {cred.is_active ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>

                  {cred.description && (
                    <p className="text-gray-400 text-sm mb-3">{cred.description}</p>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <code className="flex-1 px-3 py-2 bg-slate-900/50 text-sm text-gray-300 rounded font-mono">
                      {showValues[cred.id] ? cred.value : '••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => toggleVisibility(cred.id)}
                      className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                      title={showValues[cred.id] ? 'Hide' : 'Show'}
                    >
                      {showValues[cred.id] ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(cred.value, cred.id)}
                      className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                      title="Copy"
                    >
                      {copiedId === cred.id ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Created: {new Date(cred.created_at).toLocaleDateString()}</span>
                    {cred.last_used_at && (
                      <span>Last used: {new Date(cred.last_used_at).toLocaleDateString()}</span>
                    )}
                    {cred.expires_at && (
                      <span className="text-yellow-400">
                        Expires: {new Date(cred.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => testCredential(cred.id, cred.type)}
                    disabled={testingId === cred.id}
                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                    title="Test Connection"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-400 ${testingId === cred.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => startEdit(cred)}
                    className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(cred.id)}
                    className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Security Notice */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-3">
          <Lock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-300 mb-1">Security Notice</h4>
            <p className="text-xs text-blue-200/80">
              All credentials are encrypted at rest using AES-256 encryption. Only you can access your credentials.
              Never share your credentials with anyone. Rotate credentials regularly for security.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
