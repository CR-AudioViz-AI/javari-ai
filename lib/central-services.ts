/**
 * CR AudioViz AI - Central Services Client
 * =========================================
 * 
 * This file MUST be included in every app in the ecosystem.
 * All apps route through craudiovizai.com/api for:
 * - Authentication
 * - Payments (Stripe, PayPal)
 * - Credits
 * - Analytics
 * - Support/Ticketing
 * - User Management
 * - Activity Logging
 * 
 * NO app should have its own auth, payment, or credit endpoints.
 * Everything goes through the central hub.
 * 
 * @version 1.0.0
 * @date January 1, 2026
 * @author CR AudioViz AI
 */

const CENTRAL_API_BASE = process.env.NEXT_PUBLIC_CENTRAL_API_URL || 'https://craudiovizai.com/api';

interface CentralResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  credits: number;
  plan: string;
}

interface CreditBalance {
  balance: number;
  plan: string;
  expires_at?: string;
}

interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export const CentralAuth = {
  /**
   * Get current user session
   */
  async getSession(): Promise<CentralResponse<User>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/auth/session`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Sign in with email/password
   */
  async signIn(email: string, password: string): Promise<CentralResponse<User>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/auth/signin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<CentralResponse<void>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/auth/signout`, {
        method: 'POST',
        credentials: 'include'
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get OAuth URL for provider
   */
  getOAuthUrl(provider: 'google' | 'github' | 'discord'): string {
    return `${CENTRAL_API_BASE}/auth/oauth/${provider}`;
  }
};

// ============================================================================
// CREDITS
// ============================================================================

export const CentralCredits = {
  /**
   * Get user's credit balance
   */
  async getBalance(): Promise<CentralResponse<CreditBalance>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/credits/balance`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Deduct credits for usage
   */
  async deduct(amount: number, reason: string, appId: string): Promise<CentralResponse<CreditBalance>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/credits/deduct`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason, app_id: appId })
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Refund credits (for errors)
   */
  async refund(amount: number, reason: string, appId: string): Promise<CentralResponse<CreditBalance>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/credits/refund`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason, app_id: appId })
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// PAYMENTS
// ============================================================================

export const CentralPayments = {
  /**
   * Create Stripe checkout session
   */
  async createStripeCheckout(priceId: string, successUrl: string, cancelUrl: string): Promise<CentralResponse<{ url: string }>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/stripe/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_id: priceId, success_url: successUrl, cancel_url: cancelUrl })
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Create PayPal order
   */
  async createPayPalOrder(packageId: string): Promise<CentralResponse<{ order_id: string }>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/paypal/orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId })
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get subscription status
   */
  async getSubscription(): Promise<CentralResponse<{ plan: string; status: string; renews_at?: string }>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/stripe/subscription`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// ANALYTICS
// ============================================================================

export const CentralAnalytics = {
  /**
   * Track an event
   */
  async track(event: string, properties: Record<string, any>, appId: string): Promise<void> {
    try {
      await fetch(`${CENTRAL_API_BASE}/analytics/track`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, properties, app_id: appId, timestamp: new Date().toISOString() })
      });
    } catch (error) {
      console.error('Analytics track error:', error);
    }
  },

  /**
   * Track page view
   */
  async pageView(path: string, appId: string): Promise<void> {
    await this.track('page_view', { path }, appId);
  }
};

// ============================================================================
// SUPPORT / TICKETS
// ============================================================================

export const CentralSupport = {
  /**
   * Create a support ticket
   */
  async createTicket(subject: string, message: string, category: string, appId: string): Promise<CentralResponse<{ ticket_id: string }>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/tickets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, category, app_id: appId })
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get user's tickets
   */
  async getTickets(): Promise<CentralResponse<any[]>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/tickets`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// ACTIVITY LOGGING
// ============================================================================

export const CentralActivity = {
  /**
   * Log an activity
   */
  async log(action: string, details: Record<string, any>, appId: string): Promise<void> {
    try {
      await fetch(`${CENTRAL_API_BASE}/activity`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, details, app_id: appId, timestamp: new Date().toISOString() })
      });
    } catch (error) {
      console.error('Activity log error:', error);
    }
  }
};

// ============================================================================
// CROSS-SELLING
// ============================================================================

export const CentralCrossSell = {
  /**
   * Get recommended apps/products for user
   */
  async getRecommendations(currentAppId: string): Promise<CentralResponse<any[]>> {
    try {
      const res = await fetch(`${CENTRAL_API_BASE}/recommendations?app_id=${currentAppId}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      return res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export const CentralServices = {
  Auth: CentralAuth,
  Credits: CentralCredits,
  Payments: CentralPayments,
  Analytics: CentralAnalytics,
  Support: CentralSupport,
  Activity: CentralActivity,
  CrossSell: CentralCrossSell,
  API_BASE: CENTRAL_API_BASE
};

export default CentralServices;
