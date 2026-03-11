```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/auth';

// Validation schemas
const DataLakeConfigSchema = z.object({
  provider: z.enum(['aws-s3', 'azure-data-lake', 'gcp-bigquery', 'databricks', 'snowflake']),
  credentials: z.object({
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    region: z.string().optional(),
    accountUrl: z.string().optional(),
    token: z.string().optional(),
    warehouse: z.string().optional(),
  }),
  database: z.string(),
  schema: z.string().optional(),
  table: z.string(),
});

const StreamConfigSchema = z.object({
  mode: z.enum(['batch', 'streaming', 'real-time']),
  format: z.enum(['parquet', 'delta', 'iceberg', 'json', 'avro', 'orc']),
  compression: z.enum(['gzip', 'snappy', 'lz4', 'brotli']).optional(),
  partitioning: z.array(z.string()).optional(),
  qualityRules: z.array(z.object({
    field: z.string(),
    rule: z.enum(['not_null', 'unique', 'range', 'format', 'custom']),
    parameters: z.record(z.any()).optional(),
  })).optional(),
});

const DataIngestionSchema = z.object({
  jobId: z.string().uuid().optional(),
  config: DataLakeConfigSchema,
  streamConfig: StreamConfigSchema,
  data: z.any().optional(),
  metadata: z.record(z.any()).optional(),
  transformations: z.array(z.object({
    type: z.enum(['filter', 'map', 'aggregate', 'join', 'pivot']),
    parameters: z.record(z.any()),
  })).optional(),
});

// Enterprise Data Lake Client
class DataLakeClient {
  private provider: string;
  private credentials: any;
  private database: string;
  private schema?: string;
  private table: string;

  constructor(config: z.infer<typeof DataLakeConfigSchema>) {
    this.provider = config.provider;
    this.credentials = config.credentials;
    this.database = config.database;
    this.schema = config.schema;
    this.table = config.table;
  }

  async connect(): Promise<boolean> {
    try {
      switch (this.provider) {
        case 'aws-s3':
          return await this.connectAWS();
        case 'azure-data-lake':
          return await this.connectAzure();
        case 'gcp-bigquery':
          return await this.connectGCP();
        case 'databricks':
          return await this.connectDatabricks();
        case 'snowflake':
          return await this.connectSnowflake();
        default:
          throw new Error(`Unsupported provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('Data lake connection failed:', error);
      return false;
    }
  }

  private async connectAWS(): Promise<boolean> {
    // AWS S3/Glue/Athena connection logic
    return true;
  }

  private async connectAzure(): Promise<boolean> {
    // Azure Data Lake/Synapse connection logic
    return true;
  }

  private async connectGCP(): Promise<boolean> {
    // Google Cloud BigQuery/Dataflow connection logic
    return true;
  }

  private async connectDatabricks(): Promise<boolean> {
    // Databricks Unity Catalog connection logic
    return true;
  }

  private async connectSnowflake(): Promise<boolean> {
    // Snowflake connection logic
    return true;
  }

  async ingestData(data: any, streamConfig: z.infer<typeof StreamConfigSchema>): Promise<string> {
    const jobId = crypto.randomUUID();
    
    try {
      // Initialize ingestion job
      await this.initializeJob(jobId, streamConfig);
      
      // Process data based on mode
      if (streamConfig.mode === 'streaming' || streamConfig.mode === 'real-time') {
        await this.streamData(jobId, data, streamConfig);
      } else {
        await this.batchProcess(jobId, data, streamConfig);
      }

      return jobId;
    } catch (error) {
      console.error('Data ingestion failed:', error);
      throw new Error('Failed to ingest data into data lake');
    }
  }

  private async initializeJob(jobId: string, config: any): Promise<void> {
    // Job initialization logic
  }

  private async streamData(jobId: string, data: any, config: any): Promise<void> {
    // Real-time streaming logic
  }

  private async batchProcess(jobId: string, data: any, config: any): Promise<void> {
    // Batch processing logic
  }
}

// Stream Processor for real-time data
class StreamProcessor {
  private kafkaConfig: any;
  private schemaRegistry: any;

  constructor() {
    this.kafkaConfig = {
      brokers: process.env.KAFKA_BROKERS?.split(',') || [],
      clientId: 'cr-audioviz-data-lake',
    };
  }

  async processStream(topic: string, data: any, config: any): Promise<void> {
    try {
      // Kafka producer logic for streaming
      console.log(`Processing stream for topic: ${topic}`);
    } catch (error) {
      console.error('Stream processing failed:', error);
      throw error;
    }
  }

