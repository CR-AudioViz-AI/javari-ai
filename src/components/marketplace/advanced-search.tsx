'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Search, Filter, Save, Star, TrendingUp, Clock, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';

const searchSchema = z.object({
  query: z.string().optional(),
  categories: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  priceRange: z.array(z.number()).length(2).optional(),
  ratingRange: z.array(z.number()).length(2).optional(),
  performanceMin: z.number().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['relevance', 'rating', 'price', 'performance', 'popularity']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

type SearchFormData = z.infer<typeof searchSchema>;

interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  price: number;
  rating: number;
  reviewCount: number;
  performance: number;
  tags: string[];
  author: string;
  createdAt: string;
  featured: boolean;
}

interface SavedSearch {
  id: string;
  name: string;
  query: SearchFormData;
  createdAt: string;
  useCount: number;
}

interface AdvancedSearchProps {
  onSearch: (params: SearchFormData) => void;
  agents: Agent[];
  loading?: boolean;
  totalResults?: number;
  className?: string;
}

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, value, onRemove }) => (
  <Badge variant="secondary" className="flex items-center gap-1">
    <span className="text-xs">{label}: {value}</span>
    <Button
      variant="ghost"
      size="sm"
      onClick={onRemove}
      className="h-4 w-4 p-0 hover:bg-transparent"
      aria-label={`Remove ${label} filter`}
    >
      <X className="h-3 w-3" />
    </Button>
  </Badge>
);

interface AutocompleteDropdownProps {
  query: string;
  suggestions: string[];
  onSelect: (value: string) => void;
  loading?: boolean;
}

