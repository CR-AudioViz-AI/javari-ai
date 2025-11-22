// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTENT SAFETY FILTER
// Protects users and platform from harmful content
// Blocks illegal activities, self-harm, violence, malicious code
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createClient } from '@supabase/supabase-js'

interface SafetyCheckResult {
  isSafe: boolean
  violations: Array<{
    rule: string
    category: string
    severity: string
    matched: string
  }>
  shouldEscalate: boolean
  action: 'allow' | 'block' | 'warn' | 'filter'
}

interface SafetyRule {
  rule_name: string
  rule_type: string
  category: string
  rule_config: any
  severity: string
  action: string
  is_active: boolean
}

export class ContentSafetyFilter {
  private supabase
  private rules: SafetyRule[] = []
  private lastRuleUpdate: number = 0
  private readonly RULE_CACHE_TTL = 300000 // 5 minutes

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  // Main safety check function
  async checkContent(
    content: string,
    userId: string | null,
    requestType: string = 'chat'
  ): Promise<SafetyCheckResult> {
    // Load rules if needed
    await this.loadRules()

    const violations: SafetyCheckResult['violations'] = []
    let highestSeverity = 'low'
    let shouldEscalate = false
    let action: SafetyCheckResult['action'] = 'allow'

    // Check content against each active rule
    for (const rule of this.rules) {
      if (!rule.is_active) continue

      const match = this.checkRule(content, rule)
      
      if (match) {
        violations.push({
          rule: rule.rule_name,
          category: rule.category,
          severity: rule.severity,
          matched: match,
        })

        // Track highest severity
        if (this.getSeverityLevel(rule.severity) > this.getSeverityLevel(highestSeverity)) {
          highestSeverity = rule.severity
          action = rule.action as SafetyCheckResult['action']
        }

        // Escalate critical violations immediately
        if (rule.severity === 'critical') {
          shouldEscalate = true
        }
      }
    }

    const isSafe = violations.length === 0

    // Log if violations found
    if (!isSafe) {
      await this.logViolation(userId, requestType, content, violations, action)
    }

    // Auto-escalate critical violations to Roy
    if (shouldEscalate) {
      await this.escalateToRoy(userId, content, violations)
    }

    return {
      isSafe,
      violations,
      shouldEscalate,
      action,
    }
  }

  // Check content against a specific rule
  private checkRule(content: string, rule: SafetyRule): string | null {
    const lowerContent = content.toLowerCase()

    switch (rule.rule_type) {
      case 'keyword_block':
        const keywords = rule.rule_config.keywords || []
        for (const keyword of keywords) {
          if (lowerContent.includes(keyword.toLowerCase())) {
            return keyword
          }
        }
        break

      case 'pattern_match':
        const patterns = rule.rule_config.patterns || []
        for (const pattern of patterns) {
          if (lowerContent.includes(pattern.toLowerCase())) {
            return pattern
          }
        }
        break

      case 'behavior_analysis':
        // Placeholder for more advanced analysis
        // Could integrate with AI-based classification
        break
    }

    return null
  }

  // Get severity level for comparison
  private getSeverityLevel(severity: string): number {
    const levels: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    }
    return levels[severity] || 0
  }

  // Load safety rules from database
  private async loadRules(): Promise<void> {
    const now = Date.now()
    
    // Use cached rules if recent
    if (this.rules.length > 0 && now - this.lastRuleUpdate < this.RULE_CACHE_TTL) {
      return
    }

    try {
      const { data, error } = await this.supabase
        .from('safety_rules')
        .select('*')
        .eq('is_active', true)

      if (error) throw error

      this.rules = data || []
      this.lastRuleUpdate = now
    } catch (error) {
      console.error('Failed to load safety rules:', error)
    }
  }

  // Log safety violation
  private async logViolation(
    userId: string | null,
    requestType: string,
    content: string,
    violations: SafetyCheckResult['violations'],
    action: string
  ): Promise<void> {
    try {
      await this.supabase.from('content_safety_logs').insert({
        user_id: userId,
        request_type: requestType,
        user_message: content,
        safety_flags: violations,
        severity: violations[0]?.severity || 'low',
        action_taken: action,
        escalated_to_roy: violations.some(v => v.severity === 'critical'),
      })
    } catch (error) {
      console.error('Failed to log violation:', error)
    }
  }

  // Escalate critical violations to Roy
  private async escalateToRoy(
    userId: string | null,
    content: string,
    violations: SafetyCheckResult['violations']
  ): Promise<void> {
    try {
      // Log to bad actors registry if user is identified
      if (userId) {
        await this.supabase.from('bad_actors').insert({
          user_id: userId,
          violation_type: violations[0]?.category || 'unknown',
          violation_details: {
            content: content.substring(0, 500), // Truncate for storage
            violations,
          },
          auto_isolated: true,
          status: 'flagged',
        })
      }

      // TODO: Send notification to Roy (email, SMS, push notification)
      console.error('CRITICAL VIOLATION - ESCALATED TO ROY:', {
        userId,
        violations,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to escalate to Roy:', error)
    }
  }

  // Generate safe alternative response
  generateSafeResponse(violations: SafetyCheckResult['violations']): string {
    const category = violations[0]?.category

    const responses: Record<string, string> = {
      illegal: "I can't help with that request as it involves illegal activity. I'm designed to help with legal, ethical tasks. Is there something else I can assist you with?",
      
      harmful: "I can't provide assistance with requests that could cause harm. I'm here to help with constructive, safe activities. How else can I help you today?",
      
      self_harm: "I'm concerned about what you're asking. If you're struggling, please reach out to a crisis helpline:\n\n988 Suicide & Crisis Lifeline: Call/text 988\nCrisis Text Line: Text HOME to 741741\n\nI'm here to help with other questions you might have.",
      
      malicious_code: "I can't generate code designed to harm systems or users. I'm happy to help with legitimate development, security research, or ethical coding practices instead.",
      
      abuse: "I noticed some patterns in your requests. I'm here to help with legitimate questions and tasks. What can I assist you with today?",
    }

    return responses[category] || "I can't proceed with that request. How else can I help you?"
  }
}

// Singleton instance
let safetyFilter: ContentSafetyFilter | null = null

export function initSafetyFilter(supabaseUrl: string, supabaseKey: string): ContentSafetyFilter {
  if (!safetyFilter) {
    safetyFilter = new ContentSafetyFilter(supabaseUrl, supabaseKey)
  }
  return safetyFilter
}

export function getSafetyFilter(): ContentSafetyFilter | null {
  return safetyFilter
}
