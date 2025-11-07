/**
 * Supabase Server Client
 * For use in Server Components, Route Handlers, and Server Actions
 * Uses @supabase/ssr for proper cookie handling
 */

import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export function createClient() {
  const cookieStore = cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error: unknown) {
            // Handle cookie setting errors in Server Components
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error: unknown) {
            // Handle cookie removal errors in Server Components
          }
        },
      },
    }
  );
}

/**
 * Create admin client with service role key
 * Use with caution - bypasses Row Level Security
 */
export function createAdminClient() {
  const { createClient } = require('@supabase/supabase-js');
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
