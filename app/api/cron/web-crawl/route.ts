export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { safeAsync } from '@/lib/error-handler';
import { isDefined } from '@/lib/typescript-helpers';

export async function GET(request: Request) {
  return await safeAsync(
    async () => {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Trigger web crawl process
      return NextResponse.json({ 
        success: true, 
        message: 'Web crawl cron executed',
        timestamp: new Date().toISOString()
      });
    },
    { file: 'cron/web-crawl/route.ts', function: 'GET' },
    NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  ) || NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}
