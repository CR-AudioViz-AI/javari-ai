```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Types and Schemas
interface HRProvider {
  id: string;
  name: string;
  type: 'workday' | 'bamboohr' | 'adp' | 'successfactors';
  config: Record<string, any>;
  isActive: boolean;
}

interface Employee {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  managerId?: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'inactive' | 'terminated';
  permissions: string[];
}

interface PerformanceMetric {
  employeeId: string;
  period: string;
  rating: number;
  goals: Array<{
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    completion: number;
  }>;
  feedback: string[];
}

const hrProviderSchema = z.object({
  type: z.enum(['workday', 'bamboohr', 'adp', 'successfactors']),
  config: z.record(z.any()),
  isActive: z.boolean().default(true)
});

const employeeSchema = z.object({
  employeeId: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  department: z.string(),
  position: z.string(),
  managerId: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: z.enum(['active', 'inactive', 'terminated']),
  permissions: z.array(z.string()).default([])
});

// HR Providers
class WorkdayProvider {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async authenticate(): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        scope: 'workday.hr'
      })
    });

    if (!response.ok) {
      throw new Error('Workday authentication failed');
    }

    const data = await response.json();
    return data.access_token;
  }

  async getEmployees(): Promise<Employee[]> {
    const token = await this.authenticate();
    const response = await fetch(`${this.config.baseUrl}/api/v1/workers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Workday employees');
    }

    const data = await response.json();
    return data.workers.map((worker: any) => ({
      id: worker.id,
      employeeId: worker.employee_id,
      email: worker.primary_work_email,
      firstName: worker.first_name,
      lastName: worker.last_name,
      department: worker.organization?.name || '',
      position: worker.position?.name || '',
      managerId: worker.manager?.employee_id,
      startDate: worker.hire_date,
      endDate: worker.termination_date,
      status: worker.active ? 'active' : 'inactive',
      permissions: []
    }));
  }

  async getPerformanceData(employeeId: string): Promise<PerformanceMetric[]> {
    const token = await this.authenticate();
    const response = await fetch(`${this.config.baseUrl}/api/v1/performance/${employeeId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch performance data');
    }

    const data = await response.json();
    return data.reviews || [];
  }
}

class BambooHRProvider {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async getEmployees(): Promise<Employee[]> {
    const response = await fetch(`https://api.bamboohr.com/api/gateway.php/${this.config.companyDomain}/v1/employees/directory`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.config.apiKey}:x`).toString('base64')}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch BambooHR employees');
    }

    const data = await response.json();
    return data.employees.map((emp: any) => ({
      id: emp.id,
      employeeId: emp.employeeNumber,
      email: emp.workEmail,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.department,
      position: emp.jobTitle,
      managerId: emp.supervisorId,
      startDate: emp.hireDate,
      endDate: emp.terminationDate,
      status: emp.status === 'Active' ? 'active' : 'inactive',
      permissions: []
    }));
  }

  async getPerformanceData(employeeId: string): Promise<PerformanceMetric[]> {
    // BambooHR performance API implementation
    return [];
  }
}

class ADPProvider {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async authenticate(): Promise<string> {
    const response = await fetch('https://api.adp.com/auth/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials&scope=api'
    });

    if (!response.ok) {
      throw new Error('ADP authentication failed');
    }

