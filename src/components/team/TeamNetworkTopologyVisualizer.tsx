```tsx
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line, Sphere, Box } from '@react-three/drei';
import { Vector3, Color, BufferGeometry, Float32BufferAttribute } from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Network,
  Users,
  MessageCircle,
  GitBranch,
  Eye,
  EyeOff,
  Download,
  Settings,
  Maximize2,
  Filter,
  BarChart3,
  Layers,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

// Types
interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar?: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  skills: string[];
  workload: number;
  position?: { x: number; y: number; z: number };
}

interface Communication {
  id: string;
  fromId: string;
  toId: string;
  type: 'message' | 'meeting' | 'task' | 'review';
  frequency: number;
  lastActivity: Date;
  strength: number;
}

interface WorkflowDependency {
  id: string;
  fromId: string;
  toId: string;
  type: 'blocks' | 'requires' | 'informs' | 'collaborates';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'pending' | 'completed';
}

interface NetworkNode {
  id: string;
  member: TeamMember;
  x: number;
  y: number;
  z: number;
  fx?: number;
  fy?: number;
  fz?: number;
  connections: number;
  centrality: number;
}

interface NetworkEdge {
  source: string;
  target: string;
  communication?: Communication;
  dependency?: WorkflowDependency;
  strength: number;
  type: 'communication' | 'dependency';
}

interface ViewSettings {
  layout: '3d' | 'hierarchical' | 'circular' | 'force';
  showCommunication: boolean;
  showDependencies: boolean;
  showLabels: boolean;
  enablePhysics: boolean;
  nodeSize: number;
  edgeOpacity: number;
}

interface FilterSettings {
  departments: string[];
  roles: string[];
  communicationTypes: string[];
  dependencyTypes: string[];
  minStrength: number;
  showOnlineOnly: boolean;
}

interface NetworkMetrics {
  totalNodes: number;
  totalEdges: number;
  density: number;
  avgClustering: number;
  diameter: number;
  centralityScores: Record<string, number>;
}

interface TeamNetworkTopologyVisualizerProps {
  teamMembers: TeamMember[];
  communications: Communication[];
  dependencies: WorkflowDependency[];
  onMemberSelect?: (member: TeamMember) => void;
  onCommunicationSelect?: (communication: Communication) => void;
  onDependencySelect?: (dependency: WorkflowDependency) => void;
  className?: string;
  realTimeUpdates?: boolean;
  enableExport?: boolean;
  maxNodes?: number;
}

// 3D Node Component
const NetworkNode3D: React.FC<{
  node: NetworkNode;
  isSelected: boolean;
  isHighlighted: boolean;
  viewSettings: ViewSettings;
  onClick: () => void;
}> = ({ node, isSelected, isHighlighted, viewSettings, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current && viewSettings.enablePhysics) {
      meshRef.current.position.set(node.x, node.y, node.z);
    }
  });

  const getNodeColor = useCallback(() => {
    if (isSelected) return '#3b82f6';
    if (isHighlighted) return '#10b981';
    
    switch (node.member.status) {
      case 'online': return '#22c55e';
      case 'busy': return '#f59e0b';
      case 'away': return '#6b7280';
      default: return '#ef4444';
    }
  }, [isSelected, isHighlighted, node.member.status]);

  const nodeSize = useMemo(() => {
    const baseSize = viewSettings.nodeSize * 0.01;
    const scaleFactor = 1 + (node.centrality * 0.5);
    return baseSize * scaleFactor;
  }, [viewSettings.nodeSize, node.centrality]);

  return (
    <group position={[node.x, node.y, node.z]}>
      <Sphere
        ref={meshRef}
        args={[nodeSize, 16, 16]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={getNodeColor()}
          transparent
          opacity={hovered ? 0.9 : 0.8}
          emissive={hovered ? new Color(getNodeColor()).multiplyScalar(0.2) : new Color(0)}
        />
      </Sphere>
      
      {(viewSettings.showLabels || hovered) && (
        <Text
          position={[0, nodeSize + 0.1, 0]}
          fontSize={0.08}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {node.member.name}
        </Text>
      )}
      
      {node.member.workload > 80 && (
        <Box args={[0.02, 0.02, 0.02]} position={[nodeSize + 0.05, nodeSize + 0.05, 0]}>
          <meshStandardMaterial color="#ef4444" />
        </Box>
      )}
    </group>
  );
};

// 3D Edge Component
const NetworkEdge3D: React.FC<{
  edge: NetworkEdge;
  nodes: NetworkNode[];
  viewSettings: ViewSettings;
}> = ({ edge, nodes, viewSettings }) => {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  if (!sourceNode || !targetNode) return null;

  const points = useMemo(() => [
    new Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
    new Vector3(targetNode.x, targetNode.y, targetNode.z)
  ], [sourceNode, targetNode]);

  const getEdgeColor = useCallback(() => {
    if (edge.type === 'communication') {
      return edge.communication?.type === 'meeting' ? '#8b5cf6' :
             edge.communication?.type === 'task' ? '#3b82f6' :
             edge.communication?.type === 'review' ? '#f59e0b' : '#10b981';
    } else {
      return edge.dependency?.priority === 'critical' ? '#ef4444' :
             edge.dependency?.priority === 'high' ? '#f59e0b' :
             edge.dependency?.priority === 'medium' ? '#3b82f6' : '#6b7280';
    }
  }, [edge]);

  const lineWidth = useMemo(() => {
    return Math.max(0.001, edge.strength * 0.005);
  }, [edge.strength]);

  return (
    <Line
      points={points}
      color={getEdgeColor()}
      lineWidth={lineWidth}
      transparent
      opacity={viewSettings.edgeOpacity / 100}
      dashed={edge.type === 'dependency'}
      dashSize={edge.type === 'dependency' ? 0.02 : undefined}
      gapSize={edge.type === 'dependency' ? 0.01 : undefined}
    />
  );
};

// Network Visualization Scene
const NetworkScene: React.FC<{
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedNodeId: string | null;
  viewSettings: ViewSettings;
  onNodeClick: (node: NetworkNode) => void;
}> = ({ nodes, edges, selectedNodeId, viewSettings, onNodeClick }) => {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  const highlightedNodes = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    
    const connected = new Set<string>();
    edges.forEach(edge => {
      if (edge.source === selectedNodeId) connected.add(edge.target);
      if (edge.target === selectedNodeId) connected.add(edge.source);
    });
    
    return connected;
  }, [selectedNodeId, edges]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />
      
      {nodes.map(node => (
        <NetworkNode3D
          key={node.id}
          node={node}
          isSelected={node.id === selectedNodeId}
          isHighlighted={highlightedNodes.has(node.id)}
          viewSettings={viewSettings}
          onClick={() => onNodeClick(node)}
        />
      ))}
      
      {edges.map((edge, index) => (
        <NetworkEdge3D
          key={`${edge.source}-${edge.target}-${index}`}
          edge={edge}
          nodes={nodes}
          viewSettings={viewSettings}
        />
      ))}
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxDistance={20}
        minDistance={1}
      />
    </>
  );
};

// Controls Panel
const NetworkControls: React.FC<{
  viewSettings: ViewSettings;
  onViewSettingsChange: (settings: Partial<ViewSettings>) => void;
  onLayoutChange: (layout: ViewSettings['layout']) => void;
  onReset: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}> = ({ 
  viewSettings, 
  onViewSettingsChange, 
  onLayoutChange, 
  onReset,
  isPlaying,
  onTogglePlay
}) => {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Network Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Layout Type</Label>
          <Select 
            value={viewSettings.layout} 
            onValueChange={onLayoutChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3d">3D Force-Directed</SelectItem>
              <SelectItem value="hierarchical">Hierarchical</SelectItem>
              <SelectItem value="circular">Circular</SelectItem>
              <SelectItem value="force">2D Force</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Show Communication</Label>
            <Switch
              checked={viewSettings.showCommunication}
              onCheckedChange={(checked) => 
                onViewSettingsChange({ showCommunication: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Show Dependencies</Label>
            <Switch
              checked={viewSettings.showDependencies}
              onCheckedChange={(checked) => 
                onViewSettingsChange({ showDependencies: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Show Labels</Label>
            <Switch
              checked={viewSettings.showLabels}
              onCheckedChange={(checked) => 
                onViewSettingsChange({ showLabels: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Enable Physics</Label>
            <Switch
              checked={viewSettings.enablePhysics}
              onCheckedChange={(checked) => 
                onViewSettingsChange({ enablePhysics: checked })
              }
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Node Size: {viewSettings.nodeSize}%</Label>
            <Slider
              value={[viewSettings.nodeSize]}
              onValueChange={([value]) => onViewSettingsChange({ nodeSize: value })}
              min={50}
              max={200}
              step={10}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Edge Opacity: {viewSettings.edgeOpacity}%</Label>
            <Slider
              value={[viewSettings.edgeOpacity]}
              onValueChange={([value]) => onViewSettingsChange({ edgeOpacity: value })}
              min={10}
              max={100}
              step={10}
            />
          </div>
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePlay}
            className="flex-1"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Filters Panel
const TopologyFilters: React.FC<{
  filters: FilterSettings;
  onFiltersChange: (filters: Partial<FilterSettings>) => void;
  availableDepartments: string[];
  availableRoles: string[];
}> = ({ filters, onFiltersChange, availableDepartments, availableRoles }) => {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Departments</Label>
          <div className="flex flex-wrap gap-1">
            {availableDepartments.map(dept => (
              <Badge
                key={dept}
                variant={filters.departments.includes(dept) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => {
                  const newDepts = filters.departments.includes(dept)
                    ? filters.departments.filter(d => d !== dept)
                    : [...filters.departments, dept];
                  onFiltersChange({ departments: newDepts });
                }}
              >
                {dept}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Roles</Label>
          <div className="flex flex-wrap gap-1">
            {availableRoles.map(role => (
              <Badge
                key={role}
                variant={filters.roles.includes(role) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => {
                  const newRoles = filters.roles.includes(role)
                    ? filters.roles.filter(r => r !== role)
                    : [...filters.roles, role];
                  onFiltersChange({ roles: newRoles });
                }}
              >
                {role}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Min Connection Strength: {filters.minStrength}%</Label>
          <Slider
            value={[filters.minStrength]}
            onValueChange={([value]) => onFiltersChange({ minStrength: value })}
            min={0}
            max={100}
            step={5}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label>Online Members Only</Label>
          <Switch
            checked={filters.showOnlineOnly}
            onCheckedChange={(checked) => 
              onFiltersChange({ showOnlineOnly: checked })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Node Details Panel
const NodeDetailsPanel: React.FC<{
  node: NetworkNode | null;
  connections: NetworkEdge[];
  onClose: () => void;
}> = ({ node, connections, onClose }) => {
  if (!node) return null;

  const directConnections = connections.filter(
    edge => edge.source === node.id || edge.target === node.id
  );

  return (
    <Card className="w-80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Member Details
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {node.member.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold">{node.member.name}</h3>
            <p className="text-sm text-muted-foreground">{node.member.role}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Department:</span>
            <Badge variant="outline">{node.member.department}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Status:</span>
            <Badge 
              variant={node.member.status === 'online' ? 'default' : 'secondary'}
            >
              {node.member.status}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Workload:</span>
            <span className="text-sm font-medium">{node.member.workload}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Centrality:</span>
            <span className="text-sm font-medium">{node.centrality.toFixed(2)}</span>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-2">Skills</h4>
          <div className="flex flex-wrap gap-1">
            {node.member.skills.map(skill => (
              <Badge key={skill} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Connections ({directConnections.length})</h4>
          <ScrollArea className="h-32">
            <div className="space-y-1">
              {directConnections.slice(0, 10).map((edge, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    {edge.source === node.id ? `→ ${edge.target}` : `← ${edge.source}`}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {edge.strength.toFixed(1)}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

// Network Metrics Panel
const NetworkMetrics: React.FC<{
  metrics: NetworkMetrics;
  nodes: NetworkNode[];
}> = ({ metrics, nodes }) => {
  const topCentralNodes = useMemo(() => {
    return nodes
      .sort((a, b) => b.centrality - a.centrality)
      .slice(0, 5);
  }, [nodes]);

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Network Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Nodes</p>
            <p className="text-2xl font-bold">{metrics.totalNodes}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Edges</p