```tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Html, OrbitControls } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import * as THREE from 'three';
import { createClient } from '@supabase/supabase-js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Activity,
  Zap,
  Network,
  Settings,
  Pause,
  Play,
  RefreshCw,
  Filter,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// Types and Interfaces
interface Agent {
  id: string;
  name: string;
  type: 'coordinator' | 'specialist' | 'support' | 'monitor';
  status: 'active' | 'idle' | 'busy' | 'error' | 'offline';
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  connections: string[];
  metrics: {
    cpu: number;
    memory: number;
    tasks: number;
    errors: number;
  };
  lastActivity: string;
}

interface CommunicationFlow {
  id: string;
  from: string;
  to: string;
  type: 'command' | 'data' | 'status' | 'error';
  intensity: number;
  latency: number;
  timestamp: string;
}

interface DependencyChain {
  id: string;
  source: string;
  target: string;
  type: 'required' | 'optional' | 'fallback';
  strength: number;
  status: 'healthy' | 'degraded' | 'broken';
}

interface NetworkMetrics {
  totalAgents: number;
  activeConnections: number;
  averageLatency: number;
  throughput: number;
  errorRate: number;
  networkHealth: number;
}

interface TeamNetworkTopologyProps {
  teamId: string;
  height?: number;
  showControls?: boolean;
  autoRotate?: boolean;
  enableInteraction?: boolean;
  onAgentSelect?: (agent: Agent) => void;
  onNetworkEvent?: (event: any) => void;
  className?: string;
}

// Network Node Component
const NetworkNode: React.FC<{
  agent: Agent;
  isSelected: boolean;
  onSelect: (agent: Agent) => void;
  showLabels: boolean;
}> = ({ agent, isSelected, onSelect, showLabels }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.lerp(
        new THREE.Vector3(agent.position.x, agent.position.y, agent.position.z),
        0.1
      );
      
      if (hovered || isSelected) {
        meshRef.current.scale.lerp(new THREE.Vector3(1.5, 1.5, 1.5), 0.2);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.2);
      }
    }
  });

  const getNodeColor = useCallback(() => {
    switch (agent.status) {
      case 'active': return '#10b981';
      case 'idle': return '#f59e0b';
      case 'busy': return '#3b82f6';
      case 'error': return '#ef4444';
      case 'offline': return '#6b7280';
      default: return '#8b5cf6';
    }
  }, [agent.status]);

  const getNodeSize = useCallback(() => {
    switch (agent.type) {
      case 'coordinator': return 1.2;
      case 'specialist': return 1.0;
      case 'support': return 0.8;
      case 'monitor': return 0.6;
      default: return 1.0;
    }
  }, [agent.type]);

  return (
    <group>
      <mesh
        ref={meshRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={() => onSelect(agent)}
        scale={getNodeSize()}
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial 
          color={getNodeColor()} 
          emissive={isSelected ? getNodeColor() : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      
      {showLabels && (
        <Text
          position={[0, 1, 0]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {agent.name}
        </Text>
      )}

      {(hovered || isSelected) && (
        <Html position={[1, 1, 0]} className="pointer-events-none">
          <div className="bg-background/90 backdrop-blur-sm border rounded-lg p-2 text-xs">
            <div className="font-semibold">{agent.name}</div>
            <div className="text-muted-foreground">{agent.type}</div>
            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
              {agent.status}
            </Badge>
          </div>
        </Html>
      )}
    </group>
  );
};

// Network Edge Component
const NetworkEdge: React.FC<{
  from: Agent;
  to: Agent;
  flow: CommunicationFlow;
  dependency?: DependencyChain;
  showFlow: boolean;
}> = ({ from, to, flow, dependency, showFlow }) => {
  const lineRef = useRef<THREE.BufferGeometry>(null);
  const [animationOffset, setAnimationOffset] = useState(0);

  useFrame((state, delta) => {
    if (showFlow && flow) {
      setAnimationOffset((prev) => (prev + delta * flow.intensity) % 1);
    }
  });

  const getEdgeColor = useCallback(() => {
    if (dependency) {
      switch (dependency.status) {
        case 'healthy': return '#10b981';
        case 'degraded': return '#f59e0b';
        case 'broken': return '#ef4444';
      }
    }
    
    switch (flow?.type) {
      case 'command': return '#3b82f6';
      case 'data': return '#8b5cf6';
      case 'status': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  }, [flow?.type, dependency?.status]);

  const points = useMemo(() => {
    return [
      new THREE.Vector3(from.position.x, from.position.y, from.position.z),
      new THREE.Vector3(to.position.x, to.position.y, to.position.z),
    ];
  }, [from.position, to.position]);

  return (
    <line>
      <bufferGeometry ref={lineRef}>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial 
        color={getEdgeColor()} 
        opacity={0.6} 
        transparent
        linewidth={dependency ? dependency.strength * 3 : 1}
      />
    </line>
  );
};

// Network Controls Component
const NetworkControls: React.FC<{
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  showFlows: boolean;
  onToggleFlows: () => void;
  forceStrength: number;
  onForceStrengthChange: (value: number) => void;
  layoutType: string;
  onLayoutTypeChange: (type: string) => void;
}> = ({
  isPlaying,
  onPlayPause,
  onReset,
  showLabels,
  onToggleLabels,
  showFlows,
  onToggleFlows,
  forceStrength,
  onForceStrengthChange,
  layoutType,
  onLayoutTypeChange,
}) => {
  return (
    <Card className="absolute top-4 left-4 z-10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Network className="h-4 w-4" />
          Network Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            aria-label="Reset network"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm">Show Labels</label>
            <Switch checked={showLabels} onCheckedChange={onToggleLabels} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Show Flows</label>
            <Switch checked={showFlows} onCheckedChange={onToggleFlows} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm">Force Strength</label>
          <Slider
            value={[forceStrength]}
            onValueChange={(values) => onForceStrengthChange(values[0])}
            min={0.1}
            max={2}
            step={0.1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm">Layout</label>
          <Select value={layoutType} onValueChange={onLayoutTypeChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="force">Force Directed</SelectItem>
              <SelectItem value="hierarchical">Hierarchical</SelectItem>
              <SelectItem value="circular">Circular</SelectItem>
              <SelectItem value="grid">Grid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

// Agent Info Panel Component
const AgentInfoPanel: React.FC<{
  agent: Agent | null;
  onClose: () => void;
}> = ({ agent, onClose }) => {
  if (!agent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="absolute top-4 right-4 z-10"
    >
      <Card className="w-80">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{agent.name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="flex items-center gap-2">
            <Badge variant="outline">{agent.type}</Badge>
            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
              {agent.status}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="metrics" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="connections">Connections</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="metrics" className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">CPU Usage</span>
                <span className="text-sm font-mono">{agent.metrics.cpu}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Memory</span>
                <span className="text-sm font-mono">{agent.metrics.memory}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Active Tasks</span>
                <span className="text-sm font-mono">{agent.metrics.tasks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Errors</span>
                <span className="text-sm font-mono text-destructive">
                  {agent.metrics.errors}
                </span>
              </div>
            </TabsContent>
            <TabsContent value="connections" className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Connected to {agent.connections.length} agents:
              </div>
              {agent.connections.map((connectionId) => (
                <div key={connectionId} className="text-sm">
                  {connectionId}
                </div>
              ))}
            </TabsContent>
            <TabsContent value="activity" className="space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Last Activity:</span>
                <br />
                {new Date(agent.lastActivity).toLocaleString()}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Network Metrics Component
const NetworkMetrics: React.FC<{
  metrics: NetworkMetrics;
}> = ({ metrics }) => {
  return (
    <Card className="absolute bottom-4 left-4 z-10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Network Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Agents</div>
          <div className="font-mono">{metrics.totalAgents}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Connections</div>
          <div className="font-mono">{metrics.activeConnections}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Latency</div>
          <div className="font-mono">{metrics.averageLatency}ms</div>
        </div>
        <div>
          <div className="text-muted-foreground">Throughput</div>
          <div className="font-mono">{metrics.throughput}/s</div>
        </div>
        <div>
          <div className="text-muted-foreground">Error Rate</div>
          <div className="font-mono text-destructive">{metrics.errorRate}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">Health</div>
          <div className={`font-mono ${metrics.networkHealth > 80 ? 'text-green-500' : 
            metrics.networkHealth > 50 ? 'text-yellow-500' : 'text-red-500'}`}>
            {metrics.networkHealth}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Component
const TeamNetworkTopology: React.FC<TeamNetworkTopologyProps> = ({
  teamId,
  height = 600,
  showControls = true,
  autoRotate = false,
  enableInteraction = true,
  onAgentSelect,
  onNetworkEvent,
  className = '',
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [communicationFlows, setCommunicationFlows] = useState<CommunicationFlow[]>([]);
  const [dependencies, setDependencies] = useState<DependencyChain[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showFlows, setShowFlows] = useState(true);
  const [forceStrength, setForceStrength] = useState(1);
  const [layoutType, setLayoutType] = useState('force');
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics>({
    totalAgents: 0,
    activeConnections: 0,
    averageLatency: 0,
    throughput: 0,
    errorRate: 0,
    networkHealth: 100,
  });

  const simulationRef = useRef<any>(null);
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  // Initialize force simulation
  useEffect(() => {
    if (!isPlaying) return;

    simulationRef.current = forceSimulation()
      .force('link', forceLink().id((d: any) => d.id))
      .force('charge', forceManyBody().strength(-300 * forceStrength))
      .force('center', forceCenter(0, 0))
      .force('collision', forceCollide().radius(1));

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [isPlaying, forceStrength]);

  // Update simulation with agents
  useEffect(() => {
    if (simulationRef.current && agents.length > 0) {
      const links = dependencies.map(dep => ({
        source: dep.source,
        target: dep.target,
        strength: dep.strength,
      }));

      simulationRef.current
        .nodes(agents)
        .force('link').links(links);

      simulationRef.current.alpha(1).restart();
    }
  }, [agents, dependencies]);

  // Load initial data and set up real-time subscriptions
  useEffect(() => {
    loadNetworkData();
    setupRealtimeSubscriptions();

    return () => {
      // Cleanup subscriptions
    };
  }, [teamId]);

  const loadNetworkData = async () => {
    try {
      // Load agents
      const { data: agentsData } = await supabaseClient
        .from('team_agents')
        .select('*')
        .eq('team_id', teamId);

      // Load dependencies
      const { data: depsData } = await supabaseClient
        .from('agent_dependencies')
        .select('*')
        .eq('team_id', teamId);

      // Load recent communications
      const { data: commsData } = await supabaseClient
        .from('team_communications')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (agentsData) {
        const processedAgents: Agent[] = agentsData.map(agent => ({
          ...agent,
          position: { 
            x: Math.random() * 10 - 5, 
            y: Math.random() * 10 - 5, 
            z: Math.random() * 10 - 5 
          },
          velocity: { x: 0, y: 0, z: 0 },
        }));
        setAgents(processedAgents);
      }

      if (depsData) {
        setDependencies(depsData);
      }

      if (commsData) {
        setCommunicationFlows(commsData);
      }

      updateNetworkMetrics();
    } catch (error) {
      console.error('Error loading network data:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Agent status updates
    const agentSubscription = supabaseClient
      .channel(`team_agents_${teamId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'team_agents' },
        (payload) => {
          handleAgentUpdate(payload);
        }
      )
      .subscribe();

    // Communication events
    const commSubscription = supabaseClient
      .channel(`team_communications_${teamId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_communications' },
        (payload) => {
          handleCommunicationEvent(payload);
        }
      )
      .subscribe();
  };

  const handleAgentUpdate = (payload: any) => {
    setAgents(prev => 
      prev.map(agent => 
        agent.id === payload.new.id ? { ...agent, ...payload.new } : agent
      )
    );
    updateNetworkMetrics();
    onNetworkEvent?.({ type: 'agent_