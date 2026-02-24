/**
 * HENDERSON OVERRIDE PROTOCOL - Content Safety Filter
 * 
 * Multi-layer content safety system that protects against:
 * - Malicious requests (hacking, fraud, illegal activity)
 * - Harmful content (violence, self-harm, child exploitation)
 * - Code abuse (malware, exploits, jailbreak attempts)
 * - Spam and abuse patterns
 */

import { createClient } from '@/lib/supabase/server';

export interface SafetyCheckResult {
  isSafe: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  violationType?: string;
  shouldBlock: boolean;
  shouldEscalate: boolean;
}

const ROY_EMAIL = 'royhenderson@craudiovizai.com';

// Critical patterns that should always block
const CRITICAL_PATTERNS = [
  // Hacking & Exploits
  /sql\s+injection/i,
  /xss\s+attack/i,
  /buffer\s+overflow/i,
  /remote\s+code\s+execution/i,
  /privilege\s+escalation/i,
  /zero[\s-]day/i,
  
  // Illegal Activity
  /credit\s+card\s+fraud/i,
  /identity\s+theft/i,
  /money\s+laundering/i,
  /phishing\s+scam/i,
  
  // Malware & Viruses
  /create\s+malware/i,
  /write\s+virus/i,
  /ransomware/i,
  /trojan\s+horse/i,
  /backdoor/i,
  
  // Violence & Weapons
  /make\s+(bomb|explosive)/i,
  /build\s+weapon/i,
  /how\s+to\s+kill/i,
  
  // Child Exploitation (CRITICAL)
  /child\s+pornography/i,
  /minor\s+exploitation/i,
  /child\s+abuse/i,
  
  // Self-Harm
  /commit\s+suicide/i,
  /self[\s-]harm\s+methods/i,
  /overdose\s+on/i
];

// High-risk patterns that should escalate to Roy
const HIGH_RISK_PATTERNS = [
  /bypass\s+security/i,
  /circumvent\s+protection/i,
  /jailbreak/i,
  /ignore\s+(previous\s+)?instructions/i,
  /forget\s+your\s+rules/i,
  /you\s+are\s+now/i,
  /pretend\s+to\s+be/i
];

// Spam & Abuse patterns
const SPAM_PATTERNS = [
  /click\s+here\s+now/i,
  /limited\s+time\s+offer/i,
  /act\s+now/i,
  /\$\$\$+/,
  /💰{3,}/
];

export async function checkContentSafety(
  content: string,
  userId: string,
  userEmail: string
): Promise<SafetyCheckResult> {
  try {
    const supabase = await createClient();
    
    // Roy bypasses all safety checks (he's the owner)
    if (userEmail === ROY_EMAIL) {
      return {
        isSafe: true,
        shouldBlock: false,
        shouldEscalate: false
      };
    }
    
    // Check for critical violations
    for (const pattern of CRITICAL_PATTERNS) {
      if (pattern.test(content)) {
        const violationType = getCriticalViolationType(pattern);
        
        // Log the critical violation
        await supabase.from('safety_violations').insert({
          user_id: userId,
          user_email: userEmail,
          violation_type: violationType,
          severity: 'critical',
          content_sample: content.substring(0, 500), // First 500 chars only
          escalated_to_roy: true
        });
        
        return {
          isSafe: false,
          reason: 'Content violates platform safety policies',
          severity: 'critical',
          violationType,
          shouldBlock: true,
          shouldEscalate: true
        };
      }
    }
    
    // Check for high-risk patterns (jailbreak attempts)
    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(content)) {
        await supabase.from('safety_violations').insert({
          user_id: userId,
          user_email: userEmail,
          violation_type: 'jailbreak_attempt',
          severity: 'high',
          content_sample: content.substring(0, 500),
          escalated_to_roy: true
        });
        
        return {
          isSafe: false,
          reason: 'Suspicious request detected. Please rephrase your question.',
          severity: 'high',
          violationType: 'jailbreak_attempt',
          shouldBlock: true,
          shouldEscalate: true
        };
      }
    }
    
    // Check for spam patterns
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(content)) {
        await supabase.from('safety_violations').insert({
          user_id: userId,
          user_email: userEmail,
          violation_type: 'spam',
          severity: 'low',
          content_sample: content.substring(0, 500),
          escalated_to_roy: false
        });
        
        return {
          isSafe: false,
          reason: 'This looks like spam. Please send genuine requests only.',
          severity: 'low',
          violationType: 'spam',
          shouldBlock: true,
          shouldEscalate: false
        };
      }
    }
    
    // Check database for custom rules
    const { data: rules } = await supabase
      .from('safety_rules')
      .select('*')
      .eq('active', true);
      
    if (rules) {
      for (const rule of rules) {
        const pattern = new RegExp(rule.pattern, 'i');
        if (pattern.test(content)) {
          const shouldEscalate = rule.severity === 'critical' || rule.severity === 'high';
          
          await supabase.from('safety_violations').insert({
            user_id: userId,
            user_email: userEmail,
            violation_type: rule.rule_type,
            severity: rule.severity,
            content_sample: content.substring(0, 500),
            escalated_to_roy: shouldEscalate
          });
          
          return {
            isSafe: false,
            reason: rule.user_message || 'Content violates platform policies',
            severity: rule.severity as any,
            violationType: rule.rule_type,
            shouldBlock: true,
            shouldEscalate
          };
        }
      }
    }
    
    // Content is safe
    return {
      isSafe: true,
      shouldBlock: false,
      shouldEscalate: false
    };
    
  } catch (error) {
    console.error('Safety check error:', error);
    // Fail open - allow the request but log the error
    return {
      isSafe: true,
      shouldBlock: false,
      shouldEscalate: false
    };
  }
}

function getCriticalViolationType(pattern: RegExp): string {
  const patternStr = pattern.toString();
  
  if (patternStr.includes('sql') || patternStr.includes('xss') || patternStr.includes('injection')) {
    return 'hacking_attempt';
  }
  if (patternStr.includes('fraud') || patternStr.includes('theft') || patternStr.includes('laundering')) {
    return 'illegal_activity';
  }
  if (patternStr.includes('malware') || patternStr.includes('virus') || patternStr.includes('ransomware')) {
    return 'malware_generation';
  }
  if (patternStr.includes('bomb') || patternStr.includes('weapon') || patternStr.includes('kill')) {
    return 'violence_weapons';
  }
  if (patternStr.includes('child') || patternStr.includes('minor')) {
    return 'child_exploitation';
  }
  if (patternStr.includes('suicide') || patternStr.includes('self-harm') || patternStr.includes('overdose')) {
    return 'self_harm';
  }
  
  return 'policy_violation';
}

export async function checkUserStatus(
  userId: string,
  userEmail: string
): Promise<{ isBlocked: boolean; reason?: string }> {
  try {
    const supabase = await createClient();
    
    // Roy is never blocked
    if (userEmail === ROY_EMAIL) {
      return { isBlocked: false };
    }
    
    // Check if user is in bad actors registry
    const { data: badActor } = await supabase
      .from('bad_actors')
      .select('*')
      .eq('user_id', userId)
      .eq('is_isolated', true)
      .single();
      
    if (badActor) {
      return {
        isBlocked: true,
        reason: 'Your account has been temporarily restricted due to policy violations. Please contact support.'
      };
    }
    
    return { isBlocked: false };
  } catch (error) {
    console.error('User status check error:', error);
    // Fail open - allow the request
    return { isBlocked: false };
  }
}
