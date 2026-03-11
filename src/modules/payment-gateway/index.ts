import { EventEmitter } from 'events';

/**
 * Supported blockchain networks
 */
export enum BlockchainNetwork {
  BITCOIN = 'bitcoin',
  ETHEREUM = 'ethereum',
  BINANCE_SMART_CHAIN = 'bsc',
  POLYGON = 'polygon',
  AVALANCHE = 'avalanche',
  SOLANA = 'solana',
  CARDANO = 'cardano'
}

/**
 * Supported cryptocurrencies
 */
export enum CryptoCurrency {
  BTC = 'BTC',
  ETH = 'ETH',
  BNB = 'BNB',
  MATIC = 'MATIC',
  AVAX = 'AVAX',
  SOL = 'SOL',
  ADA = 'ADA',
  USDT = 'USDT',
  USDC = 'USDC',
  DAI = 'DAI'
}

/**
 * Payment status enumeration
 */
export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

/**
 * DeFi protocol types
 */
export enum DeFiProtocol {
  UNISWAP = 'uniswap',
  PANCAKESWAP = 'pancakeswap',
  SUSHISWAP = 'sushiswap',
  COMPOUND = 'compound',
  AAVE = 'aave',
  CURVE = 'curve'
}

/**
 * Wallet connection types
 */
export enum WalletType {
  METAMASK = 'metamask',
  WALLET_CONNECT = 'walletconnect',
  COINBASE = 'coinbase',
  PHANTOM = 'phantom',
  TRUST_WALLET = 'trustwallet'
}

/**
 * Transaction data interface
 */
export interface Transaction {
  id: string;
  hash?: string;
  from: string;
  to: string;
  amount: string;
  currency: CryptoCurrency;
  network: BlockchainNetwork;
  status: PaymentStatus;
  gasPrice?: string;
  gasLimit?: string;
  fee?: string;
  timestamp: Date;
  confirmations?: number;
  blockNumber?: number;
  metadata?: Record<string, any>;
}

/**
 * Payment request interface
 */
export interface PaymentRequest {
  amount: string;
  currency: CryptoCurrency;
  recipient: string;
  network?: BlockchainNetwork;
  memo?: string;
  expiresAt?: Date;
  autoConvert?: boolean;
  targetCurrency?: CryptoCurrency;
  gasPrice?: 'slow' | 'standard' | 'fast';
  useSmartContract?: boolean;
  contractAddress?: string;
  defiProtocol?: DeFiProtocol;
}

/**
 * Wallet connection interface
 */
export interface WalletConnection {
  address: string;
  network: BlockchainNetwork;
  balance: Record<CryptoCurrency, string>;
  isConnected: boolean;
  walletType: WalletType;
  chainId: number;
}

/**
 * Currency conversion rate interface
 */
export interface ConversionRate {
  from: CryptoCurrency;
  to: CryptoCurrency;
  rate: number;
  timestamp: Date;
  provider: string;
}

/**
 * Smart contract configuration
 */
export interface SmartContractConfig {
  address: string;
  abi: any[];
  network: BlockchainNetwork;
  gasLimit: number;
  gasPrice?: string;
}

/**
 * DeFi protocol configuration
 */
export interface DeFiProtocolConfig {
  protocol: DeFiProtocol;
  network: BlockchainNetwork;
  routerAddress: string;
  factoryAddress?: string;
  wethAddress?: string;
  fees: {
    swapFee: number;
    liquidityFee: number;
  };
}

/**
 * Payment gateway configuration
 */
