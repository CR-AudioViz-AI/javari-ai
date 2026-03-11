```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { addDays, addWeeks, addMonths, format, parseISO, isAfter, isBefore } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

/**
 * Enum for event types
 */
export enum EventType {
  WEBINAR = 'webinar',
  WORKSHOP = 'workshop',
  SOCIAL = 'social',
  CONFERENCE = 'conference',
  NETWORKING = 'networking'
}

/**
 * Enum for event status
 */
export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

/**
 * Enum for registration status
 */
export enum RegistrationStatus {
  REGISTERED = 'registered',
  WAITLISTED = 'waitlisted',
  CANCELLED = 'cancelled',
  ATTENDED = 'attended',
  NO_SHOW = 'no_show'
}

/**
 * Enum for recurrence patterns
 */
export enum RecurrencePattern {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly'
}

/**
 * Event interface
 */
export interface Event {
  id: string;
  title: string;
  description: string;
  type: EventType;
  status: EventStatus;
  start_time: string;
  end_time: string;
  timezone: string;
  capacity: number;
  registered_count: number;
  waitlist_count: number;
  is_paid: boolean;
  price?: number;
  currency?: string;
  location_type: 'online' | 'hybrid' | 'physical';
  meeting_url?: string;
  meeting_id?: string;
  meeting_password?: string;
  tags: string[];
  organizer_id: string;
  series_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Event registration interface
 */
export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  registered_at: string;
  cancelled_at?: string;
  payment_status?: 'pending' | 'completed' | 'failed';
  payment_id?: string;
  waitlist_position?: number;
}

/**
 * Event attendance interface
 */
export interface EventAttendance {
  id: string;
  event_id: string;
  user_id: string;
  joined_at: string;
  left_at?: string;
  duration_minutes: number;
  device_type: string;
  ip_address: string;
}

/**
 * Event series interface
 */
export interface EventSeries {
  id: string;
  title: string;
  description: string;
  pattern: RecurrencePattern;
  interval: number;
  end_date?: string;
  max_occurrences?: number;
  organizer_id: string;
  created_at: string;
}

/**
 * Event creation parameters
 */
export interface CreateEventParams {
  title: string;
  description: string;
  type: EventType;
  start_time: string;
  end_time: string;
  timezone: string;
  capacity: number;
  is_paid?: boolean;
  price?: number;
  currency?: string;
  location_type: 'online' | 'hybrid' | 'physical';
  meeting_url?: string;
  tags?: string[];
  organizer_id: string;
  series_id?: string;
}

/**
 * Registration parameters
 */
export interface RegistrationParams {
  event_id: string;
  user_id: string;
  payment_method?: string;
}

/**
 * Event analytics interface
 */
export interface EventAnalytics {
  event_id: string;
  total_registrations: number;
  total_attendees: number;
  attendance_rate: number;
  average_duration_minutes: number;
  peak_concurrent_users: number;
  no_show_rate: number;
  revenue?: number;
  engagement_score: number;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  email_reminders: boolean;
  sms_reminders: boolean;
  reminder_intervals: number[]; // minutes before event
}

/**
 * Error types for virtual events service
 */
export class VirtualEventsError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'VirtualEventsError';
  }
}

/**
 * Virtual Events Service
 * Comprehensive service for managing virtual community events
 */
export class VirtualEventsService {
  private supabase: SupabaseClient;
  private notificationService: NotificationService;
  private streamingIntegration: StreamingIntegration;
  private calendarIntegration: CalendarIntegration;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    private emailService: any,
    private paymentService: any
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.notificationService = new NotificationService(this.supabase, this.emailService);
    this.streamingIntegration = new StreamingIntegration();
    this.calendarIntegration = new CalendarIntegration();
  }

  /**
   * Create a new event
   */
  async createEvent(params: CreateEventParams): Promise<Event> {
    try {
      // Validate time zones and scheduling
      await this.validateEventTiming(params.start_time, params.end_time, params.timezone);

      // Create meeting room if online event
      let meetingDetails = {};
      if (params.location_type === 'online' && !params.meeting_url) {
        meetingDetails = await this.streamingIntegration.createMeeting({
          title: params.title,
          start_time: params.start_time,
          duration: this.calculateDuration(params.start_time, params.end_time)
        });
      }

      const eventData = {
        ...params,
        ...meetingDetails,
        registered_count: 0,
        waitlist_count: 0,
        status: EventStatus.DRAFT,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('events')
        .insert(eventData)
        .select()
        .single();

      if (error) {
        throw new VirtualEventsError(
          `Failed to create event: ${error.message}`,
          'CREATE_EVENT_FAILED',
          500
        );
      }

      // Sync with external calendar if configured
      await this.calendarIntegration.createCalendarEvent(data);

      return data;
    } catch (error) {
      if (error instanceof VirtualEventsError) throw error;
      throw new VirtualEventsError(
        'Failed to create event',
        'UNKNOWN_ERROR',
        500
      );
    }
  }

  /**
   * Publish an event to make it available for registration
   */
  async publishEvent(eventId: string, organizerId: string): Promise<Event> {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .update({ 
          status: EventStatus.PUBLISHED,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .eq('organizer_id', organizerId)
        .select()
        .single();

      if (error || !data) {
        throw new VirtualEventsError(
          'Event not found or unauthorized',
          'EVENT_NOT_FOUND',
          404
        );
      }

      // Send notifications to followers/subscribers
      await this.notificationService.notifyEventPublished(data);

      return data;
    } catch (error) {
      if (error instanceof VirtualEventsError) throw error;
      throw new VirtualEventsError(
        'Failed to publish event',
        'PUBLISH_FAILED',
        500
      );
    }
  }

  /**
   * Register user for an event
   */
  async registerForEvent(params: RegistrationParams): Promise<EventRegistration> {
    try {
      const event = await this.getEvent(params.event_id);
      
      if (event.status !== EventStatus.PUBLISHED) {
        throw new VirtualEventsError(
          'Event is not available for registration',
          'EVENT_NOT_AVAILABLE',
          400
        );
      }

      // Check if already registered
      const existingRegistration = await this.getRegistration(params.event_id, params.user_id);
      if (existingRegistration) {
        throw new VirtualEventsError(
          'User is already registered for this event',
          'ALREADY_REGISTERED',
          400
        );
      }

      // Determine registration status based on capacity
      const status = event.registered_count < event.capacity 
        ? RegistrationStatus.REGISTERED 
        : RegistrationStatus.WAITLISTED;

      const registrationData = {
        ...params,
        status,
        registered_at: new Date().toISOString(),
        waitlist_position: status === RegistrationStatus.WAITLISTED 
          ? event.waitlist_count + 1 
          : undefined
      };

      // Handle payment for paid events
      if (event.is_paid && status === RegistrationStatus.REGISTERED) {
        const payment = await this.paymentService.processPayment({
          amount: event.price,
          currency: event.currency,
          user_id: params.user_id,
          event_id: params.event_id
        });
        registrationData.payment_id = payment.id;
        registrationData.payment_status = 'pending';
      }

      const { data, error } = await this.supabase
        .from('event_registrations')
        .insert(registrationData)
        .select()
        .single();

      if (error) {
        throw new VirtualEventsError(
          `Registration failed: ${error.message}`,
          'REGISTRATION_FAILED',
          500
        );
      }

      // Update event counts
      await this.updateEventCounts(params.event_id);

      // Send confirmation email
      await this.notificationService.sendRegistrationConfirmation(data, event);

      return data;
    } catch (error) {
      if (error instanceof VirtualEventsError) throw error;
      throw new VirtualEventsError(
        'Registration failed',
        'REGISTRATION_ERROR',
        500
      );
    }
  }

  /**
   * Cancel event registration
   */
  async cancelRegistration(eventId: string, userId: string): Promise<void> {
    try {
      const registration = await this.getRegistration(eventId, userId);
      if (!registration) {
        throw new VirtualEventsError(
          'Registration not found',
          'REGISTRATION_NOT_FOUND',
          404
        );
      }

      const { error } = await this.supabase
        .from('event_registrations')
        .update({
          status: RegistrationStatus.CANCELLED,
          cancelled_at: new Date().toISOString()
        })
        .eq('event_id', eventId)
        .eq('user_id', userId);

      if (error) {
        throw new VirtualEventsError(
          `Failed to cancel registration: ${error.message}`,
          'CANCEL_FAILED',
          500
        );
      }

      // Update event counts and promote waitlisted users
      await this.updateEventCounts(eventId);
      await this.promoteFromWaitlist(eventId);

    } catch (error) {
      if (error instanceof VirtualEventsError) throw error;
      throw new VirtualEventsError(
        'Failed to cancel registration',
        'CANCEL_ERROR',
        500
      );
    }
  }

  /**
   * Track event attendance
   */
  async trackAttendance(
    eventId: string, 
    userId: string, 
    action: 'join' | 'leave',
    deviceInfo: { type: string; ip: string }
  ): Promise<void> {
    try {
      if (action === 'join') {
        await this.supabase
          .from('event_attendance')
          .insert({
            event_id: eventId,
            user_id: userId,
            joined_at: new Date().toISOString(),
            device_type: deviceInfo.type,
            ip_address: deviceInfo.ip,
            duration_minutes: 0
          });
      } else {
        const { data: attendance } = await this.supabase
          .from('event_attendance')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .is('left_at', null)
          .single();

        if (attendance) {
          const duration = Math.round(
            (new Date().getTime() - new Date(attendance.joined_at).getTime()) / (1000 * 60)
          );

          await this.supabase
            .from('event_attendance')
            .update({
              left_at: new Date().toISOString(),
              duration_minutes: duration
            })
            .eq('id', attendance.id);
        }
      }
    } catch (error) {
      console.error('Failed to track attendance:', error);
      // Don't throw here as this shouldn't break the main flow
    }
  }

  /**
   * Create recurring event series
   */
  async createEventSeries(
    baseEvent: CreateEventParams,
    seriesParams: {
      pattern: RecurrencePattern;
      interval: number;
      endDate?: string;
      maxOccurrences?: number;
    }
  ): Promise<EventSeries> {
    try {
      // Create series record
      const { data: series, error: seriesError } = await this.supabase
        .from('event_series')
        .insert({
          title: baseEvent.title,
          description: baseEvent.description,
          pattern: seriesParams.pattern,
          interval: seriesParams.interval,
          end_date: seriesParams.endDate,
          max_occurrences: seriesParams.maxOccurrences,
          organizer_id: baseEvent.organizer_id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (seriesError) {
        throw new VirtualEventsError(
          `Failed to create series: ${seriesError.message}`,
          'SERIES_CREATE_FAILED',
          500
        );
      }

      // Generate recurring events
      const events = this.generateRecurringEvents(baseEvent, seriesParams, series.id);
      
      for (const eventParams of events) {
        await this.createEvent({ ...eventParams, series_id: series.id });
      }

      return series;
    } catch (error) {
      if (error instanceof VirtualEventsError) throw error;
      throw new VirtualEventsError(
        'Failed to create event series',
        'SERIES_ERROR',
        500
      );
    }
  }

  /**
   * Get event analytics
   */
  async getEventAnalytics(eventId: string): Promise<EventAnalytics> {
    try {
      const [event, registrations, attendance] = await Promise.all([
        this.getEvent(eventId),
        this.getEventRegistrations(eventId),
        this.getEventAttendance(eventId)
      ]);

      const totalRegistrations = registrations.filter(
        r => r.status === RegistrationStatus.REGISTERED
      ).length;

      const totalAttendees = attendance.length;
      const attendanceRate = totalRegistrations > 0 
        ? (totalAttendees / totalRegistrations) * 100 
        : 0;

      const averageDuration = attendance.reduce((acc, a) => acc + a.duration_minutes, 0) 
        / (attendance.length || 1);

      const noShowCount = registrations.filter(
        r => r.status === RegistrationStatus.NO_SHOW
      ).length;

      const noShowRate = totalRegistrations > 0 
        ? (noShowCount / totalRegistrations) * 100 
        : 0;

      const revenue = event.is_paid 
        ? totalRegistrations * (event.price || 0)
        : undefined;

      return {
        event_id: eventId,
        total_registrations: totalRegistrations,
        total_attendees: totalAttendees,
        attendance_rate: Math.round(attendanceRate * 100) / 100,
        average_duration_minutes: Math.round(averageDuration),
        peak_concurrent_users: await this.calculatePeakConcurrentUsers(eventId),
        no_show_rate: Math.round(noShowRate * 100) / 100,
        revenue,
        engagement_score: this.calculateEngagementScore(attendance, event)
      };
    } catch (error) {
      throw new VirtualEventsError(
        'Failed to generate analytics',
        'ANALYTICS_ERROR',
        500
      );
    }
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(
    filters?: {
      type?: EventType;
      organizerId?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    }
  ): Promise<Event[]> {
    try {
      let query = this.supabase
        .from('events')
        .select('*')
        .eq('status', EventStatus.PUBLISHED)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.organizerId) {
        query = query.eq('organizer_id', filters.organizerId);
      }

      if (filters?.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 10)) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new VirtualEventsError(
          `Failed to fetch events: ${error.message}`,
          'FETCH_EVENTS_FAILED',
          500
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof VirtualEventsError) throw error;
      throw new VirtualEventsError(
        'Failed to fetch upcoming events',
        'FETCH_ERROR',
        500
      );
    }
  }

  /**
   * Send event reminders
   */
  async sendEventReminders(): Promise<void> {
    try {
      const upcomingEvents = await this.getEventsForReminders();

      for (const event of upcomingEvents) {
        const registrations = await this.getEventRegistrations(event.id);
        
        for (const registration of registrations) {
          if (registration.status === RegistrationStatus.REGISTERED) {
            await this.notificationService.sendEventReminder(registration, event);
          }
        }
      }
    } catch (error) {
      console.error('Failed to send event reminders:', error);
    }
  }

  // Private helper methods

  private async validateEventTiming(startTime: string, endTime: string, timezone: string): Promise<void> {
    const start = parseISO(startTime);
    const end = parseISO(endTime);

    if (isAfter(start, end)) {
      throw new VirtualEventsError(
        'Start time must be before end time',
        'INVALID_TIMING',
        400
      );
    }

    if (isBefore(start, new Date())) {
      throw new VirtualEventsError(
        'Event cannot be scheduled in the past',
        'PAST_EVENT',
        400
      );
    }
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  private async getEvent(eventId: string): Promise<Event> {
    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error || !data) {
      throw new VirtualEventsError(
        'Event not found',
        'EVENT_NOT_FOUND',
        404
      );
    }

    return data;
  }

  private async getRegistration(eventId: string, userId: string): Promise<EventRegistration | null> {
    const { data } = await this.supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    return data;
  }

  private async getEventRegistrations(eventId: string): Promise<EventRegistration[]> {
    const { data } = await this.supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId);

    return data || [];
  }

  private async getEventAttendance(eventId: string): Promise<EventAttendance[]> {
    const { data } = await this.supabase
      .from('event_attendance')
      .select('*')
      .eq('event_id', eventId);

    return data || [];
  }

  private async updateEventCounts(eventId: string): Promise<void> {
    const registrations = await this.getEventRegistrations(eventId);
    
    const registeredCount = registrations.filter(
      r => r.status === RegistrationStatus.REGISTERED
    ).length;
    
    const waitlistCount = registrations.filter(
      r => r.status === RegistrationStatus.WAITLISTED
    ).length;

    await this.supabase
      .from('events')
      .update({
        registered_count: registeredCount,
        waitlist_count: waitlistCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);
  }

  private async promoteFromWaitlist(eventId: string): Promise<void> {
    const event = await this.getEvent(eventId);
    const availableSlots = event.capacity - event.registered_count;

    if (availableSlots > 0) {
      const { data: waitlisted } = await this.supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', RegistrationStatus.WAITLISTED)
        .order('registered_at', { ascending: true })
        .limit(availableSlots);

      if (waitlisted && waitlisted