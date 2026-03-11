import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star, Download, X, Filter, ArrowUpDown, TrendingUp, DollarSign, Users } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  logo: string;
  verified: boolean;
}

interface AgentFeature {
  id: string;
  agent_id: string;
  feature_name: string;
  feature_value: string | boolean;
  feature_type: 'boolean' | 'text' | 'number';
  category: string;
}

interface AgentPricing {
  id: string;
  agent_id: string;
  tier_name: string;
  price: number;
  currency: string;
  billing_cycle: string;
  features: string[];
  popular: boolean;
}

interface AgentMetric {
  id: string;
  agent_id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  category: string;
}

interface AgentReview {
  id: string;
  agent_id: string;
  rating: number;
  review_count: number;
  latest_review: string;
  sentiment_score: number;
}

interface FilterOptions {
  categories: string[];
  priceRange: { min: number; max: number };
  features: string[];
  providers: string[];
  ratings: number[];
}

interface AgentComparisonMatrixProps {
  selectedAgentIds?: string[];
  onAgentRemove?: (agentId: string) => void;
  onComparisonExport?: (format: 'pdf' | 'csv') => void;
  maxAgents?: number;
  className?: string;
}

const AgentComparisonMatrix: React.FC<AgentComparisonMatrixProps> = ({
  selectedAgentIds = [],
  onAgentRemove,
  onComparisonExport,
  maxAgents = 4,
  className = '',
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [features, setFeatures] = useState<AgentFeature[]>([]);
  const [pricing, setPricing] = useState<AgentPricing[]>([]);
  const [metrics, setMetrics] = useState<AgentMetric[]>([]);
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    priceRange: { min: 0, max: 1000 },
    features: [],
    providers: [],
    ratings: [],
  });
  const [activeFilters, setActiveFilters] = useState<{
    category: string;
    priceRange: string;
    minRating: number;
    features: string[];
  }>({
    category: 'all',
    priceRange: 'all',
    minRating: 0,
    features: [],
  });
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Mock data loading - replace with actual Supabase calls
  useEffect(() => {
    const loadComparisonData = async () => {
      setIsLoading(true);
      try {
        // Mock data - replace with actual Supabase queries
        const mockAgents: Agent[] = selectedAgentIds.map((id, index) => ({
          id,
          name: `AI Agent ${index + 1}`,
          description: `Advanced AI agent for various tasks`,
          category: index % 2 === 0 ? 'Conversational' : 'Analytics',
          provider: `Provider ${String.fromCharCode(65 + index)}`,
          logo: `/api/placeholder/40/40`,
          verified: index % 3 === 0,
        }));

        const mockFeatures: AgentFeature[] = selectedAgentIds.flatMap((agentId) => [
          {
            id: `${agentId}-1`,
            agent_id: agentId,
            feature_name: 'Natural Language Processing',
            feature_value: true,
            feature_type: 'boolean' as const,
            category: 'Core Features',
          },
          {
            id: `${agentId}-2`,
            agent_id: agentId,
            feature_name: 'API Rate Limit',
            feature_value: '1000/hour',
            feature_type: 'text' as const,
            category: 'Performance',
          },
          {
            id: `${agentId}-3`,
            agent_id: agentId,
            feature_name: 'Response Time',
            feature_value: Math.floor(Math.random() * 500) + 100,
            feature_type: 'number' as const,
            category: 'Performance',
          },
        ]);

        setAgents(mockAgents);
        setFeatures(mockFeatures);
        
        // Set other mock data similarly...
        setPricing(selectedAgentIds.map((id, index) => ({
          id: `pricing-${id}`,
          agent_id: id,
          tier_name: 'Professional',
          price: (index + 1) * 29,
          currency: 'USD',
          billing_cycle: 'monthly',
          features: ['Feature 1', 'Feature 2'],
          popular: index === 1,
        })));

        setMetrics(selectedAgentIds.map((id, index) => ({
          id: `metric-${id}`,
          agent_id: id,
          metric_name: 'Accuracy',
          metric_value: 95 + index * 2,
          metric_unit: '%',
          category: 'Performance',
        })));

        setReviews(selectedAgentIds.map((id, index) => ({
          id: `review-${id}`,
          agent_id: id,
          rating: 4.5 - index * 0.2,
          review_count: 100 + index * 50,
          latest_review: 'Great agent with excellent performance',
          sentiment_score: 0.8 - index * 0.1,
        })));

      } catch (error) {
        console.error('Error loading comparison data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedAgentIds.length > 0) {
      loadComparisonData();
    }
  }, [selectedAgentIds]);

  const filteredAndSortedAgents = useMemo(() => {
    let filtered = [...agents];

    // Apply filters
    if (activeFilters.category !== 'all') {
      filtered = filtered.filter(agent => agent.category === activeFilters.category);
    }

    if (activeFilters.minRating > 0) {
      filtered = filtered.filter(agent => {
        const review = reviews.find(r => r.agent_id === agent.id);
        return review && review.rating >= activeFilters.minRating;
      });
    }

    // Sort agents
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'rating':
          const ratingA = reviews.find(r => r.agent_id === a.id)?.rating || 0;
          const ratingB = reviews.find(r => r.agent_id === b.id)?.rating || 0;
          compareValue = ratingA - ratingB;
          break;
        case 'price':
          const priceA = pricing.find(p => p.agent_id === a.id)?.price || 0;
          const priceB = pricing.find(p => p.agent_id === b.id)?.price || 0;
          compareValue = priceA - priceB;
          break;
        default:
          compareValue = 0;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [agents, reviews, pricing, activeFilters, sortBy, sortOrder]);

  const featureCategories = useMemo(() => {
    const categories = Array.from(new Set(features.map(f => f.category)));
    return categories.map(category => ({
      name: category,
      features: features.filter(f => f.category === category),
    }));
  }, [features]);

  const handleRemoveAgent = useCallback((agentId: string) => {
    if (onAgentRemove) {
      onAgentRemove(agentId);
    }
  }, [onAgentRemove]);

  const handleExport = useCallback((format: 'pdf' | 'csv') => {
    if (onComparisonExport) {
      onComparisonExport(format);
    }
  }, [onComparisonExport]);

  const ComparisonHeader: React.FC = () => (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold">Agent Comparison</h2>
        <p className="text-muted-foreground">
          Compare {filteredAndSortedAgents.length} agents side-by-side
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="rating">Rating</SelectItem>
            <SelectItem value="price">Price</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport('csv')}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );

  const FilterPanel: React.FC = () => (
    <Card className={`mb-6 transition-all ${showFilters ? 'block' : 'hidden'}`}>
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select
              value={activeFilters.category}
              onValueChange={(value) =>
                setActiveFilters(prev => ({ ...prev, category: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Conversational">Conversational</SelectItem>
                <SelectItem value="Analytics">Analytics</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Min Rating</label>
            <Select
              value={activeFilters.minRating.toString()}
              onValueChange={(value) =>
                setActiveFilters(prev => ({ ...prev, minRating: Number(value) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any Rating</SelectItem>
                <SelectItem value="3">3+ Stars</SelectItem>
                <SelectItem value="4">4+ Stars</SelectItem>
                <SelectItem value="4.5">4.5+ Stars</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const AgentCard: React.FC<{ agent: Agent }> = ({ agent }) => {
    const agentPricing = pricing.find(p => p.agent_id === agent.id);
    const agentReview = reviews.find(r => r.agent_id === agent.id);
    const agentMetric = metrics.find(m => m.agent_id === agent.id);

    return (
      <div className="p-4 border-r min-w-[280px] sticky top-0 bg-background">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <img
              src={agent.logo}
              alt={`${agent.name} logo`}
              className="w-10 h-10 rounded-lg"
            />
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                {agent.name}
                {agent.verified && (
                  <Badge variant="secondary" className="text-xs">
                    Verified
                  </Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">{agent.provider}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveAgent(agent.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {agent.description}
        </p>

        {/* Pricing */}
        {agentPricing && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Pricing</span>
            </div>
            <div className="pl-6">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold">
                  ${agentPricing.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{agentPricing.billing_cycle}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {agentPricing.tier_name}
              </p>
            </div>
          </div>
        )}

        {/* Rating */}
        {agentReview && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Rating</span>
            </div>
            <div className="pl-6">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {agentReview.rating.toFixed(1)}
                </span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-3 w-3 ${
                        star <= agentReview.rating
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {agentReview.review_count} reviews
              </p>
            </div>
          </div>
        )}

        {/* Key Metric */}
        {agentMetric && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Performance</span>
            </div>
            <div className="pl-6">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold">
                  {agentMetric.metric_value}
                </span>
                <span className="text-sm text-muted-foreground">
                  {agentMetric.metric_unit}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {agentMetric.metric_name}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const FeatureRow: React.FC<{
    featureName: string;
    features: AgentFeature[];
    agents: Agent[];
  }> = ({ featureName, features, agents }) => (
    <TableRow>
      <TableCell className="font-medium sticky left-0 bg-background border-r">
        {featureName}
      </TableCell>
      {agents.map((agent) => {
        const feature = features.find(
          f => f.agent_id === agent.id && f.feature_name === featureName
        );
        
        return (
          <TableCell key={agent.id} className="text-center">
            {feature ? (
              feature.feature_type === 'boolean' ? (
                feature.feature_value ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )
              ) : (
                <span className="text-sm">{String(feature.feature_value)}</span>
              )
            ) : (
              <span className="text-muted-foreground text-sm">-</span>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading comparison...</p>
        </div>
      </div>
    );
  }

  if (filteredAndSortedAgents.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No agents to compare</h3>
        <p className="text-muted-foreground">
          Add some agents to start comparing their features and capabilities.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <ComparisonHeader />
      <FilterPanel />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/* Agent Headers */}
            <div className="flex border-b">
              <div className="w-64 p-4 border-r bg-muted/50">
                <h3 className="font-semibold">Agents</h3>
              </div>
              <div className="flex">
                {filteredAndSortedAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </div>

            {/* Feature Comparison Table */}
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background border-r w-64">
                      Features
                    </TableHead>
                    {filteredAndSortedAgents.map((agent) => (
                      <TableHead key={agent.id} className="text-center min-w-[280px]">
                        {agent.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureCategories.map((category) => (
                    <React.Fragment key={category.name}>
                      <TableRow>
                        <TableCell
                          colSpan={filteredAndSortedAgents.length + 1}
                          className="bg-muted/50 font-semibold sticky left-0"
                        >
                          {category.name}
                        </TableCell>
                      </TableRow>
                      {Array.from(
                        new Set(category.features.map(f => f.feature_name))
                      ).map((featureName) => (
                        <FeatureRow
                          key={featureName}
                          featureName={featureName}
                          features={category.features}
                          agents={filteredAndSortedAgents}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentComparisonMatrix;