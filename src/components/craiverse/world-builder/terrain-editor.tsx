```tsx
"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
         AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
         AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
         DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { 
  Mountain, Brush, Layers, Users, GitBranch, Download, Upload, 
  Undo2, Redo2, Play, Pause, Settings, Eye, EyeOff, Plus, Trash2,
  RotateCcw, Save, Share, Zap, Waves, TreePine, Palette, Grid
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import * as THREE from 'three'

// Types and interfaces
interface TerrainPoint {
  x: number
  y: number
  height: number
  texture?: string
}

interface BrushSettings {
  size: number
  strength: number
  falloff: number
  type: 'raise' | 'lower' | 'smooth' | 'flatten' | 'texture'
  texture?: string
}

interface TextureLayer {
  id: string
  name: string
  texture: string
  opacity: number
  blendMode: string
  visible: boolean
  maskData?: Uint8Array
}

interface NoiseSettings {
  type: 'perlin' | 'simplex' | 'ridged' | 'voronoi'
  scale: number
  octaves: number
  persistence: number
  lacunarity: number
  seed: number
}

interface CollaborativeUser {
  id: string
  name: string
  color: string
  cursor: { x: number, y: number }
  brush: BrushSettings
}

interface TerrainVersion {
  id: string
  name: string
  timestamp: Date
  author: string
  description: string
  heightMapData: Float32Array
  textureData: TextureLayer[]
}

interface TerrainMetrics {
  triangleCount: number
  vertexCount: number
  textureMemory: number
  heightRange: { min: number, max: number }
  averageSlope: number
  surfaceArea: number
}

interface TerrainEditorProps {
  terrainId?: string
  width?: number
  height?: number
  resolution?: number
  onSave?: (terrainData: any) => void
  onExport?: (format: string, data: any) => void
  collaborative?: boolean
  readOnly?: boolean
  className?: string
}

// Terrain mesh component for Three.js
const TerrainMesh: React.FC<{
  heightData: Float32Array
  width: number
  height: number
  textures: TextureLayer[]
  onTerrainClick?: (point: TerrainPoint) => void
}> = ({ heightData, width, height, textures, onTerrainClick }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const { raycaster, mouse, camera } = useThree()

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, width - 1, height - 1)
    const vertices = geo.attributes.position.array as Float32Array
    
    for (let i = 0; i < heightData.length; i++) {
      vertices[i * 3 + 2] = heightData[i] * 20 // Scale height
    }
    
    geo.attributes.position.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [heightData, width, height])

  const material = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({
      color: 0x4a5d23,
      wireframe: false
    })
    return mat
  }, [])

  const handleClick = useCallback((event: THREE.Event) => {
    if (!onTerrainClick) return
    
    const intersect = event.intersections?.[0]
    if (intersect) {
      const point = intersect.point
      const terrainX = (point.x + width / 2) / width
      const terrainY = (point.z + height / 2) / height
      
      onTerrainClick({
        x: terrainX,
        y: terrainY,
        height: point.y / 20
      })
    }
  }, [onTerrainClick, width, height])

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
      castShadow
      receiveShadow
    />
  )
}

// Height map canvas component
const HeightMapCanvas: React.FC<{
  width: number
  height: number
  heightData: Float32Array
  onHeightChange: (x: number, y: number, height: number) => void
  brush: BrushSettings
  isEditing: boolean
  collaborativeUsers?: CollaborativeUser[]
}> = ({ width, height, heightData, onHeightChange, brush, isEditing, collaborativeUsers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const drawHeightMap = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.createImageData(width, height)
    const data = imageData.data

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x
        const height = heightData[index]
        const grayscale = Math.floor((height + 1) * 127.5) // Convert from [-1,1] to [0,255]
        
        const pixelIndex = (y * width + x) * 4
        data[pixelIndex] = grayscale     // R
        data[pixelIndex + 1] = grayscale // G
        data[pixelIndex + 2] = grayscale // B
        data[pixelIndex + 3] = 255       // A
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [width, height, heightData])

  const drawBrushPreview = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !isEditing) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw brush preview
    ctx.strokeStyle = '#ff4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(mousePos.x, mousePos.y, brush.size, 0, Math.PI * 2)
    ctx.stroke()

    // Draw collaborative cursors
    collaborativeUsers?.forEach(user => {
      ctx.strokeStyle = user.color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(user.cursor.x, user.cursor.y, user.brush.size, 0, Math.PI * 2)
      ctx.stroke()
    })
  }, [mousePos, brush, isEditing, collaborativeUsers])

  useEffect(() => {
    drawHeightMap()
    drawBrushPreview()
  }, [drawHeightMap, drawBrushPreview])

  const applyBrush = useCallback((x: number, y: number) => {
    const centerX = Math.floor(x)
    const centerY = Math.floor(y)
    const radius = Math.floor(brush.size)

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const targetX = centerX + dx
        const targetY = centerY + dy

        if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue

        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > radius) continue

        const falloff = Math.pow(1 - (distance / radius), brush.falloff)
        const strength = brush.strength * falloff * 0.01

        const index = targetY * width + targetX
        const currentHeight = heightData[index]
        let newHeight = currentHeight

        switch (brush.type) {
          case 'raise':
            newHeight = Math.min(1, currentHeight + strength)
            break
          case 'lower':
            newHeight = Math.max(-1, currentHeight - strength)
            break
          case 'smooth':
            // Average with neighbors
            let sum = 0
            let count = 0
            for (let sy = -1; sy <= 1; sy++) {
              for (let sx = -1; sx <= 1; sx++) {
                const nx = targetX + sx
                const ny = targetY + sy
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  sum += heightData[ny * width + nx]
                  count++
                }
              }
            }
            const average = sum / count
            newHeight = THREE.MathUtils.lerp(currentHeight, average, strength)
            break
          case 'flatten':
            newHeight = THREE.MathUtils.lerp(currentHeight, 0, strength)
            break
        }

        if (newHeight !== currentHeight) {
          onHeightChange(targetX, targetY, newHeight)
        }
      }
    }
  }, [brush, width, height, heightData, onHeightChange])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isEditing) return
    setIsMouseDown(true)
    
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left) * (width / rect.width)
    const y = (e.clientY - rect.top) * (height / rect.height)
    
    applyBrush(x, y)
  }, [isEditing, width, height, applyBrush])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left) * (width / rect.width)
    const y = (e.clientY - rect.top) * (height / rect.height)
    
    setMousePos({ x, y })

    if (isMouseDown && isEditing) {
      applyBrush(x, y)
    }
  }, [isMouseDown, isEditing, width, height, applyBrush])

  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border rounded cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  )
}

// Main terrain editor component
const TerrainEditor: React.FC<TerrainEditorProps> = ({
  terrainId,
  width = 256,
  height = 256,
  resolution = 1,
  onSave,
  onExport,
  collaborative = false,
  readOnly = false,
  className
}) => {
  // State management
  const [heightData, setHeightData] = useState<Float32Array>(() => new Float32Array(width * height))
  const [textureeLayers, setTextureLayers] = useState<TextureLayer[]>([
    {
      id: '1',
      name: 'Base',
      texture: 'grass',
      opacity: 1,
      blendMode: 'normal',
      visible: true
    }
  ])
  const [brush, setBrush] = useState<BrushSettings>({
    size: 20,
    strength: 50,
    falloff: 1,
    type: 'raise'
  })
  const [noiseSettings, setNoiseSettings] = useState<NoiseSettings>({
    type: 'perlin',
    scale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2,
    seed: Math.random() * 1000
  })
  const [isEditing, setIsEditing] = useState(false)
  const [selectedTool, setSelectedTool] = useState<string>('heightmap')
  const [collaborativeUsers, setCollaborativeUsers] = useState<CollaborativeUser[]>([])
  const [versions, setVersions] = useState<TerrainVersion[]>([])
  const [metrics, setMetrics] = useState<TerrainMetrics>({
    triangleCount: 0,
    vertexCount: 0,
    textureMemory: 0,
    heightRange: { min: 0, max: 0 },
    averageSlope: 0,
    surfaceArea: 0
  })
  const [showGrid, setShowGrid] = useState(true)
  const [showWireframe, setShowWireframe] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)

  // Calculate terrain metrics
  const calculateMetrics = useCallback(() => {
    const triangleCount = (width - 1) * (height - 1) * 2
    const vertexCount = width * height
    const textureMemory = textureeLayers.length * 1024 * 1024 // Estimate 1MB per texture
    
    let min = Infinity
    let max = -Infinity
    let slopeSum = 0
    let surfaceArea = 0

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const h = heightData[y * width + x]
        min = Math.min(min, h)
        max = Math.max(max, h)

        // Calculate slope
        if (x < width - 1 && y < height - 1) {
          const h1 = heightData[y * width + x + 1]
          const h2 = heightData[(y + 1) * width + x]
          const slope = Math.sqrt((h1 - h) ** 2 + (h2 - h) ** 2)
          slopeSum += slope
          surfaceArea += Math.sqrt(1 + slope ** 2)
        }
      }
    }

    setMetrics({
      triangleCount,
      vertexCount,
      textureMemory,
      heightRange: { min, max },
      averageSlope: slopeSum / ((width - 1) * (height - 1)),
      surfaceArea
    })
  }, [heightData, width, height, textureeLayers])

  useEffect(() => {
    calculateMetrics()
  }, [calculateMetrics])

  // Height map manipulation
  const updateHeightData = useCallback((x: number, y: number, newHeight: number) => {
    const newData = new Float32Array(heightData)
    newData[y * width + x] = newHeight
    setHeightData(newData)
  }, [heightData, width])

  // Procedural generation
  const generateTerrain = useCallback(async (settings: NoiseSettings) => {
    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      const newData = new Float32Array(width * height)
      
      // Simple Perlin noise implementation (simplified for example)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let amplitude = 1
          let frequency = settings.scale
          let noiseValue = 0

          for (let octave = 0; octave < settings.octaves; octave++) {
            const sampleX = x * frequency
            const sampleY = y * frequency
            
            // Simplified noise calculation
            const noise = Math.sin(sampleX * 0.1) * Math.cos(sampleY * 0.1) + 
                         Math.sin(sampleX * 0.05) * Math.cos(sampleY * 0.05) * 0.5
            
            noiseValue += noise * amplitude
            amplitude *= settings.persistence
            frequency *= settings.lacunarity
          }

          newData[y * width + x] = Math.max(-1, Math.min(1, noiseValue))
          
          // Update progress
          const progress = ((y * width + x) / (width * height)) * 100
          if (Math.floor(progress) !== Math.floor(generationProgress)) {
            setGenerationProgress(progress)
          }
        }
      }

      setHeightData(newData)
      toast({
        title: "Terrain Generated",
        description: "Procedural terrain generation completed successfully."
      })
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate terrain. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }, [width, height, generationProgress])

  // File handling
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/json': ['.json']
    },
    onDrop: useCallback((files) => {
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          // Load height map from image
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = width
              canvas.height = height
              const ctx = canvas.getContext('2d')
              if (!ctx) return

              ctx.drawImage(img, 0, 0, width, height)
              const imageData = ctx.getImageData(0, 0, width, height)
              const newHeightData = new Float32Array(width * height)

              for (let i = 0; i < imageData.data.length; i += 4) {
                const grayscale = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3
                newHeightData[i / 4] = (grayscale / 255) * 2 - 1 // Convert to [-1, 1]
              }

              setHeightData(newHeightData)
              toast({
                title: "Height Map Loaded",
                description: `Imported height map from ${file.name}`
              })
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        }
      })
    }, [width, height])
  })

  // Save and export functions
  const handleSave = useCallback(() => {
    const terrainData = {
      id: terrainId,
      width,
      height,
      heightData: Array.from(heightData),
      textureLayers: textureeLayers,
      timestamp: new Date()
    }
    
    onSave?.(terrainData)
    toast({
      title: "Terrain Saved",
      description: "Your terrain has been saved successfully."
    })
  }, [terrainId, width, height, heightData, textureeLayers, onSave])

  const handleExport = useCallback((format: string) => {
    const exportData = {
      format,
      width,
      height,
      heightData: Array.from(heightData),
      textureLayers: textureeLayers
    }
    
    onExport?.(format, exportData)
    toast({
      title: "Export Complete",
      description: `Terrain exported as ${format.toUpperCase()}`
    })
  }, [width, height, heightData, textureeLayers, onExport])

  return (
    <div className={cn("flex flex-col h-screen bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Mountain className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Terrain Editor</h1>
          {collaborative && (
            <Badge variant="outline" className="ml-2">
              <Users className="h-3 w-3 mr-1" />
              {collaborativeUsers.length + 1} users
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            disabled={readOnly}
          >
            {isEditing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isEditing ? 'Stop' : 'Edit'}
          </Button>
          
          <Button variant="outline" size="sm">
            <Undo2 className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm">
            <Redo2 className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">