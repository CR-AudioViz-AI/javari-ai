/**
 * Javari AI - TypeScript Fix Helpers
 * Common utilities for fixing TypeScript errors
 * 
 * @created November 8, 2025 - 1:31 AM EST
 * @version 1.0.0
 */

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if value is an object (not null)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is an array
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Check if value is a function
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * Check if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// ============================================================================
// SAFE ACCESSORS
// ============================================================================

/**
 * Safely access nested object properties
 */
export function safeGet<T = unknown>(
  obj: unknown,
  path: string,
  defaultValue?: T
): T | undefined {
  if (!isObject(obj)) return defaultValue;

  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[key];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * Safely parse JSON
 */
export function safeParseJSON<T = unknown>(
  json: string,
  defaultValue?: T
): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely stringify JSON
 */
export function safeStringifyJSON(
  value: unknown,
  defaultValue: string = '{}'
): string {
  try {
    return JSON.stringify(value);
  } catch {
    return defaultValue;
  }
}

// ============================================================================
// TYPE CONVERTERS
// ============================================================================

/**
 * Convert value to string safely
 */
export function toString(value: unknown, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue;
  if (isString(value)) return value;
  if (isNumber(value) || isBoolean(value)) return String(value);
  if (isObject(value) || isArray(value)) return safeStringifyJSON(value, defaultValue);
  return String(value);
}

/**
 * Convert value to number safely
 */
export function toNumber(value: unknown, defaultValue: number = 0): number {
  if (isNumber(value)) return value;
  if (isString(value)) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Convert value to boolean safely
 */
export function toBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (isBoolean(value)) return value;
  if (isString(value)) {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  if (isNumber(value)) return value !== 0;
  return defaultValue;
}

/**
 * Convert value to array safely
 */
export function toArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  if (isArray<T>(value)) return value;
  if (value === null || value === undefined) return defaultValue;
  return [value as T];
}

// ============================================================================
// ASYNC HELPERS
// ============================================================================

/**
 * Wrap async function with error handling
 */
export async function asyncTry<T>(
  fn: () => Promise<T>,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    console.error('Async error:', error);
    return defaultValue;
  }
}

/**
 * Retry async function with exponential backoff
 */
export async function asyncRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Run async function with timeout
 */
export async function asyncTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutValue?: T
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]).catch(() => {
    if (timeoutValue !== undefined) return timeoutValue;
    throw new Error(`Operation timed out after ${timeoutMs}ms`);
  });
}

// ============================================================================
// NULL/UNDEFINED HELPERS
// ============================================================================

/**
 * Return first defined value
 */
export function coalesce<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const value of values) {
    if (isDefined(value)) return value;
  }
  return undefined;
}

/**
 * Remove null and undefined from array
 */
export function compact<T>(array: (T | null | undefined)[]): T[] {
  return array.filter(isDefined);
}

/**
 * Remove null and undefined from object
 */
export function compactObject<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isDefined(value)) {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

// ============================================================================
// REACT SPECIFIC HELPERS
// ============================================================================

/**
 * Safe event handler wrapper
 */
export function safeHandler<T extends (...args: any[]) => any>(
  handler: T | undefined,
  fallback?: T
): T | (() => void) {
  if (isFunction(handler)) return handler;
  if (isFunction(fallback)) return fallback;
  return (() => {}) as any;
}

/**
 * Safe state update wrapper
 */
export function safeSetState<T>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  value: T | ((prev: T) => T)
): void {
  try {
    setState(value);
  } catch (error) {
    console.error('State update error:', error);
  }
}

/**
 * Create safe ref accessor
 */
export function safeRef<T>(ref: React.RefObject<T>): T | null {
  return ref?.current ?? null;
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Safe fetch wrapper with type safety
 */
export async function safeFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      return {
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    return { data: data as T };
  } catch (error) {
    return {
      error: isError(error) ? error.message : 'Network error occurred'
    };
  }
}

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const cleaned = compactObject(params);
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(cleaned)) {
    if (isArray(value)) {
      value.forEach(v => searchParams.append(key, toString(v)));
    } else {
      searchParams.append(key, toString(value));
    }
  }

  return searchParams.toString();
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: unknown): email is string {
  if (!isString(email)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: unknown): url is string {
  if (!isString(url)) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID format
 */
export function isValidUuid(uuid: unknown): uuid is string {
  if (!isString(uuid)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  // Type guards
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isFunction,
  isError,

  // Safe accessors
  safeGet,
  safeParseJSON,
  safeStringifyJSON,

  // Type converters
  toString,
  toNumber,
  toBoolean,
  toArray,

  // Async helpers
  asyncTry,
  asyncRetry,
  asyncTimeout,

  // Null/undefined helpers
  coalesce,
  compact,
  compactObject,

  // React helpers
  safeHandler,
  safeSetState,
  safeRef,

  // API helpers
  safeFetch,
  buildQueryString,

  // Validation helpers
  isValidEmail,
  isValidUrl,
  isValidUuid
};