export interface PaymentGatewayConfig {
  supportedNetworks: BlockchainNetwork[];
  supportedCurrencies: CryptoCurrency[];
  defaultNetwork: BlockchainNetwork;
  rpcEndpoints: Record<BlockchainNetwork, string>;
  apiKeys: {
    infura?: string;
    alchemy?: string;
    moralis?: string;
    coinbase?: string;
  };
  smartContracts: Record<string, SmartContractConfig>;
  defiProtocols: Record<DeFiProtocol, DeFiProtocolConfig>;
  fees: {
    processingFee: number;
    conversionFee: number;
    networkFees: Record<BlockchainNetwork, string>;
  };
  security: {
    enableMultiSig: boolean;
    confirmationsRequired: Record<BlockchainNetwork, number>;
    maxTransactionAmount: Record<CryptoCurrency, string>;
  };
}

/**
 * Payment gateway events
 */
export interface PaymentGatewayEvents {
  paymentInitiated: (transaction: Transaction) => void;
  paymentConfirmed: (transaction: Transaction) => void;
  paymentFailed: (transaction: Transaction, error: Error) => void;
  walletConnected: (wallet: WalletConnection) => void;
  walletDisconnected: (address: string) => void;
  currencyConverted: (from: CryptoCurrency, to: CryptoCurrency, amount: string) => void;
  smartContractExecuted: (contractAddress: string, transaction: Transaction) => void;
  defiSwapCompleted: (protocol: DeFiProtocol, transaction: Transaction) => void;
}

/**
 * Address validation utility
 */
class AddressValidator {
  /**
   * Validates cryptocurrency address format
   * @param address - Address to validate
   * @param network - Blockchain network
   * @returns True if address is valid
   */
  static validateAddress(address: string, network: BlockchainNetwork): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }

    switch (network) {
      case BlockchainNetwork.BITCOIN:
        return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(address);
      case BlockchainNetwork.ETHEREUM:
      case BlockchainNetwork.BINANCE_SMART_CHAIN:
      case BlockchainNetwork.POLYGON:
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case BlockchainNetwork.SOLANA:
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      case BlockchainNetwork.CARDANO:
        return /^addr1[a-z0-9]{58}$|^[a-zA-Z0-9]{103}$/.test(address);
      default:
        return false;
    }
  }

  /**
   * Validates and normalizes address
   * @param address - Address to normalize
   * @param network - Blockchain network
   * @returns Normalized address or throws error
   */
  static normalizeAddress(address: string, network: BlockchainNetwork): string {
    if (!this.validateAddress(address, network)) {
      throw new Error(`Invalid address format for ${network}: ${address}`);
    }

    switch (network) {
      case BlockchainNetwork.ETHEREUM:
      case BlockchainNetwork.BINANCE_SMART_CHAIN:
      case BlockchainNetwork.POLYGON:
        return address.toLowerCase();
      default:
        return address;
    }
  }
}

/**
 * Gas fee estimation utility
 */
class GasFeeEstimator {
  /**
   * Estimates gas fees for different speed levels
   * @param network - Blockchain network
   * @param transactionType - Type of transaction
   * @returns Gas fee estimates
   */
  static async estimateGasFees(
    network: BlockchainNetwork,
    transactionType: 'transfer' | 'contract' | 'swap' = 'transfer'
  ): Promise<{ slow: string; standard: string; fast: string }> {
    const baseGasLimits = {
      transfer: 21000,
      contract: 150000,
      swap: 300000
    };

    const gasLimit = baseGasLimits[transactionType];

    switch (network) {
      case BlockchainNetwork.ETHEREUM:
        return {
          slow: (gasLimit * 20e9).toString(),
          standard: (gasLimit * 40e9).toString(),
          fast: (gasLimit * 80e9).toString()
        };
      case BlockchainNetwork.BINANCE_SMART_CHAIN:
        return {
          slow: (gasLimit * 5e9).toString(),
          standard: (gasLimit * 10e9).toString(),
          fast: (gasLimit * 20e9).toString()
        };
      case BlockchainNetwork.POLYGON:
        return {
          slow: (gasLimit * 30e9).toString(),
          standard: (gasLimit * 50e9).toString(),
          fast: (gasLimit * 100e9).toString()
        };
      default:
        return {
          slow: '0',
          standard: '0',
          fast: '0'
        };
    }
  }
}

