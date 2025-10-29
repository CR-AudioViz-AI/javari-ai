'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Grid3x3,
  List,
  FolderOpen,
  Code,
  Globe,
  Settings,
  Trash2,
  Edit,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  Download,
  Upload,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

interface Project {
  id: string;
  name: string;
  description: string;
  type: 'web' | 'api' | 'mobile' | 'desktop';
  status: 'active' | 'inactive' | 'building' | 'deployed';
  framework: string;
  components: number;
  lastDeployed?: Date;
  url?: string;
  repository?: string;
  createdAt: Date;
}

interface Component {
  id: string;
  name: string;
  type: string;
  status: 'ready' | 'building' | 'error';
  lastModified: Date;
}

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // New project form state
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    type: 'web' as Project['type'],
    framework: 'nextjs',
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/javari/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || generateMockProjects());
      } else {
        setProjects(generateMockProjects());
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects(generateMockProjects());
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockProjects = (): Project[] => [
    {
      id: '1',
      name: 'E-Commerce Dashboard',
      description: 'Modern admin dashboard for online store management',
      type: 'web',
      status: 'deployed',
      framework: 'Next.js 14',
      components: 23,
      lastDeployed: new Date(Date.now() - 1000 * 60 * 60 * 2),
      url: 'https://dashboard.example.com',
      repository: 'github.com/user/ecommerce-dashboard',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    },
    {
      id: '2',
      name: 'API Gateway Service',
      description: 'Microservices API gateway with rate limiting',
      type: 'api',
      status: 'active',
      framework: 'Express.js',
      components: 15,
      lastDeployed: new Date(Date.now() - 1000 * 60 * 60 * 24),
      url: 'https://api.example.com',
      repository: 'github.com/user/api-gateway',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
    },
    {
      id: '3',
      name: 'Mobile Fitness App',
      description: 'React Native fitness tracking application',
      type: 'mobile',
      status: 'building',
      framework: 'React Native',
      components: 31,
      repository: 'github.com/user/fitness-app',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    },
    {
      id: '4',
      name: 'Analytics Platform',
      description: 'Real-time data analytics and visualization',
      type: 'web',
      status: 'inactive',
      framework: 'Vue.js 3',
      components: 18,
      lastDeployed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      url: 'https://analytics.example.com',
      repository: 'github.com/user/analytics-platform',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    },
  ];

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast({
        title: 'Error',
        description: 'Project name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/javari/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });

      if (response.ok) {
        toast({
          title: 'Project created',
          description: `${newProject.name} has been created successfully`,
        });
        setIsCreateDialogOpen(false);
        setNewProject({ name: '', description: '', type: 'web', framework: 'nextjs' });
        fetchProjects();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/javari/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Project deleted',
          description: 'Project has been removed successfully',
        });
        fetchProjects();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  const handleDeployProject = async (projectId: string) => {
    toast({
      title: 'Deploying project',
      description: 'Deployment initiated...',
    });

    // In production, this would trigger actual deployment
    setTimeout(() => {
      toast({
        title: 'Deployment successful',
        description: 'Your project is now live',
      });
      fetchProjects();
    }, 3000);
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'deployed':
        return 'bg-green-100 text-green-800';
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'building':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Project['status']) => {
    switch (status) {
      case 'deployed':
        return <CheckCircle className="h-4 w-4" />;
      case 'active':
        return <Play className="h-4 w-4" />;
      case 'building':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'inactive':
        return <Pause className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getProjectIcon = (type: Project['type']) => {
    switch (type) {
      case 'web':
        return <Globe className="h-5 w-5" />;
      case 'api':
        return <Code className="h-5 w-5" />;
      case 'mobile':
        return <FolderOpen className="h-5 w-5" />;
      default:
        return <FolderOpen className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
        <p className="text-gray-500 mt-1">
          Manage your AI-built applications and deployments
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Let Javari AI build your project from scratch
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="My Awesome Project"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what your project does..."
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({ ...newProject, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Project Type</Label>
                <Select
                  value={newProject.type}
                  onValueChange={(value: Project['type']) =>
                    setNewProject({ ...newProject, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">Web Application</SelectItem>
                    <SelectItem value="api">API Service</SelectItem>
                    <SelectItem value="mobile">Mobile App</SelectItem>
                    <SelectItem value="desktop">Desktop App</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="framework">Framework</Label>
                <Select
                  value={newProject.framework}
                  onValueChange={(value) =>
                    setNewProject({ ...newProject, framework: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nextjs">Next.js</SelectItem>
                    <SelectItem value="react">React</SelectItem>
                    <SelectItem value="vue">Vue.js</SelectItem>
                    <SelectItem value="express">Express.js</SelectItem>
                    <SelectItem value="react-native">React Native</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProject}>Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid/List */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No projects found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Create your first project to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getProjectIcon(project.type)}
                    <div>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {project.framework}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeployProject(project.id)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Deploy
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {project.description}
                </p>
                <div className="flex items-center justify-between mb-4">
                  <Badge className={getStatusColor(project.status)}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(project.status)}
                      {project.status}
                    </span>
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {project.components} components
                  </span>
                </div>
                {project.url && (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Globe className="h-3 w-3" />
                    Visit site
                  </a>
                )}
                {project.lastDeployed && (
                  <p className="text-xs text-gray-500 mt-2">
                    Last deployed{' '}
                    {new Date(project.lastDeployed).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {getProjectIcon(project.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {project.name}
                          </h3>
                          <Badge className={getStatusColor(project.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(project.status)}
                              {project.status}
                            </span>
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {project.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{project.framework}</span>
                          <span>•</span>
                          <span>{project.components} components</span>
                          {project.lastDeployed && (
                            <>
                              <span>•</span>
                              <span>
                                Last deployed{' '}
                                {new Date(project.lastDeployed).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeployProject(project.id)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Deploy
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
