/**
 * Supabase Write Proxy
 * Secure serverless API route for controlled database writes
 * 
 * @route POST /api/javari/supabase/write
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import telemetryEngine from '@/lib/telemetry-engine';

// Whitelist of allowed tables
const ALLOWED_TABLES = ['projects', 'milestones'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

// Allowed operations
const ALLOWED_OPERATIONS = ['insert', 'update'] as const;
type AllowedOperation = typeof ALLOWED_OPERATIONS[number];

interface WriteRequest {
  table: string;
  operation: string;
  data: Record<string, any> | Record<string, any>[];
  match?: Record<string, any>; // For updates only
}

interface WriteResponse {
  success: boolean;
  recordIds?: string[];
  error?: string;
  timestamp: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<WriteResponse>> {
  const timestamp = new Date().toISOString();

  try {
    // Feature flag check
    const writeEnabled = process.env.FEATURE_SUPABASE_WRITE === '1';
    if (!writeEnabled) {
      telemetryEngine.emitProgress('supabase-write', 0);
      return NextResponse.json({
        success: false,
        error: 'Supabase write proxy is disabled (FEATURE_SUPABASE_WRITE=0)',
        timestamp,
      }, { status: 403 });
    }

    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      telemetryEngine.emitProgress('supabase-write', 0);
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase credentials',
        timestamp,
      }, { status: 500 });
    }

    // Parse and validate request body
    let body: WriteRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON payload',
        timestamp,
      }, { status: 400 });
    }

    const { table, operation, data, match } = body;

    // Validate table whitelist
    if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
      telemetryEngine.emitProgress('supabase-write', 0);
      return NextResponse.json({
        success: false,
        error: `Table '${table}' not in whitelist. Allowed: ${ALLOWED_TABLES.join(', ')}`,
        timestamp,
      }, { status: 403 });
    }

    // Validate operation whitelist
    if (!ALLOWED_OPERATIONS.includes(operation as AllowedOperation)) {
      telemetryEngine.emitProgress('supabase-write', 0);
      return NextResponse.json({
        success: false,
        error: `Operation '${operation}' not allowed. Allowed: ${ALLOWED_OPERATIONS.join(', ')}`,
        timestamp,
      }, { status: 403 });
    }

    // Validate data payload
    if (!data || (typeof data !== 'object')) {
      return NextResponse.json({
        success: false,
        error: 'Missing or invalid data payload',
        timestamp,
      }, { status: 400 });
    }

    // Validate match clause for updates
    if (operation === 'update' && (!match || typeof match !== 'object')) {
      return NextResponse.json({
        success: false,
        error: 'Update operation requires match clause',
        timestamp,
      }, { status: 400 });
    }

    // Initialize Supabase client with SERVICE ROLE key
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let result;
    const recordIds: string[] = [];

    // Execute operation
    if (operation === 'insert') {
      const { data: insertedData, error } = await supabase
        .from(table)
        .insert(data)
        .select('id');

      if (error) {
        throw new Error(`Insert failed: ${error.message}`);
      }

      // Extract IDs
      if (insertedData) {
        if (Array.isArray(insertedData)) {
          recordIds.push(...insertedData.map(r => r.id));
        } else if (insertedData.id) {
          recordIds.push(insertedData.id);
        }
      }

      result = insertedData;
    } else if (operation === 'update') {
      let query = supabase.from(table).update(data);

      // Apply match filters
      Object.entries(match!).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: updatedData, error } = await query.select('id');

      if (error) {
        throw new Error(`Update failed: ${error.message}`);
      }

      // Extract IDs
      if (updatedData) {
        if (Array.isArray(updatedData)) {
          recordIds.push(...updatedData.map(r => r.id));
        } else if (updatedData.id) {
          recordIds.push(updatedData.id);
        }
      }

      result = updatedData;
    }

    // Emit success telemetry
    telemetryEngine.emitProgress('supabase-write', 100);
    telemetryEngine.emitHeartbeat(
      'supabase-write',
      `${operation} on ${table}: ${recordIds.length} record(s)`
    );

    return NextResponse.json({
      success: true,
      recordIds,
      timestamp,
    }, { status: 200 });

  } catch (error) {
    // Emit failure telemetry
    telemetryEngine.emitProgress('supabase-write', 0);
    
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
