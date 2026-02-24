/**
 * Javari AI - Comprehensive Error Handler Utility
 * Systematically handles TypeScript errors across the platform
 * 
 * @created November 8, 2025 - 1:30 AM EST
 * @version 1.0.0
 * @quality Fortune 50 Production Standard
 */
import { logError, formatApiError } from "@/lib/utils/error-handler";
import React from 'react';


// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ErrorContext {
  file: string;
  line?: number;
  function?: string;
  component?: string;
  user?: string;
  timestamp: string;
}

export interface ErrorLog {
  id: string;
  type: 'typescript' | 'runtime' | 'api' | 'database' | 'unknown';
  severity: 'critical' | 'error' | 'warning' | 'info';
  message: string;
  context: ErrorContext;
  stack?: string;
  resolved: boolean;
  createdAt: Date;
}

export type ErrorHandler = (error: unknown, context: Partial<ErrorContext>) => void;

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

export class JavariErrorHandler {
  private static instance: JavariErrorHandler;
  private errors: ErrorLog[] = [];
  private handlers: Map<string, ErrorHandler> = new Map();

  private constructor() {
    this.registerDefaultHandlers();
  }

  static getInstance(): JavariErrorHandler {
    if (!JavariErrorHandler.instance) {
      JavariErrorHandler.instance = new JavariErrorHandler();
    }
    return JavariErrorHandler.instance;
  }

  /**
   * Register default error handlers for common scenarios
   */
  private registerDefaultHandlers(): void {
    // TypeScript error handler
    this.registerHandler('typescript', (error, context) => {
      console.error('[TYPESCRIPT ERROR]', {
        message: this.extractErrorMessage(error),
        context,
        timestamp: new Date().toISOString()
      });
    });

    // Runtime error handler
    this.registerHandler('runtime', (error, context) => {
      console.error('[RUNTIME ERROR]', {
        message: this.extractErrorMessage(error),
        context,
        timestamp: new Date().toISOString()
      });
    });

    // API error handler
    this.registerHandler('api', (error, context) => {
      console.error('[API ERROR]', {
        message: this.extractErrorMessage(error),
        context,
        timestamp: new Date().toISOString()
      });
    });

    // Database error handler
    this.registerHandler('database', (error, context) => {
      console.error('[DATABASE ERROR]', {
        message: this.extractErrorMessage(error),
        context,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Register a custom error handler
   */
  registerHandler(type: string, handler: ErrorHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Handle an error with context
   */
  handle(error: unknown, context: Partial<ErrorContext> = {}): ErrorLog {
    const errorLog: ErrorLog = {
      id: this.generateErrorId(),
      type: this.determineErrorType(error),
      severity: this.determineSeverity(error),
      message: this.extractErrorMessage(error),
      context: this.enrichContext(context),
      stack: this.extractStack(error),
      resolved: false,
      createdAt: new Date()
    };

    // Store error log
    this.errors.push(errorLog);

    // Call appropriate handler
    const handler = this.handlers.get(errorLog.type);
    if (handler) {
      handler(error, context);
    } else {
      console.error('[UNHANDLED ERROR TYPE]', errorLog);
    }

    return errorLog;
  }

  /**
   * Safe wrapper for async functions
   */
  async safeAsync<T>(
    fn: () => Promise<T>,
    context: Partial<ErrorContext> = {},
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error: unknown) {
      this.handle(error, context);
      return fallback;
    }
  }

  /**
   * Safe wrapper for sync functions
   */
  safe<T>(
    fn: () => T,
    context: Partial<ErrorContext> = {},
    fallback?: T
  ): T | undefined {
    try {
      return fn();
    } catch (error: unknown) {
      this.handle(error, context);
      return fallback;
    }
  }

  /**
   * Try-catch wrapper with custom error handling
   */
  tryCatch<T>(
    fn: () => T,
    errorHandler: (error: unknown) => T,
    context: Partial<ErrorContext> = {}
  ): T {
    try {
      return fn();
    } catch (error: unknown) {
      this.handle(error, context);
      return errorHandler(error);
    }
  }

  /**
   * Get all errors
   */
  getErrors(): ErrorLog[] {
    return [...this.errors];
  }

  /**
   * Get unresolved errors
   */
  getUnresolvedErrors(): ErrorLog[] {
    return this.errors.filter(e => !e.resolved);
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string): void {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
    }
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  // ============================================================================
  // PRIVATE UTILITY METHODS
  // ============================================================================

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineErrorType(error: unknown): ErrorLog['type'] {
    if (error instanceof TypeError) return 'typescript';
    if (error instanceof SyntaxError) return 'typescript';
    if (this.isApiError(error)) return 'api';
    if (this.isDatabaseError(error)) return 'database';
    if (error instanceof Error) return 'runtime';
    return 'unknown';
  }

  private determineSeverity(error: unknown): ErrorLog['severity'] {
    const message = this.extractErrorMessage(error);
    if (message.includes('critical') || message.includes('fatal')) {
      return 'critical';
    }
    if (message.includes('warning')) {
      return 'warning';
    }
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return 'error';
    }
    return 'error';
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return 'Unknown error occurred';
  }

  private extractStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }
    return undefined;
  }

  private enrichContext(context: Partial<ErrorContext>): ErrorContext {
    return {
      file: context.file || 'unknown',
      line: context.line,
      function: context.function,
      component: context.component,
      user: context.user,
      timestamp: new Date().toISOString()
    };
  }

  private isApiError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      return 'status' in error || 'statusCode' in error || 'response' in error;
    }
    return false;
  }

  private isDatabaseError(error: unknown): boolean {
    const message = this.extractErrorMessage(error);
    return message.includes('database') || 
           message.includes('SQL') || 
           message.includes('query') ||
           message.includes('supabase');
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the singleton instance of the error handler
 */
export const errorHandler = JavariErrorHandler.getInstance();

/**
 * Quick error handling function
 */
export const handleError = (error: unknown, context?: Partial<ErrorContext>) => {
  return errorHandler.handle(error, context);
};

/**
 * Safe async wrapper
 */
export const safeAsync = <T,>(
  fn: () => Promise<T>,
  context?: Partial<ErrorContext>,
  fallback?: T
) => {
  return errorHandler.safeAsync(fn, context, fallback);
};

/**
 * Safe sync wrapper
 */
export const safe = <T,>(
  fn: () => T,
  context?: Partial<ErrorContext>,
  fallback?: T
) => {
  return errorHandler.safe(fn, context, fallback);
};

/**
 * Try-catch wrapper
 */
export const tryCatch = <T,>(
  fn: () => T,
  errorHandler: (error: unknown) => T,
  context?: Partial<ErrorContext>
) => {
  return JavariErrorHandler.getInstance().tryCatch(fn, errorHandler, context);
};

// ============================================================================
// REACT ERROR BOUNDARY COMPONENT
// ============================================================================

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Note: This is a class component as Error Boundaries require class components

export class JavariErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    errorHandler.handle(error, {
      file: 'ErrorBoundary',
      component: errorInfo.componentStack?.split('\n')[1]?.trim() || 'unknown'
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              We've logged the error and will fix it soon.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default JavariErrorHandler;

