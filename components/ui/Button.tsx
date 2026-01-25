/**
 * Javari AI - Button Component
 * SPEC 05 — Canonical UI Primitives
 * 
 * Accessible button with variants and states
 * - Primary, secondary, outline, ghost variants
 * - Small, medium, large sizes
 * - Loading and disabled states
 * - Token-only styling via Tailwind
 * - Keyboard accessible with focus-visible
 * 
 * Server Component (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 05
 * @timestamp Tuesday, January 28, 2025 at 11:52 AM EST
 */

import { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  children: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border-2 border-border bg-transparent hover:bg-surface',
  ghost: 'bg-transparent hover:bg-surface',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <button
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-md
        transition-all duration-fast
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
