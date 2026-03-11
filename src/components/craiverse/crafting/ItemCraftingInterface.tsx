```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Filter,
  Zap,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  Sparkles,
  Hammer,
} from 'lucide-react';

// Types
interface Material {
  id: string;
  name: string;
  type: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  quality: number;
  quantity: number;
  icon: string;
  properties: Record<string, any>;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  category: string;
  level_required: number;
  materials_required: {
    material_id: string;
    quantity: number;
    quality_min?: number;
  }[];
  result_item: {
    name: string;
    type: string;
    icon: string;
    properties: Record<string, any>;
  };
  base_success_rate: number;
  crafting_time: number;
  energy_cost: number;
}

interface CraftingSlot {
  id: string;
  material?: Material;
  required_material_id?: string;
  required_quantity: number;
}

interface CraftingState {
  selectedRecipe: Recipe | null;
  craftingSlots: CraftingSlot[];
  inventory: Material[];
  crafting: boolean;
  progress: number;
  filters: {
    category: string;
    level: string;
    search: string;
  };
  setSelectedRecipe: (recipe: Recipe | null) => void;
  updateCraftingSlot: (slotId: string, material: Material | null) => void;
  setInventory: (inventory: Material[]) => void;
  setCrafting: (crafting: boolean) => void;
  setProgress: (progress: number) => void;
  updateFilters: (filters: Partial<CraftingState['filters']>) => void;
  clearCraftingSlots: () => void;
}

// Zustand store
const useCraftingStore = create<CraftingState>((set) => ({
  selectedRecipe: null,
  craftingSlots: [],
  inventory: [],
  crafting: false,
  progress: 0,
  filters: {
    category: 'all',
    level: 'all',
    search: '',
  },
  setSelectedRecipe: (recipe) => {
    const slots = recipe
      ? recipe.materials_required.map((req, index) => ({
          id: `slot-${index}`,
          required_material_id: req.material_id,
          required_quantity: req.quantity,
        }))
      : [];
    set({ selectedRecipe: recipe, craftingSlots: slots });
  },
  updateCraftingSlot: (slotId, material) =>
    set((state) => ({
      craftingSlots: state.craftingSlots.map((slot) =>
        slot.id === slotId ? { ...slot, material } : slot
      ),
    })),
  setInventory: (inventory) => set({ inventory }),
  setCrafting: (crafting) => set({ crafting }),
  setProgress: (progress) => set({ progress }),
  updateFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),
  clearCraftingSlots: () =>
    set((state) => ({
      craftingSlots: state.craftingSlots.map((slot) => ({
        ...slot,
        material: undefined,
      })),
    })),
}));

// Drag and Drop Types
const ItemTypes = {
  MATERIAL: 'material',
};

// Components
const MaterialTooltip: React.FC<{ material: Material; children: React.ReactNode }> = ({
  material,
  children,
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="right" className="max-w-xs">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <img src={material.icon} alt={material.name} className="w-6 h-6" />
          <span className="font-semibold">{material.name}</span>
          <Badge variant="outline" className={`rarity-${material.rarity}`}>
            {material.rarity}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          Type: {material.type}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Star className="w-4 h-4" />
          Quality: {material.quality}/100
        </div>
        <div className="text-sm">Quantity: {material.quantity}</div>
      </div>
    </TooltipContent>
  </Tooltip>
);

const DraggableMaterial: React.FC<{ material: Material }> = ({ material }) => {
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.MATERIAL,
    item: { material },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <MaterialTooltip material={material}>
      <motion.div
        ref={drag}
        className={`
          flex items-center gap-2 p-2 rounded-lg border cursor-grab
          ${isDragging ? 'opacity-50' : 'opacity-100'}
          hover:bg-accent transition-colors
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <img src={material.icon} alt={material.name} className="w-8 h-8" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{material.name}</div>
          <div className="text-xs text-muted-foreground">
            Qty: {material.quantity}
          </div>
        </div>
        <Badge variant="outline" className={`rarity-${material.rarity} text-xs`}>
          {material.rarity}
        </Badge>
      </motion.div>
    </MaterialTooltip>
  );
};

