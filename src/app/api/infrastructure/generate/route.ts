```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { validateInfrastructureRequest } from '@/lib/validators/infrastructure-schema';
import { TerraformGenerator } from '@/lib/infrastructure/terraform-generator';
import { KubernetesGenerator } from '@/lib/infrastructure/kubernetes-generator';
import { ResourceCalculator } from '@/lib/infrastructure/resource-calculator';
import { TemplateEngine } from '@/lib/infrastructure/template-engine';
import type { InfrastructureRequest, InfrastructureResponse } from '@/types/infrastructure';
import Redis from 'ioredis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

const terraformGenerator = new TerraformGenerator();
const kubernetesGenerator = new KubernetesGenerator();
const resourceCalculator = new ResourceCalculator();
const templateEngine = new TemplateEngine();

async function validateCloudProviderLimits(
  provider: string,
  resources: any
): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.CLOUD_VALIDATOR_API_URL}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLOUD_VALIDATOR_API_KEY}`,
      },
      body: JSON.stringify({ provider, resources }),
    });
    
    if (!response.ok) {
      throw new Error('Cloud provider validation failed');
    }
    
    const result = await response.json();
    return result.valid;
  } catch (error) {
    console.error('Cloud provider validation error:', error);
    return false;
  }
}

async function estimateCosts(
  provider: string,
  resources: any
): Promise<{ monthlyCost: number; yearlyCost: number }> {
  try {
    const response = await fetch(`${process.env.COST_ESTIMATION_API_URL}/estimate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COST_ESTIMATION_API_KEY}`,
      },
      body: JSON.stringify({ provider, resources }),
    });
    
    if (!response.ok) {
      throw new Error('Cost estimation failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Cost estimation error:', error);
    return { monthlyCost: 0, yearlyCost: 0 };
  }
}

