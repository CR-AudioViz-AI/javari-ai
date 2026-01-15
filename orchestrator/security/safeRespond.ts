/**
 * SAFE EGRESS WRAPPER
 * 
 * Phase Ω-X - Egress Sanitization Integration
 * 
 * Wraps all AI model outputs to prevent secret leakage.
 * Use this function at EVERY AI output choke point.
 * 
 * BEHAVIOR:
 * - Development: Redacts secrets, logs warnings, returns sanitized content
 * - Production: THROWS ERROR if secrets detected (fail-closed)
 * 
 * USAGE:
 * ```typescript
 * import { safeModelEgress } from '@/orchestrator/security/safeRespond';
 * 
 * // In API route
 * const aiOutput = response.choices[0].message.content;
 * const safe = safeModelEgress(aiOutput, 'ai'); // Sanitizes or throws
 * return NextResponse.json({ content: safe });
 * ```
 */

import { sanitizeEgress, SanitizationResult } from './egressSanitizer';

export class EgressSecurityError extends Error {
  constructor(
    message: string,
    public readonly detectedThreats: SanitizationResult['detectedThreats'],
    public readonly blocked: boolean
  ) {
    super(message);
    this.name = 'EgressSecurityError';
  }
}

/**
 * Safe wrapper for AI model egress
 * 
 * CRITICAL: Use this at ALL AI output points
 * 
 * @param content - Raw AI output content
 * @param context - Context type (ai, user, system)
 * @returns Sanitized content (safe to return to user)
 * @throws EgressSecurityError if content blocked in production
 */
export function safeModelEgress(
  content: string | null | undefined,
  context: 'ai' | 'user' | 'system' = 'ai'
): string {
  // Handle null/undefined
  if (content == null) {
    return '';
  }
  
  // Sanitize
  const result = sanitizeEgress(content, context);
  
  // Production: BLOCK if threats detected
  if (result.blocked) {
    throw new EgressSecurityError(
      result.reason || 'Outbound response blocked by security policy',
      result.detectedThreats,
      true
    );
  }
  
  // Development: Log warnings but allow
  if (result.detectedThreats.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn(
      `[EGRESS WARNING] Detected ${result.detectedThreats.length} potential secrets in AI output:`,
      result.detectedThreats.map(t => ({
        type: t.type,
        sample: t.redactedValue,
      }))
    );
  }
  
  return result.sanitized;
}

/**
 * Safe wrapper for streaming responses
 * 
 * Use with TransformStream to sanitize streaming AI output
 * 
 * @param context - Context type
 * @returns TransformStream that sanitizes chunks
 */
export function createSafeEgressStream(
  context: 'ai' | 'user' | 'system' = 'ai'
): TransformStream<string, string> {
  let accumulatedContent = '';
  let lastCheckpoint = 0;
  
  return new TransformStream({
    transform(chunk, controller) {
      // Accumulate content
      accumulatedContent += chunk;
      
      // Check every 500 chars or at sentence boundaries
      const shouldCheck = 
        accumulatedContent.length - lastCheckpoint > 500 ||
        /[.!?]\s*$/.test(chunk);
      
      if (shouldCheck) {
        try {
          // Sanitize accumulated content
          const safe = safeModelEgress(accumulatedContent, context);
          
          // Calculate what's new since last check
          const newContent = safe.slice(lastCheckpoint);
          
          if (newContent) {
            controller.enqueue(newContent);
          }
          
          lastCheckpoint = safe.length;
        } catch (error) {
          // On security error, close stream
          if (error instanceof EgressSecurityError) {
            controller.error(error);
            return;
          }
          throw error;
        }
      } else {
        // Fast path: no check needed yet
        controller.enqueue(chunk);
      }
    },
    
    flush(controller) {
      // Final sanitization check on complete content
      try {
        const safe = safeModelEgress(accumulatedContent, context);
        const remaining = safe.slice(lastCheckpoint);
        
        if (remaining) {
          controller.enqueue(remaining);
        }
      } catch (error) {
        if (error instanceof EgressSecurityError) {
          controller.error(error);
          return;
        }
        throw error;
      }
    },
  });
}

/**
 * Wrap NextResponse.json with automatic sanitization
 * 
 * @param data - Response data
 * @param init - Response init options
 * @returns Sanitized NextResponse
 */
export function safeJsonResponse(
  data: Record<string, any>,
  init?: ResponseInit
): Response {
  // Recursively sanitize all string values
  const sanitized = sanitizeObject(data);
  
  return new Response(JSON.stringify(sanitized), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

/**
 * Recursively sanitize object values
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return safeModelEgress(obj, 'ai');
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}
