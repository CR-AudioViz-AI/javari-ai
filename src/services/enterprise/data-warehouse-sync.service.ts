import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { Queue, Job } from 'bull';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
export interface DataWarehouseConfig {
export interface SchemaMapping {
export interface SyncConfiguration {
export interface RetryPolicy {
export interface SyncJobData {
export interface SyncResult {
export interface ConflictRecord {
export interface SyncError {
export interface SyncMetrics {
export interface DataWarehouseConnector {
    // Implementation for Snowflake connection
    // Snowflake MERGE implementation
    // Create staging table
    // Insert into staging
    // Perform merge
    // BigQuery client doesn't need explicit disconnection
    // BigQuery doesn't support traditional UPDATE, use MERGE
    // Create temporary table
    // Perform merge
    // BigQuery doesn't support traditional transactions
    // Execute operations sequentially
    // Create temp table
    // Insert into temp table
    // Perform u
export default {}
