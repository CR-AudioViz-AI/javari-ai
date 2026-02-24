/**
 * Javari AI - Error Boundary
 * SPEC 03 — Canonical Application Shell
 * 
 * Global error boundary for unhandled errors
 * Provides minimal, accessible error UI
 * Client Component (required by Next.js error boundaries)
 * 
 * @version 1.0.0
 * @spec SPEC 03
 * @timestamp Tuesday, January 28, 2025 at 11:13 AM EST
 */

'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Application error:', error)
    }
  }, [error])

  return (
    <div 
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: 'var(--spacing-8)',
        textAlign: 'center',
      }}
    >
      <h1 
        style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          marginBottom: 'var(--spacing-4)',
          color: 'hsl(var(--foreground))',
        }}
      >
        Something went wrong
      </h1>
      
      <p 
        style={{
          marginBottom: 'var(--spacing-6)',
          color: 'hsl(var(--foreground))',
          opacity: '0.8',
        }}
      >
        We encountered an unexpected error. Please try again.
      </p>

      <button
        onClick={reset}
        style={{
          padding: 'var(--spacing-3) var(--spacing-6)',
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: '1rem',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'opacity var(--duration-fast) var(--easing-standard)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
      >
        Try again
      </button>

      {error.digest && (
        <p 
          style={{
            marginTop: 'var(--spacing-6)',
            fontSize: '0.875rem',
            color: 'hsl(var(--foreground))',
            opacity: '0.6',
          }}
        >
          Error ID: {error.digest}
        </p>
      )}
    </div>
  )
}
