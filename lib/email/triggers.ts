// lib/email/triggers.ts
// ═══════════════════════════════════════════════════════════════════════════════
// CENTRALIZED EMAIL TRIGGER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:35 PM EST
// Reusable functions to send emails on key events
// ═══════════════════════════════════════════════════════════════════════════════

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WELCOME EMAIL - On first signup
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<EmailResult> {
  try {
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'welcome',
        to: email,
        data: { name }
      })
    });
    
    const data = await res.json();
    return { success: data.success, messageId: data.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE RECEIPT - After successful payment
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendPurchaseReceipt(
  email: string,
  data: {
    name: string;
    planName: string;
    amount: number;
    credits: number;
    transactionId: string;
    isSubscription: boolean;
  }
): Promise<EmailResult> {
  try {
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'purchase_receipt',
        to: email,
        data: {
          name: data.name,
          planName: data.planName,
          amount: `$${data.amount.toFixed(2)}`,
          credits: data.credits.toLocaleString(),
          transactionId: data.transactionId,
          date: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        }
      })
    });
    
    const result = await res.json();
    return { success: result.success, messageId: result.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOW CREDITS WARNING - When balance drops below threshold
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendLowCreditsWarning(
  email: string,
  data: {
    name: string;
    currentBalance: number;
    threshold: number;
  }
): Promise<EmailResult> {
  try {
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'low_credits',
        to: email,
        data: {
          name: data.name,
          currentBalance: data.currentBalance,
          suggestedPack: data.currentBalance < 10 ? 'Plus Pack (550 credits)' : 'Basic Pack (100 credits)'
        }
      })
    });
    
    const result = await res.json();
    return { success: result.success, messageId: result.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CONFIRMATION - After subscribing
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendSubscriptionConfirmation(
  email: string,
  data: {
    name: string;
    planName: string;
    monthlyCredits: number;
    nextBillingDate: Date;
    amount: number;
  }
): Promise<EmailResult> {
  try {
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'subscription_confirmed',
        to: email,
        data: {
          name: data.name,
          planName: data.planName,
          monthlyCredits: data.monthlyCredits.toLocaleString(),
          nextBillingDate: data.nextBillingDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }),
          amount: `$${data.amount.toFixed(2)}`
        }
      })
    });
    
    const result = await res.json();
    return { success: result.success, messageId: result.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CANCELLED - When user cancels
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendSubscriptionCancelled(
  email: string,
  data: {
    name: string;
    planName: string;
    endDate: Date;
    remainingCredits: number;
  }
): Promise<EmailResult> {
  try {
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'subscription_cancelled',
        to: email,
        data: {
          name: data.name,
          planName: data.planName,
          endDate: data.endDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }),
          remainingCredits: data.remainingCredits.toLocaleString()
        }
      })
    });
    
    const result = await res.json();
    return { success: result.success, messageId: result.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREDITS REFUNDED - When error causes auto-refund
// ═══════════════════════════════════════════════════════════════════════════════
export async function sendCreditsRefunded(
  email: string,
  data: {
    name: string;
    amount: number;
    reason: string;
    newBalance: number;
  }
): Promise<EmailResult> {
  try {
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'credits_refunded',
        to: email,
        data: {
          name: data.name,
          amount: data.amount,
          reason: data.reason,
          newBalance: data.newBalance.toLocaleString()
        }
      })
    });
    
    const result = await res.json();
    return { success: result.success, messageId: result.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Check if user should receive low credits email
// ═══════════════════════════════════════════════════════════════════════════════
export function shouldSendLowCreditsEmail(
  currentBalance: number,
  previousBalance: number,
  threshold: number = 20
): boolean {
  // Only send if:
  // 1. Balance dropped below threshold
  // 2. Previous balance was above threshold (don't spam)
  return currentBalance <= threshold && previousBalance > threshold;
}

export default {
  sendWelcomeEmail,
  sendPurchaseReceipt,
  sendLowCreditsWarning,
  sendSubscriptionConfirmation,
  sendSubscriptionCancelled,
  sendCreditsRefunded,
  shouldSendLowCreditsEmail
};
