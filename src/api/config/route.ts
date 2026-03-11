```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import crypto from 'crypto';
import { rateLimit } from '@/lib/rate-limit';

// Configuration schemas
const ConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  settings: z.record(z.any()),
  secrets: z.record(z.string()).optional(),
  metadata: z.object({
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    owner: z.string(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  }),
});

const SecretsRotationSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  secretKeys: z.array(z.string()),
  rotationPolicy: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    autoRotate: z.boolean(),
  }),
});

const ValidationRequestSchema = z.object({
  configuration: ConfigSchema.omit({ metadata: true }).partial(),
  environment: z.enum(['development', 'staging', 'production']),
  validateDependencies: z.boolean().default(true),
});

const DriftCheckSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  configVersion: z.string().optional(),
});

// Types
interface ConfigurationRecord {
  id: string;
  environment: string;
  version: string;
  settings: Record<string, any>;
  secrets_hash: string | null;
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SecretRecord {
  id: string;
  environment: string;
  key_name: string;
  value_hash: string;
  rotation_policy: Record<string, any>;
  last_rotated: string;
  next_rotation: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dependencies: {
    resolved: string[];
    missing: string[];
  };
}

interface DriftResult {
  hasDrift: boolean;
  differences: Array<{
    key: string;
    expected: any;
    actual: any;
    severity: 'low' | 'medium' | 'high';
  }>;
  lastChecked: string;
}

// Rate limiting
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

// Utility functions
function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

function validateEnvironmentAccess(userRole: string, environment: string): boolean {
  const accessMatrix = {
    'admin': ['development', 'staging', 'production'],
    'developer': ['development', 'staging'],
    'viewer': ['development'],
  };
  
  return accessMatrix[userRole as keyof typeof accessMatrix]?.includes(environment) || false;
}

async function validateConfiguration(
  config: Partial<z.infer<typeof ConfigSchema>>,
  environment: string,
  supabase: any
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    dependencies: { resolved: [], missing: [] }
  };

  try {
    // Schema validation
    ConfigSchema.partial().parse(config);

    // Check for required environment-specific settings
    const requiredSettings = {
      production: ['database_url', 'api_url', 'jwt_secret'],
      staging: ['database_url', 'api_url'],
      development: ['database_url']
    };

    const required = requiredSettings[environment as keyof typeof requiredSettings] || [];
    for (const key of required) {
      if (!config.settings?.[key]) {
        result.errors.push(`Missing required setting: ${key}`);
        result.dependencies.missing.push(key);
      } else {
        result.dependencies.resolved.push(key);
      }
    }

    // Validate settings values
    if (config.settings) {
      for (const [key, value] of Object.entries(config.settings)) {
        if (key.includes('url') && typeof value === 'string') {
          try {
            new URL(value);
          } catch {
            result.errors.push(`Invalid URL format for ${key}: ${value}`);
          }
        }
        
        if (key.includes('port') && typeof value === 'number') {
          if (value < 1 || value > 65535) {
            result.errors.push(`Invalid port number for ${key}: ${value}`);
          }
        }
      }
    }

    // Check for configuration conflicts
    const { data: existingConfigs } = await supabase
      .from('configurations')
      .select('settings, version')
      .eq('environment', environment)
      .eq('is_active', true);

    if (existingConfigs && existingConfigs.length > 0) {
      const existing = existingConfigs[0];
      if (config.version && config.version <= existing.version) {
        result.warnings.push(`Version ${config.version} is not greater than current version ${existing.version}`);
      }
    }

    result.valid = result.errors.length === 0;
  } catch (error) {
    result.valid = false;
    result.errors.push(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

async function detectDrift(
  environment: string,
  expectedVersion: string | undefined,
  supabase: any
): Promise<DriftResult> {
  const result: DriftResult = {
    hasDrift: false,
    differences: [],
    lastChecked: new Date().toISOString()
  };

  try {
    // Get current active configuration
    const { data: currentConfig } = await supabase
      .from('configurations')
      .select('*')
      .eq('environment', environment)
      .eq('is_active', true)
      .single();

    if (!currentConfig) {
      result.differences.push({
        key: 'configuration',
        expected: 'exists',
        actual: 'missing',
        severity: 'high'
      });
      result.hasDrift = true;
      return result;
    }

    // Get expected configuration (latest or specified version)
    const versionFilter = expectedVersion ? expectedVersion : currentConfig.version;
    const { data: expectedConfig } = await supabase
      .from('configuration_templates')
      .select('*')
      .eq('environment', environment)
      .eq('version', versionFilter)
      .single();

    if (!expectedConfig) {
      result.differences.push({
        key: 'template',
        expected: `version ${versionFilter}`,
        actual: 'missing',
        severity: 'medium'
      });
      result.hasDrift = true;
      return result;
    }

    // Compare configurations
    const compareObjects = (obj1: any, obj2: any, path = '') => {
      for (const key in obj2) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (!(key in obj1)) {
          result.differences.push({
            key: currentPath,
            expected: obj2[key],
            actual: 'missing',
            severity: 'medium'
          });
          result.hasDrift = true;
        } else if (typeof obj2[key] === 'object' && obj2[key] !== null) {
          compareObjects(obj1[key], obj2[key], currentPath);
        } else if (obj1[key] !== obj2[key]) {
          result.differences.push({
            key: currentPath,
            expected: obj2[key],
            actual: obj1[key],
            severity: key.includes('secret') ? 'high' : 'low'
          });
          result.hasDrift = true;
        }
      }
    };

    compareObjects(currentConfig.settings, expectedConfig.settings);

  } catch (error) {
    result.differences.push({
      key: 'drift_detection',
      expected: 'success',
      actual: `error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'high'
    });
    result.hasDrift = true;
  }

  return result;
}

