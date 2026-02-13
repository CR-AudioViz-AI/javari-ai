export const dynamic = 'force-dynamic';

// ============================================================================
// API ROUTE: List Notifications
// ============================================================================
// Path: app/api/notifications/route.ts
// Method: GET
// Description: List user's notifications with filtering
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notificationos';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as any;
    const type = searchParams.get('type') as any;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get notifications
    const notifications = await NotificationService.list(user.id, {
      status,
      type,
      limit,
      offset,
    });

    // Get unread count
    const unread_count = await NotificationService.getUnreadCount(user.id);

    return NextResponse.json({
      success: true,
      notifications,
      unread_count,
      pagination: {
        limit,
        offset,
        total: notifications.length,
      },
    });

  } catch (error: any) {
    console.error('Error in /api/notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
