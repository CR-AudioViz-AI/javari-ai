// lib/javari/factory/file-tree.ts
// Javari Module Factory — Canonical File Tree Schema
// 2026-02-20 — STEP 4 implementation
// Represents the full file structure for a generated module.
// Supports multi-agent diffs + merges.
// All paths relative to project root.
// ── Types ─────────────────────────────────────────────────────────────────────
export type FileCategory =
export type FileStatus =
export interface FileNode {
export interface DirectoryNode {
export interface ModuleFileTree {
// ── Standard path templates ───────────────────────────────────────────────────
// ── Factory helpers ───────────────────────────────────────────────────────────
export default {}
