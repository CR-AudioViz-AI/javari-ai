/**
 * Javari AI - Mobile Navigation
 * SPEC 02 — Canonical Navigation System
 * 
 * Mobile navigation with drawer overlay
 * - Hamburger menu button
 * - Overlay drawer with navigation links
 * - Escape key closes drawer
 * - Focus trap when open
 * - aria-expanded / aria-controls
 * - WCAG 2.2 AA compliant
 * 
 * Client Component (requires local state for open/close)
 * 
 * @version 1.0.0
 * @spec SPEC 02
 * @timestamp Tuesday, January 28, 2025 at 11:25 AM EST
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
      // Prevent body scroll when drawer is open
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
      <div
        className="mobile-nav-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-4)',
          borderBottom: '1px solid hsl(var(--border))',
          backgroundColor: 'hsl(var(--background))',
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

        {/* Hamburger Menu Button */}
        <button
          ref={buttonRef}
          onClick={toggleMenu}
          aria-expanded={isOpen}
          aria-controls="mobile-drawer"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            padding: 'var(--spacing-2)',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'background-color var(--duration-fast) var(--easing-standard)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'hsl(var(--surface))'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid hsl(var(--focus))'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
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
          style={{
            position: 'fixed',
            inset: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: '998',
            transition: 'opacity var(--duration-normal) var(--easing-standard)',
            opacity: isOpen ? '1' : '0',
          }}
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
        style={{
          position: 'fixed',
          top: '0',
          right: '0',
          bottom: '0',
          width: '280px',
          maxWidth: '80vw',
          backgroundColor: 'hsl(var(--background))',
          boxShadow: 'var(--elevation-lg)',
          zIndex: '999',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--duration-normal) var(--easing-emphasized)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-4)',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <span
            style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: 'hsl(var(--foreground))',
            }}
          >
            Menu
          </span>

          <button
            onClick={closeMenu}
            aria-label="Close menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              padding: 'var(--spacing-1)',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'hsl(var(--foreground))',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid hsl(var(--focus))'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
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
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--spacing-4)',
            gap: 'var(--spacing-1)',
          }}
        >
          {navigationLinks.map((link) => (
            <NavLink key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Responsive CSS - Show only on mobile */}
      <style jsx>{`
        @media (min-width: 768px) {
          .mobile-nav-header {
            display: none;
          }
        }
      `}</style>
    </>
  )
}