    const data = await response.json();
    return data.access_token;
  }

  async getEmployees(): Promise<Employee[]> {
    const token = await this.authenticate();
    const response = await fetch(`${this.config.baseUrl}/hr/v2/workers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch ADP employees');
    }

    const data = await response.json();
    return data.workers?.map((worker: any) => ({
      id: worker.associateOID,
      employeeId: worker.workerID?.idValue,
      email: worker.person?.communication?.emails?.[0]?.emailUri,
      firstName: worker.person?.legalName?.givenName,
      lastName: worker.person?.legalName?.familyName1,
      department: worker.workAssignments?.[0]?.assignedOrganizationalUnits?.[0]?.nameCode?.codeValue,
      position: worker.workAssignments?.[0]?.jobCode?.codeValue,
      startDate: worker.workAssignments?.[0]?.actualStartDate,
      status: 'active',
      permissions: []
    })) || [];
  }

  async getPerformanceData(employeeId: string): Promise<PerformanceMetric[]> {
    // ADP performance API implementation
    return [];
  }
}

class SuccessFactorsProvider {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async getEmployees(): Promise<Employee[]> {
    const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    const response = await fetch(`${this.config.baseUrl}/odata/v2/User`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch SuccessFactors employees');
    }

    const data = await response.json();
    return data.d.results.map((user: any) => ({
      id: user.userId,
      employeeId: user.personId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      position: user.title,
      managerId: user.managerId,
      startDate: user.startDate,
      status: user.status === 'A' ? 'active' : 'inactive',
      permissions: []
    }));
  }

  async getPerformanceData(employeeId: string): Promise<PerformanceMetric[]> {
    // SuccessFactors performance API implementation
    return [];
  }
}

// HR Adapter
class HRAdapter {
  private providers: Map<string, any> = new Map();

  registerProvider(type: string, provider: any): void {
    this.providers.set(type, provider);
  }

  getProvider(type: string): any {
    return this.providers.get(type);
  }

  async syncEmployees(providerType: string): Promise<Employee[]> {
    const provider = this.getProvider(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not found`);
    }

    return await provider.getEmployees();
  }

  async getPerformanceData(providerType: string, employeeId: string): Promise<PerformanceMetric[]> {
    const provider = this.getProvider(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not found`);
    }

    return await provider.getPerformanceData(employeeId);
  }
}

// Services
class EmployeeSyncService {
  private supabase: any;
  private adapter: HRAdapter;

  constructor(supabase: any, adapter: HRAdapter) {
    this.supabase = supabase;
    this.adapter = adapter;
  }

  async syncAllEmployees(providerType: string): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      const employees = await this.adapter.syncEmployees(providerType);
      
      for (const employee of employees) {
        try {
          const { error } = await this.supabase
            .from('hr_employees')
            .upsert({
              employee_id: employee.employeeId,
              email: employee.email,
              first_name: employee.firstName,
              last_name: employee.lastName,
              department: employee.department,
              position: employee.position,
              manager_id: employee.managerId,
              start_date: employee.startDate,
              end_date: employee.endDate,
              status: employee.status,
              permissions: employee.permissions,
              provider_type: providerType,
              last_synced: new Date().toISOString()
            }, {
              onConflict: 'employee_id'
            });

          if (error) {
            errors.push(`Failed to sync ${employee.email}: ${error.message}`);
          } else {
            synced++;
          }
        } catch (err) {
          errors.push(`Error processing ${employee.email}: ${err}`);
        }
      }

      return { synced, errors };
    } catch (error) {
      throw new Error(`Sync failed: ${error}`);
    }
  }
}

class AccessProvisionerService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async provisionAccess(employeeId: string, permissions: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('hr_employees')
      .update({
        permissions,
        access_provisioned: true,
        provisioned_at: new Date().toISOString()
      })
      .eq('employee_id', employeeId);

    if (error) {
      throw new Error(`Failed to provision access: ${error.message}`);
    }

    // Create AI agent access record
    await this.supabase
      .from('ai_agent_access')
      .upsert({
        employee_id: employeeId,
        permissions,
        granted_at: new Date().toISOString(),
        status: 'active'
      });
  }

  async deprovisionAccess(employeeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('hr_employees')
      .update({
        permissions: [],
        access_provisioned: false,
        deprovisioned_at: new Date().toISOString()
      })
      .eq('employee_id', employeeId);

    if (error) {
      throw new Error(`Failed to deprovision access: ${error.message}`);
    }

    // Revoke AI agent access
    await this.supabase
      .from('ai_agent_access')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString()
      })
      .eq('employee_id', employeeId);
  }
}

// Encryption utilities
class HREncryption {
  private static readonly algorithm = 'aes-256-gcm';
  private static readonly keyLength = 32;

  static encrypt(text: string, key: string): { encrypted: string; iv: string; tag: string } {
    const crypto = require('crypto');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex')
    };
  }

  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }, key: string): string {
    const crypto = require('crypto');
    const decipher = crypto.createDecipher(this.algorithm, key, Buffer.from(encryptedData.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Main HR Integration Module
class HRIntegrationModule {
  private supabase: any;
  private adapter: HRAdapter;
  private employeeSyncService: EmployeeSyncService;
  private accessProvisionerService: AccessProvisionerService;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.adapter = new HRAdapter();
    this.employeeSyncService = new EmployeeSyncService(this.supabase, this.adapter);
    this.accessProvisionerService = new AccessProvisionerService(this.supabase);

    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    const { data: providers } = await this.supabase
      .from('hr_providers')
      .select('*')
      .eq('is_active', true);

    for (const provider of providers || []) {
      let providerInstance;
      
      switch (provider.type) {
        case 'workday':
          providerInstance = new WorkdayProvider(provider.config);
          break;
        case 'bamboohr':
          providerInstance = new BambooHRProvider(provider.config);
          break;
        case 'adp':
          providerInstance = new ADPProvider(provider.config);
          break;
        case 'successfactors':
          providerInstance = new SuccessFactorsProvider(provider.config);
          break;
        default:
          continue;
      }

      this.adapter.registerProvider(provider.type, providerInstance);
    }
  }

  async syncEmployees(providerType?: string): Promise<{ results: any[]; errors: string[] }> {
    const results: any[] = [];
    const allErrors: string[] = [];

    if (providerType) {
      const result = await this.employeeSyncService.syncAllEmployees(providerType);
      results.push({ provider: providerType, ...result });
      allErrors.push(...result.errors);
    } else {
      const { data: providers } = await this.supabase
        .from('hr_providers')
        .select('type')
        .eq('is_active', true);

      for (const provider of providers || []) {
        try {
          const result = await this.employeeSyncService.syncAllEmployees(provider.type);
          results.push({ provider: provider.type, ...result });
          allErrors.push(...result.errors);
        } catch (error) {
          allErrors.push(`Provider ${provider.type}: ${error}`);
        }
      }
    }

    return { results, errors: allErrors };
  }

  async handleWebhook(providerType: string, payload: any): Promise<void> {
    switch (payload.event_type) {
      case 'employee.created':
      case 'employee.updated':
        await this.syncEmployees(providerType);
        if (payload.data.status === 'active') {
          await this.accessProvisionerService.provisionAccess(
            payload.data.employee_id,
            payload.data.permissions || ['basic_access']
          );
        }
        break;
      case 'employee.terminated':
        await this.accessProvisionerService.deprovisionAccess(payload.data.employee_id);
        break;
      default:
        console.log(`Unhandled webhook event: ${payload.event_type}`);
    }
  }

  async getEmployees(filters?: any): Promise<Employee[]> {
    let query = this.supabase.from('hr_employees').select('*');

    if (filters?.department) {
      query = query.eq('department', filters.department);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }

    return data || [];
  }

  async getPerformanceMetrics(employeeId: string): Promise<PerformanceMetric[]> {
    const { data: employee } = await this.supabase
      .from('hr_employees')
      .select('provider_type')
      .eq('employee_id', employeeId)
      .single();

    if (!employee) {
      throw new Error('Employee not found');
    }

    return await this.adapter.getPerformanceData(employee.provider_type, employeeId);
  }

  async healthCheck(): Promise<{ status: string; providers: any[] }> {
    const { data: providers } = await this.supabase
      .from('hr_providers')
      .select('*');

    const providerStatus = await Promise.all(
      (providers || []).map(async (provider) => {
        try {
          const providerInstance = this.adapter.getProvider(provider.type);
          if (providerInstance && typeof providerInstance.getEmployees === 'function') {
            await providerInstance.getEmployees();
            return { type: provider.type, status: 'healthy' };
          }
          return { type: provider.type, status: 'unknown' };
        } catch (error) {
          return { type: provider.type, status: 'error', error: error.message };
        }
      })
    );

    return {
      status: 'ok',
      providers: providerStatus
    };
  }
}

// Initialize module
const hrModule = new HRIntegrationModule();

// API Routes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'health':
        const health = await hrModule.healthCheck();
        return NextResponse.json(health);

      case 'employees':
        const filters = {
          department: searchParams.get('department'),
          status: searchParams.get('status')
        };
        const employees = await hrModule.getEmployees(filters);
        return NextResponse.json({ employees });

      case 'performance':
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) {
          return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
        }
        const metrics = await hrModule.getPerformanceMetrics(employeeId);
        return NextResponse.json({ metrics });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('HR Integration GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'sync':
        const syncResult = await hrModule.syncEmployees(data.providerType);
        return NextResponse.json(syncResult);

      case 'webhook':
        await hrModule.handleWebhook(data.providerType, data.payload);
        return NextResponse.json({ success: true });

      case 'provision':
        const accessProvisioner = new AccessProvisionerService(
          createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
        );
        await accessProvisioner.provisionAccess(data.employeeId, data.permissions);
        return NextResponse.json({ success: true });

      case 'deprovision':
        const accessDeprovisioner = new AccessProvisionerService(
          createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
        );
        await accessDeprovisioner.deprovisionAccess(data.employeeId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {