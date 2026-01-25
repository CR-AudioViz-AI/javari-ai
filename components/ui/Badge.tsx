/**
 * Javari AI - Badge Component
 * SPEC 05 — Canonical UI Primitives
 * 
 * Small status/label indicator
 * - Default, success, warning, error variants
 * - Compact sizing
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 05
 * @timestamp Tuesday, January 28, 2025 at 11:54 AM EST
 */

import { HTMLAttributes, ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children: ReactNode
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-secondary text-secondary-foreground',
  success: 'bg-success/10 text-success border border-success/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  error: 'bg-error/10 text-error border border-error/20',
}

export function Badge({
  variant = 'default',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2 py-0.5
        text-xs font-medium
        rounded-md
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  )
}
