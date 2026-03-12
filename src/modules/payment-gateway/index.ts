import { EventEmitter } from 'events';
export interface Transaction {
export interface PaymentRequest {
export interface WalletConnection {
export interface ConversionRate {
export interface SmartContractConfig {
export interface DeFiProtocolConfig {
export interface PaymentGatewayConfig {
export interface PaymentGatewayEvents {
    // Bitcoin Core RPC implementation
    // Web3/Ethers implementation
    // Solana Web3 implementation
    // Bitcoin transaction implementation
    // EVM transaction implementation
    // Solana transaction implementation
      // Implementation would use Web3/Ethers for contract execution
      // Implementation would use Web3/Ethers for contract reading
      // Implementation would interact with DeFi protocol contracts
    // Implementation would query protocol for swap rates
      // Validate recipient address
      // Check balance
      // Handle auto conversion if needed
      // Estimate gas fees
      // Process through smart contract if specified
      // Implementation would integrate with wallet providers
      // Load balances for supported currencies
export default {}
