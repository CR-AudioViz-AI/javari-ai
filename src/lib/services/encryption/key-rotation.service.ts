import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, createHash, pbkdf2, scrypt, timingSafeEqual } from 'crypto';
import { schedule, ScheduledTask } from 'node-cron';
import Redis from 'ioredis';
export interface EncryptionKey {
export interface RotationPolicy {
export interface KeyVault {
export interface HSMAdapter {
export interface AlgorithmProvider {
export interface AuditEvent {
export interface KeyRotationServiceConfig {
        // In production, use crypto.generateKeyPair
        // Using scrypt as Argon2id alternative (Node.js built-in)
    // Check key size based on algorithm
    // Check if key is expired
    // Check if key is revoked
    // Validate key material
      // Update key status to revoked
      // Clear from cache
      // Log revocation event
      // Start automated rotation if enabled
      // Store key in vault
      // Cache key metadata
      // Schedule rotation if policy provided
      // Log generation event
      // Get current key
      // Generate new key
      // Store new key
      // Mark old key as expired
      // Update cache
      // Schedule next rotation
      // Log rotation event
    // Check for keys needing rotation every hour
      // Create default policy for checking
export default {}
