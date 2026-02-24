/**
 * Javari AI - Page Sidebar Layout Component
 * SPEC 07 — Canonical Page Templates
 * 
 * Two-column layout with optional sidebar
 * - Main content area (required)
 * - Optional left or right sidebar
 * - Responsive: sidebar collapses on mobile
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 07
 * @timestamp Tuesday, January 28, 2025 at 12:21 PM EST
 */

import { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

type SidebarPosition = 'left' | 'right'

interface PageSidebarLayoutProps {
  sidebar?: ReactNode
  sidebarPosition?: SidebarPosition
  children: ReactNode
  className?: string
}

export function PageSidebarLayout({
  sidebar,
  sidebarPosition = 'right',
  children,
  className = '',
}: PageSidebarLayoutProps) {
  if (!sidebar) {
    // No sidebar, render main content only
    return (
      <div className={`px-6 py-6 ${className}`}>
        {children}
      </div>
    )
  }

  return (
    <div
      className={`
        grid gap-6
        grid-cols-1 lg:grid-cols-[1fr_300px]
        px-6 py-6
        ${sidebarPosition === 'left' ? 'lg:grid-cols-[300px_1fr]' : ''}
        ${className}
      `}
    >
      {/* Main content */}
      {sidebarPosition === 'left' && sidebar && (
        <aside className="order-2 lg:order-1">
          <Card className="sticky top-6">
            {sidebar}
          </Card>
        </aside>
      )}

      <main className={sidebarPosition === 'left' ? 'order-1 lg:order-2' : 'order-1'}>
        {children}
      </main>

      {sidebarPosition === 'right' && sidebar && (
        <aside className="order-2">
          <Card className="sticky top-6">
            {sidebar}
          </Card>
        </aside>
      )}
    </div>
  )
}
