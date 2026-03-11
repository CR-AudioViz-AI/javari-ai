'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, TransformControls, Text, Box, Sphere, Plane } from '@react-three/drei'
import * as THREE from 'three'
import { useDrag, useDrop, DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Search, 
  Layers, 
  Move3d, 
  RotateCw, 
  Scale3d, 
  Grid3x3, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  Mountain,
  TreePine,
  Home,
  Palette,
  Users,
  Settings,
  Download,
  Upload,
  Trash2,
  Copy,
  Play,
  Pause
} from 'lucide-react'

// Types
interface Asset3D {
  id: string
  name: string
  category: 'building' | 'terrain' | 'prop' | 'vegetation'
  thumbnail: string
  model: string
  metadata: {
    vertices: number
    materials: number
    size: { x: number; y: number; z: number }
    tags: string[]
  }
}

interface SceneObject {
  id: string
  assetId: string
  name: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  visible: boolean
  locked: boolean
  layer: number
  properties: Record<string, any>
}

interface CollaboratorCursor {
  userId: string
  userName: string
  avatar: string
  position: [number, number]
  color: string
  lastSeen: number
}

interface TerrainData {
  heightMap: Float32Array
  textureMap: string[]
  waterLevel: number
  size: { width: number; height: number }
}

type ToolMode = 'select' | 'translate' | 'rotate' | 'scale' | 'terrain-height' | 'terrain-texture'

// Store
interface Environment3DStore {
  sceneObjects: SceneObject[]
  selectedObjectId: string | null
  toolMode: ToolMode
  showGrid: boolean
  snapEnabled: boolean
  snapSize: number
  terrainData: TerrainData
  collaborators: CollaboratorCursor[]
  isCollaborative: boolean
  setSceneObjects: (objects: SceneObject[]) => void
  addSceneObject: (object: SceneObject) => void
  updateSceneObject: (id: string, updates: Partial<SceneObject>) => void
  removeSceneObject: (id: string) => void
  setSelectedObjectId: (id: string | null) => void
  setToolMode: (mode: ToolMode) => void
  toggleGrid: () => void
  toggleSnap: () => void
  setSnapSize: (size: number) => void
  updateTerrainData: (data: Partial<TerrainData>) => void
  updateCollaborators: (collaborators: CollaboratorCursor[]) => void
}

const useEnvironmentStore = create<Environment3DStore>()(
  subscribeWithSelector((set, get) => ({
    sceneObjects: [],
    selectedObjectId: null,
    toolMode: 'select',
    showGrid: true,
    snapEnabled: false,
    snapSize: 1,
    terrainData: {
      heightMap: new Float32Array(256 * 256),
      textureMap: [],
      waterLevel: 0,
      size: { width: 256, height: 256 }
    },
    collaborators: [],
    isCollaborative: false,
    setSceneObjects: (objects) => set({ sceneObjects: objects }),
    addSceneObject: (object) => set((state) => ({ 
      sceneObjects: [...state.sceneObjects, object] 
    })),
    updateSceneObject: (id, updates) => set((state) => ({
      sceneObjects: state.sceneObjects.map(obj => 
        obj.id === id ? { ...obj, ...updates } : obj
      )
    })),
    removeSceneObject: (id) => set((state) => ({
      sceneObjects: state.sceneObjects.filter(obj => obj.id !== id)
    })),
    setSelectedObjectId: (id) => set({ selectedObjectId: id }),
    setToolMode: (mode) => set({ toolMode: mode }),
    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
    toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
    setSnapSize: (size) => set({ snapSize: size }),
    updateTerrainData: (data) => set((state) => ({
      terrainData: { ...state.terrainData, ...data }
    })),
    updateCollaborators: (collaborators) => set({ collaborators })
  }))
)

