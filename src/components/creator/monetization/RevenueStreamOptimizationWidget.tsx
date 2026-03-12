```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Lightbulb,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowRight,
  Star,
  Users,
  Play,
  Gift
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface RevenueStream {
  id: string;
  name: string;
  type: 'subscription' | 'sponsorship' | 'merchandise' | 'donations' | 'courses' | 'affiliate' | 'licensing';
  currentRevenue: number;
  monthlyGrowth: number;
  isActive: boolean;
  lastUpdated: string;
  metrics: {
    subscribers?: number;
    conversionRate?: number;
    averageOrderValue?: number;
    clickThroughRate?: number;
  };
}

interface OptimizationRecommendation {
  id: string;
  streamId: string;
  title: string;
  description: string;
  potentialIncrease: number;
  potentialIncreasePercentage: number;
  implementationDifficulty: 1 | 2 | 3 | 4 | 5;
  timeToImplement: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'pricing' | 'audience' | 'content' | 'marketing' | 'platform' | 'diversification';
  aiConfidence: number;
  isImplemented: boolean;
  estimatedROI: number;
  requiredResources: string[];
  successMetrics: string[];
}

interface RevenueProjection {
  month: string;
  current: number;
  projected: number;
  optimized: number;
}

interface RevenueStreamOptimizationWidgetProps {
  creatorId: string;
  timeframe?: '3m' | '6m' | '12m';
  onOptimizationApply?: (recommendationId: string) => void;
  className?: string;
}

const DIFFICULTY_COLORS = {
  1: 'bg-green-500',
  2: 'bg-lime-500',
  3: 'bg-yellow-500',
  4: 'bg-orange-500',
  5: 'bg-red-500'
} as const;

const DIFFICULTY_LABELS = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Difficult',
  5: 'Very Difficult'
} as const;

const PRIORITY_COLORS = {
  low: 'bg-gray-500',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500'
} as const;

const STREAM_TYPE_COLORS = {
  subscription: '#8B5CF6',
  sponsorship: '#10B981',
  merchandise: '#F59E0B',
  donations: '#EF4444',
  courses: '#3B82F6',
  affiliate: '#8B5A2B',
  licensing: '#6B7280'
} as const;

const STREAM_TYPE_ICONS = {
  subscription: Users,
  sponsorship: Star,
  merchandise: Gift,
  donations: DollarSign,
  courses: Play,
  affiliate: Target,
  licensing: BarChart3
} as const;

const RevenueStreamCard: React.FC<{
  stream: RevenueStream;
  recommendations: OptimizationRecommendation[];
  onViewRecommendations: (streamId: string) => void;
}> = ({ stream, recommendations, onViewRecommendations }) => {
  const streamRecommendations = recommendations.filter(r => r.streamId === stream.id);
  const totalPotentialIncrease = streamRecommendations.reduce((sum, r) => sum + r.potentialIncrease, 0);
  const IconComponent = STREAM_TYPE_ICONS[stream.type];

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${STREAM_TYPE_COLORS[stream.type]}20` }}
            >
              <IconComponent 
                className="w-4 h-4" 
                style={{ color: STREAM_TYPE_COLORS[stream.type] }}
              />
            </div>
            <div>
              <CardTitle className="text-lg">{stream.name}</CardTitle>
              <CardDescription className="capitalize">{stream.type}</CardDescription>
            </div>
          </div>
          <Badge variant={stream.isActive ? "default" : "secondary"}>
            {stream.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Revenue</p>
              <p className="text-2xl font-bold">${stream.currentRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Growth</p>
              <div className="flex items-center gap-1">
                {stream.monthlyGrowth >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <p className={`text-lg font-semibold ${
                  stream.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stream.monthlyGrowth >= 0 ? '+' : ''}{stream.monthlyGrowth}%
                </p>
              </div>
            </div>
          </div>

          {Object.keys(stream.metrics).length > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              {stream.metrics.subscribers && (
                <div>
                  <p className="text-sm text-muted-foreground">Subscribers</p>
                  <p className="font-semibold">{stream.metrics.subscribers.toLocaleString()}</p>
                </div>
              )}
              {stream.metrics.conversionRate && (
                <div>
                  <p className="text-sm text-muted-foreground">Conversion Rate</p>
                  <p className="font-semibold">{stream.metrics.conversionRate}%</p>
                </div>
              )}
              {stream.metrics.averageOrderValue && (
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Order Value</p>
                  <p className="font-semibold">${stream.metrics.averageOrderValue}</p>
                </div>
              )}
              {stream.metrics.clickThroughRate && (
                <div>
                  <p className="text-sm text-muted-foreground">CTR</p>
                  <p className="font-semibold">{stream.metrics.clickThroughRate}%</p>
                </div>
              )}
            </div>
          )}

          {streamRecommendations.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Optimization Potential</p>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  +${totalPotentialIncrease.toLocaleString()}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onViewRecommendations(stream.id)}
                className="w-full"
              >
                View {streamRecommendations.length} Recommendations
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ImplementationDifficultyBadge: React.FC<{
  difficulty: 1 | 2 | 3 | 4 | 5;
  showLabel?: boolean;
}> = ({ difficulty, showLabel = true }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < difficulty ? DIFFICULTY_COLORS[difficulty] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-sm text-muted-foreground">
          {DIFFICULTY_LABELS[difficulty]}
        </span>
      )}
    </div>
  );
};

const OptimizationRecommendation: React.FC<{
  recommendation: OptimizationRecommendation;
  streamName: string;
  onApply: (id: string) => void;
  onDismiss?: (id: string) => void;
}> = ({ recommendation, streamName, onApply, onDismiss }) => {
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply(recommendation.id);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card className={`${recommendation.isImplemented ? 'bg-green-50 border-green-200' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge 
                className={`${PRIORITY_COLORS[recommendation.priority]} text-white`}
              >
                {recommendation.priority}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {recommendation.category}
              </Badge>
              {recommendation.isImplemented && (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Implemented
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{recommendation.title}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {streamName}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-600">
              +${recommendation.potentialIncrease.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              +{recommendation.potentialIncreasePercentage}%
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm">{recommendation.description}</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Implementation Difficulty</p>
              <ImplementationDifficultyBadge difficulty={recommendation.implementationDifficulty} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Time to Implement</p>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{recommendation.timeToImplement}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">AI Confidence</p>
              <div className="flex items-center gap-2">
                <Progress value={recommendation.aiConfidence} className="flex-1" />
                <span className="text-sm font-medium">{recommendation.aiConfidence}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Estimated ROI</p>
              <p className="text-sm font-semibold">{recommendation.estimatedROI}x</p>
            </div>
          </div>

          {recommendation.requiredResources.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Required Resources</p>
              <div className="flex flex-wrap gap-1">
                {recommendation.requiredResources.map((resource, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {resource}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {recommendation.successMetrics.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Success Metrics</p>
              <ul className="text-sm space-y-1">
                {recommendation.successMetrics.map((metric, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Target className="w-3 h-3 text-muted-foreground" />
                    {metric}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!recommendation.isImplemented && (
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleApply}
                disabled={isApplying}
                className="flex-1"
              >
                {isApplying ? 'Applying...' : 'Apply Recommendation'}
                <Zap className="w-4 h-4 ml-2" />
              </Button>
              {onDismiss && (
                <Button 
                  variant="outline" 
                  onClick={() => onDismiss(recommendation.id)}
                  disabled={isApplying}
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const RevenueProjectionChart: React.FC<{
  data: RevenueProjection[];
  timeframe: string;
}> = ({ data, timeframe }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Revenue Projection ({timeframe})
        </CardTitle>
        <CardDescription>
          Compare current trajectory vs. optimized revenue potential
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              formatter={(value) => [`$${Number(value).toLocaleString()}`, '']}
            />
            <Line 
              type="monotone" 
              dataKey="current" 
              stroke="#6B7280" 
              strokeWidth={2}
              name="Current Trajectory"
              strokeDasharray="5 5"
            />
            <Line 
              type="monotone" 
              dataKey="optimized" 
              stroke="#10B981" 
              strokeWidth={3}
              name="Optimized Potential"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export const RevenueStreamOptimizationWidget: React.FC<RevenueStreamOptimizationWidgetProps> = ({
  creatorId,
  timeframe = '6m',
  onOptimizationApply,
  className = ''
}) => {
  const [revenueStreams, setRevenueStreams] = useState<RevenueStream[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [projectionData, setProjectionData] = useState<RevenueProjection[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  // Calculate summary metrics
  const totalCurrentRevenue = useMemo(() => 
    revenueStreams.reduce((sum, stream) => sum + stream.currentRevenue, 0)
  , [revenueStreams]);

  const totalOptimizationPotential = useMemo(() => 
    recommendations.reduce((sum, rec) => sum + rec.potentialIncrease, 0)
  , [recommendations]);

  const averageGrowthRate = useMemo(() => {
    const activeStreams = revenueStreams.filter(stream => stream.isActive);
    if (activeStreams.length === 0) return 0;
    return activeStreams.reduce((sum, stream) => sum + stream.monthlyGrowth, 0) / activeStreams.length;
  }, [revenueStreams]);

  const highPriorityRecommendations = useMemo(() => 
    recommendations.filter(rec => rec.priority === 'high' || rec.priority === 'critical')
  , [recommendations]);

  // Fetch revenue streams and generate AI recommendations
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch revenue streams
        const { data: streamsData, error: streamsError } = await supabase
          .from('creator_revenue_streams')
          .select('*')
          .eq('creator_id', creatorId)
          .order('current_revenue', { ascending: false });

        if (streamsError) throw streamsError;

        const formattedStreams: RevenueStream[] = streamsData.map(stream => ({
          id: stream.id,
          name: stream.name,
          type: stream.type,
          currentRevenue: stream.current_revenue,
          monthlyGrowth: stream.monthly_growth || 0,
          isActive: stream.is_active,
          lastUpdated: stream.updated_at,
          metrics: stream.metrics || {}
        }));

        setRevenueStreams(formattedStreams);

        // Fetch existing recommendations
        const { data: recommendationsData, error: recommendationsError } = await supabase
          .from('revenue_optimizations')
          .select('*')
          .eq('creator_id', creatorId)
          .eq('is_active', true)
          .order('priority', { ascending: false });

        if (recommendationsError) throw recommendationsError;

        const formattedRecommendations: OptimizationRecommendation[] = recommendationsData.map(rec => ({
          id: rec.id,
          streamId: rec.stream_id,
          title: rec.title,
          description: rec.description,
          potentialIncrease: rec.potential_increase,
          potentialIncreasePercentage: rec.potential_increase_percentage,
          implementationDifficulty: rec.implementation_difficulty,
          timeToImplement: rec.time_to_implement,
          priority: rec.priority,
          category: rec.category,
          aiConfidence: rec.ai_confidence,
          isImplemented: rec.is_implemented,
          estimatedROI: rec.estimated_roi,
          requiredResources: rec.required_resources || [],
          successMetrics: rec.success_metrics || []
        }));

        setRecommendations(formattedRecommendations);

        // Generate projection data
        const months = [];
        const currentDate = new Date();
        const timeframeMonths = timeframe === '3m' ? 3 : timeframe === '6m' ? 6 : 12;
        
        for (let i = 0; i < timeframeMonths; i++) {
          const month = new Date(currentDate.getFullYear(), currentDate.getMonth() + i);
          const monthName = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          
          const currentProjection = totalCurrentRevenue * Math.pow(1 + (averageGrowthRate / 100), i);
          const optimizedProjection = (totalCurrentRevenue + totalOptimizationPotential) * Math.pow(1.15, i);
          
          months.push({
            month: monthName,
            current: Math.round(currentProjection),
            projected: Math.round(currentProjection),
            optimized: Math.round(optimizedProjection)
          });
        }

        setProjectionData(months);

      } catch (err) {
        console.error('Error fetching revenue optimization data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    if (creatorId) {
      fetchData();
    }
  }, [creatorId, timeframe, supabase, totalCurrentRevenue, totalOptimizationPotential, averageGrowthRate]);

  const handleApplyRecommendation = async (recommendationId: string) => {
    try {
      // Update recommendation as implemented
      const { error } = await supabase
        .from('revenue_optimizations')
        .update({ 
          is_implemented: true,
          implemented_at: new Date().toISOString()