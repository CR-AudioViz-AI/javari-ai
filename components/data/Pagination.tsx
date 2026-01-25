/**
 * Javari AI - Pagination Component
 * SPEC 06 — Canonical Data UI Components
 * 
 * Accessible pagination controls
 * - Previous/Next buttons with aria-labels
 * - Page number display
 * - Disabled states
 * - Keyboard navigable
 * - Token-only styling via Tailwind
 * 
 * Client Component (requires click handlers for parent state updates)
 * 
 * @version 1.0.0
 * @spec SPEC 06
 * @timestamp Tuesday, January 28, 2025 at 12:09 PM EST
 */

'use client'

import { Button } from '@/components/ui/Button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  itemsPerPage?: number
  totalItems?: number
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
  className = '',
}: PaginationProps) {
  const hasPrevious = currentPage > 1
  const hasNext = currentPage < totalPages

  const handlePrevious = () => {
    if (hasPrevious) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (hasNext) {
      onPageChange(currentPage + 1)
    }
  }

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`
        flex items-center justify-between
        px-4 py-3
        border-t border-border
        ${className}
      `}
    >
      {/* Info section */}
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        {totalItems !== undefined && itemsPerPage !== undefined && (
          <span>
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to{' '}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
          </span>
        )}
        {totalItems === undefined && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={!hasPrevious}
          aria-label="Go to previous page"
        >
          Previous
        </Button>

        <span className="px-3 py-1 text-sm font-medium text-foreground">
          {currentPage}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!hasNext}
          aria-label="Go to next page"
        >
          Next
        </Button>
      </div>
    </nav>
  )
}
