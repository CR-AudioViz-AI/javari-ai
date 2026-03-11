```tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ZoomIn, 
  ZoomOut, 
  Move, 
  Download, 
  RefreshCw,
  Play,
  Pause,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

// Types
interface WorkflowNode {
  id: string;
  type: 'agent' | 'process' | 'decision' | 'input' | 'output';
  name: string;
  description?: string;
  status: 'active' | 'idle' | 'error' | 'pending';
  position?: { x: number; y: number };
  metadata?: Record<string, any>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: 'data' | 'control' | 'feedback';
  label?: string;
  condition?: string;
  weight?: number;
}

interface WorkflowData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: {
    name: string;
    description: string;
    version: string;
  };
}

interface TeamWorkflowDiagramProps {
  workflowData: WorkflowData;
  onNodeClick?: (node: WorkflowNode) => void;
  onEdgeClick?: (edge: WorkflowEdge) => void;
  onNodePositionChange?: (nodeId: string, position: { x: number; y: number }) => void;
  isEditable?: boolean;
  showMiniMap?: boolean;
  autoLayout?: boolean;
  className?: string;
}

// Node component
const WorkflowNodeComponent: React.FC<{
  node: WorkflowNode;
  position: { x: number; y: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}> = ({ node, position, onMouseEnter, onMouseLeave, onClick }) => {
  const getNodeColor = (type: string, status: string) => {
    const baseColors = {
      agent: '#3B82F6',
      process: '#10B981',
      decision: '#F59E0B',
      input: '#8B5CF6',
      output: '#EF4444'
    };
    
    const statusOpacity = {
      active: 1,
      idle: 0.7,
      error: 0.9,
      pending: 0.8
    };

    return {
      fill: baseColors[type as keyof typeof baseColors] || '#6B7280',
      opacity: statusOpacity[status as keyof typeof statusOpacity] || 0.7
    };
  };

  const getNodeShape = (type: string) => {
    switch (type) {
      case 'decision':
        return (
          <polygon
            points="0,-15 15,0 0,15 -15,0"
            {...getNodeColor(type, node.status)}
            stroke="#374151"
            strokeWidth="2"
          />
        );
      case 'input':
      case 'output':
        return (
          <rect
            x="-20"
            y="-10"
            width="40"
            height="20"
            rx="4"
            {...getNodeColor(type, node.status)}
            stroke="#374151"
            strokeWidth="2"
          />
        );
      default:
        return (
          <circle
            r="20"
            {...getNodeColor(type, node.status)}
            stroke="#374151"
            strokeWidth="2"
          />
        );
    }
  };

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {getNodeShape(node.type)}
      <text
        textAnchor="middle"
        dy="4"
        fontSize="10"
        fill="#1F2937"
        fontWeight="500"
      >
        {node.name.length > 8 ? `${node.name.substring(0, 8)}...` : node.name}
      </text>
      {node.status === 'active' && (
        <circle
          r="3"
          fill="#10B981"
          transform="translate(15, -15)"
        >
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {node.status === 'error' && (
        <circle
          r="3"
          fill="#EF4444"
          transform="translate(15, -15)"
        />
      )}
    </g>
  );
};

// Edge component
const WorkflowEdgeComponent: React.FC<{
  edge: WorkflowEdge;
  source: { x: number; y: number };
  target: { x: number; y: number };
  onClick: () => void;
}> = ({ edge, source, target, onClick }) => {
  const getEdgeColor = (type: string) => {
    const colors = {
      data: '#3B82F6',
      control: '#6B7280',
      feedback: '#F59E0B'
    };
    return colors[type as keyof typeof colors] || '#6B7280';
  };

  const getDashArray = (type: string) => {
    return type === 'feedback' ? '5,5' : 'none';
  };

  // Calculate edge path with arrow
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dr = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  // Adjust for node radius
  const sourceX = source.x + Math.cos(angle) * 20;
  const sourceY = source.y + Math.sin(angle) * 20;
  const targetX = target.x - Math.cos(angle) * 20;
  const targetY = target.y - Math.sin(angle) * 20;

  const path = `M${sourceX},${sourceY}L${targetX},${targetY}`;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <path
        d={path}
        stroke={getEdgeColor(edge.type)}
        strokeWidth="2"
        strokeDasharray={getDashArray(edge.type)}
        fill="none"
        markerEnd="url(#arrowhead)"
        opacity="0.8"
      />
      {edge.label && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2}
          textAnchor="middle"
          fontSize="8"
          fill="#4B5563"
          fontWeight="400"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
};

// Tooltip component
const NodeTooltip: React.FC<{
  node: WorkflowNode | null;
  position: { x: number; y: number };
}> = ({ node, position }) => {
  if (!node) return null;

  return (
    <div
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs pointer-events-none"
      style={{
        left: position.x + 10,
        top: position.y - 10,
        transform: 'translate(0, -100%)'
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={node.status === 'active' ? 'default' : 'secondary'}>
          {node.type}
        </Badge>
        <Badge variant={node.status === 'error' ? 'destructive' : 'outline'}>
          {node.status}
        </Badge>
      </div>
      <h4 className="font-medium text-sm text-gray-900">{node.name}</h4>
      {node.description && (
        <p className="text-xs text-gray-600 mt-1">{node.description}</p>
      )}
      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          {Object.entries(node.metadata).slice(0, 3).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-gray-500">{key}:</span>
              <span className="text-gray-700">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Legend component
const WorkflowLegend: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  if (!isVisible) return null;

  const nodeTypes = [
    { type: 'agent', color: '#3B82F6', label: 'Agent' },
    { type: 'process', color: '#10B981', label: 'Process' },
    { type: 'decision', color: '#F59E0B', label: 'Decision' },
    { type: 'input', color: '#8B5CF6', label: 'Input' },
    { type: 'output', color: '#EF4444', label: 'Output' }
  ];

  const edgeTypes = [
    { type: 'data', color: '#3B82F6', label: 'Data Flow', style: 'solid' },
    { type: 'control', color: '#6B7280', label: 'Control Flow', style: 'solid' },
    { type: 'feedback', color: '#F59E0B', label: 'Feedback', style: 'dashed' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg p-4 shadow-lg z-10"
    >
      <h4 className="font-medium text-sm text-gray-900 mb-3">Legend</h4>
      
      <div className="space-y-3">
        <div>
          <h5 className="text-xs font-medium text-gray-700 mb-2">Node Types</h5>
          <div className="space-y-1">
            {nodeTypes.map(({ type, color, label }) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h5 className="text-xs font-medium text-gray-700 mb-2">Edge Types</h5>
          <div className="space-y-1">
            {edgeTypes.map(({ type, color, label, style }) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-4 h-0.5"
                  style={{
                    backgroundColor: color,
                    borderStyle: style === 'dashed' ? 'dashed' : 'solid',
                    borderWidth: style === 'dashed' ? '1px 0' : '0'
                  }}
                />
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Main component
const TeamWorkflowDiagram: React.FC<TeamWorkflowDiagramProps> = ({
  workflowData,
  onNodeClick,
  onEdgeClick,
  onNodePositionChange,
  isEditable = false,
  showMiniMap = false,
  autoLayout = true,
  className = ""
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<WorkflowNode, WorkflowEdge> | null>(null);
  
  const [hoveredNode, setHoveredNode] = useState<WorkflowNode | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isSimulationRunning, setIsSimulationRunning] = useState(autoLayout);
  const [showLegend, setShowLegend] = useState(true);
  const [transform, setTransform] = useState(d3.zoomIdentity);

  // Initialize D3 simulation
  const initializeSimulation = useCallback(() => {
    if (!svgRef.current || !workflowData.nodes.length) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    // Create simulation
    const simulation = d3.forceSimulation(workflowData.nodes as any)
      .force("link", d3.forceLink(workflowData.edges).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    simulationRef.current = simulation;

    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    svg.call(zoom);

    // Handle node dragging if editable
    if (isEditable) {
      const drag = d3.drag<SVGGElement, WorkflowNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
          if (onNodePositionChange) {
            onNodePositionChange(d.id, { x: d.x || 0, y: d.y || 0 });
          }
        });

      svg.selectAll(".node-group").call(drag as any);
    }

    return simulation;
  }, [workflowData, isEditable, onNodePositionChange]);

  // Update simulation when data changes
  useEffect(() => {
    const simulation = initializeSimulation();
    
    return () => {
      simulation?.stop();
    };
  }, [initializeSimulation]);

  // Handle simulation control
  const toggleSimulation = () => {
    if (simulationRef.current) {
      if (isSimulationRunning) {
        simulationRef.current.stop();
      } else {
        simulationRef.current.restart();
      }
      setIsSimulationRunning(!isSimulationRunning);
    }
  };

  // Handle zoom controls
  const handleZoom = (scale: number) => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        scale
      );
    }
  };

  // Handle fit to view
  const fitToView = () => {
    if (svgRef.current && containerRef.current) {
      const svg = d3.select(svgRef.current);
      const bounds = svg.select('.workflow-content').node()?.getBBox();
      
      if (bounds) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const scale = Math.min(width / bounds.width, height / bounds.height) * 0.8;
        const translateX = (width - bounds.width * scale) / 2 - bounds.x * scale;
        const translateY = (height - bounds.height * scale) / 2 - bounds.y * scale;

        svg.transition().duration(500).call(
          d3.zoom<SVGSVGElement, unknown>().transform as any,
          d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
      }
    }
  };

  // Export as SVG
  const exportSVG = () => {
    if (svgRef.current) {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'workflow-diagram.svg';
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // Handle mouse events
  const handleMouseMove = (event: React.MouseEvent) => {
    setMousePosition({ x: event.clientX, y: event.clientY });
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      <Card className="w-full h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {workflowData.metadata?.name || 'Team Workflow'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleSimulation}
                    >
                      {isSimulationRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isSimulationRunning ? 'Pause' : 'Resume'} simulation
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleZoom(1.2)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleZoom(0.8)}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fitToView}
                  >
                    <Move className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fit to view</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLegend(!showLegend)}
                  >
                    {showLegend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle legend</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportSVG}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export SVG</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {workflowData.metadata?.description && (
            <p className="text-sm text-gray-600">{workflowData.metadata.description}</p>
          )}
        </CardHeader>
        
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative w-full h-[600px] overflow-hidden"
            onMouseMove={handleMouseMove}
          >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              className="bg-gray-50"
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#6B7280"
                  />
                </marker>
              </defs>
              
              <g
                className="workflow-content"
                transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
              >
                {/* Render edges */}
                {workflowData.edges.map((edge) => {
                  const sourceNode = workflowData.nodes.find(n => n.id === edge.source);
                  const targetNode = workflowData.nodes.find(n => n.id ===