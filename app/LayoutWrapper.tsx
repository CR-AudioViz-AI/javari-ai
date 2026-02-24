/**
 * Layout Wrapper - Client Component for Pathname Detection
 * 
 * Detects /javari/* routes and conditionally renders global navigation
 * Server component (layout.tsx) wraps children with this client component
 * 
 * @version 1.0.0
 * @timestamp Monday, February 24, 2026 at 12:59 AM EST
 */

'use client'

import { usePathname } from 'next/navigation'
import { TopNav, MobileNav } from '@/components/navigation'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isJavari = pathname?.startsWith('/javari') || false

  return (
    <>
      {!isJavari && (
        <>
          {/* Skip-to-content link for keyboard navigation */}
          <a 
            href="#main-content" 
            className="absolute -left-[9999px] z-[999] p-4 bg-primary text-primary-foreground no-underline rounded-md focus:left-4 focus:top-4"
          >
            Skip to main content
          </a>

          {/* Header slot - EMPTY placeholder for future implementation */}
          <header role="banner">
            {/* Header content will be added in future steps */}
          </header>

          {/* Navigation slot - Canonical Navigation System (SPEC 02) */}
          <TopNav />
          <MobileNav />
        </>
      )}

      {/* Main content area - where page children render */}
      <main role="main" id="main-content">
        {children}
      </main>

      {!isJavari && (
        <>
          {/* Footer slot - EMPTY placeholder for future implementation */}
          <footer role="contentinfo">
            {/* Footer content will be added in future steps */}
          </footer>

          {/* System overlay slot - EMPTY placeholder for modals, toasts, etc. */}
          <div role="region" aria-live="polite" aria-atomic="true">
            {/* System overlays (modals, toasts) will be added in future steps */}
          </div>
        </>
      )}
    </>
  )
}
