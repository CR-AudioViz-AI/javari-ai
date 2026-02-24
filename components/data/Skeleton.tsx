/**
 * Javari AI - Skeleton Components
 * SPEC 06 — Canonical Data UI Components
 * 
 * Loading state placeholders
 * - SkeletonRow for table rows
 * - SkeletonBlock for generic content blocks
 * - Animated pulse effect
 * - Token-only styling via Tailwind
 * - aria-busy and aria-live for screen readers
 * 
 * Server Components (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 06
 * @timestamp Tuesday, January 28, 2025 at 12:10 PM EST
 */

import { HTMLAttributes } from 'react'

interface SkeletonRowProps extends HTMLAttributes<HTMLDivElement> {
  columns?: number
}

interface SkeletonBlockProps extends HTMLAttributes<HTMLDivElement> {
  width?: string
  height?: string
}

export function SkeletonRow({ 
  columns = 4, 
  className = '', 
  ...props 
}: SkeletonRowProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading"
      className={`
        flex items-center gap-4
        px-4 py-3
        border-b border-border
        ${className}
      `}
      {...props}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <div
          key={index}
          className="h-4 bg-surface/50 rounded animate-pulse flex-1"
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Loading content...</span>
    </div>
  )
}

export function SkeletonBlock({ 
  width = 'w-full',
  height = 'h-20',
  className = '', 
  ...props 
}: SkeletonBlockProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading"
      className={`
        bg-surface/50 rounded animate-pulse
        ${width}
        ${height}
        ${className}
      `}
      {...props}
    >
      <span className="sr-only">Loading content...</span>
    </div>
  )
}

// Utility component for table skeleton
export function TableSkeleton({ 
  rows = 5, 
  columns = 4,
  className = '',
}: { 
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={className}>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow key={index} columns={columns} />
      ))}
    </div>
  )
}
