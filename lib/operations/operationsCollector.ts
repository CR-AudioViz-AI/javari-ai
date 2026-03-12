// lib/operations/operationsCollector.ts
// Purpose: Central data collector for the Javari Operations Center.
//          Pulls live data from Supabase tables that all other engines write to.
//          Single source of truth for the operations dashboard.
// Date: 2026-03-07
import { createClient } from "@supabase/supabase-js";
// ── Types ──────────────────────────────────────────────────────────────────
export interface RawOperationsData {
export interface TargetRow {
export interface CycleRow {
export interface TaskRow {
export interface ExecLogRow {
export interface GuardrailRow {
export interface CustomerAuditRow {
export interface ScanMetricRow {
export interface RepairMetricRow {
// ── Supabase ───────────────────────────────────────────────────────────────
// ── Main collector ─────────────────────────────────────────────────────────
// ── Ensure tables ──────────────────────────────────────────────────────────
// ── Write helpers used by other engines ───────────────────────────────────
export default {}
