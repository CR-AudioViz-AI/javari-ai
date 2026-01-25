/**
 * Javari AI - Data Empty State Component
 * SPEC 06 — Canonical Data UI Components
 * 
 * Specialized empty state for data tables/lists
 * - Composes the core EmptyState component
 * - Data-specific default icon and messaging
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 06
 * @timestamp Tuesday, January 28, 2025 at 12:11 PM EST
 */

import { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'

interface DataEmptyStateProps {
  icon?: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

const DefaultIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="9" x2="15" y2="9" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
)

export function DataEmptyState({
  icon,
  title = 'No data found',
  description = 'There are no items to display. Try adjusting your filters or create a new item.',
  action,
  className = '',
}: DataEmptyStateProps) {
  return (
    <EmptyState
      icon={icon || <DefaultIcon />}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  )
}
