import { TaxCalculator } from './components/TaxCalculator';
import { TaxBreakdown } from './components/TaxBreakdown';
import { JurisdictionSelector } from './components/JurisdictionSelector';
import { TaxRateDisplay } from './components/TaxRateDisplay';
import { useTaxCalculation } from './hooks/useTaxCalculation';
import { useJurisdictions } from './hooks/useJurisdictions';
import { avalaraService } from './services/avalaraService';
import { taxEngine } from './services/taxEngine';
import { taxValidators } from './utils/taxValidators';
import { taxFormatters } from './utils/taxFormatters';
import { taxRules } from './config/taxRules';
import {
export interface TaxCalculationService {
export interface TaxModuleConfig {
    // Initialize Avalara service
      // Validate request
      // Check cache first
      // Perform calculation via Avalara
      // Cache result
      // Store transaction for compliance
      // Fallback to cached calculation if available
    // Validate required fields
    // Validate currency
    // Validate jurisdiction-specific rules
      // Store in database via Supabase
export type {
    // Verify webhook signature
    // Process webhook based on event type
  // Update compliance status in database
  // Update jurisdiction information
  // Update cached tax rates
export default {}
