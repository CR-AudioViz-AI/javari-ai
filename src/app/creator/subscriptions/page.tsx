```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import {
  CreditCard,
  Users,
  DollarSign,
  TrendingUp,
  Settings,
  Plus,
  Edit,
  Trash2,
  Download,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

/**
 * Subscription plan interface
 */
interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billing_interval: 'month' | 'year';
  features: FeatureConfig[];
  usage_limits: UsageLimit[];
  is_active: boolean;
  stripe_price_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Feature configuration interface
 */
interface FeatureConfig {
  id: string;
  name: string;
  enabled: boolean;
  limit?: number;
  description: string;
}

/**
 * Usage limit interface
 */
interface UsageLimit {
  resource: string;
  limit: number;
  period: 'day' | 'month' | 'year';
}

/**
 * Subscription user interface
 */
interface SubscriptionUser {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  usage_data: UsageData;
  created_at: string;
}

/**
 * Usage data interface
 */
interface UsageData {
  [resource: string]: {
    used: number;
    limit: number;
    period_start: string;
    period_end: string;
  };
}

/**
 * Billing metrics interface
 */
interface BillingMetrics {
  total_revenue: number;
  monthly_recurring_revenue: number;
  subscriber_count: number;
  churn_rate: number;
  average_revenue_per_user: number;
  growth_rate: number;
}

/**
 * Invoice interface
 */
interface Invoice {
  id: string;
  amount: number;
  status: string;
  created: number;
  customer_email: string;
  invoice_pdf: string;
}

/**
 * Subscription management hook
 */
function useSubscriptionManagement(creatorId: string) {
  const supabase = useSupabaseClient();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriptionUser[]>([]);
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch subscription plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (plansError) throw plansError;

      // Fetch subscribers
      const { data: subscribersData, error: subscribersError } = await supabase
        .from('subscription_users')
        .select(`
          *,
          subscription_plans (name, price)
        `)
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (subscribersError) throw subscribersError;

      // Fetch billing metrics
      const { data: metricsData, error: metricsError } = await supabase
        .rpc('get_billing_metrics', { creator_id: creatorId });

      if (metricsError) throw metricsError;

      setPlans(plansData || []);
      setSubscribers(subscribersData || []);
      setMetrics(metricsData);

      // Fetch invoices from Stripe
      const response = await fetch(`/api/subscriptions/invoices?creator_id=${creatorId}`);
      if (response.ok) {
        const invoicesData = await response.json();
        setInvoices(invoicesData);
      }
    } catch (err) {
      console.error('Error fetching subscription data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, [supabase, creatorId]);

  useEffect(() => {
    if (creatorId) {
      fetchData();
    }
  }, [creatorId, fetchData]);

  const createPlan = async (planData: Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at' | 'stripe_price_id'>) => {
    try {
      // Create Stripe price
      const stripeResponse = await fetch('/api/subscriptions/create-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: planData.price * 100,
          currency: 'usd',
          interval: planData.billing_interval,
          product_name: planData.name,
        }),
      });

      if (!stripeResponse.ok) throw new Error('Failed to create Stripe price');

      const { price_id } = await stripeResponse.json();

      // Create plan in database
      const { data, error } = await supabase
        .from('subscription_plans')
        .insert([
          {
            ...planData,
            creator_id: creatorId,
            stripe_price_id: price_id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setPlans(prev => [data, ...prev]);
      toast.success('Subscription plan created successfully');
      return data;
    } catch (err) {
      console.error('Error creating plan:', err);
      toast.error('Failed to create subscription plan');
      throw err;
    }
  };

  const updatePlan = async (planId: string, updates: Partial<SubscriptionPlan>) => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .update(updates)
        .eq('id', planId)
        .eq('creator_id', creatorId)
        .select()
        .single();

      if (error) throw error;

      setPlans(prev => prev.map(plan => plan.id === planId ? data : plan));
      toast.success('Plan updated successfully');
      return data;
    } catch (err) {
      console.error('Error updating plan:', err);
      toast.error('Failed to update plan');
      throw err;
    }
  };

  const cancelSubscription = async (subscriptionId: string) => {
    try {
      const response = await fetch(`/api/subscriptions/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });

      if (!response.ok) throw new Error('Failed to cancel subscription');

      await fetchData();
      toast.success('Subscription canceled successfully');
    } catch (err) {
      console.error('Error canceling subscription:', err);
      toast.error('Failed to cancel subscription');
    }
  };

  return {
    plans,
    subscribers,
    metrics,
    invoices,
    loading,
    error,
    createPlan,
    updatePlan,
    cancelSubscription,
    refresh: fetchData,
  };
}

/**
 * Plan builder component
 */
