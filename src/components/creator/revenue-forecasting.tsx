```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Target, 
  Activity, 
  DollarSign,
  BarChart3,
  PieChart,
  Settings,
  Download,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const scenarioSchema = z.object({
  baseGrowthRate: z.number().min(-50).max(200),
  seasonalityFactor: z.number().min(0.5).max(2),
  marketTrendFactor: z.number().min(0.5).max(2),
  contentQualityFactor: z.number().min(0.5).max(2),
  audienceGrowthRate: z.number().min(-20).max(100),
  platformChangeFactor: z.number().min(0.5).max(2)
});

type ScenarioFormData = z.infer<typeof scenarioSchema>;

interface RevenueData {
  id: string;
  creator_id: string;
  period: string;
  revenue: number;
  revenue_type: string;
  created_at: string;
}

interface ForecastPoint {
  period: string;
  historical?: number;
  conservative: number;
  realistic: number;
  optimistic: number;
  confidence: number;
  isActual: boolean;
}

interface SeasonalPattern {
  month: number;
  factor: number;
  variance: number;
}

interface RevenueForecastingProps {
  creatorId: string;
  className?: string;
}

const RevenueForecastingDashboard: React.FC<RevenueForecastingProps> = ({ 
  creatorId, 
  className = "" 
}) => {
  const [historicalData, setHistoricalData] = useState<RevenueData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [seasonalPatterns, setSeasonalPatterns] = useState<SeasonalPattern[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('12');
  const [selectedScenario, setSelectedScenario] = useState<'conservative' | 'realistic' | 'optimistic'>('realistic');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { register, watch, setValue, handleSubmit } = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      baseGrowthRate: 10,
      seasonalityFactor: 1,
      marketTrendFactor: 1,
      contentQualityFactor: 1,
      audienceGrowthRate: 15,
      platformChangeFactor: 1
    }
  });

  const scenarioParams = watch();

  // Fetch historical revenue data
  useEffect(() => {
    const fetchRevenueData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('revenue_analytics')
          .select('*')
          .eq('creator_id', creatorId)
          .gte('created_at', format(addMonths(new Date(), -24), 'yyyy-MM-dd'))
          .order('created_at', { ascending: true });

        if (error) throw error;
        setHistoricalData(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch revenue data');
      } finally {
        setLoading(false);
      }
    };

    if (creatorId) {
      fetchRevenueData();
    }
  }, [creatorId]);

  // Calculate seasonal patterns
  const calculateSeasonalPatterns = useMemo(() => {
    if (historicalData.length < 12) return [];

    const monthlyData: { [key: number]: number[] } = {};
    
    historicalData.forEach(item => {
      const month = new Date(item.created_at).getMonth();
      if (!monthlyData[month]) monthlyData[month] = [];
      monthlyData[month].push(item.revenue);
    });

    const patterns: SeasonalPattern[] = [];
    const overallAverage = historicalData.reduce((sum, item) => sum + item.revenue, 0) / historicalData.length;

    for (let month = 0; month < 12; month++) {
      const monthRevenues = monthlyData[month] || [];
      const monthAverage = monthRevenues.length > 0 
        ? monthRevenues.reduce((sum, rev) => sum + rev, 0) / monthRevenues.length
        : overallAverage;
      
      const factor = overallAverage > 0 ? monthAverage / overallAverage : 1;
      const variance = monthRevenues.length > 1 
        ? Math.sqrt(monthRevenues.reduce((sum, rev) => sum + Math.pow(rev - monthAverage, 2), 0) / (monthRevenues.length - 1))
        : 0;

      patterns.push({
        month,
        factor,
        variance: variance / overallAverage
      });
    }

    return patterns;
  }, [historicalData]);

  useEffect(() => {
    setSeasonalPatterns(calculateSeasonalPatterns);
  }, [calculateSeasonalPatterns]);

  // Generate forecast data
  const generateForecast = useMemo(() => {
    if (historicalData.length === 0) return [];

    const forecastPoints: ForecastPoint[] = [];
    const baseRevenue = historicalData.slice(-3).reduce((sum, item) => sum + item.revenue, 0) / 3;
    const forecastMonths = parseInt(selectedTimeRange);

    // Add historical data points
    historicalData.slice(-12).forEach(item => {
      forecastPoints.push({
        period: format(new Date(item.created_at), 'MMM yyyy'),
        historical: item.revenue,
        conservative: item.revenue,
        realistic: item.revenue,
        optimistic: item.revenue,
        confidence: 100,
        isActual: true
      });
    });

    // Generate future projections
    for (let i = 1; i <= forecastMonths; i++) {
      const futureDate = addMonths(new Date(), i);
      const monthIndex = futureDate.getMonth();
      const seasonalFactor = seasonalPatterns[monthIndex]?.factor || 1;
      
      const growthFactor = Math.pow(1 + scenarioParams.baseGrowthRate / 100, i / 12);
      const adjustedSeasonality = seasonalFactor * scenarioParams.seasonalityFactor;
      
      const baseProjection = baseRevenue * growthFactor * adjustedSeasonality * 
        scenarioParams.marketTrendFactor * scenarioParams.contentQualityFactor * 
        scenarioParams.platformChangeFactor;

      const audienceGrowthFactor = Math.pow(1 + scenarioParams.audienceGrowthRate / 100, i / 12);
      
      const confidence = Math.max(95 - (i * 5), 40); // Decreasing confidence over time
      
      forecastPoints.push({
        period: format(futureDate, 'MMM yyyy'),
        conservative: baseProjection * 0.8 * audienceGrowthFactor * 0.9,
        realistic: baseProjection * audienceGrowthFactor,
        optimistic: baseProjection * 1.2 * audienceGrowthFactor * 1.1,
        confidence,
        isActual: false
      });
    }

    return forecastPoints;
  }, [historicalData, seasonalPatterns, scenarioParams, selectedTimeRange]);

  useEffect(() => {
    setForecastData(generateForecast);
  }, [generateForecast]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (forecastData.length === 0) return null;

    const futureData = forecastData.filter(point => !point.isActual);
    const currentRevenue = historicalData.slice(-1)[0]?.revenue || 0;
    const projectedRevenue = futureData.reduce((sum, point) => sum + point[selectedScenario], 0);
    const growthRate = currentRevenue > 0 ? ((projectedRevenue - currentRevenue * futureData.length) / (currentRevenue * futureData.length)) * 100 : 0;
    const averageConfidence = futureData.reduce((sum, point) => sum + point.confidence, 0) / futureData.length;

    return {
      currentRevenue,
      projectedRevenue,
      growthRate,
      averageConfidence,
      totalForecast: futureData.reduce((sum, point) => sum + point[selectedScenario], 0)
    };
  }, [forecastData, selectedScenario, historicalData]);

  const ForecastChart: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Revenue Forecast
        </CardTitle>
        <CardDescription>
          Revenue projections with confidence intervals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip 
                formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name]}
                labelFormatter={(label) => `Period: ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="historical" 
                stroke="#8884d8" 
                strokeWidth={3}
                name="Historical"
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="conservative" 
                stroke="#ef4444" 
                strokeDasharray="5 5"
                name="Conservative"
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="realistic" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Realistic"
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="optimistic" 
                stroke="#f59e0b" 
                strokeDasharray="3 3"
                name="Optimistic"
                connectNulls={false}
              />
              <ReferenceLine x={format(new Date(), 'MMM yyyy')} stroke="#666" strokeDasharray="2 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );

  const ScenarioModelingPanel: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Scenario Parameters
        </CardTitle>
        <CardDescription>
          Adjust factors to model different scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Base Growth Rate: {scenarioParams.baseGrowthRate}%
          </label>
          <Slider
            value={[scenarioParams.baseGrowthRate]}
            onValueChange={([value]) => setValue('baseGrowthRate', value)}
            max={200}
            min={-50}
            step={1}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="text-sm font-medium mb-2 block">
            Seasonality Factor: {scenarioParams.seasonalityFactor}x
          </label>
          <Slider
            value={[scenarioParams.seasonalityFactor]}
            onValueChange={([value]) => setValue('seasonalityFactor', value)}
            max={2}
            min={0.5}
            step={0.1}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Market Trend Factor: {scenarioParams.marketTrendFactor}x
          </label>
          <Slider
            value={[scenarioParams.marketTrendFactor]}
            onValueChange={([value]) => setValue('marketTrendFactor', value)}
            max={2}
            min={0.5}
            step={0.1}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Audience Growth Rate: {scenarioParams.audienceGrowthRate}%
          </label>
          <Slider
            value={[scenarioParams.audienceGrowthRate]}
            onValueChange={([value]) => setValue('audienceGrowthRate', value)}
            max={100}
            min={-20}
            step={1}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Platform Change Factor: {scenarioParams.platformChangeFactor}x
          </label>
          <Slider
            value={[scenarioParams.platformChangeFactor]}
            onValueChange={([value]) => setValue('platformChangeFactor', value)}
            max={2}
            min={0.5}
            step={0.1}
            className="w-full"
          />
        </div>
      </CardContent>
    </Card>
  );

  const SeasonalTrendsChart: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Seasonal Patterns
        </CardTitle>
        <CardDescription>
          Monthly revenue patterns based on historical data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={seasonalPatterns.map((pattern, index) => ({
              month: format(new Date(2024, pattern.month), 'MMM'),
              factor: pattern.factor,
              variance: pattern.variance
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'factor' ? `${Number(value).toFixed(2)}x` : `${Number(value).toFixed(2)}`,
                  name === 'factor' ? 'Seasonal Factor' : 'Variance'
                ]}
              />
              <Bar dataKey="factor" fill="#8884d8" name="Seasonal Factor" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );

  const RevenueMetricsGrid: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4" />
            Current Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${metrics?.currentRevenue.toLocaleString() || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Latest month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4" />
            Projected Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${metrics?.totalForecast.toLocaleString() || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Next {selectedTimeRange} months
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            Growth Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-1">
            {metrics?.growthRate.toFixed(1)}%
            {metrics && metrics.growthRate > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Projected growth
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4" />
            Confidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics?.averageConfidence.toFixed(0)}%
          </div>
          <Progress 
            value={metrics?.averageConfidence || 0} 
            className="mt-2 h-2" 
          />
        </CardContent>
      </Card>
    </div>
  );

  const ForecastAccuracyIndicator: React.FC = () => {
    const accuracy = metrics?.averageConfidence || 0;
    const getAccuracyColor = (acc: number) => {
      if (acc >= 80) return 'text-green-600';
      if (acc >= 60) return 'text-yellow-600';
      return 'text-red-600';
    };

    const getAccuracyIcon = (acc: number) => {
      if (acc >= 80) return <CheckCircle className="h-4 w-4" />;
      if (acc >= 60) return <Info className="h-4 w-4" />;
      return <AlertTriangle className="h-4 w-4" />;
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Forecast Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 ${getAccuracyColor(accuracy)}`}>
              {getAccuracyIcon(accuracy)}
              <span className="font-semibold">{accuracy.toFixed(0)}% Confidence</span>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>
              • Forecast confidence decreases over time
            </p>
            <p>
              • Based on {historicalData.length} months of historical data
            </p>
            <p>
              • Consider updating parameters monthly for better accuracy
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const TimeRangeSelector: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle>Forecast Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Forecast Period
          </label>
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="18">18 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="text-sm font-medium mb-2 block">
            Scenario View
          </label>
          <Select value={selectedScenario} onValueChange={(value: 'conservative' | 'realistic' | 'optimistic') => setSelectedScenario(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservative</SelectItem>
              <SelectItem value="realistic">Realistic</SelectItem>
              <SelectItem value="optimistic">Optimistic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button className="w-full" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Forecast
        </Button>