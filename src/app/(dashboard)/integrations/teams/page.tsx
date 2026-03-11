'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { 
  Settings, 
  Bot, 
  FileText, 
  Mic, 
  Users, 
  Activity, 
  Shield, 
  BarChart3,
  MessageSquare,
  Video,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  Copy,
  Download,
  Share,
  AlertTriangle,
  Info
} from 'lucide-react';

interface TeamsIntegration {
  id: string;
  teamId: string;
  teamName: string;
  tenantId: string;
  appId: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSync: string;
  permissions: string[];
  botEnabled: boolean;
  transcriptionEnabled: boolean;
  fileProcessingEnabled: boolean;
  webhookUrl: string;
  createdAt: string;
}

interface TeamsBotCommand {
  id: string;
  command: string;
  description: string;
  enabled: boolean;
  responseType: 'text' | 'adaptive_card' | 'task_module';
  parameters: Record<string, any>;
}

interface TeamsChannel {
  id: string;
  name: string;
  description?: string;
  type: 'standard' | 'private' | 'shared';
  memberCount: number;
  selected: boolean;
}

interface TeamsMeeting {
  id: string;
  subject: string;
  organizer: string;
  startTime: string;
  endTime: string;
  transcriptionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  recordingUrl?: string;
  transcriptUrl?: string;
  insights?: {
    sentiment: number;
    topics: string[];
    actionItems: string[];
    participants: number;
  };
}

interface TeamsActivity {
  id: string;
  type: 'message' | 'file_upload' | 'meeting' | 'command' | 'webhook';
  timestamp: string;
  user: string;
  channel: string;
  description: string;
  status: 'success' | 'error' | 'pending';
  metadata: Record<string, any>;
}

interface TeamsAnalytics {
  totalMessages: number;
  processedFiles: number;
  transcribedMeetings: number;
  activeChannels: number;
  botInteractions: number;
  averageResponseTime: number;
  userEngagement: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  topChannels: Array<{
    name: string;
    activity: number;
  }>;
}

const defaultBotCommands: TeamsBotCommand[] = [
  {
    id: '1',
    command: '/analyze',
    description: 'Analyze audio file or voice message',
    enabled: true,
    responseType: 'adaptive_card',
    parameters: { requiresFile: true, supportedFormats: ['mp3', 'wav', 'm4a'] }
  },
  {
    id: '2',
    command: '/transcribe',
    description: 'Transcribe meeting recording',
    enabled: true,
    responseType: 'task_module',
    parameters: { requiresRecording: true, outputFormat: 'detailed' }
  },
  {
    id: '3',
    command: '/insights',
    description: 'Get conversation insights',
    enabled: true,
    responseType: 'adaptive_card',
    parameters: { includeMetrics: true, includeSentiment: true }
  },
  {
    id: '4',
    command: '/help',
    description: 'Show available commands',
    enabled: true,
    responseType: 'text',
    parameters: { showExamples: true }
  }
];

/**
 * Microsoft Teams Integration Hub component
 * Provides comprehensive Teams integration with CR AudioViz AI capabilities
 */
