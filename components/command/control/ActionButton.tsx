/**
 * components/command/control/ActionButton.tsx
 * Reusable Control Action Button
 * Created: 2026-02-22 03:17 ET
 * 
 * Animated button component with:
 * - Loading spinner
 * - Success/error states
 * - Color variants
 * - Disabled states
 * - Icon support
 */

'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700',
  success: 'bg-green-600 hover:bg-green-700 text-white border-green-700',
  warning: 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white border-red-700',
  info: 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700',
};

export function ActionButton({
  variant = 'primary',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}: ActionButtonProps) {
  const baseStyles = 'px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 border-2 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed';
  const widthStyles = fullWidth ? 'w-full' : '';
  const variantStyle = variantStyles[variant];

  return (
    <button
      className={`${baseStyles} ${variantStyle} ${widthStyles} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>Processing...</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
