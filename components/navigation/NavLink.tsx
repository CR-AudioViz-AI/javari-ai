/**
 * Javari AI - Navigation Link Component
 * SPEC 02 — Canonical Navigation System (Hardened)
 * 
 * Accessible navigation link with active state detection
 * - Uses Next.js Link for client-side navigation
 * - aria-current for active links
 * - Tailwind styling with design tokens only
 * - No inline styles or JS style mutations
 * 
 * @version 1.1.0
 * @spec SPEC 02
 * @timestamp Tuesday, January 28, 2025 at 11:40 AM EST
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
      className={`
        inline-flex items-center relative
        px-4 py-2 rounded-md
        text-[0.9375rem] no-underline
        transition-all duration-fast
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2
        ${isActive 
          ? 'text-primary font-semibold' 
          : 'text-foreground font-medium hover:bg-surface'
        }
        ${className}
      `}
    >
      {children}
      {isActive && (
        <span
          className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-sm"
          aria-hidden="true"
        />
      )}
    </Link>
  )
}
