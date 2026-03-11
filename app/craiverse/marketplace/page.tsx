```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useBalance, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Wallet, 
  ShoppingCart, 
  Plus,
  Eye,
  TrendingUp,
  Verified,
  Clock,
  DollarSign
} from 'lucide-react';

/**
 * Marketplace item interface
 */
interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: 'land' | 'avatar' | 'wearable' | 'vehicle' | 'building' | 'art' | 'collectible';
  price: string;
  currency: 'ETH' | 'MATIC' | 'USDC';
  seller_address: string;
  seller_name: string;
  token_id?: string;
  contract_address?: string;
  metadata_uri: string;
  image_url: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  attributes: Record<string, any>;
  created_at: string;
  updated_at: string;
  is_verified: boolean;
  view_count: number;
  favorite_count: number;
  transaction_history: Transaction[];
}

/**
 * Transaction interface
 */
interface Transaction {
  id: string;
  item_id: string;
  buyer_address: string;
  seller_address: string;
  price: string;
  currency: string;
  tx_hash: string;
  block_number: number;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Filter options interface
 */
interface FilterOptions {
  category: string;
  priceMin: string;
  priceMax: string;
  currency: string;
  rarity: string;
  verified: boolean;
  sortBy: 'price_asc' | 'price_desc' | 'created_desc' | 'popular';
}

/**
 * Marketplace service class
 */
class MarketplaceService {
  /**
   * Fetch marketplace items with filters
   */
  async getItems(filters: Partial<FilterOptions>, page = 0, limit = 20): Promise<MarketplaceItem[]> {
    let query = supabase
      .from('marketplace_items')
      .select(`
        *,
        transaction_history:transactions(*)
      `)
      .eq('is_active', true)
      .range(page * limit, (page + 1) * limit - 1);

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    if (filters.priceMin) {
      query = query.gte('price', filters.priceMin);
    }

    if (filters.priceMax) {
      query = query.lte('price', filters.priceMax);
    }

    if (filters.currency && filters.currency !== 'all') {
      query = query.eq('currency', filters.currency);
    }

    if (filters.rarity && filters.rarity !== 'all') {
      query = query.eq('rarity', filters.rarity);
    }

    if (filters.verified) {
      query = query.eq('is_verified', true);
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'popular':
        query = query.order('view_count', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch items: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get item by ID with ownership verification
   */
  async getItemById(itemId: string): Promise<MarketplaceItem | null> {
    const { data, error } = await supabase
      .from('marketplace_items')
      .select(`
        *,
        transaction_history:transactions(*)
      `)
      .eq('id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch item: ${error.message}`);
    }

    return data;
  }

  /**
   * Create new marketplace listing
   */
  async createListing(listingData: Partial<MarketplaceItem>, userAddress: string): Promise<string> {
    const { data, error } = await supabase
      .from('marketplace_items')
      .insert({
        ...listingData,
        seller_address: userAddress,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        view_count: 0,
        favorite_count: 0
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create listing: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update item view count
   */
  async incrementViewCount(itemId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_view_count', {
      item_id: itemId
    });

    if (error) {
      console.warn('Failed to increment view count:', error.message);
    }
  }

  /**
   * Record transaction
   */
  async recordTransaction(transaction: Omit<Transaction, 'id'>): Promise<string> {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to record transaction: ${error.message}`);
    }

    return data.id;
  }
}

/**
 * Marketplace Header Component
 */
const MarketplaceHeader: React.FC<{
  onSearch: (query: string) => void;
  onToggleView: () => void;
  viewMode: 'grid' | 'list';
}> = ({ onSearch, onToggleView, viewMode }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">CRAIverse Marketplace</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleView}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            {viewMode === 'grid' ? <List size={20} /> : <Grid3X3 size={20} />}
          </button>
          <WalletConnection />
        </div>
      </div>
      
      <form onSubmit={handleSearchSubmit} className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, collections, and creators..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </form>
    </div>
  );
};

/**
 * Category Filter Component
 */
const CategoryFilter: React.FC<{
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
}> = ({ filters, onFiltersChange }) => {
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'land', label: 'Virtual Land' },
    { value: 'avatar', label: 'Avatars' },
    { value: 'wearable', label: 'Wearables' },
    { value: 'vehicle', label: 'Vehicles' },
    { value: 'building', label: 'Buildings' },
    { value: 'art', label: 'Digital Art' },
    { value: 'collectible', label: 'Collectibles' }
  ];

  const rarities = [
    { value: 'all', label: 'All Rarities' },
    { value: 'common', label: 'Common' },
    { value: 'rare', label: 'Rare' },
    { value: 'epic', label: 'Epic' },
    { value: 'legendary', label: 'Legendary' }
  ];

  const sortOptions = [
    { value: 'created_desc', label: 'Recently Listed' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'popular', label: 'Most Popular' }
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center space-x-6 overflow-x-auto">
        <div className="flex items-center space-x-2 min-w-0">
          <Filter size={16} className="text-gray-500" />
          <span className="font-medium text-gray-700 whitespace-nowrap">Filters:</span>
        </div>

        <select
          value={filters.category}
          onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map(category => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>

        <select
          value={filters.rarity}
          onChange={(e) => onFiltersChange({ ...filters, rarity: e.target.value })}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {rarities.map(rarity => (
            <option key={rarity.value} value={rarity.value}>
              {rarity.label}
            </option>
          ))}
        </select>

        <div className="flex items-center space-x-2">
          <input
            type="number"
            placeholder="Min Price"
            value={filters.priceMin}
            onChange={(e) => onFiltersChange({ ...filters, priceMin: e.target.value })}
            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">-</span>
          <input
            type="number"
            placeholder="Max Price"
            value={filters.priceMax}
            onChange={(e) => onFiltersChange({ ...filters, priceMax: e.target.value })}
            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.verified}
            onChange={(e) => onFiltersChange({ ...filters, verified: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 whitespace-nowrap">Verified Only</span>
        </label>

        <select
          value={filters.sortBy}
          onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value as FilterOptions['sortBy'] })}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {sortOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

/**
 * Item Card Component
 */
const ItemCard: React.FC<{
  item: MarketplaceItem;
  onView: (item: MarketplaceItem) => void;
  onPurchase: (item: MarketplaceItem) => void;
}> = ({ item, onView, onPurchase }) => {
  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'legendary': return 'text-orange-500';
      case 'epic': return 'text-purple-500';
      case 'rare': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden">
      <div className="relative">
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-48 object-cover cursor-pointer"
          onClick={() => onView(item)}
        />
        {item.is_verified && (
          <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
            <Verified size={12} />
          </div>
        )}
        {item.rarity && (
          <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium bg-white/90 ${getRarityColor(item.rarity)}`}>
            {item.rarity.toUpperCase()}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 truncate cursor-pointer" onClick={() => onView(item)}>
            {item.name}
          </h3>
          <span className="text-xs text-gray-500 ml-2">{item.category}</span>
        </div>

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-1">
            <DollarSign size={16} className="text-green-500" />
            <span className="font-bold text-lg">{item.price}</span>
            <span className="text-sm text-gray-500">{item.currency}</span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <Eye size={12} />
              <span>{item.view_count}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock size={12} />
              <span>{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            by {item.seller_name || `${item.seller_address.slice(0, 6)}...${item.seller_address.slice(-4)}`}
          </span>
          <button
            onClick={() => onPurchase(item)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
          >
            <ShoppingCart size={14} />
            <span>Buy</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Wallet Connection Component
 */
const WalletConnection: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });

  if (!isConnected) {
    return (
      <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        <Wallet size={16} />
        <span>Connect Wallet</span>
      </button>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="text-sm">
        <div className="text-gray-600">Balance:</div>
        <div className="font-medium">
          {balance ? `${Number(formatEther(balance.value)).toFixed(4)} ${balance.symbol}` : '0.0000 ETH'}
        </div>
      </div>
      <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-sm font-medium">
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
        </span>
      </div>
    </div>
  );
};

/**
 * Purchase Modal Component
 */
const PurchaseModal: React.FC<{
  item: MarketplaceItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: MarketplaceItem) => void;
}> = ({ item, isOpen, onClose, onConfirm }) => {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Purchase Confirmation</h2>
        
        <div className="flex items-start space-x-4 mb-4">
          <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded" />
          <div>
            <h3 className="font-semibold">{item.name}</h3>
            <p className="text-sm text-gray-600">{item.category}</p>
            <div className="flex items-center space-x-1 mt-1">
              <DollarSign size={16} className="text-green-500" />
              <span className="font-bold">{item.price} {item.currency}</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Item Price:</span>
            <span>{item.price} {item.currency}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span>Platform Fee (2.5%):</span>
            <span>{(Number(item.price) * 0.025).toFixed(4)} {item.currency}</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2">
            <span>Total:</span>
            <span>{(Number(item.price) * 1.025).toFixed(4)} {item.currency}</span>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(item)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Confirm Purchase
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Main Marketplace Page Component
 */
const MarketplacePage: React.FC = () => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState<FilterOptions>({
    category: 'all',
    priceMin: '',
    priceMax: '',
    currency: 'all',
    rarity: 'all',
    verified: false,
    sortBy: 'created_desc'
  });

  const marketplaceService = useMemo(() => new MarketplaceService(), []);
  const { address, isConnected } = useAccount();

  /**
   * Load marketplace items
   */
  const loadItems = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 0 : page;
      const newItems = await marketplaceService.getItems(filters, currentPage