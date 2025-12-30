// app/settings/subscription/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION MANAGEMENT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:18 PM EST
// Henderson Standard - Self-service subscription management
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { 
  CreditCard, Calendar, Clock, CheckCircle2, XCircle, 
  ArrowUpCircle, ArrowDownCircle, RefreshCw, ExternalLink,
  AlertTriangle, Sparkles, Shield
} from 'lucide-react';

interface Subscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  plan: string;
  priceMonthly: number;
  interval: 'month' | 'year';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  creditsPerMonth: number;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

const PLANS = {
  free: { name: 'Free', credits: 50, price: 0, color: 'gray' },
  starter: { name: 'Starter', credits: 500, price: 9, color: 'blue' },
  pro: { name: 'Pro', credits: 2000, price: 29, color: 'purple' },
  business: { name: 'Business', credits: 10000, price: 99, color: 'amber' }
};

export default function SubscriptionManagement() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  async function fetchSubscription() {
    try {
      const res = await fetch('/api/subscription');
      const data = await res.json();
      
      if (data.subscription) {
        setSubscription(data.subscription);
      }
      if (data.paymentMethod) {
        setPaymentMethod(data.paymentMethod);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSubscription() {
    setActionLoading('cancel');
    try {
      const res = await fetch('/api/subscription/cancel', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: true } : null);
        setShowCancelModal(false);
      }
    } catch (error) {
      console.error('Failed to cancel:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReactivate() {
    setActionLoading('reactivate');
    try {
      const res = await fetch('/api/subscription/reactivate', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: false } : null);
      }
    } catch (error) {
      console.error('Failed to reactivate:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleManageBilling() {
    setActionLoading('billing');
    try {
      const res = await fetch('/api/stripe/billing-portal', { method: 'POST' });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <SubscriptionSkeleton />;
  }

  const currentPlan = subscription?.plan 
    ? PLANS[subscription.plan as keyof typeof PLANS] 
    : PLANS.free;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Subscription & Billing
        </h1>

        {/* Current Plan Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-${currentPlan.color}-100 dark:bg-${currentPlan.color}-900/30`}>
                <Sparkles className={`w-6 h-6 text-${currentPlan.color}-600`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {currentPlan.name} Plan
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  {currentPlan.credits.toLocaleString()} credits/month
                </p>
              </div>
            </div>
            {subscription?.status === 'active' && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Active
              </span>
            )}
            {subscription?.status === 'trialing' && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
                <Clock className="w-4 h-4" />
                Trial
              </span>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />
                Canceling
              </span>
            )}
          </div>

          {subscription && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                  <CreditCard className="w-4 h-4" />
                  Billing
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  ${subscription.priceMonthly}/{subscription.interval === 'year' ? 'yr' : 'mo'}
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                  <Calendar className="w-4 h-4" />
                  {subscription.cancelAtPeriodEnd ? 'Access Until' : 'Next Billing'}
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>

              {subscription.trialEnd && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    Trial Ends
                  </div>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">
                    {new Date(subscription.trialEnd).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>
          )}

          {subscription?.cancelAtPeriodEnd && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Your subscription is set to cancel
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    You'll lose access to {currentPlan.name} features on{' '}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
                    Changed your mind?
                  </p>
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading === 'reactivate'}
                    className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                  >
                    {actionLoading === 'reactivate' ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Keep My Subscription
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <a
              href="/pricing"
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-medium transition flex items-center gap-2"
            >
              <ArrowUpCircle className="w-4 h-4" />
              {subscription ? 'Change Plan' : 'Upgrade'}
            </a>
            
            {subscription && (
              <button
                onClick={handleManageBilling}
                disabled={actionLoading === 'billing'}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition flex items-center gap-2"
              >
                {actionLoading === 'billing' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Manage Billing
              </button>
            )}

            {subscription && !subscription.cancelAtPeriodEnd && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Cancel Plan
              </button>
            )}
          </div>
        </div>

        {/* Payment Method */}
        {paymentMethod && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Payment Method
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)} •••• {paymentMethod.last4}
                  </p>
                  <p className="text-sm text-gray-500">
                    Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
                  </p>
                </div>
              </div>
              <button
                onClick={handleManageBilling}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Update
              </button>
            </div>
          </div>
        )}

        {/* Benefits List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Your Benefits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: Sparkles, text: `${currentPlan.credits.toLocaleString()} credits/month` },
              { icon: Shield, text: currentPlan.name === 'free' ? 'Credits expire monthly' : 'Credits never expire' },
              { icon: CheckCircle2, text: 'Access to all creative tools' },
              { icon: CheckCircle2, text: 'AI-powered assistance' },
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <benefit.icon className="w-4 h-4 text-green-500" />
                <span>{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Cancel Subscription?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                You'll keep access until the end of your billing period, then you'll be moved to the Free plan with 50 credits/month.
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-4">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>You'll lose:</strong> {currentPlan.credits - 50} monthly credits, credits that never expire
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading === 'cancel'}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  {actionLoading === 'cancel' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    'Cancel Plan'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