/**
 * Blockchain service for network interactions
 */
class BlockchainService {
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  /**
   * Gets account balance for specified currency
   * @param address - Wallet address
   * @param currency - Currency to check
   * @param network - Blockchain network
   * @returns Balance as string
   */
  async getBalance(
    address: string,
    currency: CryptoCurrency,
    network: BlockchainNetwork
  ): Promise<string> {
    try {
      AddressValidator.normalizeAddress(address, network);

      switch (network) {
        case BlockchainNetwork.BITCOIN:
          return this.getBitcoinBalance(address);
        case BlockchainNetwork.ETHEREUM:
        case BlockchainNetwork.BINANCE_SMART_CHAIN:
        case BlockchainNetwork.POLYGON:
          return this.getEVMBalance(address, currency, network);
        case BlockchainNetwork.SOLANA:
          return this.getSolanaBalance(address, currency);
        default:
          throw new Error(`Unsupported network: ${network}`);
      }
    } catch (error) {
      throw new Error(`Failed to get balance: ${error}`);
    }
  }

  /**
   * Sends transaction on specified network
   * @param transaction - Transaction data
   * @returns Transaction hash
   */
  async sendTransaction(transaction: Transaction): Promise<string> {
    try {
      switch (transaction.network) {
        case BlockchainNetwork.BITCOIN:
          return this.sendBitcoinTransaction(transaction);
        case BlockchainNetwork.ETHEREUM:
        case BlockchainNetwork.BINANCE_SMART_CHAIN:
        case BlockchainNetwork.POLYGON:
          return this.sendEVMTransaction(transaction);
        case BlockchainNetwork.SOLANA:
          return this.sendSolanaTransaction(transaction);
        default:
          throw new Error(`Unsupported network: ${transaction.network}`);
      }
    } catch (error) {
      throw new Error(`Failed to send transaction: ${error}`);
    }
  }

  private async getBitcoinBalance(address: string): Promise<string> {
    // Bitcoin Core RPC implementation
    return '0';
  }

  private async getEVMBalance(
    address: string,
    currency: CryptoCurrency,
    network: BlockchainNetwork
  ): Promise<string> {
    // Web3/Ethers implementation
    return '0';
  }

  private async getSolanaBalance(address: string, currency: CryptoCurrency): Promise<string> {
    // Solana Web3 implementation
    return '0';
  }

  private async sendBitcoinTransaction(transaction: Transaction): Promise<string> {
    // Bitcoin transaction implementation
    return 'btc_tx_hash';
  }

  private async sendEVMTransaction(transaction: Transaction): Promise<string> {
    // EVM transaction implementation
    return '0x' + '0'.repeat(64);
  }

  private async sendSolanaTransaction(transaction: Transaction): Promise<string> {
    // Solana transaction implementation
    return 'sol_tx_hash';
  }
}

/**
 * Smart contract service for contract interactions
 */
class SmartContractService {
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  /**
   * Executes smart contract function
   * @param contractAddress - Contract address
   * @param functionName - Function to call
   * @param parameters - Function parameters
   * @param network - Blockchain network
   * @returns Transaction hash
   */
  async executeContract(
    contractAddress: string,
    functionName: string,
    parameters: any[],
    network: BlockchainNetwork
  ): Promise<string> {
    try {
      const contract = this.config.smartContracts[contractAddress];
      if (!contract) {
        throw new Error(`Contract not found: ${contractAddress}`);
      }

      // Implementation would use Web3/Ethers for contract execution
      return '0x' + '0'.repeat(64);
    } catch (error) {
      throw new Error(`Failed to execute contract: ${error}`);
    }
  }

