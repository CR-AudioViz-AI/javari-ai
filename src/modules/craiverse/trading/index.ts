/**
 * @fileoverview CRAIverse Virtual Asset Trading Engine
 * @version 1.0.0
 * @author CR AudioViz AI Platform
 */

import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ethers, BigNumber } from 'ethers';
import WebSocket from 'ws';
import axios, { AxiosInstance } from 'axios';

/**
 * Asset types supported by the trading engine
 */
export enum AssetType {
  NFT = 'nft',
  VIRTUAL_REAL_ESTATE = 'virtual_real_estate',
  DIGITAL_COLLECTIBLE = 'digital_collectible',
  UTILITY_TOKEN = 'utility_token',
  GOVERNANCE_TOKEN = 'governance_token'
}

/**
 * Order types for trading
 */
export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP = 'stop',
  AUCTION = 'auction'
}

/**
 * Order status enumeration
 */
export enum OrderStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

/**
 * Blockchain networks supported
 */
export enum BlockchainNetwork {
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  SOLANA = 'solana',
  ARBITRUM = 'arbitrum'
}

/**
 * Virtual asset interface
 */
export interface VirtualAsset {
  id: string;
  contractAddress: string;
  tokenId: string;
  name: string;
  description: string;
  image: string;
  metadata: Record<string, any>;
  type: AssetType;
  network: BlockchainNetwork;
  owner: string;
  creator: string;
  royalties: number;
  isListed: boolean;
  currentPrice?: string;
  lastSalePrice?: string;
  rarity?: number;
  attributes?: AssetAttribute[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Asset attribute interface
 */
export interface AssetAttribute {
  trait_type: string;
  value: string | number;
  rarity?: number;
}

/**
 * Trading order interface
 */
export interface TradingOrder {
  id: string;
  userId: string;
  assetId: string;
  type: OrderType;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  status: OrderStatus;
  expiresAt?: Date;
  filledQuantity: string;
  remainingQuantity: string;
  network: BlockchainNetwork;
  gasPrice?: string;
  signature?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Market data interface
 */
export interface MarketData {
  assetId: string;
  price: string;
  volume24h: string;
  change24h: number;
  high24h: string;
  low24h: string;
  marketCap: string;
  floorPrice?: string;
  totalSupply?: string;
  holders?: number;
  timestamp: Date;
}

/**
 * User portfolio interface
 */
export interface UserPortfolio {
  userId: string;
  assets: PortfolioAsset[];
  totalValue: string;
  totalCost: string;
  unrealizedPnL: string;
  realizedPnL: string;
  performance24h: number;
  updatedAt: Date;
}

/**
 * Portfolio asset interface
 */
export interface PortfolioAsset {
  assetId: string;
  quantity: string;
  averageCost: string;
  currentValue: string;
  unrealizedPnL: string;
  allocation: number;
}

/**
 * Liquidity pool interface
 */
export interface LiquidityPool {
  id: string;
  assetA: string;
  assetB: string;
  reserveA: string;
  reserveB: string;
  totalLiquidity: string;
  fee: number;
  apr: number;
  volume24h: string;
  network: BlockchainNetwork;
  contractAddress: string;
}

/**
 * Trading configuration interface
 */
export interface TradingConfig {
  supabaseUrl: string;
  supabaseKey: string;
  ethereumRpcUrl: string;
  polygonRpcUrl: string;
  solanaRpcUrl: string;
  ipfsGateway: string;
  websocketUrl: string;
  maxOrderSize: string;
  minOrderSize: string;
  tradingFee: number;
  maxSlippage: number;
  orderExpiry: number;
}

/**
 * Wallet connection interface
 */
export interface WalletConnection {
  address: string;
  network: BlockchainNetwork;
  balance: string;
  provider: any;
  signer?: any;
}

/**
 * Risk assessment interface
 */
export interface RiskAssessment {
  riskScore: number;
  liquidityRisk: number;
  volatilityRisk: number;
  counterpartyRisk: number;
  technicalRisk: number;
  recommendations: string[];
}

/**
 * CRAIverse Virtual Asset Trading Engine
 * Comprehensive trading platform for virtual assets including NFTs, virtual real estate, and digital collectibles
 */
export class CRAIverseTradingEngine extends EventEmitter {
  private supabase: SupabaseClient;
  private providers: Map<BlockchainNetwork, ethers.providers.Provider> = new Map();
  private websocket?: WebSocket;
  private httpClient: AxiosInstance;
  private orderBook: Map<string, TradingOrder[]> = new Map();
  private marketData: Map<string, MarketData> = new Map();
  private liquidityPools: Map<string, LiquidityPool> = new Map();
  private walletConnection?: WalletConnection;
  private isInitialized = false;

  constructor(private config: TradingConfig) {
    super();
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    this.initializeProviders();
  }

  /**
   * Initialize blockchain providers
   */
  private initializeProviders(): void {
    try {
      this.providers.set(
        BlockchainNetwork.ETHEREUM,
        new ethers.providers.JsonRpcProvider(this.config.ethereumRpcUrl)
      );
      this.providers.set(
        BlockchainNetwork.POLYGON,
        new ethers.providers.JsonRpcProvider(this.config.polygonRpcUrl)
      );
      // Solana provider would be handled differently
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize providers: ${error}`));
    }
  }

  /**
   * Initialize the trading engine
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadMarketData();
      await this.loadLiquidityPools();
      this.initializeWebSocket();
      this.startMarketMaker();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize trading engine: ${error}`);
    }
  }

  /**
   * Connect user wallet
   */
  public async connectWallet(
    provider: any,
    network: BlockchainNetwork
  ): Promise<WalletConnection> {
    try {
      if (!provider) {
        throw new Error('Wallet provider not available');
      }

      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);

      this.walletConnection = {
        address,
        network,
        balance: ethers.utils.formatEther(balance),
        provider,
        signer
      };

      this.emit('walletConnected', this.walletConnection);
      return this.walletConnection;
    } catch (error) {
      throw new Error(`Failed to connect wallet: ${error}`);
    }
  }

  /**
   * Load market data from database
   */
  private async loadMarketData(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('market_data')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      data?.forEach(item => {
        this.marketData.set(item.asset_id, {
          assetId: item.asset_id,
          price: item.price,
          volume24h: item.volume_24h,
          change24h: item.change_24h,
          high24h: item.high_24h,
          low24h: item.low_24h,
          marketCap: item.market_cap,
          floorPrice: item.floor_price,
          totalSupply: item.total_supply,
          holders: item.holders,
          timestamp: new Date(item.timestamp)
        });
      });
    } catch (error) {
      throw new Error(`Failed to load market data: ${error}`);
    }
  }

