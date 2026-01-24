/**
 * Javari AI - Top Navigation (Desktop)
 * SPEC 02 — Canonical Navigation System
 * 
 * Primary navigation for desktop viewports
 * - Horizontal layout
 * - Uses NavLink for routing
 * - Responsive hiding on mobile
 * - Design token styling
 * 
 * Server Component (no client state needed)
 * 
 * @version 1.0.0
 * @spec SPEC 02
 * @timestamp Tuesday, January 28, 2025 at 11:23 AM EST
 */

import { NavLink } from './NavLink'

const navigationLinks = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/settings', label: 'Settings' },
]

export function TopNav() {
  return (
    <nav
      role="navigation"
      aria-label="Primary navigation"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-2)',
        padding: 'var(--spacing-4)',
        borderBottom: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--background))',
      }}
      // Hide on mobile (< 768px)
      className="desktop-nav"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-1)',
          marginRight: 'var(--spacing-8)',
        }}
      >
        <span
          style={{
            fontSize: '1.25rem',
            fontWeight: '700',
            color: 'hsl(var(--primary))',
          }}
        >
          Javari AI
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-1)',
          flex: '1',
        }}
      >
        {navigationLinks.map((link) => (
          <NavLink key={link.href} href={link.href}>
            {link.label}
          </NavLink>
        ))}
      </div>

      {/* Responsive CSS */}
      <style jsx>{`
        @media (max-width: 767px) {
          .desktop-nav {
            display: none;
          }
        }
      `}</style>
    </nav>
  )
}