  /**
   * Reads data from smart contract
   * @param contractAddress - Contract address
   * @param functionName - Function to call
   * @param parameters - Function parameters
   * @param network - Blockchain network
   * @returns Contract data
   */
  async readContract(
    contractAddress: string,
    functionName: string,
    parameters: any[],
    network: BlockchainNetwork
  ): Promise<any> {
    try {
      const contract = this.config.smartContracts[contractAddress];
      if (!contract) {
        throw new Error(`Contract not found: ${contractAddress}`);
      }

      // Implementation would use Web3/Ethers for contract reading
      return null;
    } catch (error) {
      throw new Error(`Failed to read contract: ${error}`);
    }
  }
}

/**
 * DeFi protocol service for protocol interactions
 */
class DeFiProtocolService {
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  /**
   * Performs token swap on DeFi protocol
   * @param protocol - DeFi protocol to use
   * @param fromToken - Token to swap from
   * @param toToken - Token to swap to
   * @param amount - Amount to swap
   * @param slippage - Maximum slippage tolerance
   * @param network - Blockchain network
   * @returns Transaction hash
   */
  async swapTokens(
    protocol: DeFiProtocol,
    fromToken: CryptoCurrency,
    toToken: CryptoCurrency,
    amount: string,
    slippage: number = 0.5,
    network: BlockchainNetwork
  ): Promise<string> {
    try {
      const protocolConfig = this.config.defiProtocols[protocol];
      if (!protocolConfig || protocolConfig.network !== network) {
        throw new Error(`Protocol ${protocol} not supported on ${network}`);
      }

      // Implementation would interact with DeFi protocol contracts
      return '0x' + '0'.repeat(64);
    } catch (error) {
      throw new Error(`Failed to swap tokens: ${error}`);
    }
  }

  /**
   * Gets best swap rate from multiple protocols
   * @param fromToken - Token to swap from
   * @param toToken - Token to swap to
   * @param amount - Amount to swap
   * @param network - Blockchain network
   * @returns Best rate and protocol
   */
  async getBestSwapRate(
    fromToken: CryptoCurrency,
    toToken: CryptoCurrency,
    amount: string,
    network: BlockchainNetwork
  ): Promise<{ protocol: DeFiProtocol; rate: number; estimatedGas: string }> {
    try {
      const supportedProtocols = Object.entries(this.config.defiProtocols)
        .filter(([, config]) => config.network === network)
        .map(([protocol]) => protocol as DeFiProtocol);

      let bestRate = 0;
      let bestProtocol = supportedProtocols[0];
      let estimatedGas = '0';

      for (const protocol of supportedProtocols) {
        const rate = await this.getSwapRate(protocol, fromToken, toToken, amount);
        if (rate > bestRate) {
          bestRate = rate;
          bestProtocol = protocol;
        }
      }

      return { protocol: bestProtocol, rate: bestRate, estimatedGas };
    } catch (error) {
      throw new Error(`Failed to get best swap rate: ${error}`);
    }
  }

  private async getSwapRate(
    protocol: DeFiProtocol,
    fromToken: CryptoCurrency,
    toToken: CryptoCurrency,
    amount: string
  ): Promise<number> {
    // Implementation would query protocol for swap rates
    return 1.0;
  }
}

/**
 * Payment processor for handling payment flows
 */
