// ============================================================================
// API ROUTE: Mark All Notifications as Read
// ============================================================================
// Path: app/api/notifications/read-all/route.ts
// Method: PATCH
// Description: Mark all notifications as read for current user
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notificationos';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
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

    // Mark all as read
    const success = await NotificationService.markAllAsRead(user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to mark all notifications as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error: any) {
    console.error('Error in /api/notifications/read-all:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
