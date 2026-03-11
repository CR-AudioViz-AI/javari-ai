```tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Search, Filter, Grid, List, MoreHorizontal, ExternalLink, Shield, Clock, DollarSign, TrendingUp, Eye, CheckCircle2, AlertCircle, Star, Zap, Settings, Download, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';

interface DigitalAsset {
  id: string;
  name: string;
  description: string;
  image: string;
  type: 'nft' | 'virtual-item' | 'avatar' | 'land' | 'collectible';
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  blockchain: 'ethereum' | 'polygon' | 'solana' | 'binance';
  contractAddress: string;
  tokenId: string;
  price: number;
  currency: string;
  isVerified: boolean;
  isListed: boolean;
  owner: string;
  createdAt: string;
  lastSale?: number;
  traits: Array<{ name: string; value: string; rarity: number }>;
  collection: string;
  creator: string;
  royalties: number;
  status: 'owned' | 'listed' | 'in-trade' | 'staked';
}

interface TradeOffer {
  id: string;
  fromUser: string;
  toUser: string;
  offeredAssets: string[];
  requestedAssets: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
}

interface InventoryFilters {
  types: string[];
  rarities: string[];
  blockchains: string[];
  statuses: string[];
  priceRange: [number, number];
  collections: string[];
  isVerified?: boolean;
  isListed?: boolean;
}

interface InventoryStats {
  totalAssets: number;
  totalValue: number;
  listedAssets: number;
  tradingAssets: number;
  verifiedAssets: number;
  topCollection: string;
  rarityDistribution: Record<string, number>;
}

const MOCK_ASSETS: DigitalAsset[] = [
  {
    id: '1',
    name: 'Cosmic Warrior #1337',
    description: 'A legendary warrior from the cosmic realm with rare attributes.',
    image: '/api/placeholder/300/300',
    type: 'nft',
    rarity: 'legendary',
    blockchain: 'ethereum',
    contractAddress: '0x123...abc',
    tokenId: '1337',
    price: 2.5,
    currency: 'ETH',
    isVerified: true,
    isListed: true,
    owner: 'user123',
    createdAt: '2024-01-15T10:00:00Z',
    lastSale: 1.8,
    traits: [
      { name: 'Weapon', value: 'Cosmic Sword', rarity: 0.05 },
      { name: 'Armor', value: 'Stellar Plate', rarity: 0.12 },
      { name: 'Background', value: 'Nebula', rarity: 0.08 }
    ],
    collection: 'Cosmic Warriors',
    creator: 'CosmicStudio',
    royalties: 5,
    status: 'listed'
  },
  {
    id: '2',
    name: 'Virtual Land Plot #256',
    description: 'Prime real estate in the CRAIverse metaverse.',
    image: '/api/placeholder/300/300',
    type: 'land',
    rarity: 'rare',
    blockchain: 'polygon',
    contractAddress: '0x456...def',
    tokenId: '256',
    price: 0.8,
    currency: 'MATIC',
    isVerified: true,
    isListed: false,
    owner: 'user123',
    createdAt: '2024-02-01T14:30:00Z',
    traits: [
      { name: 'Location', value: 'Downtown District', rarity: 0.15 },
      { name: 'Size', value: '100x100', rarity: 0.3 },
      { name: 'Zone', value: 'Commercial', rarity: 0.25 }
    ],
    collection: 'CRAIverse Lands',
    creator: 'CRAIverse Team',
    royalties: 2.5,
    status: 'owned'
  }
];

const RARITY_COLORS = {
  common: 'bg-gray-100 text-gray-800 border-gray-200',
  rare: 'bg-blue-100 text-blue-800 border-blue-200',
  epic: 'bg-purple-100 text-purple-800 border-purple-200',
  legendary: 'bg-orange-100 text-orange-800 border-orange-200',
  mythic: 'bg-red-100 text-red-800 border-red-200'
};

const BLOCKCHAIN_COLORS = {
  ethereum: 'bg-slate-100 text-slate-800',
  polygon: 'bg-violet-100 text-violet-800',
  solana: 'bg-green-100 text-green-800',
  binance: 'bg-yellow-100 text-yellow-800'
};

export default function CRAIverseInventoryPage() {
  const [assets, setAssets] = useState<DigitalAsset[]>(MOCK_ASSETS);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<InventoryFilters>({
    types: [],
    rarities: [],
    blockchains: [],
    statuses: [],
    priceRange: [0, 100],
    collections: []
  });
  const [selectedAsset, setSelectedAsset] = useState<DigitalAsset | null>(null);
  const [showTradePanel, setShowTradePanel] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const stats: InventoryStats = useMemo(() => {
    const totalAssets = assets.length;
    const totalValue = assets.reduce((sum, asset) => sum + asset.price, 0);
    const listedAssets = assets.filter(asset => asset.isListed).length;
    const tradingAssets = assets.filter(asset => asset.status === 'in-trade').length;
    const verifiedAssets = assets.filter(asset => asset.isVerified).length;
    
    const collections = assets.reduce((acc, asset) => {
      acc[asset.collection] = (acc[asset.collection] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topCollection = Object.entries(collections).sort(([,a], [,b]) => b - a)[0]?.[0] || '';
    
    const rarityDistribution = assets.reduce((acc, asset) => {
      acc[asset.rarity] = (acc[asset.rarity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAssets,
      totalValue,
      listedAssets,
      tradingAssets,
      verifiedAssets,
      topCollection,
      rarityDistribution
    };
  }, [assets]);

  const filteredAndSortedAssets = useMemo(() => {
    let filtered = assets.filter(asset => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!asset.name.toLowerCase().includes(query) && 
            !asset.description.toLowerCase().includes(query) &&
            !asset.collection.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(asset.type)) {
        return false;
      }

      // Rarity filter
      if (filters.rarities.length > 0 && !filters.rarities.includes(asset.rarity)) {
        return false;
      }

      // Blockchain filter
      if (filters.blockchains.length > 0 && !filters.blockchains.includes(asset.blockchain)) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(asset.status)) {
        return false;
      }

      // Verification filter
      if (filters.isVerified !== undefined && asset.isVerified !== filters.isVerified) {
        return false;
      }

      // Listed filter
      if (filters.isListed !== undefined && asset.isListed !== filters.isListed) {
        return false;
      }

      // Price range filter
      if (asset.price < filters.priceRange[0] || asset.price > filters.priceRange[1]) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortBy as keyof DigitalAsset];
      let bVal: any = b[sortBy as keyof DigitalAsset];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [assets, searchQuery, filters, sortBy, sortOrder]);

  const handleSelectAsset = useCallback((assetId: string, selected: boolean) => {
    setSelectedAssets(prev => 
      selected 
        ? [...prev, assetId]
        : prev.filter(id => id !== assetId)
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedAssets.length === filteredAndSortedAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(filteredAndSortedAssets.map(asset => asset.id));
    }
  }, [selectedAssets.length, filteredAndSortedAssets]);

  const AssetCard: React.FC<{ asset: DigitalAsset }> = ({ asset }) => (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <Checkbox
            checked={selectedAssets.includes(asset.id)}
            onCheckedChange={(checked) => handleSelectAsset(asset.id, checked as boolean)}
            className="mt-1"
            aria-label={`Select ${asset.name}`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Asset actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedAsset(asset)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Blockchain
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="relative">
          <img
            src={asset.image}
            alt={asset.name}
            className="w-full aspect-square object-cover rounded-lg"
          />
          <div className="absolute top-2 left-2 flex gap-1">
            {asset.isVerified && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge className="bg-green-500 text-white">
                      <Shield className="w-3 h-3" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Verified Asset</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Badge className={RARITY_COLORS[asset.rarity]}>
              {asset.rarity}
            </Badge>
          </div>
          <div className="absolute top-2 right-2">
            <Badge className={BLOCKCHAIN_COLORS[asset.blockchain]}>
              {asset.blockchain}
            </Badge>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-lg leading-tight">{asset.name}</h3>
          <p className="text-sm text-muted-foreground">{asset.collection}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            <span className="font-medium">{asset.price} {asset.currency}</span>
          </div>
          <Badge variant={asset.status === 'listed' ? 'default' : 'secondary'}>
            {asset.status}
          </Badge>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <div className="w-full flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => setSelectedAsset(asset)}
          >
            View Details
          </Button>
          {asset.status === 'owned' && (
            <Button className="flex-1">
              List for Sale
            </Button>
          )}
          {asset.status === 'listed' && (
            <Button variant="destructive" className="flex-1">
              Unlist
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );

  const InventoryStats: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Assets</p>
              <p className="text-2xl font-bold">{stats.totalAssets}</p>
            </div>
            <Grid className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">{stats.totalValue.toFixed(2)} ETH</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Listed</p>
              <p className="text-2xl font-bold">{stats.listedAssets}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Verified</p>
              <p className="text-2xl font-bold">{stats.verifiedAssets}</p>
            </div>
            <Shield className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const FilterPanel: React.FC = () => (
    <div className="space-y-6 p-4">
      <div>
        <h4 className="font-medium mb-3">Asset Type</h4>
        <div className="space-y-2">
          {['nft', 'virtual-item', 'avatar', 'land', 'collectible'].map(type => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`type-${type}`}
                checked={filters.types.includes(type)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFilters(prev => ({ ...prev, types: [...prev.types, type] }));
                  } else {
                    setFilters(prev => ({ ...prev, types: prev.types.filter(t => t !== type) }));
                  }
                }}
              />
              <label htmlFor={`type-${type}`} className="text-sm capitalize">
                {type.replace('-', ' ')}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-3">Rarity</h4>
        <div className="space-y-2">
          {['common', 'rare', 'epic', 'legendary', 'mythic'].map(rarity => (
            <div key={rarity} className="flex items-center space-x-2">
              <Checkbox
                id={`rarity-${rarity}`}
                checked={filters.rarities.includes(rarity)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFilters(prev => ({ ...prev, rarities: [...prev.rarities, rarity] }));
                  } else {
                    setFilters(prev => ({ ...prev, rarities: prev.rarities.filter(r => r !== rarity) }));
                  }
                }}
              />
              <label htmlFor={`rarity-${rarity}`} className="text-sm capitalize">
                {rarity}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-3">Blockchain</h4>
        <div className="space-y-2">
          {['ethereum', 'polygon', 'solana', 'binance'].map(blockchain => (
            <div key={blockchain} className="flex items-center space-x-2">
              <Checkbox
                id={`blockchain-${blockchain}`}
                checked={filters.blockchains.includes(blockchain)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFilters(prev => ({ ...prev, blockchains: [...prev.blockchains, blockchain] }));
                  } else {
                    setFilters(prev => ({ ...prev, blockchains: prev.blockchains.filter(b => b !== blockchain) }));
                  }
                }}
              />
              <label htmlFor={`blockchain-${blockchain}`} className="text-sm capitalize">
                {blockchain}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-3">Price Range (ETH)</h4>
        <div className="space-y-3">
          <Slider
            value={filters.priceRange}
            onValueChange={(value) => 
              setFilters(prev => ({ ...prev, priceRange: value as [number, number] }))
            }
            max={100}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{filters.priceRange[0]} ETH</span>
            <span>{filters.priceRange[1]} ETH</span>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-3">Status</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="verified-filter"
              checked={filters.isVerified === true}
              onCheckedChange={(checked) => 
                setFilters(prev => ({ ...prev, isVerified: checked ? true : undefined }))
              }
            />