// Component type definitions
export interface JavariGreetingProps {
  // Future props can be added here
  className?: string;
  variant?: 'default' | 'compact' | 'expanded';
}

// Re-export common React types
export type { FC, ReactNode } from 'react';