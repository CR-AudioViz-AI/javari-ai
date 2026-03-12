import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY';
export type PaymentProvider = 'stripe' | 'paypal' | 'square' | 'adyen' | 'checkout';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
export type ReconciliationStatus = 'pending' | 'matched' | 'discrepant' | 'resolved' | 'disputed';
export type DiscrepancyType = 'amount_mismatch' | 'missing_transaction' | 'duplicate' | 'fx_rate_variance' | 'timing_mismatch';
export interface ProviderTransaction {
export interface NormalizedTransaction {
export interface MatchingConfig {
export interface FXRate {
export interface Discrepancy {
export interface MatchResult {
export interface ReconciliationReport {
export interface AuditLogEntry {
        // Check for discrepancies
    // Reference matching (highest weight)
    // Amount matching
    // Timestamp proximity
    // Provider diversity (bonus for cross-provider matches)
    // Amount discrepancy
    // FX rate variance
      // Auto-resolve low severity discrepancies
      // Add to assignment queue for manual review
    // Simple round-robin assignment logic
    // In a real implementation, this would query the database
        // Re-add to buffer for retry
    // Initial reconciliation
    // Set up periodic reconciliation
export default {}
