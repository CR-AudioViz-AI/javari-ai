```tsx
"use client"

import React, { useState, useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Text, Box, Sphere } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Palette, 
  User, 
  Shirt, 
  Crown, 
  Play, 
  Save, 
  Download,
  Upload,
  RotateCcw,
  Eye,
  Smile
} from 'lucide-react'

// Types
interface AvatarState {
  body: {
    skinTone: string
    height: number
    build: number
  }
  face: {
    eyeColor: string
    eyeShape: string
    eyebrowStyle: string
    noseShape: string
    mouthShape: string
    expression: string
  }
  hair: {
    style: string
    color: string
    length: number
  }
  clothing: {
    shirt: string
    pants: string
    shoes: string
    colors: {
      shirt: string
      pants: string
      shoes: string
    }
  }
  accessories: {
    hat: string
    glasses: string
    jewelry: string
    colors: {
      hat: string
      glasses: string
      jewelry: string
    }
  }
  animation: string
  name: string
}

interface AvatarAppearanceEditorProps {
  initialAvatar?: Partial<AvatarState>
  onSave?: (avatar: AvatarState) => void
  onExport?: (avatar: AvatarState) => void
  className?: string
}

// Zustand store
const useAvatarStore = create<{
  avatar: AvatarState
  updateAvatar: (updates: Partial<AvatarState>) => void
  resetAvatar: () => void
  savePreset: (name: string) => void
  presets: Array<{ name: string; avatar: AvatarState }>
}>()(
  persist(
    (set, get) => ({
      avatar: {
        body: {
          skinTone: '#F4C2A1',
          height: 50,
          build: 50
        },
        face: {
          eyeColor: '#4A5568',
          eyeShape: 'normal',
          eyebrowStyle: 'normal',
          noseShape: 'normal',
          mouthShape: 'normal',
          expression: 'neutral'
        },
        hair: {
          style: 'short',
          color: '#2D3748',
          length: 50
        },
        clothing: {
          shirt: 'tshirt',
          pants: 'jeans',
          shoes: 'sneakers',
          colors: {
            shirt: '#4299E1',
            pants: '#2D3748',
            shoes: '#1A202C'
          }
        },
        accessories: {
          hat: 'none',
          glasses: 'none',
          jewelry: 'none',
          colors: {
            hat: '#2D3748',
            glasses: '#1A202C',
            jewelry: '#D69E2E'
          }
        },
        animation: 'idle',
        name: 'My Avatar'
      },
      updateAvatar: (updates) => 
        set((state) => ({ 
          avatar: { ...state.avatar, ...updates } 
        })),
      resetAvatar: () => 
        set((state) => ({ 
          avatar: get().avatar 
        })),
      savePreset: (name) =>
        set((state) => ({
          presets: [
            ...state.presets,
            { name, avatar: state.avatar }
          ]
        })),
      presets: []
    }),
    {
      name: 'avatar-store'
    }
  )
)

// Color picker component
const ColorPicker: React.FC<{
  value: string
  onChange: (color: string) => void
  label: string
}> = ({ value, onChange, label }) => {
  const colors = [
    '#F4C2A1', '#E8B08A', '#D4975C', '#C88A3E', '#8B6B2A', '#654321',
    '#4299E1', '#3182CE', '#2B6CB0', '#2C5282', '#2A4365', '#1A365D',
    '#48BB78', '#38A169', '#2F855A', '#276749', '#22543D', '#1C4532',
    '#ED8936', '#DD6B20', '#C05621', '#9C4221', '#7B341E', '#652B19',
    '#E53E3E', '#C53030', '#9B2C2C', '#742A2A', '#553C9A', '#44337A'
  ]

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-6 gap-1">
        {colors.map((color) => (
          <button
            key={color}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              value === color 
                ? 'border-primary scale-110 shadow-md' 
                : 'border-muted hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
      <Input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10"
      />
    </div>
  )
}

// 3D Avatar Preview Component
const Avatar3DModel: React.FC<{ avatar: AvatarState }> = ({ avatar }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const mixerRef = useRef<THREE.AnimationMixer>()
  const { scene } = useThree()

  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.1
    }
  })

  // Simple 3D avatar representation
  return (
    <group ref={meshRef}>
      {/* Head */}
      <Sphere
        position={[0, 1.5, 0]}
        args={[0.3, 16, 16]}
      >
        <meshStandardMaterial color={avatar.body.skinTone} />
      </Sphere>
      
      {/* Body */}
      <Box
        position={[0, 0.5, 0]}
        args={[0.6, 1, 0.3]}
      >
        <meshStandardMaterial color={avatar.clothing.colors.shirt} />
      </Box>
      
      {/* Legs */}
      <Box
        position={[-0.15, -0.5, 0]}
        args={[0.2, 0.8, 0.2]}
      >
        <meshStandardMaterial color={avatar.clothing.colors.pants} />
      </Box>
      <Box
        position={[0.15, -0.5, 0]}
        args={[0.2, 0.8, 0.2]}
      >
        <meshStandardMaterial color={avatar.clothing.colors.pants} />
      </Box>
      
      {/* Feet */}
      <Box
        position={[-0.15, -1, 0.1]}
        args={[0.25, 0.1, 0.4]}
      >
        <meshStandardMaterial color={avatar.clothing.colors.shoes} />
      </Box>
      <Box
        position={[0.15, -1, 0.1]}
        args={[0.25, 0.1, 0.4]}
      >
        <meshStandardMaterial color={avatar.clothing.colors.shoes} />
      </Box>
      
      {/* Hair */}
      <Sphere
        position={[0, 1.7, 0]}
        args={[0.35, 8, 8]}
      >
        <meshStandardMaterial color={avatar.hair.color} />
      </Sphere>
    </group>
  )
}

const Avatar3DPreview: React.FC<{ avatar: AvatarState }> = ({ avatar }) => {
  return (
    <div className="w-full h-96 bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg overflow-hidden">
      <Canvas
        camera={{ position: [0, 1, 3], fov: 60 }}
        dpr={[1, 2]}
      >
        <Suspense fallback={<Text>Loading...</Text>}>
          <Environment preset="studio" />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <Avatar3DModel avatar={avatar} />
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            minDistance={2}
            maxDistance={6}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

// Body Customization Panel
const BodyCustomization: React.FC = () => {
  const { avatar, updateAvatar } = useAvatarStore()

  return (
    <div className="space-y-6">
      <ColorPicker
        value={avatar.body.skinTone}
        onChange={(color) => updateAvatar({
          body: { ...avatar.body, skinTone: color }
        })}
        label="Skin Tone"
      />
      
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Height</Label>
          <Slider
            value={[avatar.body.height]}
            onValueChange={([height]) => updateAvatar({
              body: { ...avatar.body, height }
            })}
            max={100}
            min={0}
            step={1}
            className="mt-2"
          />
        </div>
        
        <div>
          <Label className="text-sm font-medium">Build</Label>
          <Slider
            value={[avatar.body.build]}
            onValueChange={([build]) => updateAvatar({
              body: { ...avatar.body, build }
            })}
            max={100}
            min={0}
            step={1}
            className="mt-2"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-sm font-medium">Face Features</Label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Eye Shape</Label>
            <Select
              value={avatar.face.eyeShape}
              onValueChange={(eyeShape) => updateAvatar({
                face: { ...avatar.face, eyeShape }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
                <SelectItem value="narrow">Narrow</SelectItem>
                <SelectItem value="almond">Almond</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Expression</Label>
            <Select
              value={avatar.face.expression}
              onValueChange={(expression) => updateAvatar({
                face: { ...avatar.face, expression }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="happy">Happy</SelectItem>
                <SelectItem value="sad">Sad</SelectItem>
                <SelectItem value="surprised">Surprised</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <ColorPicker
          value={avatar.face.eyeColor}
          onChange={(eyeColor) => updateAvatar({
            face: { ...avatar.face, eyeColor }
          })}
          label="Eye Color"
        />
      </div>

      <div className="space-y-4">
        <Label className="text-sm font-medium">Hair</Label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Style</Label>
            <Select
              value={avatar.hair.style}
              onValueChange={(style) => updateAvatar({
                hair: { ...avatar.hair, style }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="curly">Curly</SelectItem>
                <SelectItem value="bald">Bald</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Length</Label>
            <Slider
              value={[avatar.hair.length]}
              onValueChange={([length]) => updateAvatar({
                hair: { ...avatar.hair, length }
              })}
              max={100}
              min={0}
              step={1}
              className="mt-2"
            />
          </div>
        </div>
        
        <ColorPicker
          value={avatar.hair.color}
          onChange={(color) => updateAvatar({
            hair: { ...avatar.hair, color }
          })}
          label="Hair Color"
        />
      </div>
    </div>
  )
}

// Clothing Selector Panel
const ClothingSelector: React.FC = () => {
  const { avatar, updateAvatar } = useAvatarStore()

  const clothingItems = {
    shirt: ['tshirt', 'polo', 'hoodie', 'tank', 'dress shirt'],
    pants: ['jeans', 'shorts', 'slacks', 'skirt', 'joggers'],
    shoes: ['sneakers', 'boots', 'sandals', 'heels', 'loafers']
  }

  return (
    <div className="space-y-6">
      {Object.entries(clothingItems).map(([category, items]) => (
        <div key={category} className="space-y-4">
          <Label className="text-sm font-medium capitalize">{category}</Label>
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <Button
                key={item}
                variant={avatar.clothing[category as keyof typeof avatar.clothing] === item ? 'default' : 'outline'}
                size="sm"
                className="capitalize"
                onClick={() => updateAvatar({
                  clothing: { 
                    ...avatar.clothing, 
                    [category]: item 
                  }
                })}
              >
                {item}
              </Button>
            ))}
          </div>
          
          <ColorPicker
            value={avatar.clothing.colors[category as keyof typeof avatar.clothing.colors]}
            onChange={(color) => updateAvatar({
              clothing: {
                ...avatar.clothing,
                colors: {
                  ...avatar.clothing.colors,
                  [category]: color
                }
              }
            })}
            label={`${category} Color`}
          />
        </div>
      ))}
    </div>
  )
}

// Accessory Panel
const AccessoryPanel: React.FC = () => {
  const { avatar, updateAvatar } = useAvatarStore()

  const accessories = {
    hat: ['none', 'cap', 'beanie', 'fedora', 'helmet'],
    glasses: ['none', 'regular', 'sunglasses', 'reading', 'goggles'],
    jewelry: ['none', 'necklace', 'earrings', 'watch', 'ring']
  }

  return (
    <div className="space-y-6">
      {Object.entries(accessories).map(([category, items]) => (
        <div key={category} className="space-y-4">
          <Label className="text-sm font-medium capitalize">{category}</Label>
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <Button
                key={item}
                variant={avatar.accessories[category as keyof typeof avatar.accessories] === item ? 'default' : 'outline'}
                size="sm"
                className="capitalize"
                onClick={() => updateAvatar({
                  accessories: { 
                    ...avatar.accessories, 
                    [category]: item 
                  }
                })}
              >
                {item}
              </Button>
            ))}
          </div>
          
          {avatar.accessories[category as keyof typeof avatar.accessories] !== 'none' && (
            <ColorPicker
              value={avatar.accessories.colors[category as keyof typeof avatar.accessories.colors]}
              onChange={(color) => updateAvatar({
                accessories: {
                  ...avatar.accessories,
                  colors: {
                    ...avatar.accessories.colors,
                    [category]: color
                  }
                }
              })}
              label={`${category} Color`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// Animation Controls
const AnimationControls: React.FC = () => {
  const { avatar, updateAvatar } = useAvatarStore()

  const animations = [
    { id: 'idle', name: 'Idle', icon: User },
    { id: 'walk', name: 'Walk', icon: Play },
    { id: 'run', name: 'Run', icon: Play },
    { id: 'wave', name: 'Wave', icon: Smile },
    { id: 'dance', name: 'Dance', icon: Play }
  ]

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Animations</Label>
      <div className="grid grid-cols-2 gap-2">
        {animations.map(({ id, name, icon: Icon }) => (
          <Button
            key={id}
            variant={avatar.animation === id ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-2"
            onClick={() => updateAvatar({ animation: id })}
          >
            <Icon className="w-4 h-4" />
            {name}
          </Button>
        ))}
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Play className="w-3 h-3" />
        Currently playing: {avatar.animation}
      </div>
    </div>
  )
}

// Preset Library
const PresetLibrary: React.FC = () => {
  const { presets, savePreset, updateAvatar, avatar } = useAvatarStore()
  const [presetName, setPresetName] = useState('')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Preset name"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
        />
        <Button
          onClick={() => {
            if (presetName.trim()) {
              savePreset(presetName.trim())
              setPresetName('')
            }
          }}
          size="sm"
        >
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>
      
      <ScrollArea className="h-48">
        <div className="space-y-2">
          {presets.map((preset, index) => (
            <Card key={index} className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{preset.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateAvatar(preset.avatar)}
                >
                  Load
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// Main Component
const AvatarAppearanceEditor: React.FC<AvatarAppearanceEditorProps> = ({
  initialAvatar,
  onSave,
  onExport,
  className
}) => {
  const { avatar, updateAvatar, resetAvatar } = useAvatarStore()
  const [activeTab, setActiveTab] = useState('body')

  useEffect(() => {
    if (initialAvatar) {
      updateAvatar(initialAvatar)
    }
  }, [initialAvatar, updateAvatar])

  const handleSave = () => {
    onSave?.(avatar)
  }

  const handleExport = () => {
    onExport?.(avatar)
  }

  const handleReset = () => {
    resetAvatar()
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 ${className}`}>
      {/* 3D Preview */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Avatar Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Avatar3DPreview avatar={avatar} />
            
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Input
                  value={avatar