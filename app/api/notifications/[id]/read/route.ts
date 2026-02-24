// ============================================================================
// API ROUTE: Mark Notification as Read
// ============================================================================
// Path: app/api/notifications/[id]/read/route.ts
// Method: PATCH
// Description: Mark a notification as read
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notificationos';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const notificationId = params.id;

    // Mark as read
    const success = await NotificationService.markAsRead(notificationId, user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to mark notification as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error: any) {
    console.error('Error in /api/notifications/[id]/read:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
