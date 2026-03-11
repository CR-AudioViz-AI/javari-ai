'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, TrendingUp, TrendingDown, Users, DollarSign, BarChart3, Download, Filter, Loader2, AlertCircle } from 'lucide-react';
import { useCreatorAnalytics } from '@/hooks/useCreatorAnalytics';
import { RevenueChart } from '@/components/creator/analytics/RevenueChart';
import { AudienceEngagementMetrics } from '@/components/creator/analytics/AudienceEngagementMetrics';
import { ContentPerformanceGrid } from '@/components/creator/analytics/ContentPerformanceGrid';
import { GrowthMetricsCard } from '@/components/creator/analytics/GrowthMetricsCard';
import { RevenueForecastChart } from '@/components/creator/analytics/RevenueForecastChart';
import { AnalyticsFilters } from '@/components/creator/analytics/AnalyticsFilters';
import { MetricsSummaryCards } from '@/components/creator/analytics/MetricsSummaryCards';
import { ExportReportButton } from '@/components/creator/analytics/ExportReportButton';
import { AnalyticsFiltersType, DateRange, MetricsSummary, AnalyticsData } from '@/types/creator-analytics';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

/**
 * Creator Performance Analytics Dashboard
 * 
 * Comprehensive analytics dashboard providing:
 * - Revenue trends and forecasting
 * - Audience engagement metrics
 * - Content performance tracking
 * - Growth analytics with ML predictions
 * - Real-time data updates
 * - Export capabilities
 */
export default function CreatorAnalyticsPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [filters, setFilters] = useState<AnalyticsFiltersType>({
    dateRange: 'last_30_days' as DateRange,
    contentType: 'all',
    revenueSource: 'all',
    sortBy: 'date_desc'
  });
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const {
    data: analyticsData,
    summary,
    isLoading,
    error,
    refetch,
    lastUpdated
  } = useCreatorAnalytics(filters);

  /**
   * Calculate trend indicators for key metrics
   */
  const trendData = useMemo(() => {
    if (!analyticsData || !summary) return null;

    return {
      revenue: {
        current: summary.totalRevenue,
        previous: summary.previousRevenue,
        trend: ((summary.totalRevenue - summary.previousRevenue) / summary.previousRevenue) * 100
      },
      engagement: {
        current: summary.avgEngagementRate,
        previous: summary.previousEngagementRate,
        trend: summary.avgEngagementRate - summary.previousEngagementRate
      },
      audience: {
        current: summary.totalFollowers,
        previous: summary.previousFollowers,
        trend: ((summary.totalFollowers - summary.previousFollowers) / summary.previousFollowers) * 100
      }
    };
  }, [analyticsData, summary]);

  /**
   * Handle filter changes and data refresh
   */
  const handleFiltersChange = (newFilters: Partial<AnalyticsFiltersType>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  /**
   * Format last updated timestamp
   */
  const formatLastUpdated = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return timestamp.toLocaleDateString();
  };

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Failed to Load Analytics</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            We encountered an error while loading your analytics data. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creator Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your performance, revenue, and audience engagement
          </p>
          {lastUpdated && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Last updated {formatLastUpdated(lastUpdated)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-accent")}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          
          {analyticsData && (
            <ExportReportButton 
              data={analyticsData}
              filters={filters}
              summary={summary}
            />
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-6">
            <AnalyticsFilters 
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading analytics data...</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && analyticsData && summary && (
        <>
          {/* Summary Cards */}
          <MetricsSummaryCards 
            summary={summary}
            trendData={trendData}
          />

          {/* Main Dashboard Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:w-fit lg:grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="audience">Audience</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Revenue Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RevenueChart 
                      data={analyticsData.revenueData}
                      dateRange={filters.dateRange}
                    />
                  </CardContent>
                </Card>

                {/* Growth Metrics */}
                <GrowthMetricsCard 
                  metrics={analyticsData.growthMetrics}
                  className="lg:col-span-1"
                />
              </div>

              {/* Audience Engagement Overview */}
              <AudienceEngagementMetrics 
                data={analyticsData.engagementData}
                summary={summary}
              />

              {/* Top Performing Content Preview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Top Performing Content
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setActiveTab('content')}
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ContentPerformanceGrid 
                    data={analyticsData.contentPerformance.slice(0, 6)}
                    compact={true}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Trends */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Revenue Trends & Analytics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RevenueChart 
                      data={analyticsData.revenueData}
                      dateRange={filters.dateRange}
                      detailed={true}
                    />
                  </CardContent>
                </Card>

                {/* Revenue Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Sources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analyticsData.revenueBreakdown.map((source, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{source.source}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPercentage(source.percentage)} of total
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(source.amount)}</p>
                          <Badge variant={source.trend > 0 ? "default" : "secondary"}>
                            {source.trend > 0 ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {formatPercentage(Math.abs(source.trend))}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Forecast */}
              <RevenueForecastChart 
                historicalData={analyticsData.revenueData}
                forecastData={analyticsData.revenueForecast}
              />
            </TabsContent>

            {/* Audience Tab */}
            <TabsContent value="audience" className="space-y-6 mt-6">
              <AudienceEngagementMetrics 
                data={analyticsData.engagementData}
                summary={summary}
                detailed={true}
              />
              
              {/* Audience Growth */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Audience Growth & Demographics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Growth Stats */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Growth Statistics</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">New Followers</span>
                          <span className="font-medium">{formatNumber(summary.newFollowers)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Unfollows</span>
                          <span className="font-medium">{formatNumber(summary.unfollows)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Net Growth</span>
                          <span className="font-medium text-green-600">
                            +{formatNumber(summary.newFollowers - summary.unfollows)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Demographics */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Top Locations</h4>
                      <div className="space-y-2">
                        {analyticsData.audienceDemographics.topLocations.map((location, index) => (
                          <div key={index} className="flex justify-between">
                            <span className="text-sm text-muted-foreground">{location.country}</span>
                            <span className="font-medium">{formatPercentage(location.percentage)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Age Groups */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Age Groups</h4>
                      <div className="space-y-2">
                        {analyticsData.audienceDemographics.ageGroups.map((group, index) => (
                          <div key={index} className="flex justify-between">
                            <span className="text-sm text-muted-foreground">{group.range}</span>
                            <span className="font-medium">{formatPercentage(group.percentage)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-6 mt-6">
              <ContentPerformanceGrid 
                data={analyticsData.contentPerformance}
                detailed={true}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}