```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Redis } from 'ioredis';
import CryptoJS from 'crypto-js';
import { rateLimit } from '@/lib/utils/rate-limit';
import { auditLog } from '@/lib/utils/audit';

// Environment variables validation
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  REDIS_URL: z.string().url(),
  WORKDAY_TENANT_URL: z.string().url(),
  WORKDAY_CLIENT_ID: z.string(),
  WORKDAY_CLIENT_SECRET: z.string(),
  WORKDAY_REFRESH_TOKEN: z.string(),
  ENCRYPTION_KEY: z.string(),
  WEBHOOK_SECRET: z.string()
});

const env = envSchema.parse(process.env);

// Initialize clients
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis(env.REDIS_URL);

// Request schemas
const syncRequestSchema = z.object({
  syncType: z.enum(['employees', 'org-chart', 'performance', 'full']),
  force: z.boolean().optional().default(false),
  filters: z.object({
    departmentId: z.string().optional(),
    locationId: z.string().optional(),
    lastModified: z.string().datetime().optional()
  }).optional()
});

const webhookSchema = z.object({
  eventType: z.enum(['employee.created', 'employee.updated', 'employee.terminated', 'org.restructured']),
  timestamp: z.string().datetime(),
  data: z.record(z.any()),
  signature: z.string()
});

// Types
interface WorkdayEmployee {
  id: string;
  workerId: string;
  personalData: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  employmentData: {
    hireDate: string;
    jobTitle: string;
    department: string;
    location: string;
    managerId?: string;
    employmentStatus: string;
  };
  compensationData?: {
    salary?: number;
    currency?: string;
    payGroup?: string;
  };
}

interface WorkdayOrgUnit {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  managerId?: string;
  costCenter?: string;
  location?: string;
  isActive: boolean;
}

interface WorkdayPerformanceData {
  employeeId: string;
  reviewPeriod: string;
  overallRating: number;
  goals: Array<{
    id: string;
    title: string;
    status: string;
    completionPercentage: number;
  }>;
  competencies: Array<{
    name: string;
    rating: number;
  }>;
  reviewDate: string;
}

class WorkdayClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  async authenticate(): Promise<void> {
    const cacheKey = 'workday:access_token';
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const { token, expiry } = JSON.parse(cached);
      if (Date.now() < expiry) {
        this.accessToken = token;
        this.tokenExpiry = expiry;
        return;
      }
    }

    const response = await fetch(`${env.WORKDAY_TENANT_URL}/ccx/oauth2/${env.WORKDAY_TENANT_URL.split('/')[2]}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${env.WORKDAY_CLIENT_ID}:${env.WORKDAY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: env.WORKDAY_REFRESH_TOKEN
      })
    });

    if (!response.ok) {
      throw new Error(`Workday authentication failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    await redis.setex(cacheKey, data.expires_in - 60, JSON.stringify({
      token: this.accessToken,
      expiry: this.tokenExpiry
    }));
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }

    const response = await fetch(`${env.WORKDAY_TENANT_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Workday API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getEmployees(filters?: any): Promise<WorkdayEmployee[]> {
    const queryParams = new URLSearchParams();
    if (filters?.lastModified) {
      queryParams.set('lastModified', filters.lastModified);
    }
    if (filters?.departmentId) {
      queryParams.set('organization', filters.departmentId);
    }

    const endpoint = `/ccx/api/privacy/v1/${env.WORKDAY_TENANT_URL.split('/')[2]}/workers${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await this.request<any>(endpoint);

    return response.data.map(this.transformEmployee);
  }

  async getOrgChart(): Promise<WorkdayOrgUnit[]> {
    const endpoint = `/ccx/api/v1/${env.WORKDAY_TENANT_URL.split('/')[2]}/organizations`;
    const response = await this.request<any>(endpoint);

    return response.data.map(this.transformOrgUnit);
  }

  async getPerformanceData(employeeId?: string, period?: string): Promise<WorkdayPerformanceData[]> {
    const queryParams = new URLSearchParams();
    if (employeeId) queryParams.set('worker', employeeId);
    if (period) queryParams.set('reviewPeriod', period);

    const endpoint = `/ccx/api/v1/${env.WORKDAY_TENANT_URL.split('/')[2]}/performanceReviews${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await this.request<any>(endpoint);

    return response.data.map(this.transformPerformanceData);
  }

  private transformEmployee(data: any): WorkdayEmployee {
    return {
      id: data.id,
      workerId: data.workerId,
      personalData: {
        firstName: data.personalData?.firstName || '',
        lastName: data.personalData?.lastName || '',
        email: data.personalData?.emailAddress || '',
        phone: data.personalData?.phoneNumber
      },
      employmentData: {
        hireDate: data.employmentData?.hireDate || '',
        jobTitle: data.positionData?.jobTitle || '',
        department: data.organizationData?.department || '',
        location: data.organizationData?.location || '',
        managerId: data.organizationData?.managerId,
        employmentStatus: data.employmentData?.status || ''
      },
      compensationData: data.compensationData ? {
        salary: data.compensationData.annualSalary,
        currency: data.compensationData.currency,
        payGroup: data.compensationData.payGroup
      } : undefined
    };
  }

  private transformOrgUnit(data: any): WorkdayOrgUnit {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      parentId: data.parentOrganization?.id,
      managerId: data.manager?.id,
      costCenter: data.costCenter,
      location: data.location,
      isActive: data.isActive !== false
    };
  }

  private transformPerformanceData(data: any): WorkdayPerformanceData {
    return {
      employeeId: data.worker.id,
      reviewPeriod: data.reviewPeriod,
      overallRating: data.overallRating || 0,
      goals: data.goals?.map((goal: any) => ({
        id: goal.id,
        title: goal.title,
        status: goal.status,
        completionPercentage: goal.completionPercentage || 0
      })) || [],
      competencies: data.competencies?.map((comp: any) => ({
        name: comp.name,
        rating: comp.rating || 0
      })) || [],
      reviewDate: data.reviewDate
    };
  }
}

// Encryption utilities
const encrypt = (text: string): string => {
  return CryptoJS.AES.encrypt(text, env.ENCRYPTION_KEY).toString();
};

const decrypt = (ciphertext: string): string => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Webhook signature verification
const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  const expectedSignature = CryptoJS.HmacSHA256(payload, env.WEBHOOK_SECRET).toString();
  return signature === expectedSignature;
};

// Sync operations
class WorkdaySyncService {
  private workdayClient = new WorkdayClient();

  async syncEmployees(filters?: any, force = false): Promise<{ success: boolean; synced: number; errors: any[] }> {
    const syncId = `sync_employees_${Date.now()}`;
    const errors: any[] = [];
    let synced = 0;

    try {
      await auditLog('workday_sync_start', 'system', { syncId, type: 'employees', filters });

      const employees = await this.workdayClient.getEmployees(filters);
      
      for (const employee of employees) {
        try {
          // Check if employee exists and needs update
          const { data: existing } = await supabase
            .from('workday_employees')
            .select('id, updated_at')
            .eq('worker_id', employee.workerId)
            .single();

          const shouldUpdate = force || !existing || new Date(employee.employmentData.hireDate) > new Date(existing.updated_at);

          if (shouldUpdate) {
            const encryptedData = {
              ...employee,
              personalData: {
                ...employee.personalData,
                email: encrypt(employee.personalData.email),
                phone: employee.personalData.phone ? encrypt(employee.personalData.phone) : null
              },
              compensationData: employee.compensationData ? {
                ...employee.compensationData,
                salary: employee.compensationData.salary ? encrypt(employee.compensationData.salary.toString()) : null
              } : null
            };

            const { error } = await supabase
              .from('workday_employees')
              .upsert({
                worker_id: employee.workerId,
                data: encryptedData,
                last_synced: new Date().toISOString(),
                sync_id: syncId
              });

            if (error) {
              errors.push({ employeeId: employee.workerId, error: error.message });
            } else {
              synced++;
            }
          }
        } catch (error) {
          errors.push({ employeeId: employee.workerId, error: (error as Error).message });
        }
      }

      // Log sync completion
      await supabase.from('workday_sync_logs').insert({
        sync_id: syncId,
        sync_type: 'employees',
        status: errors.length === 0 ? 'completed' : 'completed_with_errors',
        records_processed: employees.length,
        records_synced: synced,
        errors_count: errors.length,
        filters,
        completed_at: new Date().toISOString()
      });

      await auditLog('workday_sync_complete', 'system', { syncId, synced, errors: errors.length });

      return { success: errors.length === 0, synced, errors };
    } catch (error) {
      await auditLog('workday_sync_error', 'system', { syncId, error: (error as Error).message });
      throw error;
    }
  }

  async syncOrgChart(force = false): Promise<{ success: boolean; synced: number; errors: any[] }> {
    const syncId = `sync_org_${Date.now()}`;
    const errors: any[] = [];
    let synced = 0;

    try {
      const orgUnits = await this.workdayClient.getOrgChart();

      for (const unit of orgUnits) {
        try {
          const { error } = await supabase
            .from('workday_org_units')
            .upsert({
              unit_id: unit.id,
              name: unit.name,
              type: unit.type,
              parent_id: unit.parentId,
              manager_id: unit.managerId,
              cost_center: unit.costCenter,
              location: unit.location,
              is_active: unit.isActive,
              last_synced: new Date().toISOString(),
              sync_id: syncId
            });

          if (error) {
            errors.push({ unitId: unit.id, error: error.message });
          } else {
            synced++;
          }
        } catch (error) {
          errors.push({ unitId: unit.id, error: (error as Error).message });
        }
      }

      await supabase.from('workday_sync_logs').insert({
        sync_id: syncId,
        sync_type: 'org_chart',
        status: errors.length === 0 ? 'completed' : 'completed_with_errors',
        records_processed: orgUnits.length,
        records_synced: synced,
        errors_count: errors.length,
        completed_at: new Date().toISOString()
      });

      return { success: errors.length === 0, synced, errors };
    } catch (error) {
      await auditLog('workday_org_sync_error', 'system', { syncId, error: (error as Error).message });
      throw error;
    }
  }

  async syncPerformanceData(employeeId?: string): Promise<{ success: boolean; synced: number; errors: any[] }> {
    const syncId = `sync_performance_${Date.now()}`;
    const errors: any[] = [];
    let synced = 0;

    try {
      const performanceData = await this.workdayClient.getPerformanceData(employeeId);

      for (const data of performanceData) {
        try {
          const { error } = await supabase
            .from('workday_performance_data')
            .upsert({
              employee_id: data.employeeId,
              review_period: data.reviewPeriod,
              overall_rating: data.overallRating,
              goals: data.goals,
              competencies: data.competencies,
              review_date: data.reviewDate,
              last_synced: new Date().toISOString(),
              sync_id: syncId
            });

          if (error) {
            errors.push({ employeeId: data.employeeId, error: error.message });
          } else {
            synced++;
          }
        } catch (error) {
          errors.push({ employeeId: data.employeeId, error: (error as Error).message });
        }
      }

      await supabase.from('workday_sync_logs').insert({
        sync_id: syncId,
        sync_type: 'performance',
        status: errors.length === 0 ? 'completed' : 'completed_with_errors',
        records_processed: performanceData.length,
        records_synced: synced,
        errors_count: errors.length,
        completed_at: new Date().toISOString()
      });

      return { success: errors.length === 0, synced, errors };
    } catch (error) {
      await auditLog('workday_performance_sync_error', 'system', { syncId, error: (error as Error).message });
      throw error;
    }
  }
}

const syncService = new WorkdaySyncService();

// GET - Status and sync history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `workday_api:${clientIp}`;
    const isAllowed = await rateLimit(rateLimitKey, 100, 3600); // 100 requests per hour

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    if (action === 'status') {
      // Get sync status and recent logs
      const { data: recentSyncs } = await supabase
        .from('workday_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: stats } = await supabase
        .rpc('get_workday_sync_stats');

      return NextResponse.json({
        status: 'operational',
        lastSync: recentSyncs?.[0]?.completed_at,
        stats: stats?.[0],
        recentSyncs
      });
    }

    if (action === 'employees') {
      const { data: employees } = await supabase
        .from('workday_employees')
        .select('worker_id, data->employmentData->jobTitle as job_title, data->employmentData->department as department, last_synced')
        .order('last_synced', { ascending: false })
        .limit(50);

      return NextResponse.json({ employees });
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Workday API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Trigger sync operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Rate limiting for sync operations (stricter)
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `workday_sync:${clientIp}`;
    const isAllowed = await rateLimit(rateLimitKey, 10, 3600); // 10 syncs per hour

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Sync rate limit exceeded' },
        { status: 429 }
      );
    }

    const validatedData = syncRequestSchema.parse(body);
    const { syncType, force, filters } = validatedData;

    let result;

    switch (syncType) {
      case 'employees':
        result = await syncService.syncEmployees(filters, force);
        break;
      case 'org-chart':
        result = await syncService.syncOrgChart(force);
        break;
      case 'performance':
        result = await syncService.syncPerformanceData(filters?.departmentId);
        break;
      case 'full':
        const employeeResult = await syncService.syncEmployees(filters, force);
        const orgResult = await syncService.syncOrgChart(force);
        const performanceResult = await syncService.syncPerformanceData();
        
        result = {
          success: employeeResult.success && orgResult.success && performanceResult.success,
          results: {
            employees: employeeResult,
            orgChart: orgResult,
            performance: performanceResult
          }
        };
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid sync type' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Workday sync error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Sync operation failed' },
      { status: 500 }
    );
  }
}

// PUT - Handle webhook events
export async function PUT(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-workday-signature');

    if (!signature || !verifyWebhookSignature(body, signature)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const webhookData = webhookSchema.parse(JSON.parse(body));
    const { eventType, timestamp, data } = webhookData;

    // Store webhook event
    const { data: webhookEvent, error } = await supabase
      .from('workday_webhook_events')
      .insert({
        event_type: eventType,
        timestamp,
        data,
        processed: false,
        received_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Process webhook based on event type
    try {
      switch (eventType) {
        case 'employee.created':
        case 'employee.updated':
          await syncService.syncEmployees({ workerId: data.workerId }, true);
          break;
        case 'employee.terminated':
          await supabase
            .from('workday_employees')
            .update({ 
              'data->employmentData->employmentStatus': 'terminated',
              last_synced: new Date().toISOString()
            })
            .eq('worker_id', data.workerId);
          break;
        case 'org.restructured':
          await syncService.syncOrgChart(true);
          break;
      }

      // Mark webhook as processed
      await supabase
        .from('workday_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', webhookEvent.id);

      await auditLog('workday_webhook_processed', 'system', { eventType, eventId: webhookEvent.id });
    } catch (processingError) {
      await