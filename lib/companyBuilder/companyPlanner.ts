// lib/companyBuilder/companyPlanner.ts
// Purpose: Analyzes an idea, defines product scope, identifies required systems,
//          generates a company name + product vision, and inserts roadmap tasks
//          into roadmap_tasks so the full Javari execution engine can build it.
// Date: 2026-03-08
import { createClient }        from "@supabase/supabase-js";
import { runOrchestrator }     from "@/lib/orchestrator/orchestrator";
import { ingestTechDiscovery } from "@/lib/memory/knowledgeNodeBuilder";
// ── Types ──────────────────────────────────────────────────────────────────
export interface CompanyInput {
export interface ArchitectureOutline {
export interface CompanyPlan {
export interface PlanRoadmapTask {
// ── Supabase ───────────────────────────────────────────────────────────────
// ── Name generator ─────────────────────────────────────────────────────────
// ── Default architecture by industry ──────────────────────────────────────
// ── Main planner ───────────────────────────────────────────────────────────
  // Use orchestrator for AI-driven market analysis
  // Parse AI response
  // Generate phased roadmap tasks
  // Ingest tech stack into memory graph
// ── Insert roadmap tasks into Supabase ────────────────────────────────────
// ── Roadmap task generator ─────────────────────────────────────────────────
    // MVP phase
    // V1 phase
    // V2 phase
    // Growth phase
export default {}
