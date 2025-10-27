'use client';

import { useState, useEffect } from 'react';
import {
  FolderPlus,
  Search,
  Star,
  Archive,
  Trash2,
  Edit,
  ExternalLink,
  Filter,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle,
  Plus
} from 'lucide-react';

interface Project {
  id: string;
  numeric_id: number;
  name: string;
  description?: string;
  repository_url?: string;
  vercel_project_id?: string;
  status: 'active' | 'inactive' | 'archived' | 'completed' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  health_score: number;
  starred: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export function ProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterStarred, setFilterStarred] = useState(false);
  const [sortBy, setSortBy] = useState('updated_at');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [userId] = useState('demo-user'); // TODO: Get from auth

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    repository_url: '',
    vercel_project_id: '',
    priority: 'medium' as const,
    tags: [] as string[],
  });

  useEffect(() => {
    loadProjects();
  }, [search, filterStatus, filterStarred, sortBy]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        userId,
        ...(filterStatus && { status: filterStatus }),
        ...(search && { search }),
        ...(filterStarred && { starred: 'true' }),
        sortBy,
        sortOrder: 'desc',
      });

      const response = await fetch(`/api/javari/projects?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    try {
      const response = await fetch('/api/javari/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...newProject }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewProject({
          name: '',
          description: '',
          repository_url: '',
          vercel_project_id: '',
          priority: 'medium',
          tags: [],
        });
        loadProjects();
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      const response = await fetch(`/api/javari/projects?id=${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        loadProjects();
        if (editingProject?.id === projectId) {
          setEditingProject(null);
        }
      }
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  const toggleStar = (projectId: string, currentStarred: boolean) => {
    updateProject(projectId, { starred: !currentStarred });
  };

  const archiveProject = (projectId: string) => {
    if (confirm('Archive this project?')) {
      fetch(`/api/javari/projects?id=${projectId}&archive=true`, {
        method: 'DELETE',
      }).then(() => loadProjects());
    }
  };

  const deleteProject = (projectId: string) => {
    if (confirm('Permanently delete this project? This cannot be undone.')) {
      fetch(`/api/javari/projects?id=${projectId}`, {
        method: 'DELETE',
      }).then(() => loadProjects());
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Projects</h1>
          <p className="text-gray-400 mt-1">Manage your development projects</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={20} />
          New Project
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="updated_at">Recently Updated</option>
            <option value="created_at">Recently Created</option>
            <option value="name">Name</option>
            <option value="health_score">Health Score</option>
          </select>

          <button
            onClick={() => setFilterStarred(!filterStarred)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStarred
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-gray-900 text-gray-400 border border-gray-700 hover:bg-gray-800'
            }`}
          >
            <Star size={18} className="inline mr-1" />
            Starred
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderPlus className="mx-auto mb-4 text-gray-500" size={64} />
          <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-gray-400 mb-4">Create your first project to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 hover:border-gray-600 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white truncate">{project.name}</h3>
                    {project.starred && (
                      <Star size={16} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">ID: {project.numeric_id}</p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleStar(project.id, project.starred)}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    <Star
                      size={16}
                      className={project.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}
                    />
                  </button>
                </div>
              </div>

              {/* Description */}
              {project.description && (
                <p className="text-sm text-gray-300 mb-3 line-clamp-2">{project.description}</p>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between mb-3 text-sm">
                <div className="flex items-center gap-2">
                  <Activity size={14} className={getHealthColor(project.health_score)} />
                  <span className={`font-medium ${getHealthColor(project.health_score)}`}>
                    {project.health_score}%
                  </span>
                  <span className="text-gray-500">Health</span>
                </div>

                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(project.priority)}`}>
                  {project.priority}
                </span>
              </div>

              {/* Tags */}
              {project.tags && project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {project.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Links */}
              <div className="flex gap-2 mb-3">
                {project.repository_url && (
                  <a
                    href={project.repository_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
                  >
                    <ExternalLink size={12} />
                    GitHub
                  </a>
                )}
                {project.vercel_project_id && (
                  <a
                    href={`https://vercel.com/dashboard/${project.vercel_project_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
                  >
                    <ExternalLink size={12} />
                    Vercel
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-700">
                <button
                  onClick={() => setEditingProject(project)}
                  className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                >
                  <Edit size={14} className="inline mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => archiveProject(project.id)}
                  className="py-1 px-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors"
                >
                  <Archive size={14} />
                </button>
                <button
                  onClick={() => deleteProject(project.id)}
                  className="py-1 px-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Create New Project</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Awesome Project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="What is this project about?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    GitHub Repository
                  </label>
                  <input
                    type="url"
                    value={newProject.repository_url}
                    onChange={(e) => setNewProject({ ...newProject, repository_url: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://github.com/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Vercel Project ID
                  </label>
                  <input
                    type="text"
                    value={newProject.vercel_project_id}
                    onChange={(e) => setNewProject({ ...newProject, vercel_project_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="prj_..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={newProject.priority}
                  onChange={(e) => setNewProject({ ...newProject, priority: e.target.value as any })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={createProject}
                disabled={!newProject.name}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Create Project
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
