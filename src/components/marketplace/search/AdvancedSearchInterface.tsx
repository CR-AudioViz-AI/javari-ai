```tsx
'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Search, Filter, X, Star, ChevronDown, ChevronRight, Grid, List, SlidersHorizontal } from 'lucide-react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface MarketplaceItem {
  id: string
  title: string
  description: string
  price: number
  rating: number
  review_count: number
  category_id: string
  category_name: string
  subcategory_name?: string
  image_url: string
  seller_name: string
  tags: string[]
  created_at: string
}

interface Category {
  id: string
  name: string
  slug: string
  parent_id?: string
  children?: Category[]
  item_count: number
}

interface SearchFilters {
  query: string
  categories: string[]
  priceRange: [number, number]
  minRating: number
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest'
  tags: string[]
}

interface SearchSuggestion {
  id: string
  text: string
  type: 'query' | 'category' | 'tag' | 'product'
  category?: string
  count?: number
}

interface AdvancedSearchInterfaceProps {
  className?: string
  onSearchResults?: (results: MarketplaceItem[], total: number) => void
  onFiltersChange?: (filters: SearchFilters) => void
  initialFilters?: Partial<SearchFilters>
  maxPrice?: number
  enableSemanticSearch?: boolean
  showViewToggle?: boolean
}

const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  categories: [],
  priceRange: [0, 1000],
  minRating: 0,
  sortBy: 'relevance',
  tags: []
}

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest First' }
]

export default function AdvancedSearchInterface({
  className,
  onSearchResults,
  onFiltersChange,
  initialFilters = {},
  maxPrice = 1000,
  enableSemanticSearch = true,
  showViewToggle = true
}: AdvancedSearchInterfaceProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    ...DEFAULT_FILTERS,
    priceRange: [0, maxPrice],
    ...initialFilters
  })
  
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const debouncedQuery = useDebounce(filters.query, 300)

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      return response.json()
    }
  })

  // Fetch search suggestions
  const { data: suggestions = [] } = useQuery<SearchSuggestion[]>({
    queryKey: ['search-suggestions', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return []
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`)
      if (!response.ok) throw new Error('Failed to fetch suggestions')
      return response.json()
    },
    enabled: debouncedQuery.length > 0
  })

  // Infinite search results query
  const {
    data: searchResults,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['marketplace-search', filters],
    queryFn: async ({ pageParam = 0 }) => {
      const searchParams = new URLSearchParams({
        q: filters.query,
        categories: filters.categories.join(','),
        price_min: filters.priceRange[0].toString(),
        price_max: filters.priceRange[1].toString(),
        min_rating: filters.minRating.toString(),
        sort_by: filters.sortBy,
        tags: filters.tags.join(','),
        page: pageParam.toString(),
        semantic: enableSemanticSearch.toString()
      })

      const response = await fetch(`/api/search/marketplace?${searchParams}`)
      if (!response.ok) throw new Error('Search failed')
      return response.json()
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.has_more ? pages.length : undefined
    },
    enabled: debouncedQuery.length > 0 || filters.categories.length > 0 || filters.tags.length > 0
  })

  const allResults = useMemo(() => {
    return searchResults?.pages.flatMap(page => page.items) || []
  }, [searchResults])

  const totalResults = searchResults?.pages[0]?.total || 0

  // Update filters handler
  const updateFilters = useCallback((updates: Partial<SearchFilters>) => {
    const newFilters = { ...filters, ...updates }
    setFilters(newFilters)
    onFiltersChange?.(newFilters)
  }, [filters, onFiltersChange])

  // Search input handler
  const handleSearchChange = useCallback((value: string) => {
    updateFilters({ query: value })
    setShowSuggestions(value.length > 0)
  }, [updateFilters])

  // Category toggle handler
  const toggleCategory = useCallback((categoryId: string) => {
    const categories = filters.categories.includes(categoryId)
      ? filters.categories.filter(id => id !== categoryId)
      : [...filters.categories, categoryId]
    updateFilters({ categories })
  }, [filters.categories, updateFilters])

  // Remove filter handler
  const removeFilter = useCallback((type: keyof SearchFilters, value?: any) => {
    switch (type) {
      case 'query':
        updateFilters({ query: '' })
        break
      case 'categories':
        updateFilters({ categories: filters.categories.filter(id => id !== value) })
        break
      case 'tags':
        updateFilters({ tags: filters.tags.filter(tag => tag !== value) })
        break
      case 'priceRange':
        updateFilters({ priceRange: [0, maxPrice] })
        break
      case 'minRating':
        updateFilters({ minRating: 0 })
        break
    }
  }, [filters, updateFilters, maxPrice])

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const clearedFilters = { ...DEFAULT_FILTERS, priceRange: [0, maxPrice] as [number, number] }
    setFilters(clearedFilters)
    onFiltersChange?.(clearedFilters)
  }, [maxPrice, onFiltersChange])

  // Category tree renderer
  const renderCategoryTree = (categories: Category[], level = 0) => {
    return categories.map(category => (
      <div key={category.id} className={cn("space-y-2", level > 0 && "ml-4")}>
        <div className="flex items-center space-x-2">
          {category.children && category.children.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => {
                const newExpanded = new Set(expandedCategories)
                if (expandedCategories.has(category.id)) {
                  newExpanded.delete(category.id)
                } else {
                  newExpanded.add(category.id)
                }
                setExpandedCategories(newExpanded)
              }}
            >
              {expandedCategories.has(category.id) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}
          <Checkbox
            id={category.id}
            checked={filters.categories.includes(category.id)}
            onCheckedChange={() => toggleCategory(category.id)}
          />
          <label
            htmlFor={category.id}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {category.name} ({category.item_count})
          </label>
        </div>
        {category.children && category.children.length > 0 && expandedCategories.has(category.id) && (
          <div className="ml-2">
            {renderCategoryTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ))
  }

  // Rating stars renderer
  const renderStars = (rating: number, size = 4) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={cn(
              `h-${size} w-${size}`,
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            )}
          />
        ))}
      </div>
    )
  }

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.query) count++
    if (filters.categories.length > 0) count += filters.categories.length
    if (filters.tags.length > 0) count += filters.tags.length
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice) count++
    if (filters.minRating > 0) count++
    return count
  }, [filters, maxPrice])

  // Effect to notify parent of results
  useEffect(() => {
    if (allResults && onSearchResults) {
      onSearchResults(allResults, totalResults)
    }
  }, [allResults, totalResults, onSearchResults])

  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* Search Header */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, brands, categories..."
            value={filters.query}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-10 pr-4"
            aria-label="Search marketplace"
          />
          
          {/* Search Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <Card className="absolute top-full left-0 right-0 z-50 mt-1">
              <CardContent className="p-0">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {suggestions.map(suggestion => (
                        <CommandItem
                          key={suggestion.id}
                          onSelect={() => {
                            if (suggestion.type === 'category') {
                              toggleCategory(suggestion.id)
                            } else {
                              handleSearchChange(suggestion.text)
                            }
                            setShowSuggestions(false)
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{suggestion.text}</span>
                            {suggestion.count && (
                              <Badge variant="secondary" className="text-xs">
                                {suggestion.count}
                              </Badge>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Search Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            
            <Select
              value={filters.sortBy}
              onValueChange={value => updateFilters({ sortBy: value as SearchFilters['sortBy'] })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {totalResults.toLocaleString()} results
            </span>
            
            {showViewToggle && (
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Active Filters */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Active filters:</span>
            
            {filters.query && (
              <Badge variant="secondary" className="flex items-center gap-1">
                "{filters.query}"
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeFilter('query')}
                />
              </Badge>
            )}
            
            {filters.categories.map(categoryId => {
              const category = categories.find(c => c.id === categoryId)
              return category ? (
                <Badge key={categoryId} variant="secondary" className="flex items-center gap-1">
                  {category.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeFilter('categories', categoryId)}
                  />
                </Badge>
              ) : null
            })}
            
            {filters.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                {tag}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeFilter('tags', tag)}
                />
              </Badge>
            ))}
            
            {(filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice) && (
              <Badge variant="secondary" className="flex items-center gap-1">
                ${filters.priceRange[0]} - ${filters.priceRange[1]}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeFilter('priceRange')}
                />
              </Badge>
            )}
            
            {filters.minRating > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {filters.minRating}+ stars
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeFilter('minRating')}
                />
              </Badge>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Filters Sidebar */}
        {showFilters && (
          <Card className="w-80 h-fit">
            <CardContent className="p-6 space-y-6">
              {/* Categories */}
              <div className="space-y-3">
                <h3 className="font-semibold">Categories</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {renderCategoryTree(categories.filter(c => !c.parent_id))}
                </div>
              </div>

              <Separator />

              {/* Price Range */}
              <div className="space-y-3">
                <h3 className="font-semibold">Price Range</h3>
                <div className="space-y-4">
                  <Slider
                    value={filters.priceRange}
                    onValueChange={value => updateFilters({ priceRange: value as [number, number] })}
                    max={maxPrice}
                    step={10}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>${filters.priceRange[0]}</span>
                    <span>${filters.priceRange[1]}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Rating Filter */}
              <div className="space-y-3">
                <h3 className="font-semibold">Minimum Rating</h3>
                <div className="space-y-2">
                  {[4, 3, 2, 1].map(rating => (
                    <div key={rating} className="flex items-center space-x-2">
                      <Checkbox
                        id={`rating-${rating}`}
                        checked={filters.minRating === rating}
                        onCheckedChange={checked => 
                          updateFilters({ minRating: checked ? rating : 0 })
                        }
                      />
                      <label
                        htmlFor={`rating-${rating}`}
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        {renderStars(rating)}
                        <span className="text-sm">& up</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Results */}
        <div className="flex-1 space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : allResults.length === 0 ? (
            <div className="text-center p-8">
              <p className="text-muted-foreground">No results found</p>
            </div>
          ) : (
            <>
              {/* Results Grid/List */}
              <div className={cn(
                "grid gap-4",
                viewMode === 'grid' 
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid-cols-1"
              )}>
                {allResults.map(item => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className={cn(
                      "p-4",
                      viewMode === 'list' && "flex gap-4"
                    )}>
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className={cn(
                          "rounded-md object-cover",
                          viewMode === 'grid' ? "w-full h-48" : "w-24 h-24 flex-shrink-0"
                        )}
                      />
                      <div className={cn(
                        "space-y-2",
                        viewMode === 'grid' ? "mt-3" : "flex-1"
                      )}>
                        <h4 className="font-medium line-clamp-2">{item.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-2">
                          {renderStars(item.rating)}
                          <span className="text-sm text-muted-foreground">
                            ({item.review_count})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-lg">${item.price}</span>
                          <Badge variant="outline">{item.category_name}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Load More */}
              {hasNextPage && (
                <div className="flex justify-center p-4">
                  <Button
                    onClick={() => fetchNextPage()}
                    disabled={isFetching