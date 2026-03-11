```typescript
import { ethers, Contract, Wallet, JsonRpcProvider, parseEther, formatEther } from 'ethers';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { mainnet, polygon, base } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';

/**
 * Configuration for blockchain networks
 */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  currency: string;
  blockExplorer: string;
}

/**
 * Creator information for revenue distribution
 */
export interface Creator {
  id: string;
  walletAddress: string;
  name: string;
  sharePercentage: number;
  isActive: boolean;
  joinedAt: Date;
}

/**
 * Performance milestone configuration
 */
export interface PerformanceMilestone {
  id: string;
  name: string;
  metric: 'streams' | 'sales' | 'engagement' | 'custom';
  threshold: number;
  bonusPercentage: number;
  isActive: boolean;
}

/**
 * Token configuration for multi-token payments
 */
export interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  isNative: boolean;
  minAmount: string;
}

/**
 * Distribution rule configuration
 */
export interface DistributionRule {
  id: string;
  name: string;
  creators: Creator[];
  milestones: PerformanceMilestone[];
  tokens: TokenConfig[];
  isDefault: boolean;
  createdAt: Date;
}

/**
 * Payment transaction record
 */
export interface PaymentTransaction {
  id: string;
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  token: TokenConfig;
  amount: string;
  recipients: PaymentRecipient[];
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
}

/**
 * Individual payment recipient
 */
export interface PaymentRecipient {
  creatorId: string;
  walletAddress: string;
  amount: string;
  sharePercentage: number;
  milestoneBonus: number;
}

/**
 * Contract deployment configuration
 */
export interface ContractDeployConfig {
  chainId: number;
  initialOwner: string;
  distributionRules: DistributionRule;
  upgradeableProxy: boolean;
  gasLimit?: string;
}

/**
 * Performance metrics for milestone evaluation
 */
export interface PerformanceMetrics {
  creatorId: string;
  streams: number;
  sales: number;
  engagement: number;
  customMetrics: Record<string, number>;
  period: 'daily' | 'weekly' | 'monthly';
  timestamp: Date;
}

/**
 * Smart contract ABI for revenue distribution
 */
const REVENUE_DISTRIBUTION_ABI = [
  'function distribute(address[] recipients, uint256[] amounts, address token) external payable',
  'function addCreator(address creator, uint256 sharePercentage) external',
  'function removeCreator(address creator) external',
  'function updateShares(address[] creators, uint256[] shares) external',
  'function setMilestone(string memory name, uint256 threshold, uint256 bonusPercentage) external',
  'function evaluateMilestones(address creator, uint256[] metrics) external view returns (uint256)',
  'function getCreatorShare(address creator) external view returns (uint256)',
  'function getTotalDistributed(address token) external view returns (uint256)',
  'function pause() external',
  'function unpause() external',
  'event Distribution(address indexed token, uint256 totalAmount, address[] recipients, uint256[] amounts)',
  'event CreatorAdded(address indexed creator, uint256 sharePercentage)',
  'event CreatorRemoved(address indexed creator)',
  'event MilestoneAchieved(address indexed creator, string milestone, uint256 bonus)'
];

/**
 * Factory contract ABI for deploying distribution contracts
 */
const FACTORY_ABI = [
  'function deployDistributionContract(address owner, bytes32 salt) external returns (address)',
  'function getDeployedContracts(address owner) external view returns (address[])',
  'function isValidContract(address contractAddress) external view returns (bool)'
];

/**
 * ERC-20 token interface
 */
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

/**
 * Blockchain configuration for supported chains
 */
export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
    currency: 'ETH',
    blockExplorer: 'https://etherscan.io'
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
    currency: 'MATIC',
    blockExplorer: 'https://polygonscan.com'
  },
  8453: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/your-api-key',
    currency: 'ETH',
    blockExplorer: 'https://basescan.org'
  }
};

/**
 * Error classes for smart contract operations
 */
export class SmartContractError extends Error {
  constructor(
    message: string,
    public code: string,
    public txHash?: string
  ) {
    super(message);
    this.name = 'SmartContractError';
  }
}

export class InsufficientFundsError extends SmartContractError {
  constructor(required: string, available: string) {
    super(
      `Insufficient funds: required ${required}, available ${available}`,
      'INSUFFICIENT_FUNDS'
    );
  }
}

export class InvalidCreatorError extends SmartContractError {
  constructor(creatorAddress: string) {
    super(
      `Invalid creator address: ${creatorAddress}`,
      'INVALID_CREATOR'
    );
  }
}

/**
 * Manages smart contract deployment and factory operations
 */
export class ContractDeployer {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private factoryContract: Contract;

  constructor(
    private chainId: number,
    private privateKey: string,
    private factoryAddress: string
  ) {
    const chainConfig = CHAIN_CONFIGS[chainId];
    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    this.provider = new JsonRpcProvider(chainConfig.rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);
    this.factoryContract = new Contract(factoryAddress, FACTORY_ABI, this.wallet);
  }

  /**
   * Deploy a new revenue distribution contract
   */
  async deployContract(config: ContractDeployConfig): Promise<string> {
    try {
      const salt = ethers.randomBytes(32);
      const tx = await this.factoryContract.deployDistributionContract(
        config.initialOwner,
        salt,
        {
          gasLimit: config.gasLimit || '500000'
        }
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id('ContractDeployed(address,address)')
      );

      if (!event) {
        throw new SmartContractError('Contract deployment failed', 'DEPLOYMENT_FAILED', tx.hash);
      }

      const contractAddress = ethers.AbiCoder.defaultAbiCoder().decode(
        ['address'],
        event.data
      )[0];

      return contractAddress;
    } catch (error) {
      throw new SmartContractError(
        `Contract deployment failed: ${error.message}`,
        'DEPLOYMENT_ERROR'
      );
    }
  }

  /**
   * Get deployed contracts for an owner
   */
  async getDeployedContracts(owner: string): Promise<string[]> {
    try {
      return await this.factoryContract.getDeployedContracts(owner);
    } catch (error) {
      throw new SmartContractError(
        `Failed to get deployed contracts: ${error.message}`,
        'QUERY_ERROR'
      );
    }
  }

  /**
   * Verify if a contract is valid
   */
  async isValidContract(contractAddress: string): Promise<boolean> {
    try {
      return await this.factoryContract.isValidContract(contractAddress);
    } catch (error) {
      return false;
    }
  }
}

/**
 * Handles multi-token payment processing
 */
export class TokenHandler {
  private provider: JsonRpcProvider;
  private wallet: Wallet;

  constructor(chainId: number, privateKey: string) {
    const chainConfig = CHAIN_CONFIGS[chainId];
    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    this.provider = new JsonRpcProvider(chainConfig.rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(tokenConfig: TokenConfig, address: string): Promise<string> {
    try {
      if (tokenConfig.isNative) {
        const balance = await this.provider.getBalance(address);
        return formatEther(balance);
      } else {
        const tokenContract = new Contract(tokenConfig.address, ERC20_ABI, this.provider);
        const balance = await tokenContract.balanceOf(address);
        return formatUnits(balance, tokenConfig.decimals);
      }
    } catch (error) {
      throw new SmartContractError(
        `Failed to get token balance: ${error.message}`,
        'BALANCE_ERROR'
      );
    }
  }

  /**
   * Approve token spending for distribution contract
   */
  async approveToken(
    tokenConfig: TokenConfig,
    spender: string,
    amount: string
  ): Promise<string> {
    try {
      if (tokenConfig.isNative) {
        return ''; // Native tokens don't need approval
      }

      const tokenContract = new Contract(tokenConfig.address, ERC20_ABI, this.wallet);
      const amountWei = parseUnits(amount, tokenConfig.decimals);
      
      const tx = await tokenContract.approve(spender, amountWei);
      await tx.wait();
      
      return tx.hash;
    } catch (error) {
      throw new SmartContractError(
        `Token approval failed: ${error.message}`,
        'APPROVAL_ERROR'
      );
    }
  }

  /**
   * Check token allowance
   */
  async checkAllowance(
    tokenConfig: TokenConfig,
    owner: string,
    spender: string
  ): Promise<string> {
    try {
      if (tokenConfig.isNative) {
        return '0';
      }

      const tokenContract = new Contract(tokenConfig.address, ERC20_ABI, this.provider);
      const allowance = await tokenContract.allowance(owner, spender);
      return formatUnits(allowance, tokenConfig.decimals);
    } catch (error) {
      throw new SmartContractError(
        `Failed to check allowance: ${error.message}`,
        'ALLOWANCE_ERROR'
      );
    }
  }

  /**
   * Validate token configuration
   */
  async validateToken(tokenConfig: TokenConfig): Promise<boolean> {
    try {
      if (tokenConfig.isNative) {
        return true;
      }

      const tokenContract = new Contract(tokenConfig.address, ERC20_ABI, this.provider);
      const [symbol, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      return symbol === tokenConfig.symbol && decimals === tokenConfig.decimals;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Tracks and evaluates performance milestones
 */
export class MilestoneTracker {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  /**
   * Store performance metrics
   */
  async storePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('performance_metrics')
        .insert({
          creator_id: metrics.creatorId,
          streams: metrics.streams,
          sales: metrics.sales,
          engagement: metrics.engagement,
          custom_metrics: metrics.customMetrics,
          period: metrics.period,
          timestamp: metrics.timestamp.toISOString()
        });

      if (error) {
        throw new Error(`Failed to store metrics: ${error.message}`);
      }
    } catch (error) {
      throw new SmartContractError(
        `Metrics storage failed: ${error.message}`,
        'STORAGE_ERROR'
      );
    }
  }

  /**
   * Evaluate milestones for a creator
   */
  async evaluateMilestones(
    creatorId: string,
    milestones: PerformanceMilestone[]
  ): Promise<number> {
    try {
      const { data: metrics, error } = await this.supabase
        .from('performance_metrics')
        .select('*')
        .eq('creator_id', creatorId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error || !metrics || metrics.length === 0) {
        return 0;
      }

      const latestMetrics = metrics[0];
      let totalBonus = 0;

      for (const milestone of milestones.filter(m => m.isActive)) {
        const metricValue = this.getMetricValue(latestMetrics, milestone.metric);
        
        if (metricValue >= milestone.threshold) {
          totalBonus += milestone.bonusPercentage;
          
          // Log milestone achievement
          await this.logMilestoneAchievement(creatorId, milestone);
        }
      }

      return totalBonus;
    } catch (error) {
      throw new SmartContractError(
        `Milestone evaluation failed: ${error.message}`,
        'EVALUATION_ERROR'
      );
    }
  }

  /**
   * Get metric value based on type
   */
  private getMetricValue(metrics: any, metricType: string): number {
    switch (metricType) {
      case 'streams':
        return metrics.streams || 0;
      case 'sales':
        return metrics.sales || 0;
      case 'engagement':
        return metrics.engagement || 0;
      case 'custom':
        return Object.values(metrics.custom_metrics || {}).reduce((sum: number, val: any) => sum + (val || 0), 0);
      default:
        return 0;
    }
  }

  /**
   * Log milestone achievement
   */
  private async logMilestoneAchievement(
    creatorId: string,
    milestone: PerformanceMilestone
  ): Promise<void> {
    await this.supabase
      .from('milestone_achievements')
      .insert({
        creator_id: creatorId,
        milestone_id: milestone.id,
        milestone_name: milestone.name,
        bonus_percentage: milestone.bonusPercentage,
        achieved_at: new Date().toISOString()
      });
  }
}

/**
 * Processes revenue distribution payments
 */
export class PaymentProcessor {
  private tokenHandler: TokenHandler;
  private milestoneTracker: MilestoneTracker;

  constructor(
    private chainId: number,
    private privateKey: string
  ) {
    this.tokenHandler = new TokenHandler(chainId, privateKey);
    this.milestoneTracker = new MilestoneTracker();
  }

  /**
   * Calculate distribution amounts with milestone bonuses
   */
  async calculateDistribution(
    totalAmount: string,
    distributionRule: DistributionRule
  ): Promise<PaymentRecipient[]> {
    const recipients: PaymentRecipient[] = [];
    const totalShares = distributionRule.creators
      .filter(c => c.isActive)
      .reduce((sum, c) => sum + c.sharePercentage, 0);

    if (totalShares !== 100) {
      throw new SmartContractError(
        `Invalid total shares: ${totalShares}%. Must equal 100%`,
        'INVALID_SHARES'
      );
    }

    const totalAmountBigInt = parseEther(totalAmount);

    for (const creator of distributionRule.creators.filter(c => c.isActive)) {
      const milestoneBonus = await this.milestoneTracker.evaluateMilestones(
        creator.id,
        distributionRule.milestones
      );

      const effectiveShare = creator.sharePercentage + (creator.sharePercentage * milestoneBonus / 100);
      const amount = (totalAmountBigInt * BigInt(Math.floor(effectiveShare * 100))) / BigInt(10000);

      recipients.push({
        creatorId: creator.id,
        walletAddress: creator.walletAddress,
        amount: formatEther(amount),
        sharePercentage: creator.sharePercentage,
        milestoneBonus
      });
    }

    return recipients;
  }

  /**
   * Validate payment recipients
   */
  validateRecipients(recipients: PaymentRecipient[]): void {
    for (const recipient of recipients) {
      if (!ethers.isAddress(recipient.walletAddress)) {
        throw new InvalidCreatorError(recipient.walletAddress);
      }

      const amount = parseEther(recipient.amount);
      if (amount <= 0) {
        throw new SmartContractError(
          `Invalid amount for creator ${recipient.creatorId}: ${recipient.amount}`,
          'INVALID_AMOUNT'
        );
      }
    }
  }

  /**
   * Check if distribution is possible
   */
  async validateDistribution(
    totalAmount: string,
    tokenConfig: TokenConfig,
    payerAddress: string
  ): Promise<void> {
    const balance = await this.tokenHandler.getTokenBalance(tokenConfig, payerAddress);
    const balanceBigInt = parseEther(balance);
    const requiredBigInt = parseEther(totalAmount);

    if (balanceBigInt < requiredBigInt) {
      throw new InsufficientFundsError(totalAmount, balance);
    }
  }
}

/**
 * Main revenue distribution manager
 */
export class RevenueDistributor {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private paymentProcessor: PaymentProcessor;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  constructor(
    private chainId: number,
    private privateKey: string
  ) {
    const chainConfig = CHAIN_CONFIGS[chainId];
    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    this.provider = new JsonRpcProvider(chainConfig.rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);
    this.paymentProcessor = new PaymentProcessor(chainId, privateKey);
  }

  /**
   * Execute revenue distribution
   */
  async distribute(
    contractAddress: string,
    totalAmount: string,
    tokenConfig: TokenConfig,
    distributionRule: DistributionRule
  ): Promise<PaymentTransaction> {
    try {
      // Validate contract
      const contract = new Contract(contractAddress, REVENUE_DISTRIBUTION_ABI, this.wallet);
      
      // Calculate distribution
      const recipients = await this.paymentProcessor.calculateDistribution(
        totalAmount,
        distributionRule
      );

      // Validate recipients and amounts
      this.paymentProcessor.validateRecipients(recipients);
      await this.paymentProcessor.validateDistribution(
        totalAmount,
        tokenConfig,
        this.wallet.address
      );

      // Prepare contract call parameters
      const addresses = recipients.map(r => r.walletAddress);
      const amounts = recipients.map(r => parseEther(r.amount));
      
      // Execute distribution
      const tx = await contract.distribute(
        addresses,
        amounts,
        tokenConfig.isNative ? ethers.ZeroAddress : tokenConfig.address,
        {
          value: tokenConfig.isNative ? parseEther(totalAmount) : 0,
          gasLimit: '300000'
        }
      );

      const receipt = await tx.wait();
      
      // Create payment transaction record
      const paymentTransaction: PaymentTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        timestamp: new Date(),
        token: tokenConfig,
        amount: totalAmount,
        recipients,
        status: 'confirmed',
        gasUsed: receipt.gasUsed.toString()
      };

      // Store transaction history
      await this.storePaymentHistory(paymentTransaction);

      return paymentTransaction;
    } catch (error) {
      throw new SmartContractError(
        `Distribution failed: ${error.message}`,
        'DISTRIBUTION_ERROR',
        error.hash
      );
    }
  }

  /**
   * Store payment transaction history
   */
  private async storePaymentHistory(transaction: PaymentTransaction): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('payment_history')
        .insert({
          id: transaction.id,
          tx_hash: transaction.txHash,
          block_number: transaction.blockNumber,
          timestamp: transaction.timestamp.toISOString(),
          token_address: transaction.token.address,
          token_symbol: transaction.token.symbol,
          total_amount: transaction.amount,
          recipients: transaction.recipients,
          status: transaction.status,
          gas_used: transaction.gasUsed,
          chain_id: this.chainId
        });

      if (error) {
        console.error('Failed to store payment history:', error);
      }
    } catch (error) {