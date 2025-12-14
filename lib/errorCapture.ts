// =============================================================================
// JAVARI AI - ERROR CAPTURE CLIENT UTILITY
// =============================================================================
// Automatically captures errors and reports to pattern detection API
// Integrates with window.onerror and unhandledrejection
// Created: Saturday, December 13, 2025 - 6:25 PM EST
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ErrorContext {
  endpoint?: string;
  user_id?: string;
  session_id?: string;
  request_id?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface CaptureResult {
  success: boolean;
  error_id?: string;
  pattern_detected: boolean;
  pattern_key?: string;
  suggested_fixes?: SuggestedFix[];
  auto_heal_available: boolean;
}

export interface SuggestedFix {
  fix_id: string;
  title: string;
  description: string;
  confidence: number;
  auto_applicable: boolean;
  fix_type: 'code' | 'config' | 'infrastructure' | 'manual';
  steps?: string[];
  code_snippet?: string;
}

type Severity = 'low' | 'medium' | 'high' | 'critical';
type ErrorHandler = (result: CaptureResult) => void;

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

interface ErrorCaptureConfig {
  endpoint: string;
  enabled: boolean;
  captureGlobalErrors: boolean;
  captureUnhandledRejections: boolean;
  captureConsoleErrors: boolean;
  ignoredErrors: RegExp[];
  maxErrorsPerMinute: number;
  onCapture?: ErrorHandler;
  onAutoHealAvailable?: (result: CaptureResult) => void;
  sessionId?: string;
  userId?: string;
}

const defaultConfig: ErrorCaptureConfig = {
  endpoint: '/api/errors',
  enabled: true,
  captureGlobalErrors: true,
  captureUnhandledRejections: true,
  captureConsoleErrors: false,
  ignoredErrors: [
    /ResizeObserver loop/i,
    /Script error/i,
    /Loading chunk/i,
  ],
  maxErrorsPerMinute: 30,
};

// -----------------------------------------------------------------------------
// Error Capture Class
// -----------------------------------------------------------------------------

class ErrorCaptureClient {
  private config: ErrorCaptureConfig;
  private errorCount: number = 0;
  private errorCountResetTime: number = Date.now();
  private initialized: boolean = false;
  private originalConsoleError?: typeof console.error;

  constructor(config: Partial<ErrorCaptureConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // ---------------------------------------------------------------------------
  // Initialize - Set up global error handlers
  // ---------------------------------------------------------------------------

  init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    
    if (this.config.captureGlobalErrors) {
      window.onerror = (message, source, lineno, colno, error) => {
        this.captureError(error || new Error(String(message)), {
          metadata: { source, lineno, colno }
        });
        return false; // Don't suppress the error
      };
    }
    
    if (this.config.captureUnhandledRejections) {
      window.onunhandledrejection = (event) => {
        const error = event.reason instanceof Error 
          ? event.reason 
          : new Error(String(event.reason));
        this.captureError(error, {
          metadata: { type: 'unhandled_rejection' }
        });
      };
    }
    
    if (this.config.captureConsoleErrors) {
      this.originalConsoleError = console.error;
      console.error = (...args) => {
        this.captureFromConsole(args);
        this.originalConsoleError?.apply(console, args);
      };
    }
    
    this.initialized = true;
  }

  // ---------------------------------------------------------------------------
  // Cleanup - Remove global handlers
  // ---------------------------------------------------------------------------

  destroy(): void {
    if (typeof window === 'undefined') return;
    
    window.onerror = null;
    window.onunhandledrejection = null;
    
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
    }
    
    this.initialized = false;
  }

  // ---------------------------------------------------------------------------
  // Configure - Update configuration
  // ---------------------------------------------------------------------------

  configure(config: Partial<ErrorCaptureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---------------------------------------------------------------------------
  // Set User/Session Context
  // ---------------------------------------------------------------------------

  setUser(userId: string): void {
    this.config.userId = userId;
  }

  setSession(sessionId: string): void {
    this.config.sessionId = sessionId;
  }

  // ---------------------------------------------------------------------------
  // Main Capture Method
  // ---------------------------------------------------------------------------

  async captureError(
    error: Error | string,
    context?: ErrorContext,
    severity?: Severity
  ): Promise<CaptureResult | null> {
    if (!this.config.enabled) return null;
    
    // Rate limiting
    if (!this.checkRateLimit()) {
      console.warn('[ErrorCapture] Rate limit exceeded, skipping error');
      return null;
    }
    
    const err = error instanceof Error ? error : new Error(String(error));
    
    // Check if error should be ignored
    if (this.shouldIgnore(err)) {
      return null;
    }
    
    // Determine severity
    const errorSeverity = severity || this.determineSeverity(err);
    
    // Build payload
    const payload = {
      error_type: err.name || 'Error',
      error_message: err.message,
      error_code: this.extractErrorCode(err),
      stack_trace: err.stack,
      context: {
        ...context,
        user_id: context?.user_id || this.config.userId,
        session_id: context?.session_id || this.config.sessionId,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
      severity: errorSeverity,
    };
    
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        console.warn('[ErrorCapture] Failed to send error:', response.status);
        return null;
      }
      
      const result: CaptureResult = await response.json();
      
      // Call callbacks
      if (this.config.onCapture) {
        this.config.onCapture(result);
      }
      
      if (result.auto_heal_available && this.config.onAutoHealAvailable) {
        this.config.onAutoHealAvailable(result);
      }
      
      return result;
      
    } catch (captureError) {
      console.warn('[ErrorCapture] Failed to capture error:', captureError);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Capture API Error (convenience method)
  // ---------------------------------------------------------------------------

  async captureApiError(
    endpoint: string,
    error: Error | Response | string,
    requestId?: string
  ): Promise<CaptureResult | null> {
    let errorMessage: string;
    let errorCode: string | undefined;
    
    if (error instanceof Response) {
      errorMessage = `API Error: ${error.status} ${error.statusText}`;
      errorCode = String(error.status);
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }
    
    return this.captureError(
      new Error(errorMessage),
      {
        endpoint,
        request_id: requestId,
        metadata: { error_code: errorCode }
      },
      errorCode === '500' || errorCode === '503' ? 'high' : 'medium'
    );
  }

  // ---------------------------------------------------------------------------
  // Capture from Console
  // ---------------------------------------------------------------------------

  private captureFromConsole(args: unknown[]): void {
    const message = args
      .map(arg => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === 'object') {
          try { return JSON.stringify(arg); } catch { return String(arg); }
        }
        return String(arg);
      })
      .join(' ');
    
    const errorArg = args.find(arg => arg instanceof Error);
    
    this.captureError(
      errorArg instanceof Error ? errorArg : new Error(message),
      { metadata: { source: 'console.error' } },
      'low'
    );
  }

  // ---------------------------------------------------------------------------
  // Rate Limiting
  // ---------------------------------------------------------------------------

  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.errorCountResetTime > 60000) {
      this.errorCount = 0;
      this.errorCountResetTime = now;
    }
    
    this.errorCount++;
    return this.errorCount <= this.config.maxErrorsPerMinute;
  }

  // ---------------------------------------------------------------------------
  // Should Ignore Check
  // ---------------------------------------------------------------------------

  private shouldIgnore(error: Error): boolean {
    return this.config.ignoredErrors.some(pattern => 
      pattern.test(error.message) || pattern.test(error.stack || '')
    );
  }

  // ---------------------------------------------------------------------------
  // Determine Severity
  // ---------------------------------------------------------------------------

  private determineSeverity(error: Error): Severity {
    const message = error.message.toLowerCase();
    
    // Critical: Authentication, security, data loss
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('security') ||
      message.includes('data loss')
    ) {
      return 'critical';
    }
    
    // High: API failures, database errors
    if (
      message.includes('500') ||
      message.includes('503') ||
      message.includes('database') ||
      message.includes('connection failed')
    ) {
      return 'high';
    }
    
    // Low: UI errors, validation
    if (
      message.includes('validation') ||
      message.includes('invalid input') ||
      error.name === 'ValidationError'
    ) {
      return 'low';
    }
    
    return 'medium';
  }

  // ---------------------------------------------------------------------------
  // Extract Error Code
  // ---------------------------------------------------------------------------

  private extractErrorCode(error: Error): string | undefined {
    // Check for common error code patterns
    const codeMatch = error.message.match(/\b(\d{3})\b/);
    if (codeMatch) return codeMatch[1];
    
    // Check for named error codes
    const namedMatch = error.message.match(/\b([A-Z_]+_ERROR|E[A-Z]+)\b/);
    if (namedMatch) return namedMatch[1];
    
    // Check error object for code property
    const anyError = error as Error & { code?: string };
    if (anyError.code) return anyError.code;
    
    return undefined;
  }
}

