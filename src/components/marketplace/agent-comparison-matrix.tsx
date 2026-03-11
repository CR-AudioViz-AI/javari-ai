```tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Check,
  X,
  Star,
  TrendingUp,
  Zap,
  Clock,
  DollarSign,
  Download,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  category: string;
  rating: number;
  pricing: {
    tier: string;
    price: number;
    period: 'month' | 'year' | 'usage';
    currency: string;
  };
  features: Record<string, boolean>;
  metrics: {
    accuracy: number;
    speed: number;
    reliability: number;
    usage: number;
  };
  tags: string[];
  isPopular?: boolean;
  isBestValue?: boolean;
}

interface ComparisonFilter {
  showOnlyDifferences: boolean;
  selectedCategories: string[];
  priceRange: [number, number];
}

interface AgentComparisonMatrixProps {
  selectedAgentIds: string[];
  agents: Agent[];
  onAgentRemove?: (agentId: string) => void;
  onExportComparison?: () => void;
  className?: string;
}

interface MetricBadgeProps {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const MetricBadge: React.FC<MetricBadgeProps> = ({
  label,
  value,
  icon: Icon,
  variant = 'default'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'warning':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'destructive':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-lg border',
      getVariantStyles()
    )}>
      <Icon className="w-4 h-4" />
      <div className="text-xs">
        <div className="font-medium">{label}</div>
        <div className="opacity-75">{value}%</div>
      </div>
    </div>
  );
};

interface AgentCardProps {
  agent: Agent;
  onRemove?: (agentId: string) => void;
  isCompact?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({ 
  agent, 
  onRemove,
  isCompact = false 
}) => {
  return (
    <div className="relative">
      {agent.isPopular && (
        <Badge className="absolute -top-2 left-4 z-10 bg-blue-500 hover:bg-blue-600">
          Popular
        </Badge>
      )}
      {agent.isBestValue && (
        <Badge className="absolute -top-2 right-4 z-10 bg-green-500 hover:bg-green-600">
          Best Value
        </Badge>
      )}
      
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={agent.avatar} alt={agent.name} />
                <AvatarFallback>
                  {agent.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {agent.category}
                </p>
              </div>
            </div>
            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(agent.id)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-medium">{agent.rating}</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {agent.tags[0]}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {!isCompact && (
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
              {agent.description}
            </p>
          )}
          
          <div className="space-y-3">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-bold">
                {agent.pricing.currency}{agent.pricing.price}
              </div>
              <div className="text-xs text-muted-foreground">
                per {agent.pricing.period}
              </div>
              <div className="text-xs font-medium text-blue-600 mt-1">
                {agent.pricing.tier}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <MetricBadge
                label="Accuracy"
                value={agent.metrics.accuracy}
                icon={TrendingUp}
                variant={agent.metrics.accuracy >= 90 ? 'success' : agent.metrics.accuracy >= 70 ? 'warning' : 'destructive'}
              />
              <MetricBadge
                label="Speed"
                value={agent.metrics.speed}
                icon={Zap}
                variant={agent.metrics.speed >= 90 ? 'success' : agent.metrics.speed >= 70 ? 'warning' : 'destructive'}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface FeatureMatrixProps {
  agents: Agent[];
  showOnlyDifferences: boolean;
}

const FeatureMatrix: React.FC<FeatureMatrixProps> = ({ 
  agents, 
  showOnlyDifferences 
}) => {
  const allFeatures = useMemo(() => {
    const features = new Set<string>();
    agents.forEach(agent => {
      Object.keys(agent.features).forEach(feature => features.add(feature));
    });
    return Array.from(features).sort();
  }, [agents]);

  const filteredFeatures = useMemo(() => {
    if (!showOnlyDifferences) return allFeatures;
    
    return allFeatures.filter(feature => {
      const values = agents.map(agent => agent.features[feature]);
      return !values.every(value => value === values[0]);
    });
  }, [allFeatures, agents, showOnlyDifferences]);

  return (
    <div className="space-y-1">
      <h4 className="font-semibold text-sm mb-3">Features</h4>
      {filteredFeatures.map(feature => (
        <div key={feature} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2 rounded hover:bg-muted/50 transition-colors">
          <div className="font-medium text-sm capitalize col-span-1 md:col-span-2 lg:col-span-1">
            {feature.replace(/([A-Z])/g, ' $1').trim()}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3 gap-4 col-span-1 md:col-span-1 lg:col-span-3">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center justify-center">
                {agent.features[feature] ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <X className="w-4 h-4 text-red-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

interface PricingComparisonProps {
  agents: Agent[];
}

const PricingComparison: React.FC<PricingComparisonProps> = ({ agents }) => {
  const bestValue = useMemo(() => {
    return agents.reduce((best, current) => {
      const currentScore = (current.metrics.accuracy + current.metrics.speed + current.metrics.reliability) / current.pricing.price;
      const bestScore = (best.metrics.accuracy + best.metrics.speed + best.metrics.reliability) / best.pricing.price;
      return currentScore > bestScore ? current : best;
    });
  }, [agents]);

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">Pricing Comparison</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map(agent => (
          <Card 
            key={agent.id} 
            className={cn(
              'text-center',
              agent.id === bestValue.id && 'ring-2 ring-green-500 bg-green-50'
            )}
          >
            <CardContent className="p-4">
              {agent.id === bestValue.id && (
                <Badge className="mb-2 bg-green-500 hover:bg-green-600">
                  Best Value
                </Badge>
              )}
              <div className="text-2xl font-bold">
                {agent.pricing.currency}{agent.pricing.price}
              </div>
              <div className="text-sm text-muted-foreground mb-2">
                per {agent.pricing.period}
              </div>
              <Badge variant="outline">{agent.pricing.tier}</Badge>
              <div className="mt-3 text-xs text-muted-foreground">
                Performance Score: {Math.round(
                  (agent.metrics.accuracy + agent.metrics.speed + agent.metrics.reliability) / 3
                )}%
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface PerformanceMetricsProps {
  agents: Agent[];
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ agents }) => {
  const metrics = ['accuracy', 'speed', 'reliability', 'usage'];
  const metricLabels = {
    accuracy: 'Accuracy',
    speed: 'Speed',
    reliability: 'Reliability',
    usage: 'Usage'
  };

  const metricIcons = {
    accuracy: TrendingUp,
    speed: Zap,
    reliability: Clock,
    usage: DollarSign
  };

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">Performance Metrics</h4>
      <div className="space-y-4">
        {metrics.map(metric => (
          <div key={metric} className="space-y-2">
            <div className="flex items-center gap-2">
              {React.createElement(metricIcons[metric as keyof typeof metricIcons], { 
                className: "w-4 h-4" 
              })}
              <span className="text-sm font-medium">
                {metricLabels[metric as keyof typeof metricLabels]}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {agents.map(agent => {
                const value = agent.metrics[metric as keyof typeof agent.metrics];
                return (
                  <div key={agent.id} className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>{value}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={cn(
                          "h-2 rounded-full transition-all duration-300",
                          value >= 90 ? "bg-green-500" :
                          value >= 70 ? "bg-yellow-500" : "bg-red-500"
                        )}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ComparisonControlsProps {
  filter: ComparisonFilter;
  onFilterChange: (filter: ComparisonFilter) => void;
  onExport?: () => void;
  agentCount: number;
}

const ComparisonControls: React.FC<ComparisonControlsProps> = ({
  filter,
  onFilterChange,
  onExport,
  agentCount
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show-differences"
            checked={filter.showOnlyDifferences}
            onCheckedChange={(checked) => 
              onFilterChange({ 
                ...filter, 
                showOnlyDifferences: checked as boolean 
              })
            }
          />
          <label 
            htmlFor="show-differences" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Show only differences
          </label>
        </div>
        
        <Badge variant="secondary" className="text-xs">
          {agentCount} agents
        </Badge>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
        
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        )}
      </div>
    </div>
  );
};

interface ComparisonHeaderProps {
  agents: Agent[];
  onAgentRemove?: (agentId: string) => void;
}

const ComparisonHeader: React.FC<ComparisonHeaderProps> = ({ 
  agents, 
  onAgentRemove 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {agents.map(agent => (
        <AgentCard 
          key={agent.id} 
          agent={agent} 
          onRemove={onAgentRemove}
          isCompact
        />
      ))}
    </div>
  );
};

export const AgentComparisonMatrix: React.FC<AgentComparisonMatrixProps> = ({
  selectedAgentIds,
  agents,
  onAgentRemove,
  onExportComparison,
  className
}) => {
  const [filter, setFilter] = useState<ComparisonFilter>({
    showOnlyDifferences: false,
    selectedCategories: [],
    priceRange: [0, 1000]
  });

  const selectedAgents = useMemo(() => {
    return agents.filter(agent => selectedAgentIds.includes(agent.id));
  }, [agents, selectedAgentIds]);

  if (selectedAgents.length === 0) {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <div className="text-muted-foreground">
          <MoreHorizontal className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No agents selected</h3>
          <p className="text-sm">
            Select up to 4 agents from the marketplace to compare their features, 
            pricing, and performance metrics.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <ComparisonControls
        filter={filter}
        onFilterChange={setFilter}
        onExport={onExportComparison}
        agentCount={selectedAgents.length}
      />

      <ComparisonHeader 
        agents={selectedAgents}
        onAgentRemove={onAgentRemove}
      />

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureMatrix 
              agents={selectedAgents}
              showOnlyDifferences={filter.showOnlyDifferences}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pricing</CardTitle>
          </CardHeader>
          <CardContent>
            <PricingComparison agents={selectedAgents} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceMetrics agents={selectedAgents} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentComparisonMatrix;
```