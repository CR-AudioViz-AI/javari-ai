// ============================================================================
// API ROUTE: Send Notification
// ============================================================================
// Path: app/api/notifications/send/route.ts
// Method: POST
// Description: Send a notification (from template or direct)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notificationos';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // Send from template
    if (body.template_key) {
      const notification = await NotificationService.sendFromTemplate({
        user_id: body.user_id || user.id,
        template_key: body.template_key,
        variables: body.variables || {},
        metadata: body.metadata,
        send_immediately: body.send_immediately !== false,
      });

      if (!notification) {
        return NextResponse.json(
          { error: 'Failed to send notification from template' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        notification,
      });
    }

    // Send direct notification
    const notification = await NotificationService.create({
      user_id: body.user_id || user.id,
      type: body.type || 'system',
      priority: body.priority,
      subject: body.subject,
      body: body.body,
      html_body: body.html_body,
      channel: body.channel || 'email',
      metadata: body.metadata,
      tags: body.tags,
      dedup_key: body.dedup_key,
      send_immediately: body.send_immediately !== false,
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notification,
    });

  } catch (error: any) {
    console.error('Error in /api/notifications/send:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
