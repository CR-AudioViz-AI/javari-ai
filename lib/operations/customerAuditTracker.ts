// lib/operations/customerAuditTracker.ts
// Purpose: Tracks customer domain audits run through the Javari Web Crawler.
//          Stores results in javari_customer_audits and provides aggregated
//          reporting for the operations dashboard.
// Date: 2026-03-07
import type { RawOperationsData, CustomerAuditRow } from "./operationsCollector";
import { recordCustomerAudit } from "./operationsCollector";
// ── Types ──────────────────────────────────────────────────────────────────
export interface CustomerAuditSummary {
export interface DomainAuditSummary {
// ── Aggregator ─────────────────────────────────────────────────────────────
// ── Record a customer audit (called from crawler) ──────────────────────────
export default {}
