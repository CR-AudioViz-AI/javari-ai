/**
 * Javari AI - Page Section Component
 * SPEC 07 — Canonical Page Templates
 * 
 * Content section with optional title and description
 * - Semantic section element
 * - Optional heading
 * - Consistent spacing
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 07
 * @timestamp Tuesday, January 28, 2025 at 12:19 PM EST
 */

import { ReactNode } from 'react'

interface PageSectionProps {
  title?: string
  description?: string
  children: ReactNode
  id?: string
  className?: string
}

export function PageSection({
  title,
  description,
  children,
  id,
  className = '',
}: PageSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={id && title ? `${id}-heading` : undefined}
      className={`
        px-6 py-6
        ${className}
      `}
    >
      {title && (
        <div className="mb-6">
          <h2
            id={id ? `${id}-heading` : undefined}
            className="text-lg font-semibold text-foreground mb-1"
          >
            {title}
          </h2>
          {description && (
            <p className="text-sm text-foreground/60">
              {description}
            </p>
          )}
        </div>
      )}

      {children}
    </section>
  )
}
