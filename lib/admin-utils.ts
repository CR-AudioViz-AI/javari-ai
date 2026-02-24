// /lib/admin-utils.ts
// Universal Admin Bypass Utility for CR AudioViz AI Ecosystem
// Timestamp: January 3, 2026
// 
// USAGE: Import and use isAdmin() to check if user should get free access
// 
// Example:
//   import { isAdmin, ADMIN_EMAILS } from '@/lib/admin-utils'
//   if (isAdmin(user?.email)) { /* skip credit deduction */ }

/**
 * Admin emails that get FREE unlimited access to ALL features
 * across the entire CR AudioViz AI ecosystem.
 * 
 * These users:
 * - Never pay credits
 * - Skip all paywalls
 * - Have access to all premium features
 * - Can access admin dashboards
 * - See all user data (for testing)
 */
export const ADMIN_EMAILS: string[] = [
  'royhenderson@craudiovizai.com',
  'cindyhenderson@craudiovizai.com'
]

/**
 * Check if an email belongs to an admin
 * @param email - User's email address (can be null/undefined)
 * @returns true if user is an admin
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

/**
 * Check if user should be charged credits
 * Returns false for admins (they don't pay)
 * @param email - User's email address
 * @returns true if user should be charged
 */
export function shouldChargeCredits(email: string | null | undefined): boolean {
  return !isAdmin(email)
}

/**
 * Get credit cost, returns 0 for admins
 * @param baseCost - Normal credit cost
 * @param email - User's email
 * @returns 0 for admins, baseCost for regular users
 */
export function getCreditCost(baseCost: number, email: string | null | undefined): number {
  return isAdmin(email) ? 0 : baseCost
}

/**
 * Check if user can access admin features
 * @param email - User's email
 * @returns true if user can access admin panel
 */
export function canAccessAdmin(email: string | null | undefined): boolean {
  return isAdmin(email)
}

/**
 * Middleware helper - check request headers for admin
 * @param request - Next.js request object
 * @returns true if request is from admin
 */
export function isAdminRequest(request: Request): boolean {
  const email = request.headers.get('x-user-email')
  return isAdmin(email)
}

export default {
  ADMIN_EMAILS,
  isAdmin,
  shouldChargeCredits,
  getCreditCost,
  canAccessAdmin,
  isAdminRequest
}
