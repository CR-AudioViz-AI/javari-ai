```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  CheckCircle, 
  Circle, 
  Upload, 
  TestTube, 
  DollarSign, 
  Store, 
  ArrowLeft, 
  ArrowRight,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  Info,
  Eye,
  Download,
  Star,
  Users,
  TrendingUp,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// Schema definitions
const agentBasicInfoSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  logoUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  repositoryUrl: z.string().url().optional(),
  contactEmail: z.string().email('Valid email is required'),
});

const capabilityTestingSchema = z.object({
  selectedCapabilities: z.array(z.string()).min(1, 'Select at least one capability'),
  testConfiguration: z.object({
    timeout: z.number().min(1000).max(30000),
    maxRetries: z.number().min(0).max(5),
    environment: z.enum(['development', 'staging', 'production']),
  }),
});

const pricingConfigurationSchema = z.object({
  pricingModel: z.enum(['free', 'usage', 'subscription', 'custom']),
  basePrice: z.number().min(0),
  usageTiers: z.array(z.object({
    name: z.string(),
    minUnits: z.number(),
    maxUnits: z.number().optional(),
    pricePerUnit: z.number(),
  })).optional(),
  subscriptionPlans: z.array(z.object({
    name: z.string(),
    price: z.number(),
    features: z.array(z.string()),
    billingPeriod: z.enum(['monthly', 'yearly']),
  })).optional(),
  freeTrialDays: z.number().min(0).max(365).optional(),
  customPricingNote: z.string().optional(),
});

const marketplaceListingSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  shortDescription: z.string().min(20, 'Short description must be at least 20 characters'),
  longDescription: z.string().min(100, 'Long description must be at least 100 characters'),
  screenshots: z.array(z.string().url()).max(5, 'Maximum 5 screenshots'),
  demoUrl: z.string().url().optional(),
  supportUrl: z.string().url(),
  privacyPolicyUrl: z.string().url(),
  termsOfServiceUrl: z.string().url(),
  targetAudience: z.array(z.string()).min(1, 'Select target audience'),
  keywords: z.array(z.string()).max(10, 'Maximum 10 keywords'),
  visibility: z.enum(['public', 'unlisted', 'private']),
  featured: z.boolean(),
});

const fullSchema = z.object({
  basicInfo: agentBasicInfoSchema,
  capabilityTesting: capabilityTestingSchema,
  pricing: pricingConfigurationSchema,
  listing: marketplaceListingSchema,
});

type FormData = z.infer<typeof fullSchema>;

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
  schema: z.ZodSchema<any>;
}

interface CapabilityTest {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  result?: {
    score: number;
    duration: number;
    details: string;
    errors?: string[];
  };
}

interface PricingTier {
  name: string;
  minUnits: number;
  maxUnits?: number;
  pricePerUnit: number;
}

interface SubscriptionPlan {
  name: string;
  price: number;
  features: string[];
  billingPeriod: 'monthly' | 'yearly';
}

interface AgentOnboardingWizardProps {
  onComplete?: (data: FormData) => void;
  onCancel?: () => void;
  initialData?: Partial<FormData>;
  className?: string;
}

// Step Components
const AgentBasicInfoStep: React.FC<{ onValidationChange: (isValid: boolean) => void }> = ({
  onValidationChange,
}) => {
  const { register, watch, formState: { errors }, setValue, getValues } = useForm();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const watchedValues = watch();

  useEffect(() => {
    const isValid = Object.keys(errors).length === 0 && 
                   watchedValues.name?.length >= 2 &&
                   watchedValues.description?.length >= 10 &&
                   watchedValues.category &&
                   tags.length > 0 &&
                   watchedValues.contactEmail;
    onValidationChange(isValid);
  }, [errors, watchedValues, tags, onValidationChange]);

  const handleLogoUpload = useCallback(async (file: File) => {
    setLogoFile(file);
    // TODO: Implement file upload to storage service
    const logoUrl = URL.createObjectURL(file);
    setValue('logoUrl', logoUrl);
  }, [setValue]);

  const addTag = useCallback(() => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const updatedTags = [...tags, newTag.trim()];
      setTags(updatedTags);
      setValue('tags', updatedTags);
      setNewTag('');
    }
  }, [newTag, tags, setValue]);

  const removeTag = useCallback((tagToRemove: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    setTags(updatedTags);
    setValue('tags', updatedTags);
  }, [tags, setValue]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Agent Name *</Label>
          <Input
            id="name"
            placeholder="My Awesome Agent"
            {...register('name')}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-sm text-red-500" role="alert">
              {errors.name.message as string}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select onValueChange={(value) => setValue('category', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="automation">Automation</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
              <SelectItem value="content">Content Generation</SelectItem>
              <SelectItem value="customer-service">Customer Service</SelectItem>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="productivity">Productivity</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          placeholder="Describe what your agent does and its key features..."
          rows={4}
          {...register('description')}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'description-error' : undefined}
        />
        {errors.description && (
          <p id="description-error" className="text-sm text-red-500" role="alert">
            {errors.description.message as string}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          <input
            type="file"
            id="logo-upload"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('logo-upload')?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Logo
          </Button>
          {logoFile && (
            <Badge variant="secondary">{logoFile.name}</Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags *</Label>
        <div className="flex gap-2 mb-2">
          <Input
            placeholder="Add a tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <Button type="button" onClick={addTag} variant="outline">
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="cursor-pointer">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-red-500"
                aria-label={`Remove ${tag} tag`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact Email *</Label>
          <Input
            id="contactEmail"
            type="email"
            placeholder="contact@example.com"
            {...register('contactEmail')}
            aria-invalid={!!errors.contactEmail}
            aria-describedby={errors.contactEmail ? 'email-error' : undefined}
          />
          {errors.contactEmail && (
            <p id="email-error" className="text-sm text-red-500" role="alert">
              {errors.contactEmail.message as string}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="repositoryUrl">Repository URL</Label>
          <Input
            id="repositoryUrl"
            placeholder="https://github.com/username/repo"
            {...register('repositoryUrl')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="documentationUrl">Documentation URL</Label>
        <Input
          id="documentationUrl"
          placeholder="https://docs.example.com"
          {...register('documentationUrl')}
        />
      </div>
    </div>
  );
};

const CapabilityTestingStep: React.FC<{ onValidationChange: (isValid: boolean) => void }> = ({
  onValidationChange,
}) => {
  const [capabilities, setCapabilities] = useState<CapabilityTest[]>([
    {
      id: 'text-processing',
      name: 'Text Processing',
      description: 'Natural language understanding and generation',
      category: 'Language',
      status: 'pending',
    },
    {
      id: 'image-analysis',
      name: 'Image Analysis',
      description: 'Computer vision and image processing',
      category: 'Vision',
      status: 'pending',
    },
    {
      id: 'api-integration',
      name: 'API Integration',
      description: 'External service integration capabilities',
      category: 'Integration',
      status: 'pending',
    },
    {
      id: 'data-processing',
      name: 'Data Processing',
      description: 'Data analysis and transformation',
      category: 'Analytics',
      status: 'pending',
    },
  ]);

  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testConfiguration, setTestConfiguration] = useState({
    timeout: 10000,
    maxRetries: 2,
    environment: 'development' as const,
  });

  useEffect(() => {
    const hasSelectedCapabilities = selectedCapabilities.length > 0;
    const allSelectedTestsComplete = selectedCapabilities.every(id => {
      const capability = capabilities.find(cap => cap.id === id);
      return capability && ['passed', 'failed'].includes(capability.status);
    });
    onValidationChange(hasSelectedCapabilities && (allSelectedTestsComplete || !isRunningTests));
  }, [selectedCapabilities, capabilities, isRunningTests, onValidationChange]);

  const handleCapabilityToggle = useCallback((capabilityId: string, checked: boolean) => {
    setSelectedCapabilities(prev => 
      checked 
        ? [...prev, capabilityId]
        : prev.filter(id => id !== capabilityId)
    );
  }, []);

  const runTests = useCallback(async () => {
    if (selectedCapabilities.length === 0) return;

    setIsRunningTests(true);
    
    for (const capabilityId of selectedCapabilities) {
      setCapabilities(prev => 
        prev.map(cap => 
          cap.id === capabilityId 
            ? { ...cap, status: 'running' as const }
            : cap
        )
      );

      // Simulate test execution
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      const testResult = {
        score: Math.random() * 100,
        duration: 1000 + Math.random() * 4000,
        details: 'Test completed successfully',
        errors: Math.random() > 0.8 ? ['Minor warning: Performance could be optimized'] : undefined,
      };

      const status = testResult.score > 60 ? 'passed' : 'failed';

      setCapabilities(prev => 
        prev.map(cap => 
          cap.id === capabilityId 
            ? { ...cap, status, result: testResult }
            : cap
        )
      );
    }

    setIsRunningTests(false);
  }, [selectedCapabilities]);

  const getTestStatusColor = (status: CapabilityTest['status']) => {
    switch (status) {
      case 'passed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'running': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getTestStatusIcon = (status: CapabilityTest['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="w-5 h-5" />;
      case 'failed': return <AlertTriangle className="w-5 h-5" />;
      case 'running': return <RefreshCw className="w-5 h-5 animate-spin" />;
      default: return <Circle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Test Configuration
          </CardTitle>
          <CardDescription>
            Configure how your agent capabilities will be tested
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                min={1000}
                max={30000}
                step={1000}
                value={testConfiguration.timeout}
                onChange={(e) => setTestConfiguration(prev => ({
                  ...prev,
                  timeout: parseInt(e.target.value)
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRetries">Max Retries</Label>
              <Input
                id="maxRetries"
                type="number"
                min={0}
                max={5}
                value={testConfiguration.maxRetries}
                onChange={(e) => setTestConfiguration(prev => ({
                  ...prev,
                  maxRetries: parseInt(e.target.value)
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">Environment</Label>
              <Select
                value={testConfiguration.environment}
                onValueChange={(value: 'development' | 'staging' | 'production') => 
                  setTestConfiguration(prev => ({ ...prev, environment: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Capabilities to Test</CardTitle>
          <CardDescription>
            Choose which capabilities you want to test for your agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {capabilities.map((capability) => (
              <div key={capability.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                <Checkbox
                  id={capability.id}
                  checked={selectedCapabilities.includes(capability.id)}
                  onCheckedChange={(checked) => 
                    handleCapabilityToggle(capability.id, checked as boolean)
                  }
                  disabled={isRunningTests}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label 
                        htmlFor={capability.id} 
                        className="font-medium cursor-pointer"
                      >
                        {capability.name}
                      </Label>
                      <Badge variant="outline" className="ml-2">
                        {capability.category}
                      </Badge>
                    </div>
                    <div className={cn("flex items-center gap-2", getTestStatusColor(capability.status))}>
                      {getTestStatusIcon(capability.status)}
                      <span className="text-sm font-medium capitalize">
                        {capability.status}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-1">
                    {capability.description}
                  </p>
                  
                  {capability.result && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span>Score: {Math.round(capability.result.score)}/100</span>
                        <span>Duration: {Math.round(capability.result.duration)}ms</span>
                      </div>
                      <Progress value={capability.result.score} className="h-2" />
                      {capability.result.errors && (
                        <div className="mt-1 text-amber-600">
                          {capability.result.errors.map((error, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span className="text-xs">{error}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center mt-6">
            <Button
              onClick={runTests}
              disabled={selectedCapabilities.length === 0 || isRunningTests}
              className="flex items-center gap-2"
            >
              {isRunningTests ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Selected Tests
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const PricingConfiguration