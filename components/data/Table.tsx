/**
 * Javari AI - Table Components
 * SPEC 06 — Canonical Data UI Components
 * 
 * Accessible table with semantic markup
 * - Proper table structure (<table>, <thead>, <tbody>)
 * - TableHeader with scope attributes
 * - TableRow and TableCell components
 * - Token-only styling via Tailwind
 * - Keyboard navigable
 * 
 * Server Components (no client state)
 * 
 * @version 1.0.0
 * @spec SPEC 06
 * @timestamp Tuesday, January 28, 2025 at 12:08 PM EST
 */

import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes, ReactNode } from 'react'

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

interface TableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
}

export function Table({ className = '', children, ...props }: TableProps) {
  return (
    <div className="w-full overflow-auto">
      <table
        className={`
          w-full border-collapse
          ${className}
        `}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ 
  scope = 'col',
  className = '', 
  children, 
  ...props 
}: TableHeaderProps) {
  return (
    <th
      scope={scope}
      className={`
        px-4 py-3
        text-left text-sm font-semibold text-foreground
        bg-surface border-b-2 border-border
        ${className}
      `}
      {...props}
    >
      {children}
    </th>
  )
}

export function TableRow({ className = '', children, ...props }: TableRowProps) {
  return (
    <tr
      className={`
        border-b border-border
        hover:bg-surface/50
        transition-colors duration-fast
        ${className}
      `}
      {...props}
    >
      {children}
    </tr>
  )
}

export function TableCell({ className = '', children, ...props }: TableCellProps) {
  return (
    <td
      className={`
        px-4 py-3
        text-sm text-foreground
        ${className}
      `}
      {...props}
    >
      {children}
    </td>
  )
}
