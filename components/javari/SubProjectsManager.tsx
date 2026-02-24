'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  GitBranch,
  ExternalLink,
  Key,
  Star,
  Trash2,
  Edit,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Github,
  Box,
} from 'lucide-react';
import type { JavariSubProject, JavariProject } from '@/types/javari';

interface SubProjectsManagerProps {
  projects: JavariProject[];
}

interface CredentialOverride {
  github_token?: string;
  vercel_token?: string;
  openai_key?: string;
  anthropic_key?: string;
  [key: string]: string | undefined;
}

export default function SubProjectsManager({ projects }: SubProjectsManagerProps) {
  const [subProjects, setSubProjects] = useState<JavariSubProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [currentSubProject, setCurrentSubProject] = useState<JavariSubProject | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    github_repo: '',
    vercel_project: '',
    parent_project_id: '',
  });

  const [credentials, setCredentials] = useState<CredentialOverride>({});

  useEffect(() => {
    fetchSubProjects();
  }, []);

  const fetchSubProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subprojects');
      const data = await response.json();

      if (data.success) {
        setSubProjects(data.data);
      } else {
        setError(data.error || 'Failed to fetch sub-projects');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubProject = async () => {
    try {
      const response = await fetch('/api/subprojects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSubProjects([...subProjects, data.data]);
        setIsCreateOpen(false);
        resetForm();
      } else {
        setError(data.error || 'Failed to create sub-project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleUpdateSubProject = async () => {
    if (!currentSubProject) return;

    try {
      const response = await fetch(`/api/subprojects?id=${currentSubProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSubProjects(subProjects.map(sp => sp.id === currentSubProject.id ? data.data : sp));
        setIsEditOpen(false);
        resetForm();
      } else {
        setError(data.error || 'Failed to update sub-project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleUpdateCredentials = async () => {
    if (!currentSubProject) return;

    try {
      const response = await fetch(`/api/subprojects/${currentSubProject.id}/credentials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential_overrides: credentials }),
      });

      const data = await response.json();

      if (data.success) {
        setSubProjects(subProjects.map(sp => sp.id === currentSubProject.id ? data.data : sp));
        setIsCredentialsOpen(false);
        setCredentials({});
      } else {
        setError(data.error || 'Failed to update credentials');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDeleteSubProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sub-project?')) return;

    try {
      const response = await fetch(`/api/subprojects?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSubProjects(subProjects.filter(sp => sp.id !== id));
      } else {
        setError(data.error || 'Failed to delete sub-project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleStarSubProject = async (subProject: JavariSubProject) => {
    try {
      const response = await fetch(`/api/subprojects?id=${subProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: !subProject.starred }),
      });

      const data = await response.json();

      if (data.success) {
        setSubProjects(subProjects.map(sp => sp.id === subProject.id ? data.data : sp));
      }
    } catch (err) {
      console.error('Failed to star sub-project:', err);
    }
  };

  const toggleProjectExpansion = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      github_repo: '',
      vercel_project: '',
      parent_project_id: '',
    });
    setCurrentSubProject(null);
  };

  const openEditDialog = (subProject: JavariSubProject) => {
    setCurrentSubProject(subProject);
    setFormData({
      name: subProject.name,
      display_name: subProject.display_name || '',
      description: subProject.description || '',
      github_repo: subProject.github_repo || '',
      vercel_project: subProject.vercel_project || '',
      parent_project_id: subProject.parent_project_id,
    });
    setIsEditOpen(true);
  };

  const openCredentialsDialog = (subProject: JavariSubProject) => {
    setCurrentSubProject(subProject);
    setCredentials(subProject.credential_overrides || {});
    setIsCredentialsOpen(true);
  };

  const getSubProjectsByParent = (parentId: string): JavariSubProject[] => {
    return subProjects.filter(sp => sp.parent_project_id === parentId);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sub-Projects</h2>
          <p className="text-muted-foreground">
            Manage project hierarchies and credential overrides
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Create Sub-Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Sub-Project</DialogTitle>
              <DialogDescription>
                Create a sub-project under an existing project with optional credential overrides.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="parent_project">Parent Project *</Label>
                <select
                  id="parent_project"
                  className="w-full mt-1 p-2 border rounded-md"
                  value={formData.parent_project_id}
                  onChange={(e) => setFormData({ ...formData, parent_project_id: e.target.value })}
                  required
                >
                  <option value="">Select a parent project...</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="name">Name * (slug format)</Label>
                <Input
                  id="name"
                  placeholder="my-subproject"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  placeholder="My Sub-Project"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What does this sub-project do?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="github_repo">GitHub Repository</Label>
                <Input
                  id="github_repo"
                  placeholder="org/repo-name"
                  value={formData.github_repo}
                  onChange={(e) => setFormData({ ...formData, github_repo: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="vercel_project">Vercel Project ID</Label>
                <Input
                  id="vercel_project"
                  placeholder="prj_xxxxx"
                  value={formData.vercel_project}
                  onChange={(e) => setFormData({ ...formData, vercel_project: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSubProject} disabled={!formData.name || !formData.parent_project_id}>
                Create Sub-Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Project Hierarchy View */}
      <div className="space-y-4">
        {projects.map(project => {
          const projectSubProjects = getSubProjectsByParent(project.id);
          const isExpanded = expandedProjects.has(project.id);

          return (
            <Card key={project.id}>
              <CardHeader
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => toggleProjectExpansion(project.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {projectSubProjects.length > 0 ? (
                      isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )
                    ) : (
                      <Box className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription>
                        {projectSubProjects.length} sub-project{projectSubProjects.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={project.health_score >= 80 ? 'default' : 'destructive'}>
                    Health: {project.health_score}%
                  </Badge>
                </div>
              </CardHeader>

              {isExpanded && projectSubProjects.length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-3 pl-8 border-l-2 border-muted ml-2">
                    {projectSubProjects.map(subProject => (
                      <div
                        key={subProject.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <GitBranch className="w-5 h-5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">
                                {subProject.display_name || subProject.name}
                              </h4>
                              {subProject.starred && (
                                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              )}
                            </div>
                            {subProject.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {subProject.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              {subProject.github_repo && (
                                <a
                                  href={`https://github.com/${subProject.github_repo}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Github className="w-3 h-3" />
                                  {subProject.github_repo}
                                </a>
                              )}
                              {subProject.vercel_project && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <ExternalLink className="w-3 h-3" />
                                  {subProject.vercel_project}
                                </span>
                              )}
                              {Object.keys(subProject.credential_overrides || {}).length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Key className="w-3 h-3 mr-1" />
                                  {Object.keys(subProject.credential_overrides || {}).length} credentials
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${getHealthColor(subProject.health_score)}`}>
                              {subProject.health_score}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStarSubProject(subProject)}
                          >
                            <Star
                              className={`w-4 h-4 ${subProject.starred ? 'fill-yellow-400 text-yellow-400' : ''}`}
                            />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openCredentialsDialog(subProject)}
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(subProject)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSubProject(subProject.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {projects.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No projects found. Create a project first to add sub-projects.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Sub-Project</DialogTitle>
            <DialogDescription>
              Update sub-project details and configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_name">Name *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_display_name">Display Name</Label>
              <Input
                id="edit_display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit_github_repo">GitHub Repository</Label>
              <Input
                id="edit_github_repo"
                value={formData.github_repo}
                onChange={(e) => setFormData({ ...formData, github_repo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_vercel_project">Vercel Project ID</Label>
              <Input
                id="edit_vercel_project"
                value={formData.vercel_project}
                onChange={(e) => setFormData({ ...formData, vercel_project: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubProject}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={isCredentialsOpen} onOpenChange={setIsCredentialsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Credentials</DialogTitle>
            <DialogDescription>
              Override project-level credentials for this sub-project. Leave empty to use parent project credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cred_github">GitHub Token</Label>
              <Input
                id="cred_github"
                type="password"
                placeholder="ghp_xxxxx"
                value={credentials.github_token || ''}
                onChange={(e) => setCredentials({ ...credentials, github_token: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cred_vercel">Vercel Token</Label>
              <Input
                id="cred_vercel"
                type="password"
                placeholder="xxxxx"
                value={credentials.vercel_token || ''}
                onChange={(e) => setCredentials({ ...credentials, vercel_token: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cred_openai">OpenAI API Key</Label>
              <Input
                id="cred_openai"
                type="password"
                placeholder="sk-xxxxx"
                value={credentials.openai_key || ''}
                onChange={(e) => setCredentials({ ...credentials, openai_key: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cred_anthropic">Anthropic API Key</Label>
              <Input
                id="cred_anthropic"
                type="password"
                placeholder="sk-ant-xxxxx"
                value={credentials.anthropic_key || ''}
                onChange={(e) => setCredentials({ ...credentials, anthropic_key: e.target.value })}
              />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Credentials are encrypted at rest using AES-256. Only enter credentials if this sub-project needs different access than its parent project.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCredentialsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCredentials}>Save Credentials</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
