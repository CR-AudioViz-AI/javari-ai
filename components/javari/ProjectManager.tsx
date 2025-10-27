'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  display_name: string;
  description: string;
  github_repo: string;
  vercel_project: string;
  health_score: number;
  active_chats_count: number;
  starred: boolean;
  created_at: string;
}

export function ProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    displayName: '',
    description: '',
    githubRepo: '',
    vercelProject: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProject.name,
          display_name: newProject.displayName,
          description: newProject.description,
          github_repo: newProject.githubRepo,
          vercel_project: newProject.vercelProject
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewProject({
          name: '',
          displayName: '',
          description: '',
          githubRepo: '',
          vercelProject: ''
        });
        fetchProjects();
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  if (loading) {
    return <div className="text-white text-center py-12">Loading projects...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <p className="text-gray-400 mt-1">Manage and monitor your projects</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          ➕ Create Project
        </button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-blue-500/20 p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-gray-400 mb-6">Create your first project to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6 hover:border-blue-500/40 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{project.display_name}</h3>
                  <p className="text-sm text-gray-400">{project.name}</p>
                </div>
                {project.starred && <span className="text-yellow-400">⭐</span>}
              </div>

              <p className="text-sm text-gray-300 mb-4">{project.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Health Score</span>
                  <span className={`font-semibold ${
                    project.health_score >= 80 ? 'text-green-400' : 
                    project.health_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{project.health_score}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Active Chats</span>
                  <span className="text-white font-semibold">{project.active_chats_count}</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <a
                  href={`https://github.com/${project.github_repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-center py-2 rounded-lg text-sm transition-colors"
                >
                  GitHub
                </a>
                <a
                  href={`https://vercel.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-center py-2 rounded-lg text-sm transition-colors"
                >
                  Vercel
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-blue-500/20 p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-white mb-4">Create New Project</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Project Name (slug)
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="my-awesome-project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={newProject.displayName}
                  onChange={(e) => setNewProject({...newProject, displayName: e.target.value})}
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Awesome Project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Brief description of your project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  GitHub Repository
                </label>
                <input
                  type="text"
                  value={newProject.githubRepo}
                  onChange={(e) => setNewProject({...newProject, githubRepo: e.target.value})}
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="username/repo-name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Vercel Project
                </label>
                <input
                  type="text"
                  value={newProject.vercelProject}
                  onChange={(e) => setNewProject({...newProject, vercelProject: e.target.value})}
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="project-name"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={!newProject.name || !newProject.displayName}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