  /**
   * Load liquidity pools
   */
  private async loadLiquidityPools(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('liquidity_pools')
        .select('*');

      if (error) throw error;

      data?.forEach(pool => {
        this.liquidityPools.set(pool.id, {
          id: pool.id,
          assetA: pool.asset_a,
          assetB: pool.asset_b,
          reserveA: pool.reserve_a,
          reserveB: pool.reserve_b,
          totalLiquidity: pool.total_liquidity,
          fee: pool.fee,
          apr: pool.apr,
          volume24h: pool.volume_24h,
          network: pool.network,
          contractAddress: pool.contract_address
        });
      });
    } catch (error) {
      throw new Error(`Failed to load liquidity pools: ${error}`);
    }
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  private initializeWebSocket(): void {
    try {
      this.websocket = new WebSocket(this.config.websocketUrl);

      this.websocket.on('open', () => {
        this.emit('websocketConnected');
        this.websocket?.send(JSON.stringify({
          action: 'subscribe',
          channels: ['market_data', 'orders', 'trades']
        }));
      });

      this.websocket.on('message', (data) => {
        this.handleWebSocketMessage(JSON.parse(data.toString()));
      });

      this.websocket.on('error', (error) => {
        this.emit('websocketError', error);
      });
    } catch (error) {
      this.emit('error', new Error(`WebSocket initialization failed: ${error}`));
    }
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    try {
      switch (message.type) {
        case 'market_data':
          this.updateMarketData(message.data);
          break;
        case 'order_update':
          this.updateOrderStatus(message.data);
          break;
        case 'trade':
          this.processTrade(message.data);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      this.emit('error', new Error(`WebSocket message handling error: ${error}`));
    }
  }

  /**
   * Update market data from WebSocket
   */
  private updateMarketData(data: any): void {
    const marketData: MarketData = {
      assetId: data.asset_id,
      price: data.price,
      volume24h: data.volume_24h,
      change24h: data.change_24h,
      high24h: data.high_24h,
      low24h: data.low_24h,
      marketCap: data.market_cap,
      floorPrice: data.floor_price,
      totalSupply: data.total_supply,
      holders: data.holders,
      timestamp: new Date()
    };

    this.marketData.set(data.asset_id, marketData);
    this.emit('marketDataUpdate', marketData);
  }

  /**
   * Create a new trading order
   */
  public async createOrder(orderData: Partial<TradingOrder>): Promise<TradingOrder> {
    try {
      if (!this.walletConnection) {
        throw new Error('Wallet not connected');
      }

      // Validate order
      await this.validateOrder(orderData);

      // Risk assessment
      const riskAssessment = await this.assessRisk(orderData);
      if (riskAssessment.riskScore > 0.8) {
        throw new Error('Order exceeds risk tolerance');
      }

      const order: TradingOrder = {
        id: this.generateOrderId(),
        userId: this.walletConnection.address,
        assetId: orderData.assetId!,
        type: orderData.type!,
        side: orderData.side!,
        quantity: orderData.quantity!,
        price: orderData.price!,
        status: OrderStatus.PENDING,
        expiresAt: orderData.expiresAt,
        filledQuantity: '0',
        remainingQuantity: orderData.quantity!,
        network: orderData.network!,
        gasPrice: orderData.gasPrice,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Sign order
      order.signature = await this.signOrder(order);

      // Store order in database
      const { error } = await this.supabase
        .from('trading_orders')
        .insert([{
          id: order.id,
          user_id: order.userId,
          asset_id: order.assetId,
          type: order.type,
          side: order.side,
          quantity: order.quantity,
          price: order.price,
          status: order.status,
          expires_at: order.expiresAt?.toISOString(),
          filled_quantity: order.filledQuantity,
          remaining_quantity: order.remainingQuantity,
          network: order.network,
          gas_price: order.gasPrice,
          signature: order.signature,
          created_at: order.createdAt.toISOString(),
          updated_at: order.updatedAt.toISOString()
        }]);

      if (error) throw error;

      // Add to order book
      this.addToOrderBook(order);

      // Attempt to match order
      await this.matchOrder(order);

      this.emit('orderCreated', order);
      return order;
    } catch (error) {
      throw new Error(`Failed to create order: ${error}`);
    }
  }

  /**
   * Validate trading order
   */
  private async validateOrder(orderData: Partial<TradingOrder>): Promise<void> {
    if (!orderData.assetId) throw new Error('Asset ID required');
    if (!orderData.type) throw new Error('Order type required');
    if (!orderData.side) throw new Error('Order side required');
    if (!orderData.quantity) throw new Error('Quantity required');
    if (!orderData.price) throw new Error('Price required');
    if (!orderData.network) throw new Error('Network required');

    const quantity = parseFloat(orderData.quantity);
    const price = parseFloat(orderData.price);
    const minSize = parseFloat(this.config.minOrderSize);
    const maxSize = parseFloat(this.config.maxOrderSize);

    if (quantity < minSize) {
      throw new Error(`Order size below minimum: ${minSize}`);
    }
    if (quantity > maxSize) {
      throw new Error(`Order size exceeds maximum: ${maxSize}`);
    }
    if (price <= 0) {
      throw new Error('Price must be positive');
    }

    // Check asset exists
    const asset = await this.getAsset(orderData.assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    // Check wallet balance for buy orders
    if (orderData.side === 'buy' && this.walletConnection) {
      const totalCost = quantity * price;
      const balance = parseFloat(this.walletConnection.balance);
      if (totalCost > balance) {
        throw new Error('Insufficient balance');
      }
    }
  }

  /**
   * Assess trading risk
   */
  private async assessRisk(orderData: Partial<TradingOrder>): Promise<RiskAssessment> {
    try {
      const asset = await this.getAsset(orderData.assetId!);
      const marketData = this.marketData.get(orderData.assetId!);

      let riskScore = 0;
      let liquidityRisk = 0;
      let volatilityRisk = 0;
      let counterpartyRisk = 0;
      let technicalRisk = 0;

      const recommendations: string[] = [];

      // Liquidity risk assessment
      if (marketData) {
        const volume = parseFloat(marketData.volume24h);
        const orderSize = parseFloat(orderData.quantity!) * parseFloat(orderData.price!);
        if (orderSize > volume * 0.1) {
          liquidityRisk = 0.8;
          recommendations.push('Large order relative to volume - consider splitting');
        }
      }

      // Volatility risk assessment
      if (marketData && marketData.change24h) {
        const volatility = Math.abs(marketData.change24h);
        if (volatility > 20) {
          volatilityRisk = 0.7;
          recommendations.push('High volatility detected - use limit orders');
        }
      }

      // Technical risk assessment
      if (orderData.network === BlockchainNetwork.ETHEREUM) {
        const provider = this.providers.get(BlockchainNetwork.ETHEREUM);
        if (provider) {
          const gasPrice = await provider.getGasPrice();
          if (gasPrice.gt(ethers.utils.parseUnits('100', 'gwei'))) {
            technicalRisk = 0.5;
            recommendations.push('High gas prices - consider waiting');
          }
        }
      }

      riskScore = Math.max(liquidityRisk, volatilityRisk, counterpartyRisk, technicalRisk);

      return {
        riskScore,
        liquidityRisk,
        volatilityRisk,
        counterpartyRisk,
        technicalRisk,
        recommendations
      };
    } catch (error) {
      return {
        riskScore: 0.5,
        liquidityRisk: 0.5,
        volatilityRisk: 0.5,
        counterpartyRisk: 0.5,
        technicalRisk: 0.5,
        recommendations: ['Unable to assess risk - proceed with caution']
      };
    }
  }

  /**
   * Sign trading order
   */
  private async signOrder(order: TradingOrder): Promise<string> {
    try {
      if (!this.walletConnection?.signer) {
        throw new Error('Wallet signer not available');
      }

      const message = `${order.id}:${order.assetId}:${order.type}:${order.side}:${order.quantity}:${order.price}`;
      return await this.walletConnection.signer.signMessage(message);
    } catch (error) {
      throw new Error(`Failed to sign order: ${error}`);
    }
  }

  /**
   * Add order to order book
   */
  private addToOrderBook(order: TradingOrder): void {
    const key = `${order.assetId}:${order.side}`;
    if (!this.orderBook.has(key)) {
      this.orderBook.set(key, []);
    }

    const orders = this.orderBook.get(key)!;
    orders.push(order);

    // Sort orders by price (ascending for buy, descending for sell)
    orders.sort((a, b) => {
      const priceA = parseFloat(a.price);
      const priceB = parseFloat(b.price);
      return order.side === 'buy' ? priceB - priceA : priceA - priceB;
    });

    this.emit('orderBookUpdate', { assetId: order.assetId, side: order.side, orders });
  }

  /**
   * Match orders in the order book
   */
  private async matchOrder(order: TradingOrder): Promise<void> {
    try {
      const oppositeKey = `${order.assetId}:${order.side === 'buy' ? 'sell' : 'buy'}`;
      const oppositeOrders = this.orderBook.get(oppositeKey) || [];

      for (const oppositeOrder of oppositeOrders) {
        if (oppositeOrder.status !== OrderStatus.PENDING) continue;

        const canMatch = this.canOrdersMatch(order, oppositeOrder);
        if (!canMatch) continue;

        await this.executeMatch(order, oppositeOrder);

        if (order.status === OrderStatus.FILLED) break;
      }
    } catch (error) {
      this.emit('error', new Error(`Order matching failed: ${error}`));
    }
  }

  /**
   * Check if two orders can be matched
   */
  private canOrdersMatch(order1: TradingOrder, order2: TradingOrder): boolean {
    if (order1.assetId !== order2.assetId) return false;
    if (order1.side === order2.side) return false;

    const price1 = parseFloat(order1.price);
    const price2 = parseFloat(order2.price);

    if (order1.side === 'buy') {
      return price1 >= price2;
    } else {
      return price1 <= price2;
    }
  }

  /**
   * Execute order match
   */
  private async executeMatch(order1: TradingOrder, order2: TradingOrder): Promise<void> {
    try {
      const quantity1 = parseFloat(order1.remainingQuantity);
      const quantity2 = parseFloat(order2.remainingQuantity);
      const matchQuantity = Math.min(quantity1, quantity2);

      // Determine execution price (use limit order price)
      const executionPrice = order1.type === OrderType.LIMIT ? 
        parseFloat(order1.price) : parseFloat(order2.price);

      // Update filled quantities
      const newFilled1 = parseFloat(order1.filledQuantity) + matchQuantity;
      const newRemaining1 = quantity1 - matchQuantity;
      const newFilled2 = parseFloat(order2.filledQuantity) + matchQuantity;
      const newRemaining2 = quantity2 - matchQuantity;

      // Update order statuses
      order1.filledQuantity = newFilled1.toString();
      order1.remainingQuantity = newRemaining1.