// Mock data
const MOCK_ASSETS: Asset3D[] = [
  {
    id: 'house-1',
    name: 'Modern House',
    category: 'building',
    thumbnail: '/api/placeholder/120/120',
    model: '/models/house-modern.glb',
    metadata: {
      vertices: 2450,
      materials: 3,
      size: { x: 10, y: 8, z: 12 },
      tags: ['residential', 'modern', 'family']
    }
  },
  {
    id: 'tree-1',
    name: 'Oak Tree',
    category: 'vegetation',
    thumbnail: '/api/placeholder/120/120',
    model: '/models/tree-oak.glb',
    metadata: {
      vertices: 1200,
      materials: 2,
      size: { x: 6, y: 15, z: 6 },
      tags: ['nature', 'deciduous', 'large']
    }
  },
  {
    id: 'rock-1',
    name: 'Boulder',
    category: 'terrain',
    thumbnail: '/api/placeholder/120/120',
    model: '/models/rock-boulder.glb',
    metadata: {
      vertices: 800,
      materials: 1,
      size: { x: 3, y: 2, z: 3 },
      tags: ['stone', 'natural', 'decoration']
    }
  }
]

// Asset Preview Card Component
interface AssetPreviewCardProps {
  asset: Asset3D
  onDragStart?: (asset: Asset3D) => void
}

