import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Check actual user_accounts table schema
 */
export async function GET(req: NextRequest) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Try to get one row to see the schema
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message, details: error });
    }

    const columns = data && data.length > 0 ? Object.keys(data[0]) : [];

    return NextResponse.json({
      message: 'user_accounts schema',
      columns,
      sample_row: data?.[0] || null
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
