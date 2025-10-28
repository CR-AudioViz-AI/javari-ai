import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// TIMESTAMP UTILITIES - Always display in user's local timezone
// ============================================================================

/**
 * Format a date/timestamp to the user's local time
 * @param date - Date object, ISO string, or timestamp
 * @param format - 'full' | 'date' | 'time' | 'relative' | 'chat'
 * @returns Formatted string in user's local timezone
 */
export function formatLocalTime(
  date: Date | string | number | null | undefined,
  format: 'full' | 'date' | 'time' | 'relative' | 'chat' = 'full'
): string {
  if (!date) return 'N/A';

  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;

  if (isNaN(dateObj.getTime())) return 'Invalid Date';

  switch (format) {
    case 'full':
      // Tuesday, October 28, 2025 - 10:52 AM EST
      return dateObj.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });

    case 'date':
      // Oct 28, 2025
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

    case 'time':
      // 10:52 AM
      return dateObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });

    case 'chat':
      // Oct 28, 10:52 AM
      return dateObj.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

    case 'relative':
      return getRelativeTime(dateObj);

    default:
      return dateObj.toLocaleString('en-US');
  }
}

/**
 * Get relative time string (e.g., "2 hours ago", "just now")
 */
export function getRelativeTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
  if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  const years = Math.floor(diffDay / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Get current timestamp in user's local time
 * @returns ISO string that will be stored in DB (UTC) but displayed as local
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format duration in minutes to readable string
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes < 1) return 'Less than a minute';
  
  if (minutes < 60) {
    return `${Math.round(minutes)} ${Math.round(minutes) === 1 ? 'minute' : 'minutes'}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  
  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get user's timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format timestamp for chat messages with relative time
 * Shows relative time if recent, otherwise shows date
 */
export function formatChatTimestamp(date: Date | string | number | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If today, show relative time
  if (diffDays === 0) {
    return getRelativeTime(dateObj);
  }

  // If yesterday
  if (diffDays === 1) {
    return `Yesterday at ${formatLocalTime(dateObj, 'time')}`;
  }

  // If within last 7 days, show day and time
  if (diffDays < 7) {
    return dateObj.toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  // Otherwise show full date and time
  return formatLocalTime(dateObj, 'chat');
}

/**
 * Format timestamp for API responses
 * Ensures consistent format across all API endpoints
 */
export function formatApiTimestamp(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;

  return dateObj.toISOString();
}

/**
 * Parse any date format to Date object
 */
export function parseDate(date: Date | string | number | null | undefined): Date | null {
  if (!date) return null;
  
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;

  return isNaN(dateObj.getTime()) ? null : dateObj;
}
