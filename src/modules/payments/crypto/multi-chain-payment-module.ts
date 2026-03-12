import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ethers, BigNumber, Contract, providers } from 'ethers';
import { EventEmitter } from 'events';
export interface ChainConfig {
export interface PaymentRequest {
export interface AtomicSwapParams {
export interface StakingPosition {
export interface DeFiPosition {
export interface TransactionResult {
      // WalletConnect v2 implementation would go here
      // This is a simplified version
export default {}
