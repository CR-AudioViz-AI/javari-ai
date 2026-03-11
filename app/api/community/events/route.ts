import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Validation schemas
const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000),
  type: z.enum(['webinar', 'workshop', 'networking', 'hybrid']),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  timezone: z.string(),
  max_attendees: z.number().int().positive().optional(),
  is_public: z.boolean().default(true),
  registration_deadline: z.string().datetime().optional(),
  meeting_url: z.string().url().optional(),
  meeting_platform: z.enum(['zoom', 'teams', 'meet', 'custom']).optional(),
  tags: z.array(z.string()).max(10).default([]),
  metadata: z.record(z.any()).optional(),
  price: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD')
});

const updateEventSchema = createEventSchema.partial();

const registerEventSchema = z.object({
  user_notes: z.string().max(500).optional(),
  dietary_requirements: z.string().max(200).optional(),
  emergency_contact: z.string().max(100).optional()
});

const analyticsSchema = z.object({
  event_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  action: z.enum(['view', 'register', 'join', 'leave', 'interact', 'complete']),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string().datetime().optional()
});

// Event management class
class EventManager {
  constructor(private supabase: any) {}

  async createEvent(eventData: any, userId: string) {
    const { data, error } = await this.supabase
      .from('events')
      .insert({
        ...eventData,
        organizer_id: userId,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create event: ${error.message}`);
    return data;
  }

  async getEvents(filters: any = {}) {
    let query = this.supabase
      .from('events')
      .select(`
        *,
        organizer:organizer_id (id, name, email, avatar_url),
        registrations:event_registrations (count),
        analytics:event_analytics (action, count)
      `);

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.is_public !== undefined) {
      query = query.eq('is_public', filters.is_public);
    }

    if (filters.start_date) {
      query = query.gte('start_time', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('start_time', filters.end_date);
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    query = query.order('start_time', { ascending: true });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch events: ${error.message}`);
    return data;
  }

  async updateEvent(eventId: string, updates: any, userId: string) {
    // Check if user is organizer
    const { data: event, error: fetchError } = await this.supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      throw new Error('Event not found');
    }

    if (event.organizer_id !== userId) {
      throw new Error('Unauthorized: Only event organizer can update');
    }

    const { data, error } = await this.supabase
      .from('events')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update event: ${error.message}`);
    return data;
  }

  async registerForEvent(eventId: string, userId: string, registrationData: any = {}) {
    // Check if event exists and has capacity
    const { data: event, error: eventError } = await this.supabase
      .from('events')
      .select('max_attendees, registration_deadline, status')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    if (event.status !== 'published') {
      throw new Error('Event is not open for registration');
    }

    if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
      throw new Error('Registration deadline has passed');
    }

    // Check current registration count
    if (event.max_attendees) {
      const { count } = await this.supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'confirmed');

      if (count && count >= event.max_attendees) {
        throw new Error('Event is full');
      }
    }

    // Check if already registered
    const { data: existing } = await this.supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      throw new Error('Already registered for this event');
    }

    // Create registration
    const { data, error } = await this.supabase
      .from('event_registrations')
      .insert({
        event_id: eventId,
        user_id: userId,
        status: 'confirmed',
        registration_data: registrationData,
        registered_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to register: ${error.message}`);

    // Send confirmation email
    await this.sendRegistrationConfirmation(eventId, userId);

