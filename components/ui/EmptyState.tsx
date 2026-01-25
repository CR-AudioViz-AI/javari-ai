/**
 * Javari AI - Empty State Component
 * SPEC 05 — Canonical UI Primitives
 * 
 * Placeholder for empty content states
 * - Icon, title, description, and optional action
 * - Centered layout
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 05
 * @timestamp Tuesday, January 28, 2025 at 11:57 AM EST
 */

import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center
        px-4 py-12 text-center
        ${className}
      `}
    >
      {icon && (
        <div className="mb-4 text-foreground/40" aria-hidden="true">
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-foreground/60 mb-6 max-w-md">
          {description}
        </p>
      )}
      
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  )
}
