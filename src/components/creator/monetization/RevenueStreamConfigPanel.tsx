"use client";

import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, DollarSign, TrendingUp, Settings, Users, CreditCard, Calculator, Eye, Save, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Validation schemas
const subscriptionTierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Tier name is required"),
  description: z.string().optional(),
  price: z.number().min(0.99, "Minimum price is $0.99"),
  currency: z.string().default("USD"),
  billingCycle: z.enum(["monthly", "yearly"]),
  features: z.array(z.string()),
  maxSubscribers: z.number().optional(),
  isActive: z.boolean().default(true),
});

const tipSettingSchema = z.object({
  enabled: z.boolean().default(true),
  suggestedAmounts: z.array(z.number().min(1)),
  minimumAmount: z.number().min(1),
  maximumAmount: z.number().optional(),
  goal: z.number().optional(),
  goalDescription: z.string().optional(),
});

const premiumContentSchema = z.object({
  id: z.string().optional(),
  contentType: z.enum(["track", "album", "livestream", "exclusive"]),
  title: z.string().min(1, "Title is required"),
  price: z.number().min(0.99),
  currency: z.string().default("USD"),
  accessDuration: z.number().optional(),
  isActive: z.boolean().default(true),
});

const customPricingSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Model name is required"),
  type: z.enum(["pay-per-view", "time-based", "volume-discount", "dynamic"]),
  basePrice: z.number().min(0),
  rules: z.array(z.object({
    condition: z.string(),
    modifier: z.number(),
    type: z.enum(["percentage", "fixed"]),
  })),
  isActive: z.boolean().default(true),
});

const paymentMethodSchema = z.object({
  stripe: z.object({
    enabled: z.boolean().default(false),
    accountId: z.string().optional(),
    webhookSecret: z.string().optional(),
  }),
  paypal: z.object({
    enabled: z.boolean().default(false),
    clientId: z.string().optional(),
    webhookId: z.string().optional(),
  }),
  crypto: z.object({
    enabled: z.boolean().default(false),
    supportedCurrencies: z.array(z.string()),
  }),
});

const taxConfigSchema = z.object({
  enabled: z.boolean().default(false),
  taxRate: z.number().min(0).max(100),
  taxIncluded: z.boolean().default(false),
  region: z.string().optional(),
  taxId: z.string().optional(),
});

const revenueConfigSchema = z.object({
  subscriptionTiers: z.array(subscriptionTierSchema),
  tipSettings: tipSettingSchema,
  premiumContent: z.array(premiumContentSchema),
  customPricingModels: z.array(customPricingSchema),
  paymentMethods: paymentMethodSchema,
  taxConfiguration: taxConfigSchema,
});

type RevenueConfigFormData = z.infer<typeof revenueConfigSchema>;

interface RevenueStreamConfigPanelProps {
  creatorId: string;
  initialConfig?: Partial<RevenueConfigFormData>;
  onConfigUpdate?: (config: RevenueConfigFormData) => void;
  className?: string;
}

interface AnalyticsData {
  totalRevenue: number;
  monthlyRecurring: number;
  oneTimePayments: number;
  subscribers: number;
  revenueGrowth: number;
  topTier: string;
  projectedMonthly: number;
}

interface RevenueProjection {
  month: string;
  subscription: number;
  tips: number;
  premium: number;
  total: number;
}