async function rotateSecrets(
  environment: string,
  secretKeys: string[],
  supabase: any
): Promise<{ success: boolean; rotated: string[]; errors: string[] }> {
  const result = {
    success: true,
    rotated: [] as string[],
    errors: [] as string[]
  };

  try {
    for (const keyName of secretKeys) {
      // Generate new secret
      const newSecret = generateSecret();
      const secretHash = hashSecret(newSecret);

      // Update or insert secret record
      const { error: upsertError } = await supabase
        .from('secrets')
        .upsert({
          environment,
          key_name: keyName,
          value_hash: secretHash,
          last_rotated: new Date().toISOString(),
          next_rotation: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        });

      if (upsertError) {
        result.errors.push(`Failed to rotate ${keyName}: ${upsertError.message}`);
        result.success = false;
      } else {
        result.rotated.push(keyName);
        
        // Log rotation event
        await supabase
          .from('audit_logs')
          .insert({
            action: 'secret_rotation',
            environment,
            details: { key_name: keyName },
            created_at: new Date().toISOString()
          });
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Secret rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// GET: Retrieve configuration
export async function GET(request: NextRequest) {
  try {
    await limiter.check(request, 10, 'CONFIG_READ');

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment');
    const version = searchParams.get('version');
    const action = searchParams.get('action');

    if (!environment) {
      return NextResponse.json({ error: 'Environment parameter required' }, { status: 400 });
    }

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!validateEnvironmentAccess(profile?.role || 'viewer', environment)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Handle drift detection
    if (action === 'drift') {
      const driftResult = await detectDrift(environment, version, supabase);
      return NextResponse.json({ data: driftResult });
    }

    // Retrieve configuration
    let query = supabase
      .from('configurations')
      .select('*')
      .eq('environment', environment);

    if (version) {
      query = query.eq('version', version);
    } else {
      query = query.eq('is_active', true);
    }

    const { data: configuration, error } = await query.single();

    if (error) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    // Remove sensitive data for non-admin users
    if (profile?.role !== 'admin') {
      delete configuration.secrets_hash;
    }

    return NextResponse.json({ data: configuration });

  } catch (error) {
    console.error('Configuration retrieval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create or update configuration
export async function POST(request: NextRequest) {
  try {
    await limiter.check(request, 5, 'CONFIG_WRITE');

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Handle validation request
    if (action === 'validate') {
      const validationData = ValidationRequestSchema.parse(body);
      const validationResult = await validateConfiguration(
        validationData.configuration,
        validationData.environment,
        supabase
      );
      return NextResponse.json({ data: validationResult });
    }

    // Handle secrets rotation
    if (action === 'rotate-secrets') {
      const rotationData = SecretsRotationSchema.parse(body);
      
      // Get user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin role required for secret rotation' }, { status: 403 });
      }

      const rotationResult = await rotateSecrets(
        rotationData.environment,
        rotationData.secretKeys,
        supabase
      );

      return NextResponse.json({ data: rotationResult });
    }

    // Handle configuration creation/update
    const configData = ConfigSchema.parse(body);

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!validateEnvironmentAccess(profile?.role || 'viewer', configData.environment)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Validate configuration
    const validationResult = await validateConfiguration(
      configData,
      configData.environment,
      supabase
    );

    if (!validationResult.valid) {
      return NextResponse.json({
        error: 'Configuration validation failed',
        details: validationResult
      }, { status: 400 });
    }

    // Deactivate current configuration
    await supabase
      .from('configurations')
      .update({ is_active: false })
      .eq('environment', configData.environment)
      .eq('is_active', true);

    // Hash secrets if provided
    let secretsHash = null;
    if (configData.secrets) {
      const secretsString = JSON.stringify(configData.secrets);
      secretsHash = hashSecret(secretsString);
    }

    // Insert new configuration
    const { data: newConfig, error: insertError } = await supabase
      .from('configurations')
      .insert({
        environment: configData.environment,
        version: configData.version,
        settings: configData.settings,
        secrets_hash: secretsHash,
        metadata: {
          ...configData.metadata,
          owner: user.id,
          createdAt: new Date().toISOString(),
        },
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Log configuration change
    await supabase
      .from('audit_logs')
      .insert({
        action: 'configuration_updated',
        environment: configData.environment,
        details: {
          version: configData.version,
          changes: Object.keys(configData.settings),
        },
        user_id: user.id,
        created_at: new Date().toISOString(),
      });

    // Trigger deployment pipeline (if configured)
    try {
      await fetch('/api/deployment/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: configData.environment,
          configurationId: newConfig.id,
        }),
      });
    } catch (deploymentError) {
      console.error('Deployment trigger failed:', deploymentError);
      // Don't fail the configuration update if deployment fails
    }

    return NextResponse.json({ data: newConfig }, { status: 201 });

  } catch (error) {
    console.error('Configuration management error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update specific configuration settings
export async function PUT(request: NextRequest) {
  try {
    await limiter.check(request, 5, 'CONFIG_UPDATE');

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { environment, settings, incrementVersion } = body;

    if (!environment || !settings) {
      return NextResponse.json({ error: 'Environment and settings required' }, { status: 400 });
    }

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!validateEnvironmentAccess(profile?.role || 'viewer', environment)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get current configuration
    const { data: currentConfig } = await supabase
      .from('configurations')
      .select('*')
      .eq('environment', environment)
      .eq('is_active', true)
      .single();

    if (!currentConfig) {
      return NextResponse.json({ error: 'No active configuration found' }, { status: 404 });
    }

    // Merge settings
    const updatedSettings = { ...currentConfig.settings, ...settings };

    // Calculate new version if requested
    let newVersion = currentConfig.version;
    if (incrementVersion) {
      const versionParts = currentConfig.version.split('.').map(Number);
      versionParts[2]++; // Increment patch version
      newVersion = versionParts.join('.');
    }

    // Validate updated configuration
    const validationResult = await validateConfiguration(
      { settings: updatedSettings, environment, version: newVersion },
      environment,
      supabase
    );

    if (!validationResult.valid) {
      return NextResponse.json({
        error: 'Configuration validation failed',
        details: validationResult
      }, { status: 400 });
    }

    // Update configuration
    const { data: updatedConfig, error: updateError } = await supabase
      .from('configurations')
      .update({
        settings: updatedSettings,
        version: newVersion,
        metadata: {
          ...currentConfig.metadata,
          updatedAt: new Date().toISOString(),
        },
      })
      .eq('id', currentConfig.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log configuration update
    await supabase
      .from('audit_logs')
      .insert({
        action: 'configuration_updated',
        environment,
        details: {
          version: newVersion,
          updatedKeys: Object.keys(settings),
        },
        user_id: user.id,
        created_at: new Date().toISOString(),
      });

    return NextResponse.json({ data: updatedConfig });

  } catch (error) {
    console.error('Configuration update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Deactivate configuration
export async function DELETE(request: NextRequest) {
  try {
    await limiter.check(request, 3, 'CONFIG_DELETE');

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment');
    const version = searchParams.get('version');

    if (!environment) {
      return NextResponse.json({ error: 'Environment parameter required' }, { status: 400 });
    }

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    // Deactivate configuration(s)
    let query = supabase
      .from('configurations')
      .update({ is_active: false })
      .eq('environment', environment);

    if (version) {
      query = query.eq('version', version);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log deactivation
    await supabase
      .from('audit_logs')
      .insert({
        action: 'configuration_deactivated',
        environment,
        details: { version: version || 'all' },
        user_id: user.id,
        created_at: new Date().toISOString(),
      });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Configuration deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```