const AutocompleteDropdown: React.FC<AutocompleteDropdownProps> = ({
  query,
  suggestions,
  onSelect,
  loading = false
}) => (
  <Command className="rounded-lg border shadow-md">
    <CommandInput placeholder="Search agents..." value={query} />
    <CommandList>
      {loading ? (
        <div className="p-4 text-sm text-muted-foreground">Loading suggestions...</div>
      ) : (
        <>
          <CommandEmpty>No suggestions found.</CommandEmpty>
          <CommandGroup>
            {suggestions.map((suggestion, index) => (
              <CommandItem
                key={index}
                onSelect={() => onSelect(suggestion)}
                className="cursor-pointer"
              >
                <Search className="mr-2 h-4 w-4" />
                {suggestion}
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      )}
    </CommandList>
  </Command>
);

interface VisualQueryBuilderProps {
  filters: SearchFormData;
  onChange: (filters: SearchFormData) => void;
}

const VisualQueryBuilder: React.FC<VisualQueryBuilderProps> = ({ filters, onChange }) => {
  const addCondition = () => {
    // Implementation for adding visual query conditions
    console.log('Adding visual query condition');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Visual Query Builder
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <span className="text-sm">Find agents where</span>
            <Select defaultValue="category">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="price">Price</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="equals">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">equals</SelectItem>
                <SelectItem value="contains">contains</SelectItem>
                <SelectItem value="greater">greater than</SelectItem>
              </SelectContent>
            </Select>
            <Input className="w-32" placeholder="value" />
            <Button size="sm" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={addCondition} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Condition
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  agents,
  loading = false,
  totalResults = 0,
  className = ''
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');

  const form = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: '',
      categories: [],
      capabilities: [],
      priceRange: [0, 1000],
      ratingRange: [0, 5],
      performanceMin: 0,
      tags: [],
      sortBy: 'relevance',
      sortOrder: 'desc'
    }
  });

  const { watch, setValue, handleSubmit, reset } = form;
  const currentFilters = watch();

  // Generate autocomplete suggestions
  const generateSuggestions = useCallback((query: string) => {
    if (!query.trim()) return [];
    
    const agentNames = agents.map(agent => agent.name);
    const capabilities = [...new Set(agents.flatMap(agent => agent.capabilities))];
    const tags = [...new Set(agents.flatMap(agent => agent.tags))];
    
    const allSuggestions = [...agentNames, ...capabilities, ...tags];
    return allSuggestions.filter(suggestion => 
      suggestion.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
  }, [agents]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = currentFilters.query || '';
      setSuggestions(generateSuggestions(query));
    }, 300);

    return () => clearTimeout(timer);
  }, [currentFilters.query, generateSuggestions]);

  // Available filter options
  const categories = useMemo(() => 
    [...new Set(agents.map(agent => agent.category))], [agents]
  );

  const capabilities = useMemo(() => 
    [...new Set(agents.flatMap(agent => agent.capabilities))], [agents]
  );

  const tags = useMemo(() => 
    [...new Set(agents.flatMap(agent => agent.tags))], [agents]
  );

  // Active filters for chip display
  const activeFilters = useMemo(() => {
    const filters: Array<{ label: string; value: string; key: string }> = [];
    
    if (currentFilters.categories?.length) {
      currentFilters.categories.forEach(category => 
        filters.push({ label: 'Category', value: category, key: `category-${category}` })
      );
    }
    
    if (currentFilters.capabilities?.length) {
      currentFilters.capabilities.forEach(capability => 
        filters.push({ label: 'Capability', value: capability, key: `capability-${capability}` })
      );
    }

    if (currentFilters.priceRange && (currentFilters.priceRange[0] > 0 || currentFilters.priceRange[1] < 1000)) {
      filters.push({ 
        label: 'Price', 
        value: `$${currentFilters.priceRange[0]}-$${currentFilters.priceRange[1]}`, 
        key: 'price-range' 
      });
    }

    if (currentFilters.ratingRange && (currentFilters.ratingRange[0] > 0 || currentFilters.ratingRange[1] < 5)) {
      filters.push({ 
        label: 'Rating', 
        value: `${currentFilters.ratingRange[0]}-${currentFilters.ratingRange[1]} stars`, 
        key: 'rating-range' 
      });
    }

    return filters;
  }, [currentFilters]);

  const onSubmit = (data: SearchFormData) => {
    onSearch(data);
  };

  const clearFilters = () => {
    reset();
    onSearch({});
  };

  const removeFilter = (key: string) => {
    if (key.startsWith('category-')) {
      const category = key.replace('category-', '');
      setValue('categories', currentFilters.categories?.filter(c => c !== category) || []);
    } else if (key.startsWith('capability-')) {
      const capability = key.replace('capability-', '');
      setValue('capabilities', currentFilters.capabilities?.filter(c => c !== capability) || []);
    } else if (key === 'price-range') {
      setValue('priceRange', [0, 1000]);
    } else if (key === 'rating-range') {
      setValue('ratingRange', [0, 5]);
    }
  };

  const saveSearch = () => {
    if (!searchName.trim()) return;
    
    const newSavedSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchName,
      query: currentFilters,
      createdAt: new Date().toISOString(),
      useCount: 0
    };
    
    setSavedSearches(prev => [...prev, newSavedSearch]);
    setSearchName('');
    setShowSaveDialog(false);
  };

  const loadSavedSearch = (savedSearch: SavedSearch) => {
    Object.entries(savedSearch.query).forEach(([key, value]) => {
      if (value !== undefined) {
        setValue(key as keyof SearchFormData, value as any);
      }
    });
    
    // Update use count
    setSavedSearches(prev => 
      prev.map(search => 
        search.id === savedSearch.id 
          ? { ...search, useCount: search.useCount + 1 }
          : search
      )
    );
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* Search Header */}
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Main Search Input */}
              <div className="relative">
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            placeholder="Search AI agents by name, capability, or description..."
                            className="pl-10 pr-4 h-12"
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                {/* Autocomplete Suggestions */}
                {currentFilters.query && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1">
                    <AutocompleteDropdown
                      query={currentFilters.query || ''}
                      suggestions={suggestions}
                      onSelect={(value) => setValue('query', value)}
                      loading={loading}
                    />
                  </div>
                )}
              </div>

              {/* Search Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
                  </Button>

                  <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        Save Search
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Save Search</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Search name..."
                          value={searchName}
                          onChange={(e) => setSearchName(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={saveSearch} disabled={!searchName.trim()}>
                            Save
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Saved Searches Dropdown */}
                  {savedSearches.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Clock className="h-4 w-4 mr-2" />
                          Saved ({savedSearches.length})
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {savedSearches.map(savedSearch => (
                              <div
                                key={savedSearch.id}
                                className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer"
                                onClick={() => loadSavedSearch(savedSearch)}
                              >
                                <div>
                                  <div className="font-medium">{savedSearch.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Used {savedSearch.useCount} times
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(savedSearch.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="sortBy"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="relevance">Relevance</SelectItem>
                            <SelectItem value="rating">Rating</SelectItem>
                            <SelectItem value="price">Price</SelectItem>
                            <SelectItem value="performance">Performance</SelectItem>
                            <SelectItem value="popularity">Popularity</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {activeFilters.map(filter => (
            <FilterChip
              key={filter.key}
              label={filter.label}
              value={filter.value}
              onRemove={() => removeFilter(filter.key)}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear All
          </Button>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Categories */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Categories</Label>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {categories.map(category => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={category}
                          checked={currentFilters.categories?.includes(category) || false}
                          onCheckedChange={(checked) => {
                            const current = currentFilters.categories || [];
                            if (checked) {
                              setValue('categories', [...current, category]);
                            } else {
                              setValue('categories', current.filter(c => c !== category));
                            }
                          }}
                        />
                        <Label htmlFor={category} className="text-sm">
                          {category}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Capabilities */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Capabilities</Label>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {capabilities.map(capability => (
                      <div key={capability} className="flex items-center space-x-2">
                        <Checkbox
                          id={capability}
                          checked={currentFilters.capabilities?.includes(capability) || false}
                          onCheckedChange={(checked) => {
                            const current = currentFilters.capabilities || [];
                            if (checked) {
                              setValue('capabilities', [...current, capability]);
                            } else {
                              setValue('capabilities', current.filter(c => c !== capability));
                            }
                          }}
                        />
                        <Label htmlFor={capability} className="text-sm">
                          {capability}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Price and Rating Ranges */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Price Range: ${currentFilters.priceRange?.[0] || 0} - ${currentFilters.priceRange?.[1] || 1000}
                  </Label>
                  <Slider
                    value={currentFilters.priceRange || [0, 1000]}
                    onValueChange={(value) => setValue('priceRange', value as [number, number])}
                    max={1000}
                    step={10}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Rating: {currentFilters.ratingRange?.[0] || 0} - {currentFilters.ratingRange?.[1] || 5} stars
                  </Label>
                  <Slider
                    value={currentFilters.ratingRange || [0, 5]}
                    onValueChange={(value) => setValue('ratingRange', value as [number, number])}
                    max={5}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Visual Query Builder */}
            <VisualQueryBuilder
              filters={currentFilters}
              onChange={(filters) => {
                Object.entries(filters).forEach(([key, value]) => {
                  if (value !== undefined) {
                    setValue(key as keyof SearchFormData, value as any);
                  }
                });
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Search Metrics */}