export default function RevenueStreamConfigPanel({
  creatorId,
  initialConfig,
  onConfigUpdate,
  className = "",
}: RevenueStreamConfigPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("subscriptions");
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 15420.50,
    monthlyRecurring: 8945.00,
    oneTimePayments: 6475.50,
    subscribers: 342,
    revenueGrowth: 12.5,
    topTier: "Pro Creator",
    projectedMonthly: 11200.00,
  });

  const form = useForm<RevenueConfigFormData>({
    resolver: zodResolver(revenueConfigSchema),
    defaultValues: {
      subscriptionTiers: initialConfig?.subscriptionTiers || [{
        name: "Basic Support",
        description: "Support my music journey",
        price: 4.99,
        currency: "USD",
        billingCycle: "monthly",
        features: ["Early access to tracks", "Monthly updates"],
        isActive: true,
      }],
      tipSettings: initialConfig?.tipSettings || {
        enabled: true,
        suggestedAmounts: [1, 5, 10, 25, 50],
        minimumAmount: 1,
        goal: 500,
        goalDescription: "Monthly equipment fund",
      },
      premiumContent: initialConfig?.premiumContent || [],
      customPricingModels: initialConfig?.customPricingModels || [],
      paymentMethods: initialConfig?.paymentMethods || {
        stripe: { enabled: true },
        paypal: { enabled: false },
        crypto: { enabled: false, supportedCurrencies: [] },
      },
      taxConfiguration: initialConfig?.taxConfiguration || {
        enabled: false,
        taxRate: 0,
        taxIncluded: false,
      },
    },
  });

  const {
    fields: subscriptionFields,
    append: appendSubscription,
    remove: removeSubscription,
  } = useFieldArray({
    control: form.control,
    name: "subscriptionTiers",
  });

  const {
    fields: premiumFields,
    append: appendPremium,
    remove: removePremium,
  } = useFieldArray({
    control: form.control,
    name: "premiumContent",
  });

  const {
    fields: customPricingFields,
    append: appendCustomPricing,
    remove: removeCustomPricing,
  } = useFieldArray({
    control: form.control,
    name: "customPricingModels",
  });

  const revenueProjections: RevenueProjection[] = [
    { month: "Jan", subscription: 8500, tips: 1200, premium: 800, total: 10500 },
    { month: "Feb", subscription: 8945, tips: 1350, premium: 920, total: 11215 },
    { month: "Mar", subscription: 9200, tips: 1100, premium: 1100, total: 11400 },
    { month: "Apr", subscription: 9650, tips: 1450, premium: 1200, total: 12300 },
    { month: "May", subscription: 10100, tips: 1600, premium: 1350, total: 13050 },
    { month: "Jun", subscription: 10500, tips: 1800, premium: 1500, total: 13800 },
  ];

  const revenueBreakdown = [
    { name: "Subscriptions", value: analytics.monthlyRecurring, color: "#3B82F6" },
    { name: "Tips", value: analytics.oneTimePayments * 0.6, color: "#10B981" },
    { name: "Premium Content", value: analytics.oneTimePayments * 0.4, color: "#F59E0B" },
  ];

  const onSubmit = async (data: RevenueConfigFormData) => {
    setIsLoading(true);
    try {
      // Here you would typically save to Supabase
      console.log("Saving revenue configuration:", data);
      onConfigUpdate?.(data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error("Failed to save configuration:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMonthlyProjection = () => {
    const subscriptionRevenue = subscriptionFields.reduce((sum, tier) => {
      const price = form.watch(`subscriptionTiers.${subscriptionFields.indexOf(tier)}.price`) || 0;
      return sum + (price * 30); // Assume 30 subscribers per tier
    }, 0);
    
    const tipRevenue = form.watch("tipSettings.goal") || 0;
    
    return subscriptionRevenue + tipRevenue;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics.revenueGrowth}% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.monthlyRecurring.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              From {analytics.subscribers} subscribers
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">One-time Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.oneTimePayments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Tips & premium content
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Monthly</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${calculateMonthlyProjection().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Based on current config
            </p>
          </CardContent>
        </Card>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
              <TabsTrigger value="tips">Tips</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Subscription Tiers Tab */}
            <TabsContent value="subscriptions" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Subscription Tiers</h3>
                  <p className="text-sm text-muted-foreground">
                    Create recurring revenue streams with subscription tiers
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => appendSubscription({
                    name: "",
                    description: "",
                    price: 4.99,
                    currency: "USD",
                    billingCycle: "monthly",
                    features: [],
                    isActive: true,
                  })}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Tier
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subscriptionFields.map((field, index) => (
                  <Card key={field.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Tier {index + 1}</CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSubscription(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name={`subscriptionTiers.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Basic Support" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`subscriptionTiers.${index}.price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0.99"
                                  placeholder="4.99"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`subscriptionTiers.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Support my music journey with exclusive benefits"
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name={`subscriptionTiers.${index}.billingCycle`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Billing Cycle</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select cycle" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`subscriptionTiers.${index}.isActive`}
                          render={({ field }) => (
                            <FormItem className="flex flex-col justify-end">
                              <div className="flex items-center space-x-2 pb-2">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormLabel>Active</FormLabel>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Estimated monthly revenue: ${((form.watch(`subscriptionTiers.${index}.price`) || 0) * 30).toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Tips Tab */}
            <TabsContent value="tips" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Tip Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Configure tip amounts and goals for your audience
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Tip Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tipSettings.enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Tips</FormLabel>
                          <FormDescription>
                            Allow your audience to send you tips
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("tipSettings.enabled") && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="tipSettings.minimumAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Amount ($)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="1"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="tipSettings.maximumAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Maximum Amount ($)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Optional"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div>
                        <Label>Suggested Amounts ($)</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {form.watch("tipSettings.suggestedAmounts")?.map((amount, index) => (
                            <Badge key={index} variant="outline">
                              ${amount}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Quick tip amounts for your audience
                        </p>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Tip Goal</h4>
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="tipSettings.goal"
                            render={({ field }) => (
                              <FormItem>