/**
 * Javari AI - Page Grid Component
 * SPEC 07 — Canonical Page Templates
 * 
 * Responsive grid layout
 * - 1, 2, 3, or 4 column layouts
 * - Responsive breakpoints via Tailwind
 * - Consistent gap spacing
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 07
 * @timestamp Tuesday, January 28, 2025 at 12:20 PM EST
 */

import { ReactNode } from 'react'

type GridColumns = 1 | 2 | 3 | 4

interface PageGridProps {
  columns?: GridColumns
  children: ReactNode
  className?: string
}

const columnClasses: Record<GridColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
}

export function PageGrid({
  columns = 3,
  children,
  className = '',
}: PageGridProps) {
  return (
    <div
      className={`
        grid gap-6
        ${columnClasses[columns]}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
