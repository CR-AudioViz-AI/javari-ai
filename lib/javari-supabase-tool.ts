// lib/javari-supabase-tool.ts
// READ-ONLY Supabase Tool for DB schema inspection and storage access

import { Tool, ToolResult } from './javari-tool-registry';
import { createClient } from '@supabase/supabase-js';

interface SupabaseConfig {
  url?: string;
  anonKey?: string;
}

interface TableInfo {
  table_name: string;
  table_schema: string;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface BucketInfo {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
}

interface StorageObject {
  name: string;
  id: string | null;
  updated_at: string | null;
  created_at: string | null;
  last_accessed_at: string | null;
  metadata: any;
}

export class SupabaseReadTool implements Tool {
  name = 'supabase_read';
  description = 'Read-only access to Supabase (tables, schema, storage)';
  
  private config: SupabaseConfig;
  private client: any;

  constructor(config: SupabaseConfig = {}) {
    this.config = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ...config,
    };

    if (this.config.url && this.config.anonKey) {
      this.client = createClient(this.config.url, this.config.anonKey);
    }
  }

  enabled(): boolean {
    const featureEnabled = process.env.FEATURE_SUPABASE_READ === '1';
    const hasUrl = !!this.config.url;
    const hasKey = !!this.config.anonKey;
    
    return featureEnabled && hasUrl && hasKey;
  }

  async execute(params: any): Promise<ToolResult> {
    const { action, ...rest } = params;

    switch (action) {
      case 'getTableList':
        return await this.getTableList(rest);
      case 'getTableSchema':
        return await this.getTableSchema(rest);
      case 'queryReadOnly':
        return await this.queryReadOnly(rest);
      case 'listBuckets':
        return await this.listBuckets(rest);
      case 'listObjects':
        return await this.listObjects(rest);
      case 'getObjectMetadata':
        return await this.getObjectMetadata(rest);
      default:
        return {
          success: false,
          error: `Unknown action: ${action}. Available: getTableList, getTableSchema, queryReadOnly, listBuckets, listObjects, getObjectMetadata`,
        };
    }
  }

  /**
   * Get list of tables (respects RLS)
   */
  async getTableList(params: {}): Promise<ToolResult<TableInfo[]>> {
    try {
      // Query information_schema (will respect RLS if configured)
      const { data, error } = await this.client
        .from('information_schema.tables')
        .select('table_name, table_schema')
        .eq('table_schema', 'public');

      if (error) {
        // If RLS blocks this, return helpful message
        return {
          success: false,
          error: `Unable to list tables. This may be due to RLS policies. Error: ${error.message}`,
        };
      }

      return {
        success: true,
        data: data || [],
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Supabase error: ${error.message}`,
      };
    }
  }

  /**
   * Get table schema
   */
  async getTableSchema(params: {
    table: string;
  }): Promise<ToolResult<ColumnInfo[]>> {
    const { table } = params;

    if (!table) {
      return {
        success: false,
        error: 'table parameter is required',
      };
    }

    try {
      const { data, error } = await this.client
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .order('ordinal_position');

      if (error) {
        return {
          success: false,
          error: `Unable to get schema for table '${table}': ${error.message}`,
        };
      }

      return {
        success: true,
        data: data || [],
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Supabase error: ${error.message}`,
      };
    }
  }

  /**
   * Execute read-only query (SELECT only)
   */
  async queryReadOnly(params: {
    sql: string;
  }): Promise<ToolResult<any[]>> {
    const { sql } = params;

    if (!sql) {
      return {
        success: false,
        error: 'sql parameter is required',
      };
    }

    // SECURITY: Validate query is SELECT only
    const validation = this.validateReadOnlyQuery(sql);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    try {
      // Add LIMIT if not present
      let safeSql = sql.trim();
      if (!safeSql.toLowerCase().includes('limit')) {
        safeSql += ' LIMIT 200';
      }

      const { data, error } = await this.client.rpc('query', { query_text: safeSql });

      if (error) {
        return {
          success: false,
          error: `Query failed: ${error.message}`,
        };
      }

      return {
        success: true,
        data: data || [],
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Supabase error: ${error.message}`,
      };
    }
  }

  /**
   * Validate query is read-only (SELECT or WITH)
   */
  private validateReadOnlyQuery(sql: string): { valid: boolean; error?: string } {
    const normalized = sql.trim().toLowerCase();

    // Check for multiple statements (semicolons)
    const statements = sql.split(';').filter(s => s.trim());
    if (statements.length > 1) {
      return {
        valid: false,
        error: 'Multiple statements not allowed. Only single SELECT queries permitted.',
      };
    }

    // Must start with SELECT or WITH (for CTEs)
    if (!normalized.startsWith('select') && !normalized.startsWith('with')) {
      return {
        valid: false,
        error: 'Only SELECT and WITH queries allowed. No INSERT, UPDATE, DELETE, DROP, etc.',
      };
    }

    // Block dangerous keywords
    const dangerousKeywords = [
      'insert', 'update', 'delete', 'drop', 'create', 'alter',
      'truncate', 'grant', 'revoke', 'exec', 'execute'
    ];

    for (const keyword of dangerousKeywords) {
      if (normalized.includes(keyword)) {
        return {
          valid: false,
          error: `Keyword '${keyword}' not allowed. Read-only queries only.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * List storage buckets
   */
  async listBuckets(params: {}): Promise<ToolResult<BucketInfo[]>> {
    try {
      const { data, error } = await this.client.storage.listBuckets();

      if (error) {
        return {
          success: false,
          error: `Unable to list buckets: ${error.message}`,
        };
      }

      return {
        success: true,
        data: data || [],
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Supabase error: ${error.message}`,
      };
    }
  }

  /**
   * List objects in bucket
   */
  async listObjects(params: {
    bucket: string;
    prefix?: string;
    limit?: number;
  }): Promise<ToolResult<StorageObject[]>> {
    const { bucket, prefix = '', limit = 100 } = params;

    if (!bucket) {
      return {
        success: false,
        error: 'bucket parameter is required',
      };
    }

    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .list(prefix, { limit });

      if (error) {
        return {
          success: false,
          error: `Unable to list objects in bucket '${bucket}': ${error.message}`,
        };
      }

      return {
        success: true,
        data: data || [],
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Supabase error: ${error.message}`,
      };
    }
  }

  /**
   * Get object metadata
   */
  async getObjectMetadata(params: {
    bucket: string;
    path: string;
  }): Promise<ToolResult<any>> {
    const { bucket, path } = params;

    if (!bucket || !path) {
      return {
        success: false,
        error: 'bucket and path parameters are required',
      };
    }

    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .list(path.split('/').slice(0, -1).join('/'), {
          search: path.split('/').pop(),
        });

      if (error) {
        return {
          success: false,
          error: `Unable to get metadata for '${path}': ${error.message}`,
        };
      }

      const file = data?.[0];
      if (!file) {
        return {
          success: false,
          error: `File not found: ${path}`,
        };
      }

      return {
        success: true,
        data: file,
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Supabase error: ${error.message}`,
      };
    }
  }
}

// Export singleton instance
export const supabaseReadTool = new SupabaseReadTool();
