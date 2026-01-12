// lib/javari-autonomy-enforcer.ts
// Enforces autonomous behavior - no permission seeking in execution modes

export interface AutonomyCheck {
  passed: boolean;
  violations: string[];
  correctedResponse?: string;
}

// Forbidden phrases that indicate permission-seeking
const FORBIDDEN_PHRASES = [
  /should (i|we)\s/i,
  /would you like/i,
  /do you want/i,
  /what would you like/i,
  /can i\s/i,
  /may i\s/i,
  /shall i\s/i,
  /is it okay/i,
  /is that okay/i,
  /would that be/i,
  /let me know if/i,
  /please confirm/i,
];

// Exception contexts where questions are allowed
const QUESTION_ALLOWED_CONTEXTS = [
  'missing required input',
  'irreversible mutation',
  'ambiguous requirement',
  'multiple valid options',
];

export class AutonomyEnforcer {
  
  /**
   * Check if response violates autonomy principles
   */
  checkResponse(response: string, mode: 'BUILD' | 'EXECUTE' | 'ANALYZE' | 'RECOVER'): AutonomyCheck {
    // Questions are allowed in RECOVER mode
    if (mode === 'RECOVER') {
      return { passed: true, violations: [] };
    }

    const violations: string[] = [];

    // Check for forbidden phrases
    for (const pattern of FORBIDDEN_PHRASES) {
      if (pattern.test(response)) {
        violations.push(`Forbidden phrase detected: ${pattern.source}`);
      }
    }

    // Check for excessive questions (more than 2-4)
    const questionCount = (response.match(/\?/g) || []).length;
    if (questionCount > 4) {
      violations.push(`Too many questions: ${questionCount} (max 4 allowed)`);
    }

    if (violations.length === 0) {
      return { passed: true, violations: [] };
    }

    // Attempt to correct response
    const corrected = this.correctResponse(response);

    return {
      passed: false,
      violations,
      correctedResponse: corrected,
    };
  }

  /**
   * Remove permission-seeking language and add default action
   */
  private correctResponse(response: string): string {
    let corrected = response;

    // Remove permission-seeking questions
    for (const pattern of FORBIDDEN_PHRASES) {
      corrected = corrected.replace(pattern, '');
    }

    // Remove trailing questions
    const sentences = corrected.split(/(?<=[.!])\s+/);
    const filtered = sentences.filter(s => !s.trim().endsWith('?'));

    // Add default action statement
    if (filtered.length > 0) {
      filtered.push('Proceeding with this approach now.');
    }

    return filtered.join(' ').trim();
  }

  /**
   * Generate autonomous response template
   */
  generateAutonomousResponse(action: string, assumptions: string[] = []): string {
    let response = `I'll ${action}.`;

    if (assumptions.length > 0) {
      response += `\n\nAssumptions:\n${assumptions.map(a => `- ${a}`).join('\n')}`;
      response += '\n\nI\'ll flag these if they need adjustment later.';
    }

    response += '\n\nStarting implementation now.';

    return response;
  }

  /**
   * Detect if question is necessary (missing required input)
   */
  isQuestionNecessary(context: string): boolean {
    const necessary = QUESTION_ALLOWED_CONTEXTS.some(allowed =>
      context.toLowerCase().includes(allowed)
    );

    return necessary;
  }

  /**
   * Format question to be minimal and focused
   */
  formatMinimalQuestion(question: string): string {
    // Remove fluff
    let minimal = question
      .replace(/would you like to/gi, 'Select:')
      .replace(/do you want to/gi, 'Choose:')
      .replace(/please let me know/gi, 'Specify:')
      .trim();

    // Ensure ends with question mark
    if (!minimal.endsWith('?')) {
      minimal += '?';
    }

    return minimal;
  }
}

// Export singleton
export const autonomyEnforcer = new AutonomyEnforcer();