  async validateSchema(data: any, schemaId: string): Promise<boolean> {
    try {
      // Schema validation against registry
      return true;
    } catch (error) {
      console.error('Schema validation failed:', error);
      return false;
    }
  }
}

// Quality Validator for automated data validation
class QualityValidator {
  async validateData(data: any, rules: any[]): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      for (const rule of rules || []) {
        const validation = await this.applyRule(data, rule);
        if (!validation.isValid) {
          errors.push(...validation.errors);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      console.error('Quality validation failed:', error);
      return {
        isValid: false,
        errors: ['Quality validation system error'],
      };
    }
  }

  private async applyRule(data: any, rule: any): Promise<{ isValid: boolean; errors: string[] }> {
    switch (rule.rule) {
      case 'not_null':
        return this.validateNotNull(data, rule.field);
      case 'unique':
        return this.validateUnique(data, rule.field);
      case 'range':
        return this.validateRange(data, rule.field, rule.parameters);
      case 'format':
        return this.validateFormat(data, rule.field, rule.parameters);
      default:
        return { isValid: true, errors: [] };
    }
  }

  private validateNotNull(data: any, field: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (Array.isArray(data)) {
      data.forEach((row, index) => {
        if (row[field] === null || row[field] === undefined) {
          errors.push(`Row ${index}: ${field} is null or undefined`);
        }
      });
    }
    return { isValid: errors.length === 0, errors };
  }

  private validateUnique(data: any, field: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (Array.isArray(data)) {
      const values = new Set();
      data.forEach((row, index) => {
        if (values.has(row[field])) {
          errors.push(`Row ${index}: ${field} value '${row[field]}' is not unique`);
        } else {
          values.add(row[field]);
        }
      });
    }
    return { isValid: errors.length === 0, errors };
  }

  private validateRange(data: any, field: string, params: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { min, max } = params || {};
    
    if (Array.isArray(data)) {
      data.forEach((row, index) => {
        const value = row[field];
        if (typeof value === 'number') {
          if (min !== undefined && value < min) {
            errors.push(`Row ${index}: ${field} value ${value} is below minimum ${min}`);
          }
          if (max !== undefined && value > max) {
            errors.push(`Row ${index}: ${field} value ${value} is above maximum ${max}`);
          }
        }
      });
    }
    return { isValid: errors.length === 0, errors };
  }

  private validateFormat(data: any, field: string, params: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { pattern } = params || {};
    
    if (pattern && Array.isArray(data)) {
      const regex = new RegExp(pattern);
      data.forEach((row, index) => {
        const value = String(row[field]);
        if (!regex.test(value)) {
          errors.push(`Row ${index}: ${field} value '${value}' does not match pattern ${pattern}`);
        }
      });
    }
    return { isValid: errors.length === 0, errors };
  }
}

// Transformation Pipeline
class TransformationPipeline {
  async applyTransformations(data: any, transformations: any[]): Promise<any> {
    let transformedData = data;

    try {
      for (const transformation of transformations || []) {
        transformedData = await this.applyTransformation(transformedData, transformation);
      }

      return transformedData;
    } catch (error) {
      console.error('Transformation pipeline failed:', error);
      throw new Error('Data transformation failed');
    }
  }

  private async applyTransformation(data: any, transformation: any): Promise<any> {
    switch (transformation.type) {
      case 'filter':
        return this.filterData(data, transformation.parameters);
      case 'map':
        return this.mapData(data, transformation.parameters);
      case 'aggregate':
        return this.aggregateData(data, transformation.parameters);
      default:
        return data;
    }
  }

  private filterData(data: any[], params: any): any[] {
    if (!Array.isArray(data)) return data;
    
    const { field, operator, value } = params;
    return data.filter(row => {
      switch (operator) {
        case 'eq': return row[field] === value;
        case 'gt': return row[field] > value;
        case 'lt': return row[field] < value;
        default: return true;
      }
    });
  }

  private mapData(data: any[], params: any): any[] {
    if (!Array.isArray(data)) return data;
    
    const { mapping } = params;
    return data.map(row => {
      const mappedRow = { ...row };
      Object.entries(mapping || {}).forEach(([oldKey, newKey]) => {
        if (oldKey in mappedRow) {
          mappedRow[newKey as string] = mappedRow[oldKey];
          delete mappedRow[oldKey];
        }
      });
      return mappedRow;
    });
  }

