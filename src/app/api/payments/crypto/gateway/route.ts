```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import { z } from 'zod';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

// Environment validation
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  ETHEREUM_RPC_URL: z.string().url(),
  POLYGON_RPC_URL: z.string().url(),
  BSC_RPC_URL: z.string().url(),
  SOLANA_RPC_URL: z.string().url(),
  BITCOIN_RPC_URL: z.string().url(),
  BITCOIN_RPC_USER: z.string(),
  BITCOIN_RPC_PASSWORD: z.string(),
  ONEINCH_API_KEY: z.string(),
  CHAINLINK_API_KEY: z.string(),
  ALCHEMY_API_KEY: z.string(),
  FIREBLOCKS_API_KEY: z.string(),
  FIREBLOCKS_PRIVATE_KEY: z.string(),
  REDIS_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().length(32),
});

const env = envSchema.parse(process.env);

// Initialize Supabase
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Network configurations
const NETWORK_CONFIGS = {
  ethereum: { chainId: 1, rpcUrl: env.ETHEREUM_RPC_URL },
  polygon: { chainId: 137, rpcUrl: env.POLYGON_RPC_URL },
  bsc: { chainId: 56, rpcUrl: env.BSC_RPC_URL },
  solana: { rpcUrl: env.SOLANA_RPC_URL },
  bitcoin: { 
    rpcUrl: env.BITCOIN_RPC_URL,
    user: env.BITCOIN_RPC_USER,
    password: env.BITCOIN_RPC_PASSWORD
  }
};

// Validation schemas
const initializePaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'BTC', 'ETH', 'SOL']),
  supportedChains: z.array(z.enum(['ethereum', 'polygon', 'bsc', 'solana', 'bitcoin'])),
  recipientAddress: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  expiresIn: z.number().min(300).max(86400).default(3600),
});

const processPaymentSchema = z.object({
  sessionId: z.string().uuid(),
  fromChain: z.enum(['ethereum', 'polygon', 'bsc', 'solana', 'bitcoin']),
  fromToken: z.string(),
  toChain: z.enum(['ethereum', 'polygon', 'bsc', 'solana', 'bitcoin']),
  toToken: z.string(),
  amount: z.string(),
  senderAddress: z.string(),
  signature: z.string(),
  gasSettings: z.object({
    gasPrice: z.string().optional(),
    gasLimit: z.string().optional(),
    priorityFee: z.string().optional(),
  }).optional(),
});

const walletOperationSchema = z.object({
  operation: z.enum(['create', 'import', 'backup', 'recover']),
  chain: z.enum(['ethereum', 'polygon', 'bsc', 'solana', 'bitcoin']),
  seedPhrase: z.string().optional(),
  privateKey: z.string().optional(),
  publicKey: z.string().optional(),
});

// Crypto Gateway Handler
class CryptoGatewayHandler {
  private providers: Map<string, any> = new Map();
  private walletManager: MultiChainWalletManager;
  private conversionEngine: AutoConversionEngine;
  private defiService: DeFiIntegrationService;
  private validator: TransactionValidator;
  private gasOptimizer: GasPriceOptimizer;
  private bridgeService: CrossChainBridge;
  private paymentProcessor: PaymentProcessor;
  private securityManager: WalletSecurityManager;
  private eventListener: BlockchainEventListener;

  constructor() {
    this.initializeProviders();
    this.walletManager = new MultiChainWalletManager();
    this.conversionEngine = new AutoConversionEngine();
    this.defiService = new DeFiIntegrationService();
    this.validator = new TransactionValidator();
    this.gasOptimizer = new GasPriceOptimizer();
    this.bridgeService = new CrossChainBridge();
    this.paymentProcessor = new PaymentProcessor();
    this.securityManager = new WalletSecurityManager();
    this.eventListener = new BlockchainEventListener();
  }

  private initializeProviders(): void {
    // Initialize blockchain providers
    this.providers.set('ethereum', new ethers.JsonRpcProvider(env.ETHEREUM_RPC_URL));
    this.providers.set('polygon', new ethers.JsonRpcProvider(env.POLYGON_RPC_URL));
    this.providers.set('bsc', new ethers.JsonRpcProvider(env.BSC_RPC_URL));
    this.providers.set('solana', new Connection(env.SOLANA_RPC_URL));
  }

  async initializePayment(data: z.infer<typeof initializePaymentSchema>): Promise<any> {
    try {
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + (data.expiresIn * 1000));

      // Get current market prices
      const prices = await this.conversionEngine.getCurrentPrices(data.supportedChains);
      
      // Calculate amounts for each supported chain
      const chainAmounts = await this.calculateChainAmounts(data.amount, data.currency, data.supportedChains, prices);

      // Generate payment addresses for each chain
      const paymentAddresses = await this.walletManager.generatePaymentAddresses(data.supportedChains);

      // Store payment session
      const { error } = await supabase.from('crypto_payment_sessions').insert({
        id: sessionId,
        amount: data.amount,
        currency: data.currency,
        supported_chains: data.supportedChains,
        chain_amounts: chainAmounts,
        payment_addresses: paymentAddresses,
        recipient_address: data.recipientAddress,
        metadata: data.metadata,
        status: 'initialized',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      return {
        sessionId,
        chainAmounts,
        paymentAddresses,
        expiresAt: expiresAt.toISOString(),
        supportedChains: data.supportedChains,
        estimatedGas: await this.gasOptimizer.estimateGasForChains(data.supportedChains)
      };
    } catch (error) {
      console.error('Payment initialization error:', error);
      throw new Error('Failed to initialize payment session');
    }
  }

  async processPayment(data: z.infer<typeof processPaymentSchema>): Promise<any> {
    try {
      // Validate session
      const session = await this.validatePaymentSession(data.sessionId);
      
      // Validate transaction signature
      const isValidSignature = await this.validator.validateSignature(
        data.senderAddress,
        data.signature,
        data.fromChain,
        data.amount
      );

      if (!isValidSignature) {
        throw new Error('Invalid transaction signature');
      }

      // Check for cross-chain conversion
      let txResult;
      if (data.fromChain !== data.toChain || data.fromToken !== data.toToken) {
        txResult = await this.processCrossChainPayment(data, session);
      } else {
        txResult = await this.processSameChainPayment(data, session);
      }

      // Update session status
      await supabase.from('crypto_payment_sessions')
        .update({
          status: 'processing',
          transaction_hash: txResult.txHash,
          from_chain: data.fromChain,
          to_chain: data.toChain,
          processed_at: new Date().toISOString()
        })
        .eq('id', data.sessionId);

      // Start monitoring transaction
      this.eventListener.monitorTransaction(txResult.txHash, data.fromChain);

      return {
        transactionHash: txResult.txHash,
        status: 'processing',
        estimatedConfirmationTime: txResult.estimatedTime,
        explorerUrl: this.getExplorerUrl(txResult.txHash, data.fromChain),
        bridgeInfo: txResult.bridgeInfo
      };
    } catch (error) {
      console.error('Payment processing error:', error);
      await this.updatePaymentStatus(data.sessionId, 'failed', error.message);
      throw new Error('Payment processing failed');
    }
  }

  private async calculateChainAmounts(
    amount: number, 
    currency: string, 
    chains: string[], 
    prices: Record<string, number>
  ): Promise<Record<string, string>> {
    const amounts: Record<string, string> = {};
    
    for (const chain of chains) {
      const chainToken = this.getChainNativeToken(chain);
      const tokenPrice = prices[chainToken];
      
      if (currency === 'USD') {
        amounts[chain] = (amount / tokenPrice).toFixed(8);
      } else if (currency === chainToken.toUpperCase()) {
        amounts[chain] = amount.toString();
      } else {
        // Convert through USD
        const usdValue = amount * prices[currency.toLowerCase()];
        amounts[chain] = (usdValue / tokenPrice).toFixed(8);
      }
    }
    
    return amounts;
  }

  private async processCrossChainPayment(data: any, session: any): Promise<any> {
    // Use bridge service for cross-chain transfers
    const bridgeQuote = await this.bridgeService.getBestRoute(
      data.fromChain,
      data.toChain,
      data.fromToken,
      data.toToken,
      data.amount
    );

    const transaction = await this.bridgeService.executeBridge(bridgeQuote, data.senderAddress);
    
    return {
      txHash: transaction.hash,
      estimatedTime: bridgeQuote.estimatedTime,
      bridgeInfo: {
        protocol: bridgeQuote.protocol,
        fees: bridgeQuote.fees,
        route: bridgeQuote.route
      }
    };
  }

  private async processSameChainPayment(data: any, session: any): Promise<any> {
    switch (data.fromChain) {
      case 'ethereum':
      case 'polygon':
      case 'bsc':
        return await this.processEVMPayment(data, session);
      case 'solana':
        return await this.processSolanaPayment(data, session);
      case 'bitcoin':
        return await this.processBitcoinPayment(data, session);
      default:
        throw new Error(`Unsupported chain: ${data.fromChain}`);
    }
  }

  private async processEVMPayment(data: any, session: any): Promise<any> {
    const provider = this.providers.get(data.fromChain);
    
    // Optimize gas settings
    const gasSettings = await this.gasOptimizer.optimizeGas(data.fromChain, data.gasSettings);
    
    const tx = {
      to: session.payment_addresses[data.fromChain],
      value: ethers.parseEther(data.amount),
      gasPrice: gasSettings.gasPrice,
      gasLimit: gasSettings.gasLimit,
    };

    // Simulate transaction
    await this.validator.simulateTransaction(provider, tx);
    
    return {
      txHash: `simulated_${crypto.randomUUID()}`,
      estimatedTime: 300, // 5 minutes
    };
  }

  private async processSolanaPayment(data: any, session: any): Promise<any> {
    const connection = this.providers.get('solana');
    const senderPubkey = new PublicKey(data.senderAddress);
    const recipientPubkey = new PublicKey(session.payment_addresses.solana);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderPubkey,
        toPubkey: recipientPubkey,
        lamports: Number(data.amount) * 1e9, // Convert SOL to lamports
      })
    );

    return {
      txHash: `solana_${crypto.randomUUID()}`,
      estimatedTime: 30, // 30 seconds
    };
  }

  private async processBitcoinPayment(data: any, session: any): Promise<any> {
    // Bitcoin transaction processing would require proper UTXO management
    // This is a simplified implementation
    return {
      txHash: `bitcoin_${crypto.randomUUID()}`,
      estimatedTime: 1800, // 30 minutes
    };
  }

  private async validatePaymentSession(sessionId: string): Promise<any> {
    const { data: session, error } = await supabase
      .from('crypto_payment_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      throw new Error('Invalid payment session');
    }

    if (new Date(session.expires_at) < new Date()) {
      throw new Error('Payment session expired');
    }

    if (session.status !== 'initialized') {
      throw new Error('Payment session already processed');
    }

    return session;
  }

  private getChainNativeToken(chain: string): string {
    const tokens: Record<string, string> = {
      ethereum: 'eth',
      polygon: 'matic',
      bsc: 'bnb',
      solana: 'sol',
      bitcoin: 'btc'
    };
    return tokens[chain] || 'eth';
  }

  private getExplorerUrl(txHash: string, chain: string): string {
    const explorers: Record<string, string> = {
      ethereum: `https://etherscan.io/tx/${txHash}`,
      polygon: `https://polygonscan.com/tx/${txHash}`,
      bsc: `https://bscscan.com/tx/${txHash}`,
      solana: `https://explorer.solana.com/tx/${txHash}`,
      bitcoin: `https://blockchair.com/bitcoin/transaction/${txHash}`
    };
    return explorers[chain] || '';
  }

  private async updatePaymentStatus(sessionId: string, status: string, errorMessage?: string): Promise<void> {
    await supabase.from('crypto_payment_sessions')
      .update({
        status,
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }
}

// Supporting classes (simplified implementations)
class MultiChainWalletManager {
  async generatePaymentAddresses(chains: string[]): Promise<Record<string, string>> {
    const addresses: Record<string, string> = {};
    for (const chain of chains) {
      addresses[chain] = `${chain}_address_${crypto.randomUUID().slice(0, 8)}`;
    }
    return addresses;
  }
}

class AutoConversionEngine {
  async getCurrentPrices(chains: string[]): Promise<Record<string, number>> {
    // Mock prices - in production, fetch from Chainlink or other price feeds
    return {
      eth: 2000,
      matic: 0.8,
      bnb: 300,
      sol: 100,
      btc: 45000
    };
  }
}

class DeFiIntegrationService {}
class TransactionValidator {
  async validateSignature(address: string, signature: string, chain: string, amount: string): Promise<boolean> {
    // Mock validation - implement proper signature verification
    return signature.length > 0 && address.length > 0;
  }

  async simulateTransaction(provider: any, tx: any): Promise<void> {
    // Simulate transaction execution
  }
}

class GasPriceOptimizer {
  async optimizeGas(chain: string, settings?: any): Promise<any> {
    return {
      gasPrice: '20000000000', // 20 gwei
      gasLimit: '21000'
    };
  }

  async estimateGasForChains(chains: string[]): Promise<Record<string, string>> {
    const estimates: Record<string, string> = {};
    for (const chain of chains) {
      estimates[chain] = '0.001'; // Mock gas estimate
    }
    return estimates;
  }
}

class CrossChainBridge {
  async getBestRoute(fromChain: string, toChain: string, fromToken: string, toToken: string, amount: string): Promise<any> {
    return {
      protocol: 'LayerZero',
      estimatedTime: 600,
      fees: '0.001',
      route: [fromChain, toChain]
    };
  }

  async executeBridge(quote: any, senderAddress: string): Promise<any> {
    return {
      hash: `bridge_${crypto.randomUUID()}`
    };
  }
}

class PaymentProcessor {}
class WalletSecurityManager {}
class BlockchainEventListener {
  monitorTransaction(txHash: string, chain: string): void {
    // Start monitoring transaction status
    console.log(`Monitoring transaction ${txHash} on ${chain}`);
  }
}

// Initialize gateway
const gateway = new CryptoGatewayHandler();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const headersList = headers();
    const clientIP = headersList.get('x-forwarded-for') || 'unknown';
    
    // Rate limiting
    const rateLimitResult = await rateLimit(clientIP, 100, 3600); // 100 requests per hour
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'initialize': {
        const validatedData = initializePaymentSchema.parse(body);
        const result = await gateway.initializePayment(validatedData);
        return NextResponse.json(result);
      }

      case 'process': {
        const validatedData = processPaymentSchema.parse(body);
        const result = await gateway.processPayment(validatedData);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Crypto gateway error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const transactionId = url.searchParams.get('transactionId');
    const sessionId = url.searchParams.get('sessionId');

    if (sessionId) {
      // Get payment session status
      const { data: session, error } = await supabase
        .from('crypto_payment_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        sessionId: session.id,
        status: session.status,
        transactionHash: session.transaction_hash,
        amount: session.amount,
        currency: session.currency,
        createdAt: session.created_at,
        expiresAt: session.expires_at
      });
    }

    // Get supported chains and their current status
    return NextResponse.json({
      supportedChains: Object.keys(NETWORK_CONFIGS),
      networkStatus: 'online',
      version: '1.0.0'
    });
  } catch (error) {
    console.error('GET request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validatedData = walletOperationSchema.parse(body);

    // Wallet management operations
    const result = await gateway.walletManager.handleOperation(validatedData);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Wallet operation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```