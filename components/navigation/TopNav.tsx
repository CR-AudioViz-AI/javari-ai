/**
 * Javari AI - Top Navigation (Desktop)
 * SPEC 02 — Canonical Navigation System (Hardened)
 * 
 * Primary navigation for desktop viewports
 * - Horizontal layout
 * - Uses NavLink for routing
 * - Tailwind responsive classes (hidden on mobile)
 * - Design token styling via Tailwind
 * 
 * Server Component (no client state needed)
 * 
 * @version 1.1.0
 * @spec SPEC 02
 * @timestamp Tuesday, January 28, 2025 at 11:42 AM EST
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
      className="hidden md:flex items-center gap-2 p-4 border-b border-border bg-background"
    >
      <div className="flex items-center gap-1 mr-8">
        <span className="text-xl font-bold text-primary">
          Javari AI
        </span>
      </div>

      <div className="flex items-center gap-1 flex-1">
        {navigationLinks.map((link) => (
          <NavLink key={link.href} href={link.href}>
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
