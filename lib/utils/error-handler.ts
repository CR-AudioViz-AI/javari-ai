/**
 * Universal Error Handler for TypeScript Strict Mode
 * Handles all error types safely for crav-javari
 */

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function hasMessage(error: unknown): error is { message: string } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

export function isSupabaseError(error: unknown): error is {
  message: string;
  code?: string;
  details?: string;
} {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    ('code' in error || 'details' in error)
  );
}

export function isZodError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'issues' in error &&
    Array.isArray((error as any).issues)
  );
}

export function isApiError(error: unknown): error is {
  status?: number;
  statusText?: string;
  message?: string;
} {
  return (
    error !== null &&
    typeof error === 'object' &&
    ('status' in error || 'statusText' in error)
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  
  if (hasMessage(error)) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error === null || error === undefined) {
    return 'An unknown error occurred';
  }
  
  // Try to stringify
  try {
    return JSON.stringify(error);
  } catch {
    return 'An unknown error occurred';
  }
}

export function getErrorDetails(error: unknown): {
  message: string;
  code?: string;
  details?: string;
  stack?: string;
} {
  const message = getErrorMessage(error);
  
  if (isError(error)) {
    return {
      message,
      stack: error.stack
    };
  }
  
  if (isSupabaseError(error)) {
    return {
      message,
      code: error.code,
      details: error.details
    };
  }
  
  return { message };
}

export function formatApiError(error: unknown): {
  error: string;
  code?: string;
  details?: string;
} {
  const details = getErrorDetails(error);
  
  return {
    error: details.message,
    code: details.code,
    details: details.details
  };
}

export function logError(context: string, error: unknown): void {
  const details = getErrorDetails(error);
  
  console.error(`[${context}] Error:`, details.message);
  
  if (details.code) {
    console.error(`[${context}] Code:`, details.code);
  }
  
  if (details.details) {
    console.error(`[${context}] Details:`, details.details);
  }
  
  if (details.stack) {
    console.error(`[${context}] Stack:`, details.stack);
  }
}

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class DatabaseError extends Error {
  constructor(message: string, public code?: string, public details?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// SAFE ASYNC WRAPPER
// ============================================================================

export async function safeAsync<T>(
  fn: () => Promise<T>,
  context: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error: unknown) {
    logError(context, error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ============================================================================
// NEXTRESPONSE ERROR HELPERS
// ============================================================================

export function errorResponse(error: unknown, status: number = 500) {
  const formatted = formatApiError(error);
  return new Response(JSON.stringify(formatted), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function unauthorizedResponse(message: string = 'Unauthorized') {
  return errorResponse(new AuthenticationError(message), 401);
}

export function notFoundResponse(resource: string) {
  return errorResponse(new NotFoundError(resource), 404);
}

export function validationErrorResponse(message: string, field?: string) {
  return errorResponse(new ValidationError(message, field), 400);
}

export function rateLimitResponse(message?: string) {
  return errorResponse(new RateLimitError(message), 429);
}