    return data;
  }

  async getEventAttendees(eventId: string, userId: string) {
    // Check if user is organizer
    const { data: event, error: eventError } = await this.supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    if (event.organizer_id !== userId) {
      throw new Error('Unauthorized: Only event organizer can view attendees');
    }

    const { data, error } = await this.supabase
      .from('event_registrations')
      .select(`
        *,
        user:user_id (id, name, email, avatar_url)
      `)
      .eq('event_id', eventId)
      .order('registered_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch attendees: ${error.message}`);
    return data;
  }

  async trackAnalytics(analyticsData: any) {
    const { data, error } = await this.supabase
      .from('event_analytics')
      .insert({
        ...analyticsData,
        timestamp: analyticsData.timestamp || new Date().toISOString()
      });

    if (error) throw new Error(`Failed to track analytics: ${error.message}`);
    return data;
  }

  async getEventAnalytics(eventId: string, userId: string) {
    // Check if user is organizer
    const { data: event, error: eventError } = await this.supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    if (event.organizer_id !== userId) {
      throw new Error('Unauthorized: Only event organizer can view analytics');
    }

    const { data, error } = await this.supabase
      .from('event_analytics')
      .select('*')
      .eq('event_id', eventId)
      .order('timestamp', { ascending: false });

    if (error) throw new Error(`Failed to fetch analytics: ${error.message}`);

    // Aggregate analytics
    const analytics = data.reduce((acc: any, item: any) => {
      if (!acc[item.action]) {
        acc[item.action] = { count: 0, timestamps: [] };
      }
      acc[item.action].count += 1;
      acc[item.action].timestamps.push(item.timestamp);
      return acc;
    }, {});

    return { raw: data, aggregated: analytics };
  }

  async sendRegistrationConfirmation(eventId: string, userId: string) {
    try {
      const { data: registration } = await this.supabase
        .from('event_registrations')
        .select(`
          *,
          event:event_id (*),
          user:user_id (email, name)
        `)
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

      if (!registration || !registration.user?.email) return;

      await resend.emails.send({
        from: 'events@craudioviz.ai',
        to: registration.user.email,
        subject: `Registration Confirmed: ${registration.event.title}`,
        html: `
          <h2>Registration Confirmed!</h2>
          <p>Hi ${registration.user.name},</p>
          <p>You've successfully registered for <strong>${registration.event.title}</strong>.</p>
          <p><strong>Date:</strong> ${new Date(registration.event.start_time).toLocaleString()}</p>
          <p><strong>Type:</strong> ${registration.event.type}</p>
          ${registration.event.meeting_url ? `<p><strong>Meeting Link:</strong> <a href="${registration.event.meeting_url}">Join Event</a></p>` : ''}
          <p>We'll send you a reminder before the event starts.</p>
          <p>Best regards,<br>CR AudioViz AI Team</p>
        `
      });
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
    }
  }

  async sendEventReminders(eventId: string) {
    try {
      const { data: registrations } = await this.supabase
        .from('event_registrations')
        .select(`
          *,
          event:event_id (*),
          user:user_id (email, name)
        `)
        .eq('event_id', eventId)
        .eq('status', 'confirmed');

      if (!registrations) return;

      const emailPromises = registrations.map((registration: any) => {
        if (!registration.user?.email) return null;

        return resend.emails.send({
          from: 'events@craudioviz.ai',
          to: registration.user.email,
          subject: `Reminder: ${registration.event.title} starts soon!`,
          html: `
            <h2>Event Reminder</h2>
            <p>Hi ${registration.user.name},</p>
            <p>This is a reminder that <strong>${registration.event.title}</strong> starts in 1 hour.</p>
            <p><strong>Start Time:</strong> ${new Date(registration.event.start_time).toLocaleString()}</p>
            ${registration.event.meeting_url ? `<p><strong>Join here:</strong> <a href="${registration.event.meeting_url}">${registration.event.meeting_url}</a></p>` : ''}
            <p>See you there!</p>
            <p>Best regards,<br>CR AudioViz AI Team</p>
          `
        });
      }).filter(Boolean);

      await Promise.all(emailPromises);
    } catch (error) {
      console.error('Failed to send reminders:', error);
    }
  }
}

// GET - Fetch events with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const eventManager = new EventManager(supabase);

    const { searchParams } = new URL(request.url);
    const filters = {
      type: searchParams.get('type'),
      status: searchParams.get('status') || 'published',
      is_public: searchParams.get('is_public') === 'true',
      start_date: searchParams.get('start_date'),
      end_date: searchParams.get('end_date'),
      search: searchParams.get('search'),
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters] === null || filters[key as keyof typeof filters] === undefined) {
        delete filters[key as keyof typeof filters];
      }
    });

    const events = await eventManager.getEvents(filters);

    return NextResponse.json({
      success: true,
      data: events,
      count: events.length
    });

  } catch (error) {
    console.error('GET /api/community/events error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// POST - Create new event
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const eventManager = new EventManager(supabase);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validatedData = createEventSchema.parse(body);

    // Validate date logic
    if (new Date(validatedData.end_time) <= new Date(validatedData.start_time)) {
      return NextResponse.json(
        { success: false, error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    if (validatedData.registration_deadline) {
      if (new Date(validatedData.registration_deadline) >= new Date(validatedData.start_time)) {
        return NextResponse.json(
          { success: false, error: 'Registration deadline must be before event start time' },
          { status: 400 }
        );
      }
    }

    const event = await eventManager.createEvent(validatedData, user.id);

    return NextResponse.json({
      success: true,
      data: event,
      message: 'Event created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/community/events error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// PUT - Update event
export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const eventManager = new EventManager(supabase);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateEventSchema.parse(body);

    const event = await eventManager.updateEvent(eventId, validatedData, user.id);

    return NextResponse.json({
      success: true,
      data: event,
      message: 'Event updated successfully'
    });

  } catch (error) {
    console.error('PUT /api/community/events error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: error.message.includes('Unauthorized') ? 403 : 500 }
    );
  }
}