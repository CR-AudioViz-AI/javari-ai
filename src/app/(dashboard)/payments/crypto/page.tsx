'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Wallet, 
  TrendingUp, 
  ArrowLeftRight, 
  Shield, 
  Zap, 
  RefreshCw, 
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Settings,
  History,
  ChevronDown,
  Filter,
  Download
} from 'lucide-react';

/**
 * Comprehensive cryptocurrency payment hub for CR AudioViz platform
 * Supports multi-chain payments, DeFi integration, and real-time optimization
 */

// Type definitions
interface CryptoCurrency {
  symbol: string;
  name: string;
  icon: string;
  chain: string;
  address?: string;
  decimals: number;
  price: number;
  change24h: number;
}

interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  installed: boolean;
  connected: boolean;
  address?: string;
  balance?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: 'crypto' | 'defi' | 'bridge';
  currencies: string[];
  fees: number;
  speed: 'slow' | 'medium' | 'fast';
  enabled: boolean;
}

interface Transaction {
  id: string;
  hash: string;
  type: 'payment' | 'conversion' | 'bridge';
  from: string;
  to: string;
  amount: string;
  currency: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  gasUsed?: string;
  fees: string;
}

interface ExchangeRate {
  pair: string;
  rate: number;
  source: string;
  lastUpdate: number;
  spread: number;
}

interface DeFiProtocol {
  id: string;
  name: string;
  icon: string;
  type: 'dex' | 'aggregator' | 'bridge';
  chains: string[];
  fees: number;
  liquidity: number;
  enabled: boolean;
}

// Mock data
const SUPPORTED_CURRENCIES: CryptoCurrency[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: '🔷',
    chain: 'ethereum',
    decimals: 18,
    price: 2341.50,
    change24h: 2.34
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: '₿',
    chain: 'bitcoin',
    decimals: 8,
    price: 43250.00,
    change24h: -1.23
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '💰',
    chain: 'ethereum',
    address: '0xA0b86a33E6441E4a6C9EDB8B2d01f1B86A6aD06C',
    decimals: 6,
    price: 1.00,
    change24h: 0.01
  },
  {
    symbol: 'MATIC',
    name: 'Polygon',
    icon: '🔺',
    chain: 'polygon',
    decimals: 18,
    price: 0.87,
    change24h: 4.56
  },
  {
    symbol: 'BNB',
    name: 'BNB Chain',
    icon: '🔶',
    chain: 'bsc',
    decimals: 18,
    price: 315.20,
    change24h: 1.89
  }
];

const WALLET_PROVIDERS: WalletProvider[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    installed: true,
    connected: false
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: '🔗',
    installed: true,
    connected: false
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '🔵',
    installed: false,
    connected: false
  }
];

const DEFI_PROTOCOLS: DeFiProtocol[] = [
  {
    id: 'uniswap',
    name: 'Uniswap',
    icon: '🦄',
    type: 'dex',
    chains: ['ethereum', 'polygon', 'arbitrum'],
    fees: 0.3,
    liquidity: 1250000,
    enabled: true
  },
  {
    id: '1inch',
    name: '1inch',
    icon: '1️⃣',
    type: 'aggregator',
    chains: ['ethereum', 'bsc', 'polygon'],
    fees: 0.1,
    liquidity: 2100000,
    enabled: true
  },
  {
    id: 'paraswap',
    name: 'ParaSwap',
    icon: '🔀',
    type: 'aggregator',
    chains: ['ethereum', 'polygon'],
    fees: 0.15,
    liquidity: 980000,
    enabled: true
  }
];

/**
 * Wallet Connection Manager Component
 */
