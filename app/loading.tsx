"use client";

/**
 * Javari AI - Loading UI
 * SPEC 03 — Canonical Application Shell
 * 
 * Global loading state during Suspense boundaries
 * Provides minimal, accessible loading indicator
 * Server Component
 * 
 * @version 1.0.0
 * @spec SPEC 03
 * @timestamp Tuesday, January 28, 2025 at 11:14 AM EST
 */

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: 'var(--spacing-8)',
      }}
    >
      {/* Accessible loading spinner */}
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '4px solid hsl(var(--border))',
          borderTopColor: 'hsl(var(--primary))',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
        aria-hidden="true"
      />
      
      {/* Screen reader text */}
      <span className="sr-only">Loading...</span>

      <p
        style={{
          marginTop: 'var(--spacing-4)',
          color: 'hsl(var(--foreground))',
          opacity: '0.8',
        }}
      >
        Loading...
      </p>

      {/* Inject keyframes for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
    </div>
  )
}
