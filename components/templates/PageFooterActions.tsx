/**
 * Javari AI - Page Footer Actions Component
 * SPEC 07 — Canonical Page Templates
 * 
 * Sticky footer with action buttons
 * - Fixed to bottom on scroll
 * - Primary and secondary action slots
 * - Responsive layout
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 07
 * @timestamp Tuesday, January 28, 2025 at 12:22 PM EST
 */

import { ReactNode } from 'react'
import { Separator } from '@/components/ui/Separator'

interface PageFooterActionsProps {
  primaryAction?: ReactNode
  secondaryActions?: ReactNode
  className?: string
}

export function PageFooterActions({
  primaryAction,
  secondaryActions,
  className = '',
}: PageFooterActionsProps) {
  if (!primaryAction && !secondaryActions) {
    return null
  }

  return (
    <footer
      className={`
        sticky bottom-0
        bg-background
        border-t border-border
        ${className}
      `}
    >
      <div
        className={`
          flex flex-col-reverse gap-3
          sm:flex-row sm:items-center sm:justify-between
          px-6 py-4
        `}
      >
        {/* Secondary actions (left side on desktop, bottom on mobile) */}
        {secondaryActions && (
          <div className="flex items-center gap-2">
            {secondaryActions}
          </div>
        )}

        {/* Primary action (right side on desktop, top on mobile) */}
        {primaryAction && (
          <div className="flex items-center gap-2">
            {primaryAction}
          </div>
        )}
      </div>
    </footer>
  )
}