async function checkContainerImageAvailability(images: string[]): Promise<boolean> {
  try {
    const checks = images.map(async (image) => {
      const response = await fetch(`${process.env.CONTAINER_REGISTRY_API_URL}/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CONTAINER_REGISTRY_API_KEY}`,
        },
        body: JSON.stringify({ image }),
      });
      
      const result = await response.json();
      return result.available;
    });
    
    const results = await Promise.all(checks);
    return results.every(Boolean);
  } catch (error) {
    console.error('Container image availability check error:', error);
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await rateLimit.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json() as InfrastructureRequest;
    
    const validation = validateInfrastructureRequest(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const {
      applicationName,
      cloudProvider,
      region,
      environment,
      performanceRequirements,
      scalingRequirements,
      securityRequirements,
      costConstraints,
      containerImages,
      customRequirements
    } = validation.data;

    // Generate cache key
    const cacheKey = `infra:${Buffer.from(JSON.stringify(body)).toString('base64')}`;
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      const cachedResult = JSON.parse(cached);
      return NextResponse.json(cachedResult);
    }

    // Validate container images
    if (containerImages?.length > 0) {
      const imagesAvailable = await checkContainerImageAvailability(containerImages);
      if (!imagesAvailable) {
        return NextResponse.json(
          { error: 'One or more container images are not available' },
          { status: 400 }
        );
      }
    }

    // Calculate optimal resources
    const calculatedResources = await resourceCalculator.calculate({
      performanceRequirements,
      scalingRequirements,
      environment,
      cloudProvider
    });

    // Validate against cloud provider limits
    const withinLimits = await validateCloudProviderLimits(
      cloudProvider,
      calculatedResources
    );

    if (!withinLimits) {
      return NextResponse.json(
        { error: 'Resource requirements exceed cloud provider limits' },
        { status: 400 }
      );
    }

    // Estimate costs
    const costEstimate = await estimateCosts(cloudProvider, calculatedResources);
    
    if (costConstraints?.maxMonthlyCost && 
        costEstimate.monthlyCost > costConstraints.maxMonthlyCost) {
      return NextResponse.json(
        { 
          error: 'Estimated costs exceed budget constraints',
          estimatedCost: costEstimate.monthlyCost,
          maxAllowedCost: costConstraints.maxMonthlyCost
        },
        { status: 400 }
      );
    }

    // Get infrastructure templates from Supabase
    const { data: templates, error: templatesError } = await supabase
      .from('infrastructure_templates')
      .select('*')
      .eq('cloud_provider', cloudProvider)
      .eq('environment_type', environment);

    if (templatesError) {
      throw new Error(`Failed to fetch templates: ${templatesError.message}`);
    }

    // Select appropriate templates
    const selectedTemplates = await templateEngine.selectTemplates({
      templates: templates || [],
      requirements: {
        performanceRequirements,
        scalingRequirements,
        securityRequirements,
        customRequirements
      }
    });

    // Generate Terraform configuration
    const terraformConfig = await terraformGenerator.generate({
      applicationName,
      cloudProvider,
      region,
      environment,
      resources: calculatedResources,
      securityRequirements,
      templates: selectedTemplates.terraform,
      customRequirements
    });

    // Generate Kubernetes manifests
    const kubernetesManifests = await kubernetesGenerator.generate({
      applicationName,
      environment,
      resources: calculatedResources,
      scalingRequirements,
      securityRequirements,
      containerImages: containerImages || [],
      templates: selectedTemplates.kubernetes,
      customRequirements
    });

    // Generate unique deployment ID
    const deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Store generated configuration in Supabase
    const { data: savedConfig, error: saveError } = await supabase
      .from('infrastructure_deployments')
      .insert({
        deployment_id: deploymentId,
        application_name: applicationName,
        cloud_provider: cloudProvider,
        region,
        environment,
        terraform_config: terraformConfig,
        kubernetes_manifests: kubernetesManifests,
        resource_allocation: calculatedResources,
        cost_estimate: costEstimate,
        performance_requirements: performanceRequirements,
        scaling_requirements: scalingRequirements,
        security_requirements: securityRequirements,
        status: 'generated',
        created_by: identifier,
        metadata: {
          templates_used: selectedTemplates,
          generation_timestamp: new Date().toISOString(),
          custom_requirements: customRequirements
        }
      })
      .select()
      .single();

    if (saveError) {
      throw new Error(`Failed to save configuration: ${saveError.message}`);
    }

    const response: InfrastructureResponse = {
      deploymentId,
      terraformConfig,
      kubernetesManifests,
      resourceAllocation: calculatedResources,
      costEstimate,
      recommendations: await generateRecommendations({
        calculatedResources,
        costEstimate,
        performanceRequirements,
        scalingRequirements
      }),
      validationResults: {
        cloudProviderLimits: withinLimits,
        containerImagesAvailable: true,
        costWithinBudget: !costConstraints?.maxMonthlyCost || 
          costEstimate.monthlyCost <= costConstraints.maxMonthlyCost
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        templatesUsed: selectedTemplates,
        version: '1.0'
      }
    };

    // Cache the result for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(response));

    return NextResponse.json(response);

  } catch (error) {
    console.error('Infrastructure generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Deployment ID is required' },
        { status: 400 }
      );
    }

    // Fetch deployment from Supabase
    const { data: deployment, error } = await supabase
      .from('infrastructure_deployments')
      .select('*')
      .eq('deployment_id', deploymentId)
      .single();

    if (error || !deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(deployment);

  } catch (error) {
    console.error('Deployment retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function generateRecommendations(params: {
  calculatedResources: any;
  costEstimate: any;
  performanceRequirements: any;
  scalingRequirements: any;
}): Promise<string[]> {
  const recommendations: string[] = [];

  // Cost optimization recommendations
  if (params.costEstimate.monthlyCost > 1000) {
    recommendations.push('Consider using spot instances to reduce costs by up to 70%');
  }

  // Performance recommendations
  if (params.performanceRequirements.cpu > 16) {
    recommendations.push('Consider using compute-optimized instance types for CPU-intensive workloads');
  }

  // Scaling recommendations
  if (params.scalingRequirements.maxReplicas > 100) {
    recommendations.push('Implement horizontal pod autoscaling with custom metrics for better scaling efficiency');
  }

  return recommendations;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```