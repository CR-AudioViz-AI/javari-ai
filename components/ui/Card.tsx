/**
 * Javari AI - Card Component
 * SPEC 05 — Canonical UI Primitives
 * 
 * Container with optional header, content, and footer
 * - Composable sub-components
 * - Elevation via shadow tokens
 * - Token-only styling via Tailwind
 * 
 * Server Components (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 05
 * @timestamp Tuesday, January 28, 2025 at 11:56 AM EST
 */

import { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`
        bg-surface border border-border rounded-lg shadow-sm
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }: CardHeaderProps) {
  return (
    <div
      className={`
        px-6 py-4 border-b border-border
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardContent({ className = '', children, ...props }: CardContentProps) {
  return (
    <div
      className={`
        px-6 py-4
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardFooter({ className = '', children, ...props }: CardFooterProps) {
  return (
    <div
      className={`
        px-6 py-4 border-t border-border
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
