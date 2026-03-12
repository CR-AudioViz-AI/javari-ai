```tsx
'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Sky, Environment } from '@react-three/drei'
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core'
import { useHotkeys } from 'react-hotkeys-hook'
import { create } from 'zustand'
import * as THREE from 'three'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Layers, 
  Move3D, 
  RotateCw, 
  Scale, 
  Sun, 
  Cloud, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  Undo,
  Redo,
  Settings,
  Save,
  Upload,
  Download,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Palette,
  Mountain,
  Trees,
  Home,
  Car,
  Lightbulb
} from 'lucide-react'

// Types
interface WorldObject {
  id: string
  type: 'terrain' | 'building' | 'vegetation' | 'prop' | 'light'
  name: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  properties: Record<string, any>
  visible: boolean
  locked: boolean
}

interface WorldEnvironment {
  skyType: 'sky' | 'hdri' | 'gradient'
  sunPosition: [number, number, number]
  sunIntensity: number
  ambientIntensity: number
  fogDensity: number
  fogColor: string
  gravity: number
  windSpeed: number
  timeOfDay: number
}

interface WorldAction {
  type: 'add' | 'remove' | 'transform' | 'modify'
  objectId?: string
  previousState?: any
  newState?: any
  timestamp: number
}

interface WorldBuilderState {
  objects: WorldObject[]
  selectedObjects: string[]
  environment: WorldEnvironment
  activeLayer: string
  layers: { id: string; name: string; visible: boolean; locked: boolean }[]
  history: WorldAction[]
  historyIndex: number
  currentTool: 'select' | 'move' | 'rotate' | 'scale' | 'terrain' | 'paint'
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
}

// Zustand store
const useWorldBuilder = create<WorldBuilderState & {
  addObject: (object: WorldObject) => void
  removeObject: (id: string) => void
  updateObject: (id: string, updates: Partial<WorldObject>) => void
  selectObjects: (ids: string[]) => void
  setTool: (tool: WorldBuilderState['currentTool']) => void
  updateEnvironment: (updates: Partial<WorldEnvironment>) => void
  undo: () => void
  redo: () => void
  addAction: (action: WorldAction) => void
}>((set, get) => ({
  objects: [],
  selectedObjects: [],
  environment: {
    skyType: 'sky',
    sunPosition: [10, 10, 5],
    sunIntensity: 1,
    ambientIntensity: 0.4,
    fogDensity: 0,
    fogColor: '#ffffff',
    gravity: -9.81,
    windSpeed: 0,
    timeOfDay: 12
  },
  activeLayer: 'default',
  layers: [{ id: 'default', name: 'Default', visible: true, locked: false }],
  history: [],
  historyIndex: -1,
  currentTool: 'select',
  cameraPosition: [10, 10, 10],
  cameraTarget: [0, 0, 0],

  addObject: (object) => set((state) => ({
    objects: [...state.objects, object]
  })),

  removeObject: (id) => set((state) => ({
    objects: state.objects.filter(obj => obj.id !== id),
    selectedObjects: state.selectedObjects.filter(objId => objId !== id)
  })),

  updateObject: (id, updates) => set((state) => ({
    objects: state.objects.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
    )
  })),

  selectObjects: (ids) => set({ selectedObjects: ids }),

  setTool: (tool) => set({ currentTool: tool }),

  updateEnvironment: (updates) => set((state) => ({
    environment: { ...state.environment, ...updates }
  })),

  addAction: (action) => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push(action)
    return {
      history: newHistory,
      historyIndex: newHistory.length - 1
    }
  }),

  undo: () => set((state) => {
    if (state.historyIndex >= 0) {
      // Implement undo logic based on action type
      return { historyIndex: state.historyIndex - 1 }
    }
    return state
  }),

  redo: () => set((state) => {
    if (state.historyIndex < state.history.length - 1) {
      // Implement redo logic based on action type
      return { historyIndex: state.historyIndex + 1 }
    }
    return state
  })
}))

// Object Library Items
const OBJECT_LIBRARY = [
  { id: 'cube', name: 'Cube', type: 'prop', icon: '🟦', category: 'basic' },
  { id: 'sphere', name: 'Sphere', type: 'prop', icon: '🔵', category: 'basic' },
  { id: 'cylinder', name: 'Cylinder', type: 'prop', icon: '🔶', category: 'basic' },
  { id: 'tree', name: 'Tree', type: 'vegetation', icon: '🌳', category: 'nature' },
  { id: 'rock', name: 'Rock', type: 'prop', icon: '🪨', category: 'nature' },
  { id: 'house', name: 'House', type: 'building', icon: '🏠', category: 'buildings' },
  { id: 'car', name: 'Car', type: 'prop', icon: '🚗', category: 'vehicles' },
  { id: 'light', name: 'Point Light', type: 'light', icon: '💡', category: 'lighting' }
]

// Draggable Object Component
const DraggableObject: React.FC<{ item: typeof OBJECT_LIBRARY[0] }> = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${item.id}`,
    data: { type: 'object', item }
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3 border rounded-lg cursor-grab active:cursor-grabbing hover:bg-accent/50 transition-colors"
    >
      <div className="text-2xl mb-1">{item.icon}</div>
      <div className="text-xs font-medium">{item.name}</div>
    </div>
  )
}