const AssetPreviewCard: React.FC<AssetPreviewCardProps> = ({ asset, onDragStart }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'ASSET_3D',
    item: { asset },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    begin: () => onDragStart?.(asset)
  })

  return (
    <Card 
      ref={drag}
      className={`cursor-move transition-all hover:shadow-md ${isDragging ? 'opacity-50' : ''}`}
    >
      <CardContent className="p-3">
        <div className="aspect-square bg-muted rounded-md mb-2 overflow-hidden">
          <img 
            src={asset.thumbnail} 
            alt={asset.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
        <h4 className="font-medium text-sm mb-1 line-clamp-1">{asset.name}</h4>
        <div className="flex flex-wrap gap-1 mb-2">
          {asset.metadata.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>{asset.metadata.vertices.toLocaleString()} vertices</div>
          <div className="flex justify-between">
            <span>Materials: {asset.metadata.materials}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Asset Library Panel Component
const AssetLibraryPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredAssets = useMemo(() => {
    return MOCK_ASSETS.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           asset.metadata.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = selectedCategory === 'all' || asset.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [searchQuery, selectedCategory])

  return (
    <Card className="w-80 flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Download className="w-5 h-5" />
          Asset Library
        </CardTitle>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="building">Buildings</SelectItem>
              <SelectItem value="terrain">Terrain</SelectItem>
              <SelectItem value="prop">Props</SelectItem>
              <SelectItem value="vegetation">Vegetation</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-3">
        <ScrollArea className="h-full">
          <div className="grid grid-cols-2 gap-3">
            {filteredAssets.map(asset => (
              <AssetPreviewCard key={asset.id} asset={asset} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Terrain Tools Panel Component
const TerrainToolsPanel: React.FC = () => {
  const { terrainData, updateTerrainData } = useEnvironmentStore()
  const [brushSize, setBrushSize] = useState(10)
  const [brushStrength, setBrushStrength] = useState(0.5)
  const [selectedTexture, setSelectedTexture] = useState('grass')

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mountain className="w-5 h-5" />
          Terrain Tools
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="sculpt">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sculpt">Sculpt</TabsTrigger>
            <TabsTrigger value="paint">Paint</TabsTrigger>
            <TabsTrigger value="water">Water</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sculpt" className="space-y-4">
            <div className="space-y-2">
              <Label>Brush Size</Label>
              <Slider
                value={[brushSize]}
                onValueChange={(value) => setBrushSize(value[0])}
                max={50}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="text-sm text-muted-foreground">{brushSize}m</div>
            </div>
            
            <div className="space-y-2">
              <Label>Brush Strength</Label>
              <Slider
                value={[brushStrength]}
                onValueChange={(value) => setBrushStrength(value[0])}
                max={1}
                min={0.1}
                step={0.1}
                className="w-full"
              />
              <div className="text-sm text-muted-foreground">{brushStrength}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm">
                <Mountain className="w-4 h-4 mr-1" />
                Raise
              </Button>
              <Button variant="outline" size="sm">
                <Mountain className="w-4 h-4 mr-1 rotate-180" />
                Lower
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="paint" className="space-y-4">
            <div className="space-y-2">
              <Label>Texture</Label>
              <div className="grid grid-cols-2 gap-2">
                {['grass', 'dirt', 'stone', 'sand'].map(texture => (
                  <Button
                    key={texture}
                    variant={selectedTexture === texture ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTexture(texture)}
                    className="capitalize"
                  >
                    {texture}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="water" className="space-y-4">
            <div className="space-y-2">
              <Label>Water Level</Label>
              <Slider
                value={[terrainData.waterLevel]}
                onValueChange={(value) => updateTerrainData({ waterLevel: value[0] })}
                max={20}
                min={-10}
                step={0.5}
                className="w-full"
              />
              <div className="text-sm text-muted-foreground">{terrainData.waterLevel}m</div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Scene Hierarchy Panel Component
const SceneHierarchyPanel: React.FC = () => {
  const { sceneObjects, selectedObjectId, setSelectedObjectId, updateSceneObject, removeSceneObject } = useEnvironmentStore()

  return (
    <Card className="w-80 flex flex-col h-96">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Scene Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full px-3">
          <div className="space-y-1">
            {sceneObjects.map(object => {
              const isSelected = object.id === selectedObjectId
              return (
                <div
                  key={object.id}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-muted/50 ${
                    isSelected ? 'bg-primary/10 border border-primary/20' : ''
                  }`}
                  onClick={() => setSelectedObjectId(object.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{object.name}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateSceneObject(object.id, { visible: !object.visible })
                      }}
                    >
                      {object.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateSceneObject(object.id, { locked: !object.locked })
                      }}
                    >
                      {object.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Properties Panel Component
const PropertiesPanel: React.FC = () => {
  const { sceneObjects, selectedObjectId, updateSceneObject } = useEnvironmentStore()
  
  const selectedObject = useMemo(() => 
    sceneObjects.find(obj => obj.id === selectedObjectId), 
    [sceneObjects, selectedObjectId]
  )

  if (!selectedObject) {
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Select an object to edit properties
          </div>
        </CardContent>
      </Card>
    )
  }

  const handleTransformChange = (property: 'position' | 'rotation' | 'scale', index: number, value: number) => {
    const newTransform = [...selectedObject[property]]
    newTransform[index] = value
    updateSceneObject(selectedObject.id, { [property]: newTransform })
  }

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Properties
        </CardTitle>
        <CardDescription>{selectedObject.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Position</Label>
            <div className="grid grid-cols-3 gap-2">
              {['X', 'Y', 'Z'].map((axis, index) => (
                <div key={axis} className="space-y-1">
                  <Label className="text-xs">{axis}</Label>
                  <Input
                    type="number"
                    value={selectedObject.position[index]}
                    onChange={(e) => handleTransformChange('position', index, parseFloat(e.target.value) || 0)}
                    step={0.1}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rotation</Label>
            <div className="grid grid-cols-3 gap-2">
              {['X', 'Y', 'Z'].map((axis, index) => (
                <div key={axis} className="space-y-1">
                  <Label className="text-xs">{axis}</Label>
                  <Input
                    type="number"
                    value={THREE.MathUtils.radToDeg(selectedObject.rotation[index])}
                    onChange={(e) => handleTransformChange('rotation', index, THREE.MathUtils.degToRad(parseFloat(e.target.value) || 0))}
                    step={1}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scale</Label>
            <div className="grid grid-cols-3 gap-2">
              {['X', 'Y', 'Z'].map((axis, index) => (
                <div key={axis} className="space-y-1">
                  <Label className="text-xs">{axis}</Label>
                  <Input
                    type="number"
                    value={selectedObject.scale[index]}
                    onChange={(e) => handleTransformChange('scale', index, parseFloat(e.target.value) || 1)}
                    step={0.1}
                    min={0.1}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Visible</Label>
            <Switch
              checked={selectedObject.visible}
              onCheckedChange={(checked) => updateSceneObject(selectedObject.id, { visible: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Locked</Label>
            <Switch
              checked={selectedObject.locked}
              onCheckedChange={(checked) => updateSceneObject(selectedObject.id, { locked: checked })}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Copy className="w-4 h-4 mr-1" />
            Duplicate
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => removeSceneObject(selectedObject.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>