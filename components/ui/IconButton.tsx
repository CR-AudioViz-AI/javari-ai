/**
 * Javari AI - Icon Button Component
 * SPEC 05 — Canonical UI Primitives
 * 
 * Accessible icon-only button
 * - Square with consistent padding
 * - Same variants as Button
 * - Requires aria-label for accessibility
 * - Token-only styling via Tailwind
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 05
 * @timestamp Tuesday, January 28, 2025 at 11:53 AM EST
 */

import { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
type IconButtonSize = 'sm' | 'md' | 'lg'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  children: ReactNode
  'aria-label': string // Required for accessibility
}

const variantStyles: Record<IconButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border-2 border-border bg-transparent hover:bg-surface',
  ghost: 'bg-transparent hover:bg-surface',
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-3',
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  disabled,
  className = '',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        rounded-md
        transition-all duration-fast
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
}
