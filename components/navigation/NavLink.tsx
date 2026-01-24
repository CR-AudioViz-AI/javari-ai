/**
 * Javari AI - Navigation Link Component
 * SPEC 02 — Canonical Navigation System
 * 
 * Accessible navigation link with active state detection
 * - Uses Next.js Link for client-side navigation
 * - aria-current for active links
 * - Focus-visible states
 * - Design token styling
 * 
 * @version 1.0.0
 * @spec SPEC 02
 * @timestamp Tuesday, January 28, 2025 at 11:22 AM EST
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href: string
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function NavLink({ href, children, onClick, className = '' }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--spacing-2) var(--spacing-4)',
        color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
        textDecoration: 'none',
        fontWeight: isActive ? '600' : '500',
        fontSize: '0.9375rem',
        borderRadius: 'var(--radius-md)',
        transition: 'all var(--duration-fast) var(--easing-standard)',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'hsl(var(--surface))'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent'
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid hsl(var(--focus))'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
      }}
    >
      {children}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            bottom: '0',
            left: 'var(--spacing-2)',
            right: 'var(--spacing-2)',
            height: '2px',
            backgroundColor: 'hsl(var(--primary))',
            borderRadius: 'var(--radius-sm)',
          }}
          aria-hidden="true"
        />
      )}
    </Link>
  )
}