// -----------------------------------------------------------------------------
// Create and Export Singleton Instance
// -----------------------------------------------------------------------------

export const errorCapture = new ErrorCaptureClient();

// -----------------------------------------------------------------------------
// React Hook for Error Capture
// -----------------------------------------------------------------------------

import { useEffect, useCallback } from 'react';

export function useErrorCapture(context?: ErrorContext) {
  useEffect(() => {
    errorCapture.init();
    return () => {
      // Don't destroy on unmount - other components may still use it
    };
  }, []);

  const capture = useCallback(
    async (error: Error | string, additionalContext?: ErrorContext) => {
      return errorCapture.captureError(error, { ...context, ...additionalContext });
    },
    [context]
  );

  const captureApi = useCallback(
    async (endpoint: string, error: Error | Response | string, requestId?: string) => {
      return errorCapture.captureApiError(endpoint, error, requestId);
    },
    []
  );

  return { capture, captureApi };
}

// -----------------------------------------------------------------------------
// Error Boundary Integration Helper
// -----------------------------------------------------------------------------

export function captureErrorBoundary(
  error: Error,
  errorInfo: { componentStack: string }
): Promise<CaptureResult | null> {
  return errorCapture.captureError(error, {
    component: 'ErrorBoundary',
    metadata: {
      componentStack: errorInfo.componentStack.substring(0, 500)
    }
  }, 'high');
}

// -----------------------------------------------------------------------------
// Fetch Wrapper with Auto-Capture
// -----------------------------------------------------------------------------

export async function fetchWithCapture(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      await errorCapture.captureApiError(url, response, requestId);
    }
    
    return response;
    
  } catch (error) {
    await errorCapture.captureApiError(
      url,
      error instanceof Error ? error : new Error(String(error)),
      requestId
    );
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default errorCapture;