// 3D Scene Object
const SceneObject: React.FC<{ object: WorldObject; isSelected: boolean }> = ({ object, isSelected }) => {
  const meshRef = useRef<THREE.Mesh>(null)

  const handleClick = useCallback((event: THREE.Event) => {
    event.stopPropagation()
    const { selectObjects } = useWorldBuilder.getState()
    selectObjects([object.id])
  }, [object.id])

  const renderGeometry = () => {
    switch (object.type) {
      case 'prop':
        if (object.name === 'Cube') return <boxGeometry args={[1, 1, 1]} />
        if (object.name === 'Sphere') return <sphereGeometry args={[0.5, 32, 32]} />
        if (object.name === 'Cylinder') return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
        break
      case 'vegetation':
        return <coneGeometry args={[0.5, 2, 8]} />
      case 'building':
        return <boxGeometry args={[2, 2, 2]} />
      default:
        return <boxGeometry args={[1, 1, 1]} />
    }
  }

  return (
    <mesh
      ref={meshRef}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={handleClick}
      visible={object.visible}
    >
      {renderGeometry()}
      <meshStandardMaterial
        color={isSelected ? '#ff6b35' : object.properties.color || '#8b8b8b'}
        wireframe={isSelected}
      />
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[renderGeometry()]} />
          <lineBasicMaterial color="#ff6b35" />
        </lineSegments>
      )}
    </mesh>
  )
}

// Main 3D Canvas
const WorldBuilderCanvas: React.FC = () => {
  const { setNodeRef } = useDroppable({ id: 'canvas' })
  const { objects, selectedObjects, environment } = useWorldBuilder()

  return (
    <div ref={setNodeRef} className="w-full h-full">
      <Canvas
        camera={{ position: [10, 10, 10], fov: 60 }}
        shadows
      >
        <OrbitControls enablePan enableZoom enableRotate />
        
        {/* Environment */}
        {environment.skyType === 'sky' && <Sky sunPosition={environment.sunPosition} />}
        {environment.skyType === 'hdri' && <Environment preset="sunset" />}
        
        {/* Lighting */}
        <ambientLight intensity={environment.ambientIntensity} />
        <directionalLight
          position={environment.sunPosition}
          intensity={environment.sunIntensity}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        {/* Grid */}
        <Grid infiniteGrid cellSize={1} cellThickness={0.5} cellColor="#6b7280" sectionColor="#374151" />
        
        {/* Scene Objects */}
        {objects.map(object => (
          <SceneObject
            key={object.id}
            object={object}
            isSelected={selectedObjects.includes(object.id)}
          />
        ))}

        {/* Ground */}
        <mesh receiveShadow position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
      </Canvas>
    </div>
  )
}