const CraftingSlotDropZone: React.FC<{ slot: CraftingSlot }> = ({ slot }) => {
  const { updateCraftingSlot } = useCraftingStore();
  
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemTypes.MATERIAL,
    drop: (item: { material: Material }) => {
      updateCraftingSlot(slot.id, item.material);
    },
    canDrop: (item: { material: Material }) => {
      return !slot.required_material_id || item.material.id === slot.required_material_id;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const handleRemoveMaterial = () => {
    updateCraftingSlot(slot.id, null);
  };

  const isValidDrop = isOver && canDrop;
  const isInvalidDrop = isOver && !canDrop;

  return (
    <div
      ref={drop}
      className={`
        relative w-20 h-20 border-2 border-dashed rounded-lg
        flex items-center justify-center transition-colors
        ${slot.material ? 'border-green-500 bg-green-50' : 'border-gray-300'}
        ${isValidDrop ? 'border-blue-500 bg-blue-50' : ''}
        ${isInvalidDrop ? 'border-red-500 bg-red-50' : ''}
      `}
    >
      {slot.material ? (
        <MaterialTooltip material={slot.material}>
          <div className="relative group">
            <img
              src={slot.material.icon}
              alt={slot.material.name}
              className="w-12 h-12 object-cover rounded"
            />
            <Button
              size="sm"
              variant="destructive"
              className="absolute -top-2 -right-2 w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleRemoveMaterial}
            >
              ×
            </Button>
            <div className="absolute bottom-0 right-0 bg-background rounded text-xs px-1">
              {slot.material.quantity}
            </div>
          </div>
        </MaterialTooltip>
      ) : (
        <Package className="w-8 h-8 text-muted-foreground" />
      )}
      
      <div className="absolute -bottom-6 text-xs text-center">
        {slot.required_quantity}x
      </div>
    </div>
  );
};

const SuccessProbabilityCalculator: React.FC = () => {
  const { selectedRecipe, craftingSlots } = useCraftingStore();
  
  const probability = useMemo(() => {
    if (!selectedRecipe) return 0;
    
    let baseRate = selectedRecipe.base_success_rate;
    let qualityBonus = 0;
    let completionPenalty = 0;
    
    const filledSlots = craftingSlots.filter(slot => slot.material);
    const totalSlots = craftingSlots.length;
    
    if (filledSlots.length < totalSlots) {
      completionPenalty = (totalSlots - filledSlots.length) * 20;
    }
    
    filledSlots.forEach(slot => {
      if (slot.material) {
        const qualityFactor = slot.material.quality / 100;
        qualityBonus += qualityFactor * 10;
      }
    });
    
    return Math.max(0, Math.min(100, baseRate + qualityBonus - completionPenalty));
  }, [selectedRecipe, craftingSlots]);
  
  const getProgressColor = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    if (value >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (!selectedRecipe) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Success Probability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Success Rate</span>
            <span className="font-semibold">{probability.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(probability)}`}
              style={{ width: `${probability}%` }}
            />
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Base Rate:</span>
            <span>{selectedRecipe.base_success_rate}%</span>
          </div>
          <div className="flex justify-between">
            <span>Quality Bonus:</span>
            <span className="text-green-600">+{(probability - selectedRecipe.base_success_rate).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Energy Cost:</span>
            <span>{selectedRecipe.energy_cost}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Craft Time:</span>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{selectedRecipe.crafting_time}s</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CraftingProgressBar: React.FC = () => {
  const { crafting, progress } = useCraftingStore();

  if (!crafting) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2">
        <Hammer className="w-5 h-5 animate-bounce" />
        <span className="font-semibold">Crafting in progress...</span>
      </div>
      <Progress value={progress} className="w-full" />
    </motion.div>
  );
};

const RecipeFilterControls: React.FC = () => {
  const { filters, updateFilters } = useCraftingStore();

  return (
    <div className="flex gap-4 items-center">
      <div className="flex-1">
        <Input
          placeholder="Search recipes..."
          value={filters.search}
          onChange={(e) => updateFilters({ search: e.target.value })}
          className="w-full"
          icon={<Search className="w-4 h-4" />}
        />
      </div>
      
      <Select
        value={filters.category}
        onValueChange={(value) => updateFilters({ category: value })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="weapons">Weapons</SelectItem>
          <SelectItem value="armor">Armor</SelectItem>
          <SelectItem value="tools">Tools</SelectItem>
          <SelectItem value="consumables">Consumables</SelectItem>
          <SelectItem value="materials">Materials</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.level}
        onValueChange={(value) => updateFilters({ level: value })}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Level" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Levels</SelectItem>
          <SelectItem value="1-10">1-10</SelectItem>
          <SelectItem value="11-25">11-25</SelectItem>
          <SelectItem value="26-50">26-50</SelectItem>
          <SelectItem value="51+">51+</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

const RecipeDiscoveryPanel: React.FC<{ recipes: Recipe[] }> = ({ recipes }) => {
  const { selectedRecipe, setSelectedRecipe, filters } = useCraftingStore();

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesSearch = recipe.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                          recipe.description.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesCategory = filters.category === 'all' || recipe.category === filters.category;
      
      const matchesLevel = filters.level === 'all' || (() => {
        const level = recipe.level_required;
        switch (filters.level) {
          case '1-10': return level >= 1 && level <= 10;
          case '11-25': return level >= 11 && level <= 25;
          case '26-50': return level >= 26 && level <= 50;
          case '51+': return level >= 51;
          default: return true;
        }
      })();
      
      return matchesSearch && matchesCategory && matchesLevel;
    });
  }, [recipes, filters]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recipe Discovery</CardTitle>
        <CardDescription>
          Choose a recipe to start crafting
        </CardDescription>
        <RecipeFilterControls />
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            <AnimatePresence>
              {filteredRecipes.map((recipe) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedRecipe?.id === recipe.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                    }
                  `}
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={recipe.result_item.icon}
                      alt={recipe.name}
                      className="w-10 h-10 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{recipe.name}</span>
                        <Badge variant="outline">Lv. {recipe.level_required}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {recipe.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{recipe.base_success_rate}% success</span>
                        <span>{recipe.crafting_time}s</span>
                        <span>{recipe.energy_cost} energy</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const CraftingWorkbench: React.FC = () => {
  const { 
    selectedRecipe, 
    craftingSlots, 
    crafting, 
    progress,
    setCrafting, 
    setProgress,
    clearCraftingSlots 
  } = useCraftingStore();

  const canCraft = useMemo(() => {
    if (!selectedRecipe || crafting) return false;
    return craftingSlots.every(slot => 
      slot.material && slot.material.quantity >= slot.required_quantity
    );
  }, [selectedRecipe, craftingSlots, crafting]);

  const handleStartCrafting = async () => {
    if (!canCraft) return;
    
    setCrafting(true);
    setProgress(0);
    
    // Simulate crafting progress
    const duration = selectedRecipe!.crafting_time * 1000;
    const interval = 50;
    let elapsed = 0;
    
    const progressInterval = setInterval(() => {
      elapsed += interval;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);
      
      if (newProgress >= 100) {
        clearInterval(progressInterval);
        setCrafting(false);
        setProgress(0);
        clearCraftingSlots();
        // Handle crafting completion
      }
    }, interval);
  };

  if (!selectedRecipe) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center text-muted-foreground">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold mb-2">No Recipe Selected</p>
            <p>Choose a recipe from the discovery panel to start crafting</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hammer className="w-5 h-5" />
          Crafting Workbench
        </CardTitle>
        <CardDescription>
          Drag materials into the slots to begin crafting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <img
            src={selectedRecipe.result_item.icon}
            alt={selectedRecipe.name}
            className="w-16 h-16 mx-auto mb-2 rounded-lg"
          />
          <h3 className="font-semibold text-lg">{selectedRecipe.name}</h3>
          <p className="text-sm text-muted-foreground">
            {selectedRecipe.description}
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Required Materials</h4>
          <div className="flex gap-4 justify-center flex-wrap">
            {craftingSlots.map((slot) => (
              <CraftingSlotDropZone key={slot.id} slot={slot} />
            ))}
          </div>
        </div>

        <CraftingProgressBar />

        <div className="flex gap-2">
          <Button
            onClick={handleStartCrafting}
            disabled={!canCraft}
            className="flex-1"
            size="lg"
          >