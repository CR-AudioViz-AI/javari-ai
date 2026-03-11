import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

/**
 * Community Event Management Microservice
 * 
 * Comprehensive service for managing community events including scheduling,
 * registration, notifications, virtual venues, and automated reminders.
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  status: EventStatus;
  startDate: Date;
  endDate: Date;
  timezone: string;
  location?: EventLocation;
  virtualVenue?: VirtualVenue;
  capacity?: number;
  registrationRequired: boolean;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  createdBy: string;
  organizerIds: string[];
  tags: string[];
  visibility: EventVisibility;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  status: RegistrationStatus;
  registeredAt: Date;
  checkedInAt?: Date;
  waitlistPosition?: number;
  metadata: Record<string, any>;
}

export interface EventNotification {
  id: string;
  eventId: string;
  type: NotificationType;
  recipientIds: string[];
  subject: string;
  content: string;
  scheduledFor: Date;
  sentAt?: Date;
  status: NotificationStatus;
  channels: NotificationChannel[];
}

export interface VirtualVenue {
  id: string;
  name: string;
  provider: VenueProvider;
  roomId: string;
  accessUrl: string;
  password?: string;
  streamingConfig?: StreamingConfig;
  recordingEnabled: boolean;
  maxParticipants: number;
  features: VenueFeature[];
}

export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  weekOfMonth?: number;
  monthOfYear?: number;
  endDate?: Date;
  occurrenceCount?: number;
  exceptions?: Date[];
}

export interface EventAnalytics {
  eventId: string;
  totalRegistrations: number;
  actualAttendance: number;
  attendanceRate: number;
  engagementScore: number;
  feedbackRating?: number;
  conversionMetrics: Record<string, number>;
  demographicBreakdown: Record<string, number>;
  generatedAt: Date;
}

export interface CalendarIntegration {
  userId: string;
  provider: CalendarProvider;
  accessToken: string;
  refreshToken?: string;
  calendarId: string;
  syncEnabled: boolean;
  lastSyncAt?: Date;
}

export interface EventPermission {
  userId: string;
  eventId: string;
  role: EventRole;
  permissions: Permission[];
  grantedBy: string;
  grantedAt: Date;
}

// Enums
export enum EventType {
  WORKSHOP = 'workshop',
  WEBINAR = 'webinar',
  MEETUP = 'meetup',
  CONFERENCE = 'conference',
  SOCIAL = 'social',
  HACKATHON = 'hackathon',
  NETWORKING = 'networking',
  TRAINING = 'training'
}

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  LIVE = 'live'
}

export enum RegistrationStatus {
  REGISTERED = 'registered',
  WAITLISTED = 'waitlisted',
  CANCELLED = 'cancelled',
  ATTENDED = 'attended',
  NO_SHOW = 'no_show'
}

export enum NotificationType {
  REGISTRATION_CONFIRMATION = 'registration_confirmation',
  EVENT_REMINDER = 'event_reminder',
  EVENT_UPDATE = 'event_update',
  EVENT_CANCELLATION = 'event_cancellation',
  WAITLIST_PROMOTION = 'waitlist_promotion',
  CHECK_IN_REMINDER = 'check_in_reminder'
}

export enum NotificationStatus {
  SCHEDULED = 'scheduled',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app',
  SMS = 'sms'
}

export enum EventVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  MEMBERS_ONLY = 'members_only'
}

export enum VenueProvider {
  ZOOM = 'zoom',
  TEAMS = 'teams',
  MEET = 'meet',
  WEBRTC = 'webrtc',
  YOUTUBE = 'youtube',
  TWITCH = 'twitch'
}

export enum VenueFeature {
  SCREEN_SHARE = 'screen_share',
  RECORDING = 'recording',
  CHAT = 'chat',
  BREAKOUT_ROOMS = 'breakout_rooms',
  WHITEBOARD = 'whiteboard',
  POLLS = 'polls'
}

export enum RecurrenceFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export enum CalendarProvider {
  GOOGLE = 'google',
  OUTLOOK = 'outlook',
  APPLE = 'apple',
  CALDAV = 'caldav'
}

export enum EventRole {
  ORGANIZER = 'organizer',
  CO_ORGANIZER = 'co_organizer',
  MODERATOR = 'moderator',
  SPEAKER = 'speaker'
}

export enum Permission {
  VIEW = 'view',
  EDIT = 'edit',
  DELETE = 'delete',
  MANAGE_REGISTRATIONS = 'manage_registrations',
  MANAGE_VENUE = 'manage_venue',
  SEND_NOTIFICATIONS = 'send_notifications'
}

export interface EventLocation {
  type: 'physical' | 'virtual' | 'hybrid';
  address?: string;
  city?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
}

export interface StreamingConfig {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  bitrate: number;
  resolution: string;
  audioCodec: string;
  videoCodec: string;
}

// Request/Response Types
export interface CreateEventRequest {
  title: string;
  description: string;
  type: EventType;
  startDate: Date;
  endDate: Date;
  timezone: string;
  location?: EventLocation;
  virtualVenue?: Partial<VirtualVenue>;
  capacity?: number;
  registrationRequired: boolean;
  recurrencePattern?: RecurrencePattern;
  organizerIds?: string[];
  tags?: string[];
  visibility: EventVisibility;
  metadata?: Record<string, any>;
}

export interface UpdateEventRequest extends Partial<CreateEventRequest> {
  id: string;
}

export interface EventSearchCriteria {
  query?: string;
  type?: EventType;
  status?: EventStatus;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  organizerId?: string;
  location?: string;
  visibility?: EventVisibility;
  limit?: number;
  offset?: number;
}

export interface RegistrationRequest {
  eventId: string;
  userId: string;
  metadata?: Record<string, any>;
}

export interface NotificationRequest {
  eventId: string;
  type: NotificationType;
  recipientIds: string[];
  subject: string;
  content: string;
  scheduledFor?: Date;
  channels: NotificationChannel[];
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class CommunityEventService {
  private supabase: SupabaseClient;
  private resend: Resend;
  private eventScheduler: EventScheduler;
  private registrationManager: RegistrationManager;
  private notificationService: NotificationService;
  private virtualVenueManager: VirtualVenueManager;
  private reminderSystem: ReminderSystem;
  private eventAnalytics: EventAnalytics;
  private calendarSync: CalendarSync;
  private eventPermissions: EventPermissions;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    resendApiKey: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.resend = new Resend(resendApiKey);
    
    this.eventScheduler = new EventScheduler(this.supabase);
    this.registrationManager = new RegistrationManager(this.supabase);
    this.notificationService = new NotificationService(this.supabase, this.resend);
    this.virtualVenueManager = new VirtualVenueManager(this.supabase);
    this.reminderSystem = new ReminderSystem(this.supabase, this.notificationService);
    this.eventAnalytics = new EventAnalytics(this.supabase);
    this.calendarSync = new CalendarSync(this.supabase);
    this.eventPermissions = new EventPermissions(this.supabase);
  }

  /**
   * Create a new community event
   */
  async createEvent(request: CreateEventRequest, createdBy: string): Promise<CommunityEvent> {
    try {
      const event = await this.eventScheduler.createEvent({
        ...request,
        createdBy,
        organizerIds: request.organizerIds || [createdBy]
      });

      // Set up virtual venue if required
      if (request.virtualVenue) {
        await this.virtualVenueManager.createVenue(event.id, request.virtualVenue);
      }

      // Create recurring instances if applicable
      if (request.recurrencePattern) {
        await this.eventScheduler.createRecurringInstances(event.id, request.recurrencePattern);
      }

      // Set up default reminders
      await this.reminderSystem.setupDefaultReminders(event.id);

      return event;
    } catch (error) {
      throw new CommunityEventError('Failed to create event', error);
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(request: UpdateEventRequest, userId: string): Promise<CommunityEvent> {
    try {
      // Check permissions
      await this.eventPermissions.checkPermission(userId, request.id, Permission.EDIT);

      const event = await this.eventScheduler.updateEvent(request);

      // Send update notifications to registered users
      await this.notificationService.sendEventUpdate(event.id, 'Event has been updated');

      return event;
    } catch (error) {
      throw new CommunityEventError('Failed to update event', error);
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, userId: string): Promise<void> {
    try {
      await this.eventPermissions.checkPermission(userId, eventId, Permission.DELETE);

      // Cancel all registrations and send notifications
      await this.registrationManager.cancelAllRegistrations(eventId);
      await this.notificationService.sendEventCancellation(eventId, 'Event has been cancelled');

      // Clean up virtual venue
      await this.virtualVenueManager.deleteVenue(eventId);

      // Remove from calendars
      await this.calendarSync.removeFromCalendars(eventId);

      await this.eventScheduler.deleteEvent(eventId);
    } catch (error) {
      throw new CommunityEventError('Failed to delete event', error);
    }
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string): Promise<CommunityEvent | null> {
    try {
      return await this.eventScheduler.getEvent(eventId);
    } catch (error) {
      throw new CommunityEventError('Failed to get event', error);
    }
  }

  /**
   * Search events
   */
  async searchEvents(criteria: EventSearchCriteria): Promise<CommunityEvent[]> {
    try {
      return await this.eventScheduler.searchEvents(criteria);
    } catch (error) {
      throw new CommunityEventError('Failed to search events', error);
    }
  }

  /**
   * Register user for event
   */
  async registerForEvent(request: RegistrationRequest): Promise<EventRegistration> {
    try {
      const registration = await this.registrationManager.registerUser(request);

      // Send confirmation notification
      await this.notificationService.sendRegistrationConfirmation(
        request.eventId,
        request.userId
      );

      // Add to user's calendar
      await this.calendarSync.addToUserCalendar(request.userId, request.eventId);

      return registration;
    } catch (error) {
      throw new CommunityEventError('Failed to register for event', error);
    }
  }

  /**
   * Cancel event registration
   */
  async cancelRegistration(eventId: string, userId: string): Promise<void> {
    try {
      await this.registrationManager.cancelRegistration(eventId, userId);

      // Promote waitlisted users
      await this.registrationManager.promoteFromWaitlist(eventId);

      // Remove from calendar
      await this.calendarSync.removeFromUserCalendar(userId, eventId);
    } catch (error) {
      throw new CommunityEventError('Failed to cancel registration', error);
    }
  }

  /**
   * Check in user to event
   */
  async checkInUser(eventId: string, userId: string): Promise<void> {
    try {
      await this.registrationManager.checkInUser(eventId, userId);
      await this.eventAnalytics.recordAttendance(eventId, userId);
    } catch (error) {
      throw new CommunityEventError('Failed to check in user', error);
    }
  }

  /**
   * Get event registrations
   */
  async getEventRegistrations(eventId: string, userId: string): Promise<EventRegistration[]> {
    try {
      await this.eventPermissions.checkPermission(userId, eventId, Permission.MANAGE_REGISTRATIONS);
      return await this.registrationManager.getEventRegistrations(eventId);
    } catch (error) {
      throw new CommunityEventError('Failed to get event registrations', error);
    }
  }

  /**
   * Send event notification
   */
  async sendNotification(request: NotificationRequest, senderId: string): Promise<void> {
    try {
      await this.eventPermissions.checkPermission(senderId, request.eventId, Permission.SEND_NOTIFICATIONS);
      await this.notificationService.sendNotification(request);
    } catch (error) {
      throw new CommunityEventError('Failed to send notification', error);
    }
  }

  /**
   * Get event analytics
   */
  async getEventAnalytics(eventId: string, userId: string): Promise<EventAnalytics> {
    try {
      await this.eventPermissions.checkPermission(userId, eventId, Permission.VIEW);
      return await this.eventAnalytics.generateAnalytics(eventId);
    } catch (error) {
      throw new CommunityEventError('Failed to get event analytics', error);
    }
  }

  /**
   * Setup calendar integration
   */
  async setupCalendarIntegration(integration: CalendarIntegration): Promise<void> {
    try {
      await this.calendarSync.setupIntegration(integration);
    } catch (error) {
      throw new CommunityEventError('Failed to setup calendar integration', error);
    }
  }

  /**
   * Start real-time event updates
   */
  subscribeToEventUpdates(eventId: string, callback: (event: CommunityEvent) => void): () => void {
    const channel = this.supabase
      .channel(`event-updates-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_events',
          filter: `id=eq.${eventId}`
        },
        (payload) => {
          callback(payload.new as CommunityEvent);
        }
      )
      .subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }
}

// ============================================================================
// COMPONENT CLASSES
// ============================================================================

class EventScheduler {
  constructor(private supabase: SupabaseClient) {}

  async createEvent(eventData: CreateEventRequest & { createdBy: string }): Promise<CommunityEvent> {
    const { data, error } = await this.supabase
      .from('community_events')
      .insert([{
        ...eventData,
        id: crypto.randomUUID(),
        status: EventStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateEvent(request: UpdateEventRequest): Promise<CommunityEvent> {
    const { data, error } = await this.supabase
      .from('community_events')
      .update({
        ...request,
        updatedAt: new Date()
      })
      .eq('id', request.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteEvent(eventId: string): Promise<void> {
    const { error } = await this.supabase
      .from('community_events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
  }

  async getEvent(eventId: string): Promise<CommunityEvent | null> {
    const { data, error } = await this.supabase
      .from('community_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async searchEvents(criteria: EventSearchCriteria): Promise<CommunityEvent[]> {
    let query = this.supabase
      .from('community_events')
      .select('*');

    if (criteria.query) {
      query = query.or(`title.ilike.%${criteria.query}%,description.ilike.%${criteria.query}%`);
    }

    if (criteria.type) {
      query = query.eq('type', criteria.type);
    }

    if (criteria.status) {
      query = query.eq('status', criteria.status);
    }

    if (criteria.startDate) {
      query = query.gte('start_date', criteria.startDate.toISOString());
    }

    if (criteria.endDate) {
      query = query.lte('end_date', criteria.endDate.toISOString());
    }

    if (criteria.tags && criteria.tags.length > 0) {
      query = query.overlaps('tags', criteria.tags);
    }

    if (criteria.organizerId) {
      query = query.contains('organizer_ids', [criteria.organizerId]);
    }

    if (criteria.visibility) {
      query = query.eq('visibility', criteria.visibility);
    }

    query = query
      .order('start_date', { ascending: true })
      .range(criteria.offset || 0, (criteria.offset || 0) + (criteria.limit || 10) - 1);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async createRecurringInstances(eventId: string, pattern: RecurrencePattern): Promise<void> {
    // Implementation for creating recurring event instances
    // This would generate multiple event records based on the recurrence pattern
  }
}

class RegistrationManager {
  constructor(private supabase: SupabaseClient) {}

  async registerUser(request: RegistrationRequest): Promise<EventRegistration> {
    // Check event capacity and determine registration status
    const event = await this.supabase
      .from('community_events')
      .select('capacity')
      .eq('id', request.eventId)
      .single();

    const currentRegistrations = await this.supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', request.eventId)
      .eq('status', RegistrationStatus.REGISTERED);

    let status = RegistrationStatus.REGISTERED;
    let waitlistPosition: number | undefined;

    if (event.data?.capacity && currentRegistrations.data && 
        currentRegistrations.data.length >= event.data.capacity) {
      status = RegistrationStatus.WAITLISTED;
      
      const waitlistCount = await this.supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', request.eventId)
        .eq('status', RegistrationStatus.WAITLISTED);
      
      waitlistPosition = (waitlistCount.data?.length || 0) + 1;
    }

    const { data, error } = await this.supabase
      .from('event_registrations')
      .insert([{
        id: crypto.randomUUID(),
        eventId: request.eventId,
        userId: request.userId,
        status,
        waitlistPosition,
        registeredAt: new Date(),
        metadata: request.metadata || {}
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async cancelRegistration(eventId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('event_registrations')
      .update({ status: RegistrationStatus.CANCELLED })
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async checkInUser(eventId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('event_registrations')
      .update({ 
        status: RegistrationStatus.ATTENDED,
        checkedInAt: new Date()
      })
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async getEventRegistrations(eventId: string): Promise<EventRegistration[]> {
    const { data, error } = await this.supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .order('registered_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async promoteFromWaitlist(eventId: string): Promise<void> {
    // Promote the next user from waitlist to registered
    const { data: nextWaitlisted } = await this.supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', RegistrationStatus.WAITLISTED