/**
 * Javari AI - Mobile Navigation
 * SPEC 02 — Canonical Navigation System (Hardened)
 * 
 * Mobile navigation with drawer overlay
 * - Hamburger menu button
 * - Overlay drawer with navigation links
 * - Escape key closes drawer
 * - Focus trap when open
 * - Tailwind styling with design tokens only
 * - No inline styles or JS style mutations
 * 
 * Client Component (requires local state for open/close)
 * 
 * @version 1.1.0
 * @spec SPEC 02
 * @timestamp Tuesday, January 28, 2025 at 11:43 AM EST
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { NavLink } from './NavLink'

const navigationLinks = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/settings', label: 'Settings' },
]

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Focus trap - keep focus within drawer when open
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const focusableElements = drawerRef.current.querySelectorAll(
        'a, button, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }

      document.addEventListener('keydown', handleTab)
      firstElement?.focus()

      return () => {
        document.removeEventListener('keydown', handleTab)
      }
    }
  }, [isOpen])

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const closeMenu = () => {
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="flex md:hidden items-center justify-between p-4 border-b border-border bg-background">
        <span className="text-xl font-bold text-primary">
          Javari AI
        </span>

        {/* Hamburger Menu Button */}
        <button
          ref={buttonRef}
          onClick={toggleMenu}
          aria-expanded={isOpen}
          aria-controls="mobile-drawer"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          className="flex items-center justify-center w-10 h-10 p-2 bg-transparent border-0 rounded-md cursor-pointer transition-colors duration-fast hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        >
          {/* Hamburger Icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {isOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Overlay Backdrop */}
      {isOpen && (
        <div
          onClick={closeMenu}
          className="fixed inset-0 bg-black/50 z-[998] transition-opacity duration-normal"
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <div
        ref={drawerRef}
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className={`
          fixed top-0 right-0 bottom-0 w-[280px] max-w-[80vw]
          bg-background shadow-lg z-[999]
          flex flex-col overflow-auto
          transition-transform duration-normal
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="text-lg font-semibold text-foreground">
            Menu
          </span>

          <button
            onClick={closeMenu}
            aria-label="Close menu"
            className="flex items-center justify-center w-8 h-8 p-1 bg-transparent border-0 rounded-md cursor-pointer text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav
          role="navigation"
          aria-label="Mobile navigation"
          className="flex flex-col p-4 gap-1"
        >
          {navigationLinks.map((link) => (
            <NavLink key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  )
}
