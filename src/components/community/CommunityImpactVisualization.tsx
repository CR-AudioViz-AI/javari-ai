```tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  Users, 
  GitBranch, 
  Activity, 
  TrendingUp, 
  Filter,
  Info,
  RefreshCw
} from 'lucide-react';

interface CommunityMember {
  id: string;
  username: string;
  avatar_url?: string;
  contribution_count: number;
  influence_score: number;
  projects: string[];
  recent_activity: Date;
  specialties: string[];
}

interface ProjectCollaboration {
  id: string;
  name: string;
  member_count: number;
  contribution_count: number;
  category: string;
  created_at: Date;
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'member' | 'project';
  name: string;
  value: number;
  category?: string;
  influence?: number;
  connections: number;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode;
  target: string | NetworkNode;
  strength: number;
  type: 'contribution' | 'collaboration';
}

interface ImpactMetrics {
  total_members: number;
  total_projects: number;
  total_contributions: number;
  average_influence: number;
  collaboration_density: number;
  growth_rate: number;
}

interface TooltipData {
  x: number;
  y: number;
  data: NetworkNode;
  visible: boolean;
}

interface FilterState {
  timeRange: number; // days
  projectCategory: string;
  minInfluence: number;
  showInactive: boolean;
}

interface CommunityImpactVisualizationProps {
  className?: string;
  height?: number;
  refreshInterval?: number;
  onMemberSelect?: (member: CommunityMember) => void;
  onProjectSelect?: (project: ProjectCollaboration) => void;
}

export function CommunityImpactVisualization({
  className = '',
  height = 600,
  refreshInterval = 30000,
  onMemberSelect,
  onProjectSelect
}: CommunityImpactVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink>>();
  const [tooltip, setTooltip] = useState<TooltipData>({
    x: 0,
    y: 0,
    data: {} as NetworkNode,
    visible: false
  });
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    timeRange: 30,
    projectCategory: 'all',
    minInfluence: 0,
    showInactive: true
  });

  const supabase = createClientComponentClient();

  // Fetch community data
  const { data: communityData, isLoading, refetch } = useQuery({
    queryKey: ['community-impact', filters],
    queryFn: async () => {
      const timeThreshold = new Date();
      timeThreshold.setDate(timeThreshold.getDate() - filters.timeRange);

      // Fetch members with contributions
      const { data: members } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          avatar_url,
          contributions:contributions(count),
          project_members:project_members(
            projects:projects(id, name, category, created_at)
          )
        `)
        .gte('last_seen', timeThreshold.toISOString());

      // Fetch projects with collaboration data
      const { data: projects } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          category,
          created_at,
          project_members:project_members(count),
          contributions:contributions(count)
        `)
        .eq('category', filters.projectCategory === 'all' ? filters.projectCategory : filters.projectCategory);

      return { members, projects };
    },
    refetchInterval: refreshInterval
  });

  // Transform data for network visualization
  const networkData = useMemo(() => {
    if (!communityData?.members || !communityData?.projects) {
      return { nodes: [], links: [] };
    }

    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];
    const memberProjectMap = new Map<string, Set<string>>();

    // Add member nodes
    communityData.members.forEach(member => {
      const projects = member.project_members?.map(pm => pm.projects.id) || [];
      const contributionCount = member.contributions?.[0]?.count || 0;
      const influence = Math.log(contributionCount + 1) * projects.length;

      if (influence >= filters.minInfluence) {
        nodes.push({
          id: member.id,
          type: 'member',
          name: member.username,
          value: contributionCount,
          influence,
          connections: projects.length
        });

        memberProjectMap.set(member.id, new Set(projects));
      }
    });

    // Add project nodes
    communityData.projects.forEach(project => {
      const memberCount = project.project_members?.[0]?.count || 0;
      const contributionCount = project.contributions?.[0]?.count || 0;

      if (filters.projectCategory === 'all' || project.category === filters.projectCategory) {
        nodes.push({
          id: project.id,
          type: 'project',
          name: project.name,
          value: contributionCount,
          category: project.category,
          connections: memberCount
        });
      }
    });

    // Create links between members and projects
    memberProjectMap.forEach((projects, memberId) => {
      projects.forEach(projectId => {
        const member = nodes.find(n => n.id === memberId);
        const project = nodes.find(n => n.id === projectId);
        
        if (member && project) {
          links.push({
            source: memberId,
            target: projectId,
            strength: Math.min(member.value || 1, 10) / 10,
            type: 'contribution'
          });
        }
      });
    });

    // Create collaboration links between members
    const memberIds = Array.from(memberProjectMap.keys());
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const member1Projects = memberProjectMap.get(memberIds[i]);
        const member2Projects = memberProjectMap.get(memberIds[j]);
        
        if (member1Projects && member2Projects) {
          const commonProjects = [...member1Projects].filter(p => member2Projects.has(p));
          
          if (commonProjects.length > 0) {
            links.push({
              source: memberIds[i],
              target: memberIds[j],
              strength: commonProjects.length / Math.max(member1Projects.size, member2Projects.size),
              type: 'collaboration'
            });
          }
        }
      }
    }

    return { nodes, links };
  }, [communityData, filters]);

  // Calculate impact metrics
  const impactMetrics = useMemo((): ImpactMetrics => {
    const memberNodes = networkData.nodes.filter(n => n.type === 'member');
    const projectNodes = networkData.nodes.filter(n => n.type === 'project');
    
    const totalContributions = memberNodes.reduce((sum, node) => sum + (node.value || 0), 0);
    const averageInfluence = memberNodes.reduce((sum, node) => sum + (node.influence || 0), 0) / memberNodes.length || 0;
    const collaborationDensity = networkData.links.length / (memberNodes.length * (memberNodes.length - 1) / 2) || 0;

    return {
      total_members: memberNodes.length,
      total_projects: projectNodes.length,
      total_contributions: totalContributions,
      average_influence: averageInfluence,
      collaboration_density: collaborationDensity * 100,
      growth_rate: 12.5 // Mock growth rate - would be calculated from historical data
    };
  }, [networkData]);

  // Initialize D3 force simulation
  useEffect(() => {
    if (!svgRef.current || networkData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = svg.node()?.getBoundingClientRect().width || 800;
    const height = svg.node()?.getBoundingClientRect().height || 600;

    svg.selectAll('*').remove();

    const simulation = d3.forceSimulation<NetworkNode>(networkData.nodes)
      .force('link', d3.forceLink<NetworkNode, NetworkLink>(networkData.links)
        .id(d => d.id)
        .strength(d => d.strength)
      )
      .force('charge', d3.forceManyBody().strength(d => 
        d.type === 'member' ? -300 : -150
      ))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => 
        Math.sqrt((d.value || 1) * 10) + 5
      ));

    simulationRef.current = simulation;

    // Create link elements
    const link = svg.append('g')
      .selectAll('line')
      .data(networkData.links)
      .enter()
      .append('line')
      .attr('class', 'network-link')
      .attr('stroke', d => d.type === 'collaboration' ? '#3b82f6' : '#6b7280')
      .attr('stroke-opacity', d => 0.2 + d.strength * 0.6)
      .attr('stroke-width', d => 1 + d.strength * 3);

    // Create node elements
    const node = svg.append('g')
      .selectAll('circle')
      .data(networkData.nodes)
      .enter()
      .append('circle')
      .attr('class', 'network-node')
      .attr('r', d => Math.sqrt((d.value || 1) * 10) + 5)
      .attr('fill', d => d.type === 'member' ? '#10b981' : '#f59e0b')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on('mouseover', (event, d) => {
        const [x, y] = d3.pointer(event, svg.node());
        setTooltip({
          x: x + 10,
          y: y - 10,
          data: d,
          visible: true
        });
      })
      .on('mouseout', () => {
        setTooltip(prev => ({ ...prev, visible: false }));
      })
      .on('click', (event, d) => {
        setSelectedNode(d);
        if (d.type === 'member' && onMemberSelect) {
          const member = communityData?.members?.find(m => m.id === d.id);
          if (member) onMemberSelect(member as CommunityMember);
        } else if (d.type === 'project' && onProjectSelect) {
          const project = communityData?.projects?.find(p => p.id === d.id);
          if (project) onProjectSelect(project as ProjectCollaboration);
        }
      });

    // Add labels
    const labels = svg.append('g')
      .selectAll('text')
      .data(networkData.nodes.filter(d => (d.value || 0) > 5))
      .enter()
      .append('text')
      .attr('class', 'network-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#374151')
      .text(d => d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as NetworkNode).x || 0)
        .attr('y1', d => (d.source as NetworkNode).y || 0)
        .attr('x2', d => (d.target as NetworkNode).x || 0)
        .attr('y2', d => (d.target as NetworkNode).y || 0);

      node
        .attr('cx', d => d.x || 0)
        .attr('cy', d => d.y || 0);

      labels
        .attr('x', d => d.x || 0)
        .attr('y', d => d.y || 0);
    });

    return () => {
      simulation.stop();
    };
  }, [networkData, communityData, onMemberSelect, onProjectSelect]);

  const handleRefresh = () => {
    refetch();
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Members</p>
                <p className="text-2xl font-bold">{impactMetrics.total_members}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <GitBranch className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold">{impactMetrics.total_projects}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Contributions</p>
                <p className="text-2xl font-bold">{impactMetrics.total_contributions}</p>
              </div>
            </div>
          </CardContent>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Influence</p>
                <p className="text-2xl font-bold">{impactMetrics.average_influence.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-muted-foreground">Collaboration</p>
              <div className="flex items-center space-x-2">
                <Progress value={impactMetrics.collaboration_density} className="flex-1" />
                <span className="text-sm font-medium">
                  {impactMetrics.collaboration_density.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Growth Rate</p>
                <p className="text-lg font-bold text-green-600">
                  +{impactMetrics.growth_rate}%
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Visualization Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Range (days)</label>
              <Slider
                value={[filters.timeRange]}
                onValueChange={([value]) => handleFilterChange('timeRange', value)}
                max={365}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">{filters.timeRange} days</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Project Category</label>
              <Select 
                value={filters.projectCategory} 
                onValueChange={(value) => handleFilterChange('projectCategory', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="audio">Audio Processing</SelectItem>
                  <SelectItem value="ml">Machine Learning</SelectItem>
                  <SelectItem value="visualization">Visualization</SelectItem>
                  <SelectItem value="tools">Developer Tools</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Min Influence Score</label>
              <Slider
                value={[filters.minInfluence]}
                onValueChange={([value]) => handleFilterChange('minInfluence', value)}
                max={50}
                min={0}
                step={0.1}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">{filters.minInfluence.toFixed(1)}</div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showInactive"
                checked={filters.showInactive}
                onChange={(e) => handleFilterChange('showInactive', e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="showInactive" className="text-sm font-medium">
                Show Inactive Members
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Community Network Graph</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative">
              <svg
                ref={svgRef}
                width="100%"
                height={height}
                className="border rounded-lg"
                role="img"
                aria-label="Community network visualization showing member connections and project collaborations"
              />
              
              {/* Tooltip */}
              <AnimatePresence>
                {tooltip.visible && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute z-10 bg-white border rounded-lg shadow-lg p-3 pointer-events-none"
                    style={{
                      left: tooltip.x,
                      top: tooltip.y,
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
                    <div className="text-sm">
                      <div className="font-semibold">{tooltip.data.name}</div>
                      <div className="text-muted-foreground">
                        Type: {tooltip.data.type}
                      </div>
                      <div className="text-muted-foreground">
                        {tooltip.data.type === 'member' ? 'Contributions' : 'Activity'}: {tooltip.data.value}
                      </div>
                      {tooltip.data.influence && (
                        <div className="text-muted-foreground">
                          Influence: {tooltip.data.influence.toFixed(1)}
                        </div>
                      )}
                      <div className="text-muted-foreground">
                        Connections: {tooltip.data.connections}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        {/* Legend and Details Panel */}
        <div