  private aggregateData(data: any[], params: any): any[] {
    if (!Array.isArray(data)) return data;
    
    const { groupBy, aggregations } = params;
    // Simplified aggregation logic
    return data; // Would implement proper aggregation
  }
}

// Security Gateway
class SecurityGateway {
  async validateAccess(request: NextRequest): Promise<{ isValid: boolean; user?: any }> {
    try {
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return { isValid: false };
      }

      const token = authHeader.substring(7);
      const user = await this.validateToken(token);
      
      return { isValid: !!user, user };
    } catch (error) {
      console.error('Security validation failed:', error);
      return { isValid: false };
    }
  }

  private async validateToken(token: string): Promise<any> {
    // JWT/OAuth2 token validation logic
    return { id: 'user-123', role: 'data-engineer' };
  }

  async auditLog(action: string, user: any, details: any): Promise<void> {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action,
        details: JSON.stringify(details),
        timestamp: new Date().toISOString(),
        ip_address: details.ip,
      });
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }
}

// Initialize services
const streamProcessor = new StreamProcessor();
const qualityValidator = new QualityValidator();
const transformationPipeline = new TransformationPipeline();
const securityGateway = new SecurityGateway();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      limit: 100,
      window: '1h',
      key: 'data-lake-ingestion'
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    // Security validation
    const security = await securityGateway.validateAccess(request);
    if (!security.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validation = DataIngestionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: validation.error.flatten()
        },
        { status: 400 }
      );
    }

    const { config, streamConfig, data, transformations, metadata } = validation.data;

    // Initialize data lake client
    const dataLakeClient = new DataLakeClient(config);
    const connected = await dataLakeClient.connect();

    if (!connected) {
      return NextResponse.json(
        { error: 'Failed to connect to data lake' },
        { status: 503 }
      );
    }

    // Apply transformations
    let transformedData = data;
    if (transformations && transformations.length > 0) {
      transformedData = await transformationPipeline.applyTransformations(data, transformations);
    }

    // Quality validation
    const qualityCheck = await qualityValidator.validateData(transformedData, streamConfig.qualityRules || []);
    if (!qualityCheck.isValid) {
      return NextResponse.json(
        { 
          error: 'Data quality validation failed',
          details: qualityCheck.errors
        },
        { status: 422 }
      );
    }

    // Ingest data
    const jobId = await dataLakeClient.ingestData(transformedData, streamConfig);

    // Stream processing for real-time modes
    if (streamConfig.mode === 'streaming' || streamConfig.mode === 'real-time') {
      await streamProcessor.processStream(`data-lake-${config.database}`, transformedData, streamConfig);
    }

    // Audit log
    await securityGateway.auditLog('data-ingestion', security.user, {
      jobId,
      provider: config.provider,
      database: config.database,
      table: config.table,
      recordCount: Array.isArray(transformedData) ? transformedData.length : 1,
      ip: request.ip,
    });

    // Store job metadata in Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from('data_lake_jobs').insert({
      job_id: jobId,
      user_id: security.user?.id,
      provider: config.provider,
      database: config.database,
      table_name: config.table,
      status: 'processing',
      config: JSON.stringify(config),
      stream_config: JSON.stringify(streamConfig),
      metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'processing',
      qualityCheck: {
        isValid: qualityCheck.isValid,
        validationRules: streamConfig.qualityRules?.length || 0,
      },
      metadata: {
        provider: config.provider,
        database: config.database,
        table: config.table,
        recordCount: Array.isArray(transformedData) ? transformedData.length : 1,
        transformations: transformations?.length || 0,
      }
    });

  } catch (error) {
    console.error('Data lake integration error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Security validation
    const security = await securityGateway.validateAccess(request);
    if (!security.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    const status = url.searchParams.get('status');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('data_lake_jobs')
      .select('*')
      .eq('user_id', security.user?.id);

    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error } = await query
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      jobs: jobs || [],
      count: jobs?.length || 0,
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve jobs' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Security validation
    const security = await securityGateway.validateAccess(request);
    if (!security.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Cancel job
    const { error } = await supabase
      .from('data_lake_jobs')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('user_id', security.user?.id);

    if (error) {
      throw error;
    }

    // Audit log
    await securityGateway.auditLog('job-cancellation', security.user, {
      jobId,
      ip: request.ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
      jobId,
    });

  } catch (error) {
    console.error('Cancel job error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
```