function PlanBuilder({ onCreatePlan }: { onCreatePlan: (plan: any) => Promise<void> }) {
  const { control, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      billing_interval: 'month',
      features: [],
      usage_limits: [],
      is_active: true,
    },
  });

  const [features, setFeatures] = useState<FeatureConfig[]>([]);
  const [usageLimits, setUsageLimits] = useState<UsageLimit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const onSubmit = async (data: any) => {
    try {
      await onCreatePlan({
        ...data,
        features,
        usage_limits: usageLimits,
      });
      reset();
      setFeatures([]);
      setUsageLimits([]);
      setDialogOpen(false);
    } catch (err) {
      // Error handled in hook
    }
  };

  const addFeature = () => {
    setFeatures(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        enabled: true,
        description: '',
      },
    ]);
  };

  const updateFeature = (id: string, updates: Partial<FeatureConfig>) => {
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFeature = (id: string) => {
    setFeatures(prev => prev.filter(f => f.id !== id));
  };

  const addUsageLimit = () => {
    setUsageLimits(prev => [
      ...prev,
      {
        resource: '',
        limit: 0,
        period: 'month',
      },
    ]);
  };

  const updateUsageLimit = (index: number, updates: Partial<UsageLimit>) => {
    setUsageLimits(prev => prev.map((limit, i) => i === index ? { ...limit, ...updates } : limit));
  };

  const removeUsageLimit = (index: number) => {
    setUsageLimits(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Subscription Plan</DialogTitle>
          <DialogDescription>
            Build a new subscription tier with custom features and usage limits
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name</Label>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Plan name is required' }}
                render={({ field }) => (
                  <Input {...field} placeholder="e.g. Pro Plan" />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Controller
                name="price"
                control={control}
                rules={{ required: 'Price is required', min: 0 }}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="number"
                    step="0.01"
                    placeholder="9.99"
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Input {...field} placeholder="Plan description..." />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing_interval">Billing Interval</Label>
            <Controller
              name="billing_interval"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Features</Label>
              <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                <Plus className="h-4 w-4 mr-2" />
                Add Feature
              </Button>
            </div>

            {features.map((feature) => (
              <Card key={feature.id}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4">
                      <Input
                        placeholder="Feature name"
                        value={feature.name}
                        onChange={(e) => updateFeature(feature.id, { name: e.target.value })}
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        placeholder="Description"
                        value={feature.description}
                        onChange={(e) => updateFeature(feature.id, { description: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Limit"
                        value={feature.limit || ''}
                        onChange={(e) => updateFeature(feature.id, { limit: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="col-span-1">
                      <Switch
                        checked={feature.enabled}
                        onCheckedChange={(enabled) => updateFeature(feature.id, { enabled })}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFeature(feature.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Usage Limits</Label>
              <Button type="button" variant="outline" size="sm" onClick={addUsageLimit}>
                <Plus className="h-4 w-4 mr-2" />
                Add Limit
              </Button>
            </div>

            {usageLimits.map((limit, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4">
                      <Input
                        placeholder="Resource (e.g. api_calls)"
                        value={limit.resource}
                        onChange={(e) => updateUsageLimit(index, { resource: e.target.value })}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder="Limit"
                        value={limit.limit}
                        onChange={(e) => updateUsageLimit(index, { limit: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="col-span-3">
                      <Select
                        value={limit.period}
                        onValueChange={(period: any) => updateUsageLimit(index, { period })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Per Day</SelectItem>
                          <SelectItem value="month">Per Month</SelectItem>
                          <SelectItem value="year">Per Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUsageLimit(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label>Active Plan</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Plan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Subscription metrics component
 */
function SubscriptionMetrics({ metrics }: { metrics: BillingMetrics | null }) {
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.total_revenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">All time earnings</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.monthly_recurring_revenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.growth_rate > 0 ? '+' : ''}{metrics.growth_rate.toFixed(1)}% from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Subscribers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.subscriber_count}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.churn_rate.toFixed(1)}% churn rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Revenue Per User</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.average_revenue_per_user.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Monthly ARPU</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Usage analytics component
 */
function UsageAnalytics({ subscribers }: { subscribers: SubscriptionUser[] }) {
  const usageData = subscribers.map(sub => {
    const totalUsage = Object.values(sub.usage_data).reduce((sum, usage) => sum + (usage.used / usage.limit) * 100, 0);
    return {
      name: sub.user_id.slice(-8),
      usage: totalUsage / Object.keys(sub.usage_data).length,
      plan: sub.plan_id,
    };
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Analytics</CardTitle>
        <CardDescription>Subscriber usage patterns across your AI agents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usageData}>
              <CartesianGrid strokeDasharray="3