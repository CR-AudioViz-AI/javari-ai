// app/api/run-migration/route.ts
// Safe migration route that doesn't break builds

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Don't run during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ 
      message: 'Migrations skipped during build' 
    });
  }

  try {
    // Migration logic wrapped in try/catch
    return NextResponse.json({ 
      message: 'Migration endpoint available',
      note: 'Manual migration execution required'
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Same safety wrapper
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ 
      message: 'Migrations skipped during build' 
    });
  }

  return NextResponse.json({ 
    message: 'Migration POST endpoint',
    note: 'Implement migration logic here with proper error handling'
  });
}
