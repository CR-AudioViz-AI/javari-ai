import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { addDays, addWeeks, addMonths, format, parseISO, isAfter, isBefore } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
export interface Event {
export interface EventRegistration {
export interface EventAttendance {
export interface EventSeries {
export interface CreateEventParams {
export interface RegistrationParams {
export interface EventAnalytics {
export interface NotificationPreferences {
      // Validate time zones and scheduling
      // Create meeting room if online event
      // Sync with external calendar if configured
      // Send notifications to followers/subscribers
      // Check if already registered
      // Determine registration status based on capacity
      // Handle payment for paid events
      // Update event counts
      // Send confirmation email
      // Update event counts and promote waitlisted users
      // Don't throw here as this shouldn't break the main flow
      // Create series record
      // Generate recurring events
  // Private helper methods
export default {}