class PaymentProcessor {
  private config: PaymentGatewayConfig;
  private blockchainService: BlockchainService;
  private smartContractService: SmartContractService;
  private defiService: DeFiProtocolService;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
    this.blockchainService = new BlockchainService(config);
    this.smartContractService = new SmartContractService(config);
    this.defiService = new DeFiProtocolService(config);
  }

  /**
   * Processes payment request
   * @param request - Payment request
   * @param walletConnection - Connected wallet
   * @returns Transaction data
   */
  async processPayment(
    request: PaymentRequest,
    walletConnection: WalletConnection
  ): Promise<Transaction> {
    try {
      const transaction: Transaction = {
        id: this.generateTransactionId(),
        from: walletConnection.address,
        to: request.recipient,
        amount: request.amount,
        currency: request.currency,
        network: request.network || this.config.defaultNetwork,
        status: PaymentStatus.PENDING,
        timestamp: new Date()
      };

      // Validate recipient address
      AddressValidator.normalizeAddress(transaction.to, transaction.network);

      // Check balance
      const balance = await this.blockchainService.getBalance(
        transaction.from,
        transaction.currency,
        transaction.network
      );

      if (parseFloat(balance) < parseFloat(transaction.amount)) {
        throw new Error('Insufficient balance');
      }

      // Handle auto conversion if needed
      if (request.autoConvert && request.targetCurrency) {
        await this.handleAutoConversion(transaction, request.targetCurrency);
      }

      // Estimate gas fees
      const gasEstimates = await GasFeeEstimator.estimateGasFees(
        transaction.network,
        request.useSmartContract ? 'contract' : 'transfer'
      );
      transaction.gasPrice = gasEstimates[request.gasPrice || 'standard'];

      // Process through smart contract if specified
      if (request.useSmartContract && request.contractAddress) {
        transaction.hash = await this.smartContractService.executeContract(
          request.contractAddress,
          'transfer',
          [transaction.to, transaction.amount],
          transaction.network
        );
      } else {
        transaction.hash = await this.blockchainService.sendTransaction(transaction);
      }

      transaction.status = PaymentStatus.CONFIRMED;
      return transaction;
    } catch (error) {
      throw new Error(`Payment processing failed: ${error}`);
    }
  }

  private async handleAutoConversion(
    transaction: Transaction,
    targetCurrency: CryptoCurrency
  ): Promise<void> {
    if (transaction.currency === targetCurrency) {
      return;
    }

    const bestRate = await this.defiService.getBestSwapRate(
      transaction.currency,
      targetCurrency,
      transaction.amount,
      transaction.network
    );

    await this.defiService.swapTokens(
      bestRate.protocol,
      transaction.currency,
      targetCurrency,
      transaction.amount,
      0.5,
      transaction.network
    );

    transaction.currency = targetCurrency;
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Multi-blockchain payment gateway
 */
export class MultiBlockchainPaymentGateway extends EventEmitter {
  private config: PaymentGatewayConfig;
  private paymentProcessor: PaymentProcessor;
  private connectedWallets: Map<string, WalletConnection> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private conversionRates: Map<string, ConversionRate> = new Map();

  constructor(config: PaymentGatewayConfig) {
    super();
    this.config = config;
    this.paymentProcessor = new PaymentProcessor(config);
    this.startConversionRateUpdates();
  }

  /**
   * Initializes the payment gateway
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConversionRates();
      this.emit('gatewayInitialized');
    } catch (error) {
      throw new Error(`Failed to initialize payment gateway: ${error}`);
    }
  }

  /**
   * Connects wallet to the gateway
   * @param walletType - Type of wallet to connect
   * @param network - Blockchain network
   * @returns Wallet connection data
   */
  async connectWallet(
    walletType: WalletType,
    network: BlockchainNetwork
  ): Promise<WalletConnection> {
    try {
      // Implementation would integrate with wallet providers
      const connection: WalletConnection = {
        address: '0x' + '0'.repeat(40),
        network,
        balance: {} as Record<CryptoCurrency, string>,
        isConnected: true,
        walletType,
        chainId: this.getChainId(network)
      };

      // Load balances for supported currencies
      for (const currency of this.config.supportedCurrencies) {
        try {
          connection.balance[currency] = await this.paymentProcessor['blockchainService'].getBalance(
            connection.address,
            currency,
            network
          );
        } catch {
          connection.balance[currency] = '0';
        }
      }

      this.connectedWallets.set(connection.address, connection);
      this.emit('walletConnected', connection);

      return connection;
    } catch (error) {
      throw new Error(`Failed to connect wallet: ${error}`);
    }
  }

  /**
   * Disconnects wallet from the gateway
   *