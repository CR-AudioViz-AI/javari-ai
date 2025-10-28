'use client';

import React, { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/javari/ChatInterface';
import { ChatHistory } from '@/components/javari/ChatHistory';
import { ProjectManager } from '@/components/javari/ProjectManager';
import SubProjectsManager from '@/components/javari/SubProjectsManager';
import { BuildHealthMonitor } from '@/components/javari/BuildHealthMonitor';
import WorkLogViewer from '@/components/javari/WorkLogViewer';
import ProjectAnalytics from '@/components/javari/ProjectAnalytics';
import SessionSummary from '@/components/javari/SessionSummary';
import { Settings } from '@/components/javari/Settings';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  MessageSquare,
  FolderKanban,
  HeartPulse,
  Settings as SettingsIcon,
  Menu,
  GitBranch,
  FileText,
  BarChart3,
  Plus,
  History,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  numeric_id: number;
  title: string;
  summary?: string;
  messages: Message[];
  status: 'active' | 'inactive' | 'archived';
  starred: boolean;
  continuation_depth: number;
  message_count: number;
  parent_id?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  numeric_id: number;
  name: string;
  description?: string;
  repository_url?: string;
  vercel_project_id?: string;
  health_score: number;
  status: string;
  starred: boolean;
  created_at: string;
}

export default function JavariDashboard() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
  const [userId] = useState('demo-user'); // TODO: Replace with actual auth
  const [activeTab, setActiveTab] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversationRefresh, setConversationRefresh] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProjects(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setSelectedProject(conversation.project_id);
    setActiveTab('chat');
  };

  const handleNewChat = () => {
    setSelectedConversation(null);
    setSelectedProject(undefined);
    setActiveTab('chat');
  };

  const handleCreateContinuation = (parentConversation: Conversation) => {
    // Create a new chat that continues from the parent
    setSelectedConversation({
      ...parentConversation,
      id: '', // New conversation will get an ID from the backend
      numeric_id: 0,
      parent_id: parentConversation.id,
      continuation_depth: parentConversation.continuation_depth + 1,
      message_count: 0,
      messages: [], // Start fresh but link to parent
      title: `${parentConversation.title} (continued)`,
    });
    setSelectedProject(parentConversation.project_id);
    setActiveTab('chat');
  };

  const handleConversationCreated = (conversationId: string) => {
    // Refresh the conversation list when a new one is created
    setConversationRefresh(prev => prev + 1);
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Chat History */}
      <div
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 border-r bg-card overflow-hidden flex flex-col`}
      >
        <div className="p-4 border-b bg-card/50 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Conversations</h2>
            </div>
            <Button size="sm" onClick={handleNewChat}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Project Filter */}
          {projects.length > 0 && (
            <select
              className="w-full p-2 text-sm border rounded-md bg-background"
              value={selectedProject || ''}
              onChange={(e) => handleProjectSelect(e.target.value || undefined)}
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Chat History Component */}
        <div className="flex-1 overflow-y-auto">
          <ChatHistory
            userId={userId}
            projectId={selectedProject}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            onCreateContinuation={handleCreateContinuation}
            currentConversationId={selectedConversation?.id}
            refreshTrigger={conversationRefresh}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <div className="h-16 border-b bg-card/50 backdrop-blur px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">J</span>
              </div>
              <div>
                <h1 className="font-bold text-lg">Javari AI</h1>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation 
                    ? `CONV-${selectedConversation.numeric_id}` 
                    : 'New Conversation'}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList>
              <TabsTrigger value="chat" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-2">
                <FolderKanban className="w-4 h-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger value="subprojects" className="gap-2">
                <GitBranch className="w-4 h-4" />
                Sub-Projects
              </TabsTrigger>
              <TabsTrigger value="health" className="gap-2">
                <HeartPulse className="w-4 h-4" />
                Build Health
              </TabsTrigger>
              <TabsTrigger value="worklog" className="gap-2">
                <FileText className="w-4 h-4" />
                Work Log
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-2">
                <Activity className="w-4 h-4" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <SettingsIcon className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} className="h-full">
            {/* Chat Tab */}
            <TabsContent value="chat" className="h-full m-0 p-0">
              {selectedConversation ? (
                <div className="h-full flex flex-col">
                  {/* Conversation Info Header */}
                  <div className="p-4 border-b bg-card/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-lg">{selectedConversation.title}</h2>
                        {selectedConversation.summary && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedConversation.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedConversation.parent_id && (
                          <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            <History className="w-3 h-3" />
                            Depth: {selectedConversation.continuation_depth}
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateContinuation(selectedConversation)}
                        >
                          <GitBranch className="w-4 h-4 mr-2" />
                          Continue
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Chat Interface */}
                  <div className="flex-1">
                    <ChatInterface
                      projectId={selectedConversation.project_id}
                      userId={userId}
                      conversationId={selectedConversation.id}
                      parentId={selectedConversation.parent_id}
                      initialMessages={selectedConversation.messages}
                      onConversationCreated={handleConversationCreated}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  <ChatInterface
                    projectId={selectedProject}
                    userId={userId}
                    onConversationCreated={handleConversationCreated}
                  />
                </div>
              )}
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects" className="h-full m-0">
              <div className="h-full overflow-y-auto p-6">
                <ProjectManager />
              </div>
            </TabsContent>

            {/* Sub-Projects Tab */}
            <TabsContent value="subprojects" className="h-full m-0">
              <div className="h-full overflow-y-auto p-6">
                <SubProjectsManager projects={projects} />
              </div>
            </TabsContent>

            {/* Build Health Tab */}
            <TabsContent value="health" className="h-full m-0">
              <div className="h-full overflow-y-auto p-6">
                <BuildHealthMonitor />
              </div>
            </TabsContent>

            {/* Settings Tab */}
            {/* Work Log Tab */}
            <TabsContent value="worklog" className="h-full m-0">
              <div className="h-full overflow-y-auto p-6">
                <WorkLogViewer />
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="h-full m-0">
              <div className="h-full overflow-y-auto p-6">
                <ProjectAnalytics projects={projects} />
              </div>
            </TabsContent>

            {/* Session Summary Tab */}
            <TabsContent value="summary" className="h-full m-0">
              <div className="h-full overflow-y-auto p-6">
                <SessionSummary 
                  conversationId={selectedConversation?.id}
                  projectId={selectedProject}
                />
              </div>
            </TabsContent>

            <TabsContent value="settings" className="h-full m-0">
              <div className="h-full overflow-y-auto p-6">
                <Settings />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
