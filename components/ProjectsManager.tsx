/**
 * JAVARI AI - PROJECTS MANAGER COMPONENT
 * Complete projects management interface
 * Date: October 28, 2025
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Star, Archive, AlertCircle } from 'lucide-react';
import type {
  JavariProject,
  ProjectFilters,
  ProjectSortField,
  CreateProjectInput
} from '@/types/javari-projects';

interface ProjectsManagerProps {
  onProjectSelect?: (project: JavariProject) => void;
}

export function ProjectsManager({ onProjectSelect }: ProjectsManagerProps) {
  const [projects, setProjects] = useState<JavariProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState<ProjectFilters>({
    sort_by: 'updated_at',
    sort_order: 'desc'
  });

  // Fetch projects
  useEffect(() => {
    fetchProjects();
  }, [filters]);

  async function fetchProjects() {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status.join(','));
      if (filters.starred !== undefined) params.set('starred', String(filters.starred));
      if (filters.archived !== undefined) params.set('archived', String(filters.archived));
      if (filters.search) params.set('search', filters.search);
      if (filters.sort_by) params.set('sort_by', filters.sort_by);
      if (filters.sort_order) params.set('sort_order', filters.sort_order);

      const response = await fetch(`/api/projects?${params}`);
      const data = await response.json();

      if (data.success) {
        setProjects(data.data.projects);
      } else {
        setError(data.error || 'Failed to fetch projects');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function createProject(input: CreateProjectInput) {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      const data = await response.json();

      if (data.success) {
        setProjects([data.data, ...projects]);
        setShowCreateForm(false);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  async function toggleStar(projectId: string, starred: boolean) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred })
      });

      const data = await response.json();

      if (data.success) {
        setProjects(projects.map(p => 
          p.id === projectId ? data.data : p
        ));
      }
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage and monitor your development projects
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setFilters({ ...filters, starred: !filters.starred })}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              filters.starred
                ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Star className="w-4 h-4" fill={filters.starred ? 'currentColor' : 'none'} />
            Starred
          </button>

          <button
            onClick={() => setFilters({ ...filters, archived: !filters.archived })}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              filters.archived
                ? 'bg-gray-100 border-gray-400 text-gray-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Archive className="w-4 h-4" />
            Archived
          </button>

          <select
            value={filters.sort_by}
            onChange={(e) => setFilters({ ...filters, sort_by: e.target.value as ProjectSortField })}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
          >
            <option value="updated_at">Last Updated</option>
            <option value="created_at">Created Date</option>
            <option value="name">Name</option>
            <option value="health_score">Health Score</option>
            <option value="total_cost">Total Cost</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading projects...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No projects found</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Project
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onSelect={() => onProjectSelect?.(project)}
                onToggleStar={() => toggleStar(project.id, !project.starred)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateForm && (
        <ProjectCreateModal
          onClose={() => setShowCreateForm(false)}
          onCreate={createProject}
        />
      )}
    </div>
  );
}

// Simple Project Card component
function ProjectCard({
  project,
  onSelect,
  onToggleStar
}: {
  project: JavariProject;
  onSelect: () => void;
  onToggleStar: () => void;
}) {
  const healthColor = 
    project.health_score >= 80 ? 'text-green-600' :
    project.health_score >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{project.display_name}</h3>
          {project.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
          className="ml-2"
        >
          <Star
            className="w-5 h-5 text-yellow-500"
            fill={project.starred ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className={`font-semibold ${healthColor}`}>
          Health: {project.health_score}%
        </div>
        <div className="text-gray-500">
          {project.active_chats_count} active chats
        </div>
      </div>
    </div>
  );
}

// Simple Create Modal component  
function ProjectCreateModal({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => Promise<{ success: boolean; error?: string }>;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const result = await onCreate({
      name,
      display_name: displayName || name,
      description: description || undefined
    });

    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Failed to create project');
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Create New Project</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="my-awesome-project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="My Awesome Project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="What is this project about?"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
