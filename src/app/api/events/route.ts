```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeInput } from '@/lib/sanitizer';
import { validateCSRF } from '@/lib/csrf';
import { createHash, randomUUID } from 'crypto';

// Validation schemas
const EventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  timezone: z.string().max(50),
  max_participants: z.number().int().min(1).max(10000),
  is_public: z.boolean().default(true),
  tags: z.array(z.string().max(50)).max(20).optional(),
  meeting_url: z.string().url().optional(),
  registration_required: z.boolean().default(false),
  event_type: z.enum(['webinar', 'workshop', 'meeting', 'conference', 'social']),
  cover_image_url: z.string().url().optional(),
});

const EventUpdateSchema = EventCreateSchema.partial();

const RegistrationSchema = z.object({
  event_id: z.string().uuid(),
  additional_info: z.string().max(500).optional(),
});

const AttendanceSchema = z.object({
  event_id: z.string().uuid(),
  session_duration: z.number().int().min(0).optional(),
});

interface DatabaseEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  timezone: string;
  max_participants: number;
  is_public: boolean;
  tags: string[];
  meeting_url?: string;
  registration_required: boolean;
  event_type: string;
  cover_image_url?: string;
  creator_id: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'published' | 'live' | 'completed' | 'cancelled';
}

interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  registered_at: string;
  status: 'registered' | 'attended' | 'cancelled';
  additional_info?: string;
}

interface EventAttendance {
  id: string;
  event_id: string;
  user_id: string;
  joined_at: string;
  left_at?: string;
  session_duration?: number;
  is_active: boolean;
}

// Create Supabase client
function createClient(cookieStore: any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

// Utility functions
async function getUserFromAuth(supabase: any): Promise<{ id: string; email: string } | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { id: user.id, email: user.email };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

async function validateEventPermissions(
  supabase: any, 
  eventId: string, 
  userId: string, 
  action: 'read' | 'write' | 'delete'
): Promise<boolean> {
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('creator_id, is_public')
      .eq('id', eventId)
      .single();

    if (error || !event) return false;

    // Creator has full permissions
    if (event.creator_id === userId) return true;

    // Public events can be read by anyone
    if (action === 'read' && event.is_public) return true;

    return false;
  } catch (error) {
    console.error('Permission validation error:', error);
    return false;
  }
}

async function generateEventAnalytics(supabase: any, eventId: string) {
  try {
    const [registrationsResult, attendanceResult, eventResult] = await Promise.all([
      supabase
        .from('event_registrations')
        .select('status, registered_at')
        .eq('event_id', eventId),
      supabase
        .from('event_attendance')
        .select('joined_at, left_at, session_duration')
        .eq('event_id', eventId),
      supabase
        .from('events')
        .select('title, start_time, end_time, max_participants')
        .eq('id', eventId)
        .single()
    ]);

    const registrations = registrationsResult.data || [];
    const attendance = attendanceResult.data || [];
    const event = eventResult.data;

    if (!event) {
      throw new Error('Event not found');
    }

    const totalRegistrations = registrations.length;
    const attendedCount = registrations.filter(r => r.status === 'attended').length;
    const noShowCount = registrations.filter(r => r.status === 'registered').length;
    const cancelledCount = registrations.filter(r => r.status === 'cancelled').length;

    const averageSessionDuration = attendance.length > 0 
      ? attendance.reduce((sum, a) => sum + (a.session_duration || 0), 0) / attendance.length
      : 0;

    const peakAttendance = Math.max(...attendance.map(a => 1)); // Simplified peak calculation

    return {
      eventId,
      totalRegistrations,
      attendedCount,
      noShowCount,
      cancelledCount,
      attendanceRate: totalRegistrations > 0 ? (attendedCount / totalRegistrations) * 100 : 0,
      averageSessionDuration: Math.round(averageSessionDuration),
      peakAttendance,
      capacityUtilization: (totalRegistrations / event.max_participants) * 100,
    };
  } catch (error) {
    console.error('Analytics generation error:', error);
    throw error;
  }
}

async function sendEventNotification(
  eventData: any,
  type: 'created' | 'updated' | 'cancelled' | 'reminder',
  recipients: string[]
) {
  // Implementation for email/push notifications
  // This would integrate with your notification service
  console.log(`Sending ${type} notification for event ${eventData.id} to ${recipients.length} recipients`);
}

// GET - Fetch events with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const search = sanitizeInput(searchParams.get('search') || '');
    const eventType = searchParams.get('type');
    const status = searchParams.get('status');
    const upcoming = searchParams.get('upcoming') === 'true';

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    let query = supabase
      .from('events')
      .select(`
        *,
        event_registrations!inner(count),
        creator:profiles!events_creator_id_fkey(username, avatar_url)
      `)
      .eq('is_public', true)
      .order('start_time', { ascending: true });

    // Apply filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (upcoming) {
      query = query.gte('start_time', new Date().toISOString());
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: events, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events: events || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error) {
    console.error('GET /api/events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new event
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const rateLimitResult = await rateLimit({
      key: `events_create_${identifier}`,
      limit: 10,
      window: 3600000, // 1 hour
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // CSRF validation
    if (!await validateCSRF(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const user = await getUserFromAuth(supabase);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate and sanitize input
    const validationResult = EventCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const eventData = validationResult.data;

    // Additional business logic validation
    const startTime = new Date(eventData.start_time);
    const endTime = new Date(eventData.end_time);
    
    if (startTime >= endTime) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    if (startTime < new Date()) {
      return NextResponse.json(
        { error: 'Start time must be in the future' },
        { status: 400 }
      );
    }

    // Create event
    const eventId = randomUUID();
    const { data: event, error: insertError } = await supabase
      .from('events')
      .insert({
        id: eventId,
        ...eventData,
        creator_id: user.id,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Event creation error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    // Send notifications (async)
    sendEventNotification(event, 'created', [user.email]);

    return NextResponse.json(
      { 
        message: 'Event created successfully',
        event: event
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('POST /api/events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update event
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // CSRF validation
    if (!await validateCSRF(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const user = await getUserFromAuth(supabase);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check permissions
    const hasPermission = await validateEventPermissions(supabase, eventId, user.id, 'write');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = EventUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // Update event
    const { data: event, error: updateError } = await supabase
      .from('events')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('Event update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      );
    }

    // Notify registered users of changes
    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('user_id, profiles(email)')
      .eq('event_id', eventId)
      .eq('status', 'registered');

    if (registrations?.length) {
      const emails = registrations
        .map(r => r.profiles?.email)
        .filter(Boolean);
      
      sendEventNotification(event, 'updated', emails);
    }

    return NextResponse.json({
      message: 'Event updated successfully',
      event: event
    });

  } catch (error) {
    console.error('PUT /api/events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete event
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // CSRF validation
    if (!await validateCSRF(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Authenticate user
    const user = await getUserFromAuth(supabase);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check permissions
    const hasPermission = await validateEventPermissions(supabase, eventId, user.id, 'delete');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if event has started
    const { data: event } = await supabase
      .from('events')
      .select('start_time, status')
      .eq('id', eventId)
      .single();

    if (event && (event.status === 'live' || new Date(event.start_time) < new Date())) {
      return NextResponse.json(
        { error: 'Cannot delete event that has started' },
        { status: 400 }
      );
    }

    // Get registered users for notification
    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('user_id, profiles(email)')
      .eq('event_id', eventId)
      .eq('status', 'registered');

    // Soft delete - mark as cancelled instead of hard delete
    const { error: updateError } = await supabase
      .from('events')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('Event deletion error:', updateError);
      return NextResponse.json(
        { error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    // Notify registered users
    if (registrations?.length) {
      const emails = registrations
        .map(r => r.profiles?.email)
        .filter(Boolean);
      
      sendEventNotification({ id: eventId }, 'cancelled', emails);
    }

    return NextResponse.json({
      message: 'Event cancelled successfully'
    });

  } catch (error) {
    console.error('DELETE /api/events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```