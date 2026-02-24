/**
 * Supabase Read Proxy
 * Secure serverless API route for controlled database reads
 * 
 * @route POST /api/javari/supabase/read
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Whitelist of allowed tables
const ALLOWED_TABLES = ['projects', 'milestones', 'tasks'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

// Allowed column operators for filters
const ALLOWED_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'] as const;
type AllowedOperator = typeof ALLOWED_OPERATORS[number];

// Allowed order directions
const ALLOWED_ORDER_DIRECTIONS = ['asc', 'desc'] as const;
type OrderDirection = typeof ALLOWED_ORDER_DIRECTIONS[number];

interface Filter {
  column: string;
  operator: AllowedOperator;
  value: any;
}

interface OrderBy {
  column: string;
  direction?: OrderDirection;
}

interface ReadRequest {
  table: string;
  columns?: string[]; // Optional: select specific columns, defaults to '*'
  filters?: Filter[]; // Optional: array of filter conditions
  limit?: number; // Optional: max records to return
  offset?: number; // Optional: pagination offset
  orderBy?: OrderBy[]; // Optional: sort order
  count?: boolean; // Optional: include total count
}

interface ReadResponse {
  success: boolean;
  data?: any[];
  count?: number;
  error?: string;
  timestamp: string;
}

/**
 * Validate filter object structure
 */
function isValidFilter(filter: any): filter is Filter {
  if (!filter || typeof filter !== 'object') return false;
  
  const { column, operator, value } = filter;
  
  if (typeof column !== 'string' || !column) return false;
  if (!ALLOWED_OPERATORS.includes(operator)) return false;
  if (value === undefined) return false;
  
  return true;
}

/**
 * Validate orderBy object structure
 */
function isValidOrderBy(orderBy: any): orderBy is OrderBy {
  if (!orderBy || typeof orderBy !== 'object') return false;
  
  const { column, direction } = orderBy;
  
  if (typeof column !== 'string' || !column) return false;
  if (direction && !ALLOWED_ORDER_DIRECTIONS.includes(direction)) return false;
  
  return true;
}

/**
 * Validate column names to prevent SQL injection
 * Only allow alphanumeric, underscores, and common safe characters
 */
function isValidColumnName(column: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(column);
}

export async function POST(req: NextRequest): Promise<NextResponse<ReadResponse>> {
  const timestamp = new Date().toISOString();

  try {
    // Feature flag check
    const readEnabled = process.env.FEATURE_SUPABASE_READ === '1';
    if (!readEnabled) {
      return NextResponse.json({
        success: false,
        error: 'Supabase read proxy is disabled (FEATURE_SUPABASE_READ=0)',
        timestamp,
      }, { status: 403 });
    }

    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase credentials',
        timestamp,
      }, { status: 500 });
    }

    // Parse and validate request body
    let body: ReadRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON payload',
        timestamp,
      }, { status: 400 });
    }

    const { table, columns, filters, limit, offset, orderBy, count } = body;

    // Validate table whitelist
    if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
      return NextResponse.json({
        success: false,
        error: `Table '${table}' not in whitelist. Allowed: ${ALLOWED_TABLES.join(', ')}`,
        timestamp,
      }, { status: 403 });
    }

    // Validate columns array if provided
    if (columns !== undefined) {
      if (!Array.isArray(columns)) {
        return NextResponse.json({
          success: false,
          error: 'columns must be an array',
          timestamp,
        }, { status: 400 });
      }
      
      for (const col of columns) {
        if (typeof col !== 'string' || !isValidColumnName(col)) {
          return NextResponse.json({
            success: false,
            error: `Invalid column name: ${col}`,
            timestamp,
          }, { status: 400 });
        }
      }
    }

    // Validate filters array if provided
    if (filters !== undefined) {
      if (!Array.isArray(filters)) {
        return NextResponse.json({
          success: false,
          error: 'filters must be an array',
          timestamp,
        }, { status: 400 });
      }
      
      for (const filter of filters) {
        if (!isValidFilter(filter)) {
          return NextResponse.json({
            success: false,
            error: 'Invalid filter structure',
            timestamp,
          }, { status: 400 });
        }
        
        if (!isValidColumnName(filter.column)) {
          return NextResponse.json({
            success: false,
            error: `Invalid column name in filter: ${filter.column}`,
            timestamp,
          }, { status: 400 });
        }
      }
    }

    // Validate limit
    if (limit !== undefined) {
      if (typeof limit !== 'number' || limit < 1 || limit > 1000) {
        return NextResponse.json({
          success: false,
          error: 'limit must be a number between 1 and 1000',
          timestamp,
        }, { status: 400 });
      }
    }

    // Validate offset
    if (offset !== undefined) {
      if (typeof offset !== 'number' || offset < 0) {
        return NextResponse.json({
          success: false,
          error: 'offset must be a non-negative number',
          timestamp,
        }, { status: 400 });
      }
    }

    // Validate orderBy array if provided
    if (orderBy !== undefined) {
      if (!Array.isArray(orderBy)) {
        return NextResponse.json({
          success: false,
          error: 'orderBy must be an array',
          timestamp,
        }, { status: 400 });
      }
      
      for (const order of orderBy) {
        if (!isValidOrderBy(order)) {
          return NextResponse.json({
            success: false,
            error: 'Invalid orderBy structure',
            timestamp,
          }, { status: 400 });
        }
        
        if (!isValidColumnName(order.column)) {
          return NextResponse.json({
            success: false,
            error: `Invalid column name in orderBy: ${order.column}`,
            timestamp,
          }, { status: 400 });
        }
      }
    }

    // Initialize Supabase client with SERVICE ROLE key
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Build query
    let query = supabase.from(table).select(
      columns ? columns.join(',') : '*',
      { count: count ? 'exact' : undefined }
    );

    // Apply filters
    if (filters && filters.length > 0) {
      filters.forEach((filter) => {
        const { column, operator, value } = filter;
        
        switch (operator) {
          case 'eq':
            query = query.eq(column, value);
            break;
          case 'neq':
            query = query.neq(column, value);
            break;
          case 'gt':
            query = query.gt(column, value);
            break;
          case 'gte':
            query = query.gte(column, value);
            break;
          case 'lt':
            query = query.lt(column, value);
            break;
          case 'lte':
            query = query.lte(column, value);
            break;
          case 'like':
            query = query.like(column, value);
            break;
          case 'ilike':
            query = query.ilike(column, value);
            break;
          case 'in':
            query = query.in(column, Array.isArray(value) ? value : [value]);
            break;
          case 'is':
            query = query.is(column, value);
            break;
        }
      });
    }

    // Apply ordering
    if (orderBy && orderBy.length > 0) {
      orderBy.forEach((order) => {
        query = query.order(order.column, { 
          ascending: order.direction !== 'desc' 
        });
      });
    }

    // Apply pagination
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    
    if (offset !== undefined) {
      query = query.range(offset, offset + (limit || 1000) - 1);
    }

    // Execute query
    const { data, error, count: totalCount } = await query;

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    const response: ReadResponse = {
      success: true,
      data: data || [],
      timestamp,
    };

    if (count && totalCount !== null) {
      response.count = totalCount;
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp,
    }, { status: 500 });
  }
}

// Reject all other HTTP methods
export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use POST.',
    timestamp: new Date().toISOString(),
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use POST.',
    timestamp: new Date().toISOString(),
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use POST.',
    timestamp: new Date().toISOString(),
  }, { status: 405 });
}
