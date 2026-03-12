import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { EventEmitter } from 'events';
      // Credit for unused portion of current plan
      // Charge for remaining portion of new plan
      // Create invoice
      // Attempt payment
    // Update subscription
    // Record billing history
    // Update subscription to past due
    // Record failed billing
    // Get new plan details
    // Update Stripe subscription
    // Update local subscription
    // Log plan change
    // Schedule the change
      // Attempt payment retry
      // Retry payment
        // Payment still failed, escalate dunning
export default {}