export default function TeamsIntegrationPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [integration, setIntegration] = useState<TeamsIntegration | null>(null);
  const [botCommands, setBotCommands] = useState<TeamsBotCommand[]>(defaultBotCommands);
  const [channels, setChannels] = useState<TeamsChannel[]>([]);
  const [meetings, setMeetings] = useState<TeamsMeeting[]>([]);
  const [activities, setActivities] = useState<TeamsActivity[]>([]);
  const [analytics, setAnalytics] = useState<TeamsAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionStep, setConnectionStep] = useState<number>(0);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [transcriptionSettings, setTranscriptionSettings] = useState({
    autoTranscribe: true,
    includeTimestamps: true,
    generateInsights: true,
    notifyChannel: true,
    language: 'en-US'
  });

  /**
   * Initialize component data
   */
  useEffect(() => {
    initializeTeamsIntegration();
  }, []);

  /**
   * Load Teams integration data
   */
  const initializeTeamsIntegration = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Load existing integration
      const integrationResponse = await fetch('/api/integrations/teams');
      if (integrationResponse.ok) {
        const integrationData = await integrationResponse.json();
        setIntegration(integrationData);
        
        if (integrationData?.status === 'connected') {
          await Promise.all([
            loadTeamsChannels(),
            loadTeamsMeetings(),
            loadTeamsActivities(),
            loadTeamsAnalytics()
          ]);
        }
      }

      // Generate webhook URL
      setWebhookUrl(`${window.location.origin}/api/webhooks/teams/${crypto.randomUUID()}`);

    } catch (error) {
      console.error('Failed to initialize Teams integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Teams integration data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load Teams channels
   */
  const loadTeamsChannels = async (): Promise<void> => {
    try {
      const response = await fetch('/api/integrations/teams/channels');
      if (response.ok) {
        const channelsData = await response.json();
        setChannels(channelsData);
      }
    } catch (error) {
      console.error('Failed to load Teams channels:', error);
    }
  };

  /**
   * Load Teams meetings
   */
  const loadTeamsMeetings = async (): Promise<void> => {
    try {
      const response = await fetch('/api/integrations/teams/meetings');
      if (response.ok) {
        const meetingsData = await response.json();
        setMeetings(meetingsData);
      }
    } catch (error) {
      console.error('Failed to load Teams meetings:', error);
    }
  };

  /**
   * Load Teams activities
   */
  const loadTeamsActivities = async (): Promise<void> => {
    try {
      const response = await fetch('/api/integrations/teams/activities');
      if (response.ok) {
        const activitiesData = await response.json();
        setActivities(activitiesData);
      }
    } catch (error) {
      console.error('Failed to load Teams activities:', error);
    }
  };

  /**
   * Load Teams analytics
   */
  const loadTeamsAnalytics = async (): Promise<void> => {
    try {
      const response = await fetch('/api/integrations/teams/analytics');
      if (response.ok) {
        const analyticsData = await response.json();
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error('Failed to load Teams analytics:', error);
    }
  };

  /**
   * Start Teams connection process
   */
  const handleConnectTeams = useCallback(async (): Promise<void> => {
    try {
      setConnectionStep(1);
      
      // Redirect to Microsoft OAuth
      const authUrl = `/api/integrations/teams/auth?redirect_uri=${encodeURIComponent(window.location.href)}`;
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('Failed to connect Teams:', error);
      toast({
        title: 'Connection Failed',
        description: 'Unable to connect to Microsoft Teams',
        variant: 'destructive'
      });
      setConnectionStep(0);
    }
  }, []);

  /**
   * Disconnect Teams integration
   */
  const handleDisconnectTeams = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/integrations/teams', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setIntegration(null);
        setChannels([]);
        setMeetings([]);
        setActivities([]);
        setAnalytics(null);
        
        toast({
          title: 'Disconnected',
          description: 'Teams integration has been disconnected',
        });
      }
    } catch (error) {
      console.error('Failed to disconnect Teams:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect Teams integration',
        variant: 'destructive'
      });
    }
  }, []);

  /**
   * Update bot command configuration
   */
  const handleUpdateBotCommand = useCallback(async (commandId: string, updates: Partial<TeamsBotCommand>): Promise<void> => {
    try {
      setBotCommands(prev => 
        prev.map(cmd => cmd.id === commandId ? { ...cmd, ...updates } : cmd)
      );

      const response = await fetch(`/api/integrations/teams/bot/commands/${commandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update bot command');

      toast({
        title: 'Updated',
        description: 'Bot command configuration updated',
      });
    } catch (error) {
      console.error('Failed to update bot command:', error);
      toast({
        title: 'Error',
        description: 'Failed to update bot command',
        variant: 'destructive'
      });
    }
  }, []);

  /**
   * Toggle channel selection
   */
  const handleToggleChannel = useCallback((channelId: string): void => {
    setSelectedChannels(prev => {
      const updated = new Set(prev);
      if (updated.has(channelId)) {
        updated.delete(channelId);
      } else {
        updated.add(channelId);
      }
      return updated;
    });
  }, []);

  /**
   * Save channel selections
   */
  const handleSaveChannelSelections = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/integrations/teams/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedChannels: Array.from(selectedChannels) })
      });

      if (!response.ok) throw new Error('Failed to save channel selections');

      toast({
        title: 'Saved',
        description: 'Channel selections have been saved',
      });
    } catch (error) {
      console.error('Failed to save channel selections:', error);
      toast({
        title: 'Error',
        description: 'Failed to save channel selections',
        variant: 'destructive'
      });
    }
  }, [selectedChannels]);

  /**
   * Start meeting transcription
   */
  const handleStartTranscription = useCallback(async (meetingId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/integrations/teams/meetings/${meetingId}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transcriptionSettings)
      });

      if (!response.ok) throw new Error('Failed to start transcription');

      setMeetings(prev =>
        prev.map(meeting =>
          meeting.id === meetingId
            ? { ...meeting, transcriptionStatus: 'processing' }
            : meeting
        )
      );

      toast({
        title: 'Started',
        description: 'Meeting transcription has started',
      });
    } catch (error) {
      console.error('Failed to start transcription:', error);
      toast({
        title: 'Error',
        description: 'Failed to start meeting transcription',
        variant: 'destructive'
      });
    }
  }, [transcriptionSettings]);

  /**
   * Copy webhook URL to clipboard
   */
  const handleCopyWebhookUrl = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast({
        title: 'Copied',
        description: 'Webhook URL copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy webhook URL',
        variant: 'destructive'
      });
    }
  }, [webhookUrl]);

  /**
   * Format activity timestamp
   */
  const formatActivityTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected': case 'completed': case 'success': return 'bg-green-500';
      case 'processing': case 'pending': return 'bg-yellow-500';
      case 'error': case 'failed': return 'bg-red-500';
      case 'disconnected': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Microsoft Teams Integration</h1>
          <p className="text-muted-foreground">
            Embed CR AudioViz AI capabilities directly into your Teams workflow
          </p>
        </div>
        
        {integration?.status === 'connected' ? (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        ) : (
          <Button onClick={handleConnectTeams} className="bg-purple-600 hover:bg-purple-700">
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect Teams
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="bot" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Bot Commands
          </TabsTrigger>
          <TabsTrigger value="transcription" className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Transcription
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {integration?.status === 'connected' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.activeChannels || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Bot Interactions</CardTitle>
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.botInteractions || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Transcribed Meetings</CardTitle>
                    <Video className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.transcribedMeetings || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Processed Files</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.processedFiles || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Latest Teams integration events</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {activities.map((activity) => (
                          <div key={activity.id} className="flex items-center gap-3 p-2 rounded border">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(activity.status)}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{activity.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {activity.user} • {activity.channel} • {formatActivityTimestamp(activity.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Meetings</CardTitle>
                    <CardDescription>Meetings with transcription status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {meetings.slice(0, 5).map((meeting) => (
                          <div key={meeting.id} className="flex items-center justify-between p-2 rounded border">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{meeting.subject}</p>
                              <p className="text-xs text-muted-foreground">
                                {meeting.organizer} • {new Date(meeting.startTime).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={meeting.transcriptionStatus === 'completed' ? 'default' : 'secondary'}>
                              {meeting.transcriptionStatus}
                            </Badge>
                          </div>
                        ))}
                      </div>