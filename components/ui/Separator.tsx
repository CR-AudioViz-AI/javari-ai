/**
 * Javari AI - Separator Component
 * SPEC 05 — Canonical UI Primitives
 * 
 * Visual divider between content
 * - Horizontal or vertical orientation
 * - Semantic separator role
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 05
 * @timestamp Tuesday, January 28, 2025 at 11:55 AM EST
 */

import { HTMLAttributes } from 'react'

type SeparatorOrientation = 'horizontal' | 'vertical'

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: SeparatorOrientation
  decorative?: boolean
}

export function Separator({
  orientation = 'horizontal',
  decorative = false,
  className = '',
  ...props
}: SeparatorProps) {
  return (
    <div
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={`
        bg-border
        ${orientation === 'horizontal' 
          ? 'h-px w-full' 
          : 'w-px h-full'
        }
        ${className}
      `}
      {...props}
    />
  )
}
