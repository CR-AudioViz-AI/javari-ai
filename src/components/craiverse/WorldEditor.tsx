```tsx
'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Paintbrush,
  Move,
  RotateCcw,
  Scale,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Layers,
  Cube,
  Mountain,
  Trees,
  Users,
  Settings,
  Save,
  Undo,
  Redo,
  Grid as GridIcon,
  Camera,
  Palette,
  Plus,
  Minus,
  Play,
  Square,
  MoreHorizontal
} from 'lucide-react'

interface User {
  id: string
  name: string
  avatar: string
  cursor: { x: number; y: number; z: number }
  isActive: boolean
}

interface WorldObject {
  id: string
  type: 'mesh' | 'light' | 'camera' | 'group'
  name: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  visible: boolean
  locked: boolean
  children?: WorldObject[]
}

interface TerrainSettings {
  heightScale: number
  subdivisions: number
  textureScale: number
  erosionStrength: number
}

interface LightingSettings {
  ambientIntensity: number
  sunIntensity: number
  sunPosition: [number, number, number]
  shadowQuality: 'low' | 'medium' | 'high'
  fogDensity: number
  fogColor: string
}

interface WorldEditorProps {
  worldId?: string
  isCollaborative?: boolean
  onSave?: (worldData: any) => void
  onLoad?: (worldId: string) => void
  className?: string
}

const WorldEditor: React.FC<WorldEditorProps> = ({
  worldId,
  isCollaborative = false,
  onSave,
  onLoad,
  className
}) => {
  const [selectedTool, setSelectedTool] = useState<'move' | 'rotate' | 'scale' | 'brush'>('move')
  const [selectedObject, setSelectedObject] = useState<WorldObject | null>(null)
  const [brushSize, setBrushSize] = useState(10)
  const [brushStrength, setBrushStrength] = useState(0.5)
  const [viewMode, setViewMode] = useState<'solid' | 'wireframe' | 'textured'>('solid')
  const [showGrid, setShowGrid] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  
  const [worldObjects, setWorldObjects] = useState<WorldObject[]>([
    {
      id: '1',
      type: 'mesh',
      name: 'Terrain',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false
    },
    {
      id: '2',
      type: 'light',
      name: 'Sun Light',
      position: [10, 10, 5],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false
    }
  ])

  const [connectedUsers, setConnectedUsers] = useState<User[]>([
    {
      id: '1',
      name: 'Alice Chen',
      avatar: 'AC',
      cursor: { x: 0, y: 0, z: 0 },
      isActive: true
    },
    {
      id: '2',
      name: 'Bob Smith',
      avatar: 'BS',
      cursor: { x: 5, y: 2, z: 3 },
      isActive: true
    }
  ])

  const [terrainSettings, setTerrainSettings] = useState<TerrainSettings>({
    heightScale: 5,
    subdivisions: 64,
    textureScale: 1,
    erosionStrength: 0.3
  })

  const [lightingSettings, setLightingSettings] = useState<LightingSettings>({
    ambientIntensity: 0.4,
    sunIntensity: 1,
    sunPosition: [10, 10, 5],
    shadowQuality: 'medium',
    fogDensity: 0.02,
    fogColor: '#87CEEB'
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleSave = useCallback(() => {
    const worldData = {
      objects: worldObjects,
      terrainSettings,
      lightingSettings,
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        worldId
      }
    }
    onSave?.(worldData)
  }, [worldObjects, terrainSettings, lightingSettings, worldId, onSave])

  const handleUndo = useCallback(() => {
    // Implement undo functionality
  }, [])

  const handleRedo = useCallback(() => {
    // Implement redo functionality
  }, [])

  const TerrainMesh = () => {
    const meshRef = useRef<THREE.Mesh>(null)
    
    useEffect(() => {
      if (meshRef.current) {
        const geometry = new THREE.PlaneGeometry(
          100, 
          100, 
          terrainSettings.subdivisions, 
          terrainSettings.subdivisions
        )
        
        // Generate height map
        const vertices = geometry.attributes.position.array
        for (let i = 0; i < vertices.length; i += 3) {
          const x = vertices[i]
          const z = vertices[i + 2]
          vertices[i + 1] = Math.sin(x * 0.1) * Math.cos(z * 0.1) * terrainSettings.heightScale
        }
        
        geometry.attributes.position.needsUpdate = true
        geometry.computeVertexNormals()
        
        meshRef.current.geometry = geometry
      }
    }, [terrainSettings])

    return (
      <mesh 
        ref={meshRef} 
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100, 64, 64]} />
        <meshLambertMaterial 
          color="#8B7355" 
          wireframe={viewMode === 'wireframe'}
        />
      </mesh>
    )
  }

  const CollaborativeCursors = () => {
    return (
      <>
        {connectedUsers.map(user => user.isActive && (
          <mesh key={user.id} position={[user.cursor.x, user.cursor.y + 0.5, user.cursor.z]}>
            <sphereGeometry args={[0.1]} />
            <meshBasicMaterial color="#ff4444" />
          </mesh>
        ))}
      </>
    )
  }

  const Scene = () => {
    const { camera } = useThree()
    
    useEffect(() => {
      camera.position.set(20, 15, 20)
      camera.lookAt(0, 0, 0)
    }, [camera])

    return (
      <>
        <PerspectiveCamera makeDefault fov={60} />
        <OrbitControls enablePan enableZoom enableRotate />
        
        <ambientLight intensity={lightingSettings.ambientIntensity} />
        <directionalLight
          position={lightingSettings.sunPosition}
          intensity={lightingSettings.sunIntensity}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <TerrainMesh />
        {showGrid && <Grid args={[100, 100]} />}
        {isCollaborative && <CollaborativeCursors />}
        
        <fog 
          attach="fog" 
          args={[lightingSettings.fogColor, 50, 200]} 
        />
      </>
    )
  }

  const ToolPalette = () => (
    <Card className="w-64">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Tools</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          <TooltipProvider>
            {[
              { tool: 'move', icon: Move, label: 'Move' },
              { tool: 'rotate', icon: RotateCcw, label: 'Rotate' },
              { tool: 'scale', icon: Scale, label: 'Scale' },
              { tool: 'brush', icon: Paintbrush, label: 'Brush' }
            ].map(({ tool, icon: Icon, label }) => (
              <Tooltip key={tool}>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectedTool === tool ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool(tool as any)}
                    className="h-10 w-10 p-0"
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>

        {selectedTool === 'brush' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="brush-size">Brush Size</Label>
              <Slider
                id="brush-size"
                min={1}
                max={50}
                step={1}
                value={[brushSize]}
                onValueChange={([value]) => setBrushSize(value)}
                className="mt-1"
              />
              <span className="text-xs text-muted-foreground">{brushSize}</span>
            </div>
            <div>
              <Label htmlFor="brush-strength">Strength</Label>
              <Slider
                id="brush-strength"
                min={0}
                max={1}
                step={0.1}
                value={[brushStrength]}
                onValueChange={([value]) => setBrushStrength(value)}
                className="mt-1"
              />
              <span className="text-xs text-muted-foreground">{brushStrength}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const ObjectHierarchy = () => (
    <Card className="w-64">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-1">
            {worldObjects.map(obj => (
              <div
                key={obj.id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                  selectedObject?.id === obj.id ? 'bg-accent' : ''
                }`}
                onClick={() => setSelectedObject(obj)}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    setWorldObjects(objects =>
                      objects.map(o =>
                        o.id === obj.id ? { ...o, visible: !o.visible } : o
                      )
                    )
                  }}
                  aria-label={obj.visible ? 'Hide object' : 'Show object'}
                >
                  {obj.visible ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                </Button>
                <span className="text-sm flex-1">{obj.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {obj.type}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )

  const PropertiesPanel = () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Properties</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="transform" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transform" className="text-xs">Transform</TabsTrigger>
            <TabsTrigger value="material" className="text-xs">Material</TabsTrigger>
            <TabsTrigger value="physics" className="text-xs">Physics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="transform" className="space-y-4 mt-4">
            {selectedObject && (
              <>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedObject.position.map((value, index) => (
                      <Input
                        key={index}
                        type="number"
                        value={value}
                        onChange={(e) => {
                          const newPosition = [...selectedObject.position] as [number, number, number]
                          newPosition[index] = parseFloat(e.target.value) || 0
                          setSelectedObject({ ...selectedObject, position: newPosition })
                        }}
                        placeholder={['X', 'Y', 'Z'][index]}
                        className="text-xs"
                      />
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Rotation</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedObject.rotation.map((value, index) => (
                      <Input
                        key={index}
                        type="number"
                        value={Math.round(value * 180 / Math.PI)}
                        onChange={(e) => {
                          const newRotation = [...selectedObject.rotation] as [number, number, number]
                          newRotation[index] = (parseFloat(e.target.value) || 0) * Math.PI / 180
                          setSelectedObject({ ...selectedObject, rotation: newRotation })
                        }}
                        placeholder={['X', 'Y', 'Z'][index]}
                        className="text-xs"
                      />
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Scale</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedObject.scale.map((value, index) => (
                      <Input
                        key={index}
                        type="number"
                        value={value}
                        onChange={(e) => {
                          const newScale = [...selectedObject.scale] as [number, number, number]
                          newScale[index] = parseFloat(e.target.value) || 1
                          setSelectedObject({ ...selectedObject, scale: newScale })
                        }}
                        placeholder={['X', 'Y', 'Z'][index]}
                        className="text-xs"
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="material" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Shader Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select shader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="toon">Toon</SelectItem>
                  <SelectItem value="matcap">MatCap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          
          <TabsContent value="physics" className="space-y-4 mt-4">
            <div className="flex items-center space-x-2">
              <Switch id="physics-enabled" />
              <Label htmlFor="physics-enabled">Enable Physics</Label>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )

  const CollaborativePanel = () => (
    <Card className="w-64">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Collaborators
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {connectedUsers.map(user => (
            <div key={user.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
                {user.avatar}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  {user.isActive ? 'Active' : 'Away'}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const TopToolbar = () => (
    <div className="flex items-center gap-2 p-2 border-b bg-background">
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={handleSave} className="gap-1">
          <Save className="h-4 w-4" />
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={handleUndo} className="gap-1">
          <Undo className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleRedo} className="gap-1">
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      
      <Separator orientation="vertical" className="h-6" />
      
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={isPlaying ? 'default' : 'outline'}
          onClick={() => setIsPlaying(!isPlaying)}
          className="gap-1"
        >
          {isPlaying ? (
            <>
              <Square className="h-4 w-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Play
            </>
          )}
        </Button>
      </div>
      
      <Separator orientation="vertical" className="h-6" />
      
      <div className="flex items-center gap-1">
        <Select value={viewMode} onValueChange={setViewMode}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="wireframe">Wireframe</SelectItem>
            <SelectItem value="textured">Textured</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          size="sm"
          variant={showGrid ? 'default' : 'outline'}
          onClick={() => setShowGrid(!showGrid)}
          className="gap-1"
        >
          <GridIcon className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="ml-auto flex items-center gap-2">
        <Badge variant="outline">World: {worldId || 'Untitled'}</Badge>
        {isCollaborative && (
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {connectedUsers.filter(u => u.isActive).length}
          </Badge>
        )}
      </div>
    </div>
  )

  return (
    <TooltipProvider>
      <div className={`flex flex-col h-screen bg-background ${className}`}>
        <TopToolbar />
        
        <div className="flex-1 flex overflow-hidden">
          <div className="flex flex-col gap-4 p-4 border-r">
            <ToolPalette />
            <ObjectHierarchy />
            {isCollaborative && <CollaborativePanel />}
          </div>
          
          <div className="flex-1 relative">
            <Canvas
              ref={canvasRef}
              shadows
              camera={{ fov: 60, position: [20, 15, 20] }}
              className="w-full h-full"
            >
              <Scene />
              <Environment preset="sunset" />
            </Canvas>
          </div>
          
          <div className="w-80 p-4 border-l bg-muted/30">
            <PropertiesPanel />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default WorldEditor
```