// Terrain Tool Panel
const TerrainToolPanel: React.FC = () => {
  const [brushSize, setBrushSize] = useState([5])
  const [brushStrength, setBrushStrength] = useState([0.5])
  const [selectedTexture, setSelectedTexture] = useState('grass')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mountain className="w-4 h-4" />
          Terrain Tools
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Brush Size</Label>
          <Slider
            value={brushSize}
            onValueChange={setBrushSize}
            max={20}
            min={1}
            step={0.5}
            className="mt-2"
          />
          <span className="text-sm text-muted-foreground">{brushSize[0]} units</span>
        </div>
        
        <div>
          <Label>Brush Strength</Label>
          <Slider
            value={brushStrength}
            onValueChange={setBrushStrength}
            max={2}
            min={0.1}
            step={0.1}
            className="mt-2"
          />
          <span className="text-sm text-muted-foreground">{brushStrength[0]}x</span>
        </div>

        <div>
          <Label>Texture</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {['grass', 'dirt', 'stone', 'sand', 'snow', 'mud'].map((texture) => (
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

        <div className="grid grid-cols-2 gap-2">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Raise
          </Button>
          <Button size="sm" variant="outline">
            <Minus className="w-4 h-4 mr-2" />
            Lower
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Object Library
const ObjectLibrary: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const categories = ['all', 'basic', 'nature', 'buildings', 'vehicles', 'lighting']

  const filteredObjects = OBJECT_LIBRARY.filter(item =>
    selectedCategory === 'all' || item.category === selectedCategory
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Object Library
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1 mb-4">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="xs"
              onClick={() => setSelectedCategory(category)}
              className="capitalize"
            >
              {category}
            </Button>
          ))}
        </div>
        
        <ScrollArea className="h-64">
          <div className="grid grid-cols-3 gap-2">
            {filteredObjects.map((item) => (
              <DraggableObject key={item.id} item={item} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Environment Controls
const EnvironmentControls: React.FC = () => {
  const { environment, updateEnvironment } = useWorldBuilder()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="w-4 h-4" />
          Environment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Sky Type</Label>
          <div className="flex gap-2 mt-2">
            {['sky', 'hdri', 'gradient'].map((type) => (
              <Button
                key={type}
                variant={environment.skyType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateEnvironment({ skyType: type as any })}
                className="capitalize"
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label>Sun Intensity</Label>
          <Slider
            value={[environment.sunIntensity]}
            onValueChange={([value]) => updateEnvironment({ sunIntensity: value })}
            max={3}
            min={0}
            step={0.1}
            className="mt-2"
          />
          <span className="text-sm text-muted-foreground">{environment.sunIntensity.toFixed(1)}</span>
        </div>

        <div>
          <Label>Ambient Light</Label>
          <Slider
            value={[environment.ambientIntensity]}
            onValueChange={([value]) => updateEnvironment({ ambientIntensity: value })}
            max={2}
            min={0}
            step={0.1}
            className="mt-2"
          />
          <span className="text-sm text-muted-foreground">{environment.ambientIntensity.toFixed(1)}</span>
        </div>

        <div>
          <Label>Time of Day</Label>
          <Slider
            value={[environment.timeOfDay]}
            onValueChange={([value]) => updateEnvironment({ timeOfDay: value })}
            max={24}
            min={0}
            step={0.5}
            className="mt-2"
          />
          <span className="text-sm text-muted-foreground">{environment.timeOfDay}:00</span>
        </div>

        <div>
          <Label>Fog Density</Label>
          <Slider
            value={[environment.fogDensity]}
            onValueChange={([value]) => updateEnvironment({ fogDensity: value })}
            max={0.1}
            min={0}
            step={0.005}
            className="mt-2"
          />
          <span className="text-sm text-muted-foreground">{environment.fogDensity.toFixed(3)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Layer Manager
const LayerManager: React.FC = () => {
  const { layers, objects } = useWorldBuilder()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Layers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          {layers.map((layer) => {
            const layerObjects = objects.filter(obj => obj.properties.layer === layer.id)
            
            return (
              <div key={layer.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div className="flex items-center gap-2">
                  <Button size="xs" variant="ghost">
                    {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </Button>
                  <Button size="xs" variant="ghost">
                    {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </Button>
                  <span className="text-sm font-medium">{layer.name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {layerObjects.length}
                </Badge>
              </div>
            )
          })}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Transform Gizmo Controls
const TransformGizmo: React.FC = () => {
  const { currentTool, setTool } = useWorldBuilder()

  const tools = [
    { id: 'select', icon: MapPin, label: 'Select' },
    { id: 'move', icon: Move3D, label: 'Move' },
    { id: 'rotate', icon: RotateCw, label: 'Rotate' },
    { id: 'scale', icon: Scale, label: 'Scale' }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transform Tools</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={currentTool === tool.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTool(tool.id as any)}
            >
              <tool.icon className="w-4 h-4 mr-2" />
              {tool.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Properties Panel
const PropertiesPanel: React.FC = () => {
  const { selectedObjects, objects } = useWorldBuilder()
  const selectedObject = selectedObjects.length === 1 ? objects.find(obj => obj.id === selectedObjects[0]) : null

  if (!selectedObject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select an object to view properties</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Properties - {selectedObject.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={selectedObject.name} className="mt-1" />
        </div>

        <div>
          <Label>Position</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <Input type="number" value={selectedObject.position[0].toFixed(2)} placeholder="X" />
            <Input type="number" value={selectedObject.position[1].toFixed(2)} placeholder="Y" />
            <Input type="number" value={selectedObject.position[2].toFixed(2)} placeholder="Z" />
          </div>