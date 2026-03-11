```tsx
"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { Search, Filter, Grid, List, TrendingUp, Award, Coins, Eye, Send, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface NFTAsset {
  id: string
  name: string
  description: string
  image: string
  collection: string
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
  module: string
  acquiredDate: string
  value: number
  blockchain: string
  tokenId: string
}

interface VirtualItem {
  id: string
  name: string
  type: string
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
  quantity: number
  description: string
  image: string
  module: string
  acquiredDate: string
  attributes: Record<string, any>
}

interface AchievementBadge {
  id: string
  name: string
  description: string
  icon: string
  category: string
  rarity: "bronze" | "silver" | "gold" | "platinum" | "diamond"
  unlockedDate: string
  module: string
  progress?: number
  maxProgress?: number
}

interface CurrencyBalance {
  id: string
  name: string
  symbol: string
  balance: number
  usdValue: number
  icon: string
  module: string
  lastUpdated: string
}

interface AssetTransaction {
  id: string
  type: "acquired" | "transferred" | "sold" | "traded"
  assetId: string
  assetName: string
  amount: number
  fromAddress?: string
  toAddress?: string
  timestamp: string
  txHash?: string
}

interface AssetFilters {
  rarity?: string
  module?: string
  dateRange?: string
  category?: string
}

interface DigitalAssetInventoryProps {
  userId: string
  nfts?: NFTAsset[]
  virtualItems?: VirtualItem[]
  achievements?: AchievementBadge[]
  currencies?: CurrencyBalance[]
  transactions?: AssetTransaction[]
  onAssetAction?: (action: string, assetId: string) => void
  onTransferAsset?: (assetId: string, recipient: string) => void
  className?: string
}

const rarityColors = {
  common: "bg-gray-500",
  uncommon: "bg-green-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-orange-500",
  bronze: "bg-amber-600",
  silver: "bg-gray-400",
  gold: "bg-yellow-500",
  platinum: "bg-cyan-500",
  diamond: "bg-pink-500"
}

const AssetFilters: React.FC<{
  filters: AssetFilters
  onFiltersChange: (filters: AssetFilters) => void
  modules: string[]
}> = ({ filters, onFiltersChange, modules }) => {
  return (
    <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
      <Select
        value={filters.rarity || "all"}
        onValueChange={(value) => onFiltersChange({ ...filters, rarity: value === "all" ? undefined : value })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Rarity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Rarities</SelectItem>
          <SelectItem value="common">Common</SelectItem>
          <SelectItem value="uncommon">Uncommon</SelectItem>
          <SelectItem value="rare">Rare</SelectItem>
          <SelectItem value="epic">Epic</SelectItem>
          <SelectItem value="legendary">Legendary</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.module || "all"}
        onValueChange={(value) => onFiltersChange({ ...filters, module: value === "all" ? undefined : value })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Module" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Modules</SelectItem>
          {modules.map((module) => (
            <SelectItem key={module} value={module}>{module}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.dateRange || "all"}
        onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value === "all" ? undefined : value })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Date Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="7d">Last 7 Days</SelectItem>
          <SelectItem value="30d">Last 30 Days</SelectItem>
          <SelectItem value="90d">Last 3 Months</SelectItem>
          <SelectItem value="1y">Last Year</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

const NFTGrid: React.FC<{
  nfts: NFTAsset[]
  onAssetAction: (action: string, assetId: string) => void
}> = ({ nfts, onAssetAction }) => {
  const [selectedNFT, setSelectedNFT] = useState<NFTAsset | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {nfts.map((nft) => (
          <Card key={nft.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
            <div className="relative aspect-square">
              <img
                src={nft.image}
                alt={nft.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2">
                <Badge className={cn("text-white", rarityColors[nft.rarity])}>
                  {nft.rarity}
                </Badge>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedNFT(nft)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAssetAction("transfer", nft.id)}>
                      <Send className="mr-2 h-4 w-4" />
                      Transfer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold truncate">{nft.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{nft.collection}</p>
              <div className="flex justify-between items-center mt-2">
                <Badge variant="outline">{nft.module}</Badge>
                <span className="text-sm font-medium">${nft.value.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={selectedNFT !== null} onOpenChange={() => setSelectedNFT(null)}>
        <DialogContent className="max-w-2xl">
          {selectedNFT && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedNFT.name}</DialogTitle>
                <DialogDescription>{selectedNFT.collection}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="aspect-square">
                  <img
                    src={selectedNFT.image}
                    alt={selectedNFT.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">{selectedNFT.description}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Rarity:</span>
                      <Badge className={cn("text-white", rarityColors[selectedNFT.rarity])}>
                        {selectedNFT.rarity}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Module:</span>
                      <span className="text-sm font-medium">{selectedNFT.module}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Blockchain:</span>
                      <span className="text-sm font-medium">{selectedNFT.blockchain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Token ID:</span>
                      <span className="text-sm font-mono">{selectedNFT.tokenId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Acquired:</span>
                      <span className="text-sm">{new Date(selectedNFT.acquiredDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Estimated Value:</span>
                      <span className="text-sm font-medium">${selectedNFT.value.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

const VirtualItemsList: React.FC<{
  items: VirtualItem[]
  onAssetAction: (action: string, assetId: string) => void
}> = ({ items, onAssetAction }) => {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex items-center gap-4 p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={item.image} alt={item.name} />
              <AvatarFallback>{item.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{item.name}</h3>
                <Badge className={cn("text-white", rarityColors[item.rarity])}>
                  {item.rarity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{item.description}</p>
              <div className="flex items-center gap-4 mt-1">
                <Badge variant="outline">{item.module}</Badge>
                <span className="text-sm">Qty: {item.quantity}</span>
                <span className="text-sm text-muted-foreground">{item.type}</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onAssetAction("use", item.id)}>
                  Use Item
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAssetAction("transfer", item.id)}>
                  <Send className="mr-2 h-4 w-4" />
                  Transfer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const AchievementBadges: React.FC<{
  achievements: AchievementBadge[]
}> = ({ achievements }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {achievements.map((achievement) => (
        <Card key={achievement.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={achievement.icon} alt={achievement.name} />
                  <AvatarFallback>
                    <Award className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <Badge 
                  className={cn("absolute -bottom-1 -right-1 text-white text-xs px-1", rarityColors[achievement.rarity])}
                >
                  {achievement.rarity}
                </Badge>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{achievement.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{achievement.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant="outline">{achievement.module}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(achievement.unlockedDate).toLocaleDateString()}
                  </span>
                </div>
                {achievement.progress !== undefined && achievement.maxProgress && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Progress</span>
                      <span>{achievement.progress}/{achievement.maxProgress}</span>
                    </div>
                    <Progress value={(achievement.progress / achievement.maxProgress) * 100} className="h-1" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const CurrencyBalances: React.FC<{
  currencies: CurrencyBalance[]
}> = ({ currencies }) => {
  const totalValue = currencies.reduce((sum, currency) => sum + currency.usdValue, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Total Portfolio Value
          </CardTitle>
          <CardDescription>Combined value across all currencies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">${totalValue.toFixed(2)}</div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currencies.map((currency) => (
          <Card key={currency.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={currency.icon} alt={currency.name} />
                <AvatarFallback>
                  <Coins className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{currency.symbol}</h3>
                  <Badge variant="outline">{currency.module}</Badge>
                </div>
                <div className="text-2xl font-bold">{currency.balance.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">
                  ${currency.usdValue.toFixed(2)} USD
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

const TransactionHistory: React.FC<{
  transactions: AssetTransaction[]
}> = ({ transactions }) => {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "acquired": return "📥"
      case "transferred": return "📤"
      case "sold": return "💰"
      case "traded": return "🔄"
      default: return "📋"
    }
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-2 p-1">
        {transactions.map((transaction) => (
          <Card key={transaction.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="text-2xl">{getTransactionIcon(transaction.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{transaction.assetName}</h3>
                  <Badge variant={
                    transaction.type === "acquired" ? "default" :
                    transaction.type === "sold" ? "destructive" :
                    "secondary"
                  }>
                    {transaction.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {transaction.type === "transferred" && transaction.toAddress && (
                    `To: ${transaction.toAddress.substring(0, 10)}...`
                  )}
                  {transaction.type === "acquired" && transaction.fromAddress && (
                    `From: ${transaction.fromAddress.substring(0, 10)}...`
                  )}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {new Date(transaction.timestamp).toLocaleString()}
                  </span>
                  {transaction.txHash && (
                    <code className="text-xs bg-muted px-1 rounded">
                      {transaction.txHash.substring(0, 8)}...
                    </code>
                  )}
                </div>
              </div>
              {transaction.amount > 0 && (
                <div className="text-right">
                  <div className="font-medium">
                    {transaction.type === "sold" ? "+" : ""}${transaction.amount.toFixed(2)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}

export function DigitalAssetInventory({
  userId,
  nfts = [],
  virtualItems = [],
  achievements = [],
  currencies = [],
  transactions = [],
  onAssetAction = () => {},
  onTransferAsset = () => {},
  className
}: DigitalAssetInventoryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<AssetFilters>({})
  const [activeTab, setActiveTab] = useState("nfts")

  const modules = useMemo(() => {
    const allModules = new Set([
      ...nfts.map(nft => nft.module),
      ...virtualItems.map(item => item.module),
      ...achievements.map(achievement => achievement.module),
      ...currencies.map(currency => currency.module)
    ])
    return Array.from(allModules)
  }, [nfts, virtualItems, achievements, currencies])

  const filteredNFTs = useMemo(() => {
    return nfts.filter(nft => {
      if (searchQuery && !nft.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filters.rarity && nft.rarity !== filters.rarity) return false
      if (filters.module && nft.module !== filters.module) return false
      return true
    })
  }, [nfts, searchQuery, filters])

  const filteredVirtualItems = useMemo(() => {
    return virtualItems.filter(item => {
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filters.rarity && item.rarity !== filters.rarity) return false
      if (filters.module && item.module !== filters.module) return false
      return true
    })
  }, [virtualItems, searchQuery, filters])

  const filteredAchievements = useMemo(() => {
    return achievements.filter(achievement => {
      if (searchQuery && !achievement.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filters.module && achievement.module !== filters.module) return false
      return true
    })
  }, [achievements, searchQuery, filters])

  const filteredCurrencies = useMemo(() => {
    return currencies.filter(currency => {
      if (searchQuery && !currency.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filters.module && currency.module !== filters.module) return false
      return true
    })