/**
 * Javari AI - Page Header Component
 * SPEC 07 — Canonical Page Templates
 * 
 * Page header with title, description, and actions
 * - H1 heading for proper hierarchy
 * - Optional description
 * - Optional action buttons
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 07
 * @timestamp Tuesday, January 28, 2025 at 12:18 PM EST
 */

import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header
      className={`
        flex flex-col gap-4 md:flex-row md:items-center md:justify-between
        px-6 py-6
        border-b border-border
        ${className}
      `}
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-foreground/60">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}