const WalletConnectionManager: React.FC<{
  onWalletConnect: (provider: WalletProvider) => void;
  connectedWallet?: WalletProvider;
}> = ({ onWalletConnect, connectedWallet }) => {
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (provider: WalletProvider) => {
    if (!provider.installed) {
      window.open(`https://${provider.id}.io`, '_blank');
      return;
    }

    setConnecting(provider.id);
    try {
      // Simulate wallet connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      onWalletConnect({
        ...provider,
        connected: true,
        address: '0x742d35Cc6635C0532925a3b8D9Bc4F6C4aB9e3dA',
        balance: '2.45 ETH'
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Wallet Connection
        </CardTitle>
      </CardHeader>
      <CardContent>
        {connectedWallet ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{connectedWallet.icon}</span>
                <div>
                  <p className="font-medium">{connectedWallet.name}</p>
                  <p className="text-sm text-gray-600">
                    {connectedWallet.address?.slice(0, 6)}...{connectedWallet.address?.slice(-4)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{connectedWallet.balance}</p>
                <Badge variant="secondary" className="bg-green-100">Connected</Badge>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {WALLET_PROVIDERS.map((provider) => (
              <Button
                key={provider.id}
                variant="outline"
                className="flex items-center justify-between p-4 h-auto"
                onClick={() => handleConnect(provider)}
                disabled={connecting === provider.id}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{provider.icon}</span>
                  <span>{provider.name}</span>
                </div>
                {connecting === provider.id ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-sm text-gray-500">
                    {provider.installed ? 'Connect' : 'Install'}
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Cryptocurrency Selector Component
 */
const CryptoCurrencySelector: React.FC<{
  selectedCurrency?: CryptoCurrency;
  onSelect: (currency: CryptoCurrency) => void;
}> = ({ selectedCurrency, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCurrencies = useMemo(() => {
    return SUPPORTED_CURRENCIES.filter(currency =>
      currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      currency.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Cryptocurrency</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="Search currencies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
          {filteredCurrencies.map((currency) => (
            <div
              key={currency.symbol}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                selectedCurrency?.symbol === currency.symbol
                  ? 'bg-blue-50 border-2 border-blue-200'
                  : 'hover:bg-gray-50 border border-gray-200'
              }`}
              onClick={() => onSelect(currency)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currency.icon}</span>
                <div>
                  <p className="font-medium">{currency.symbol}</p>
                  <p className="text-sm text-gray-600">{currency.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">${currency.price.toLocaleString()}</p>
                <p className={`text-sm ${
                  currency.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {currency.change24h >= 0 ? '+' : ''}{currency.change24h.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Payment Method Grid Component
 */
const PaymentMethodGrid: React.FC<{
  selectedMethod?: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}> = ({ selectedMethod, onSelect }) => {
  const paymentMethods: PaymentMethod[] = [
    {
      id: 'direct',
      name: 'Direct Transfer',
      type: 'crypto',
      currencies: ['ETH', 'BTC', 'USDC'],
      fees: 0.1,
      speed: 'fast',
      enabled: true
    },
    {
      id: 'defi_swap',
      name: 'DeFi Swap',
      type: 'defi',
      currencies: ['ETH', 'USDC', 'MATIC'],
      fees: 0.3,
      speed: 'medium',
      enabled: true
    },
    {
      id: 'cross_chain',
      name: 'Cross-Chain Bridge',
      type: 'bridge',
      currencies: ['ETH', 'BNB', 'MATIC'],
      fees: 0.5,
      speed: 'slow',
      enabled: true
    }
  ];

  const getSpeedColor = (speed: string) => {
    switch (speed) {
      case 'fast': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'slow': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedMethod?.id === method.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelect(method)}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{method.name}</h3>
                  <Badge className={getSpeedColor(method.speed)} variant="secondary">
                    {method.speed}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Fee: {method.fees}% • {method.currencies.length} currencies
                </p>
                <div className="flex flex-wrap gap-1">
                  {method.currencies.slice(0, 3).map((currency) => (
                    <Badge key={currency} variant="outline" className="text-xs">
                      {currency}
                    </Badge>
                  ))}
                  {method.currencies.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{method.currencies.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Exchange Rate Optimizer Component
 */
const ExchangeRateOptimizer: React.FC<{
  fromCurrency: string;
  toCurrency: string;
  amount: string;
}> = ({ fromCurrency, toCurrency, amount }) => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [bestRate, setBestRate] = useState<ExchangeRate | null>(null);

  useEffect(() => {
    if (!fromCurrency || !toCurrency || !amount) return;

    const fetchRates = async () => {
      setLoading(true);
      try {
        // Simulate fetching rates from multiple sources
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const mockRates: ExchangeRate[] = [
          {
            pair: `${fromCurrency}/${toCurrency}`,
            rate: 2341.50,
            source: 'Uniswap V3',
            lastUpdate: Date.now(),
            spread: 0.02
          },
          {
            pair: `${fromCurrency}/${toCurrency}`,
            rate: 2339.20,
            source: '1inch',
            lastUpdate: Date.now(),
            spread: 0.015
          },
          {
            pair: `${fromCurrency}/${toCurrency}`,
            rate: 2343.80,
            source: 'ParaSwap',
            lastUpdate: Date.now(),
            spread: 0.025
          }
        ];

        setRates(mockRates);
        setBestRate(mockRates.reduce((best, current) => 
          current.rate > best.rate ? current : best
        ));
      } catch (error) {
        console.error('Failed to fetch rates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, [fromCurrency, toCurrency, amount]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Exchange Rate Optimizer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Finding best rates...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Exchange Rate Optimizer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bestRate && (
            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertDescription>
                Best rate found: {bestRate.rate.toLocaleString()} on {bestRate.source}
                {' '}(Spread: {bestRate.spread}%)
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            {rates.map((rate, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  rate === bestRate ? 'border-green-500 bg-green-50' : 'border-gray-200'
                }`}
              >
                <div>
                  <p className="font-medium">{rate.source}</p>
                  <p className="text-sm text-gray-600">
                    Spread: {rate.spread}% • Updated {new Date(rate.lastUpdate).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{rate.rate.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">
                    {(parseFloat(amount) * rate.rate).toFixed(6)} {toCurrency}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Transaction Tracker Component
 */
const TransactionTracker: React.FC<{
  transactions: Transaction[];
  onRefresh: () => void;
}> = ({ transactions, onRefresh }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions yet
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(tx.status)} variant="secondary">
                      {tx.status}
                    </Badge>
                    <span className="font-medium">{tx.type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(tx.hash)}
                      className="h-auto p-1"
                    >
                      {copied === tx.hash ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{tx.amount} {tx.currency}</p>
                  <p className="text-sm text-gray-600">
                    Fee: {tx.fees}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * DeFi Protocol Integration Component
 */
const DeFi