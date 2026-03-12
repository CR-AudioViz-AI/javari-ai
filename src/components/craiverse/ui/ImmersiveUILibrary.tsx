```tsx
'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  ComponentProps,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Text,
  Box,
  Sphere,
  Plane,
  Html,
  useTexture,
  PerspectiveCamera,
  OrbitControls,
} from '@react-three/drei'
import { Vector3, Euler, Color, Mesh, Group } from 'three'
import { motion } from 'framer-motion-3d'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Types and Interfaces
interface Vector3D {
  x: number
  y: number
  z: number
}

interface GestureData {
  type: 'pinch' | 'grab' | 'point' | 'swipe' | 'tap'
  confidence: number
  position: Vector3D
  velocity?: Vector3D
  landmarks?: Vector3D[]
}

interface VoiceCommand {
  command: string
  confidence: number
  timestamp: number
  params?: Record<string, any>
}

interface HapticPattern {
  intensity: number
  duration: number
  pattern: 'click' | 'hover' | 'success' | 'error' | 'custom'
}

interface SpatialUIProps {
  position?: Vector3D
  rotation?: Vector3D
  scale?: Vector3D
  visible?: boolean
  interactive?: boolean
  hapticEnabled?: boolean
  voiceEnabled?: boolean
  gestureEnabled?: boolean
  className?: string
  children?: ReactNode
}

interface EyeTrackingData {
  gazePoint: Vector3D
  confidence: number
  fixationDuration: number
  saccadeVelocity: Vector3D
}

interface HandTrackingData {
  leftHand?: {
    landmarks: Vector3D[]
    gesture: string
    confidence: number
  }
  rightHand?: {
    landmarks: Vector3D[]
    gesture: string
    confidence: number
  }
}

// Context for Immersive UI State
interface ImmersiveUIContextType {
  gestureData: GestureData | null
  voiceCommands: VoiceCommand[]
  eyeTracking: EyeTrackingData | null
  handTracking: HandTrackingData | null
  hapticFeedback: (pattern: HapticPattern) => void
  isVRMode: boolean
  isARMode: boolean
  spatialAudioEnabled: boolean
  registerComponent: (id: string, ref: any) => void
  unregisterComponent: (id: string) => void
}

const ImmersiveUIContext = createContext<ImmersiveUIContextType | null>(null)

// Custom Hooks
const useImmersiveUI = () => {
  const context = useContext(ImmersiveUIContext)
  if (!context) {
    throw new Error('useImmersiveUI must be used within ImmersiveUIProvider')
  }
  return context
}

const useGestureRecognition = () => {
  const [gestureData, setGestureData] = useState<GestureData | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    let mediaStream: MediaStream | null = null
    let animationFrame: number

    const initializeHandTracking = async () => {
      try {
        // Simulated hand tracking initialization
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
        setIsInitialized(true)

        const processGestures = () => {
          // Simulate gesture recognition
          const mockGesture: GestureData = {
            type: Math.random() > 0.5 ? 'pinch' : 'point',
            confidence: 0.8 + Math.random() * 0.2,
            position: {
              x: (Math.random() - 0.5) * 2,
              y: (Math.random() - 0.5) * 2,
              z: -1 + Math.random() * 0.5,
            },
          }
          setGestureData(mockGesture)
          animationFrame = requestAnimationFrame(processGestures)
        }

        processGestures()
      } catch (error) {
        console.error('Failed to initialize gesture recognition:', error)
      }
    }

    initializeHandTracking()

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [])

  return { gestureData, isInitialized }
}

const useVoiceCommands = () => {
  const [commands, setCommands] = useState<VoiceCommand[]>([])
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      
      const recognition = recognitionRef.current
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1]
        if (result.isFinal) {
          const command: VoiceCommand = {
            command: result[0].transcript.toLowerCase().trim(),
            confidence: result[0].confidence,
            timestamp: Date.now(),
          }
          setCommands(prev => [...prev.slice(-9), command])
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  return { commands, isListening, startListening, stopListening }
}

const useHapticFeedback = () => {
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported('vibrate' in navigator)
  }, [])

  const triggerHaptic = useCallback((pattern: HapticPattern) => {
    if (!isSupported) return

    const patterns = {
      click: [50],
      hover: [25],
      success: [100, 50, 100],
      error: [200, 100, 200],
      custom: [pattern.duration],
    }

    navigator.vibrate(patterns[pattern.pattern] || patterns.custom)
  }, [isSupported])

  return { triggerHaptic, isSupported }
}

// 3D UI Components
interface ImmersiveButton3DProps extends SpatialUIProps {
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const ImmersiveButton3D: React.FC<ImmersiveButton3DProps> = ({
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  onClick,
  variant = 'primary',
  size = 'md',
  children,
  interactive = true,
  hapticEnabled = true,
}) => {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const { hapticFeedback } = useImmersiveUI()

  const colors = {
    primary: '#3b82f6',
    secondary: '#6b7280',
    outline: '#e5e7eb',
  }

  const sizes = {
    sm: { width: 1, height: 0.3, depth: 0.1 },
    md: { width: 1.5, height: 0.4, depth: 0.15 },
    lg: { width: 2, height: 0.5, depth: 0.2 },
  }

  const buttonSize = sizes[size]
  const buttonColor = hovered ? new Color(colors[variant]).multiplyScalar(1.2) : new Color(colors[variant])

  const handlePointerOver = useCallback(() => {
    if (!interactive) return
    setHovered(true)
    if (hapticEnabled) {
      hapticFeedback({ pattern: 'hover', intensity: 0.3, duration: 25 })
    }
  }, [interactive, hapticEnabled, hapticFeedback])

  const handlePointerOut = useCallback(() => {
    setHovered(false)
    setPressed(false)
  }, [])

  const handlePointerDown = useCallback(() => {
    if (!interactive) return
    setPressed(true)
    if (hapticEnabled) {
      hapticFeedback({ pattern: 'click', intensity: 0.7, duration: 50 })
    }
  }, [interactive, hapticEnabled, hapticFeedback])

  const handlePointerUp = useCallback(() => {
    if (!interactive) return
    setPressed(false)
    onClick?.()
  }, [interactive, onClick])

  useFrame(() => {
    if (meshRef.current) {
      const targetScale = pressed ? 0.95 : hovered ? 1.05 : 1
      meshRef.current.scale.lerp(
        new Vector3(targetScale * scale.x, targetScale * scale.y, targetScale * scale.z),
        0.1
      )
    }
  })

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
    >
      <Box
        ref={meshRef}
        args={[buttonSize.width, buttonSize.height, buttonSize.depth]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <meshStandardMaterial color={buttonColor} />
      </Box>
      <Text
        position={[0, 0, buttonSize.depth / 2 + 0.01]}
        fontSize={buttonSize.height * 0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {children}
      </Text>
    </group>
  )
}

interface FloatingPanelProps extends SpatialUIProps {
  width?: number
  height?: number
  title?: string
  children: ReactNode
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  width = 3,
  height = 2,
  title,
  children,
  visible = true,
}) => {
  const groupRef = useRef<Group>(null)
  const [isDragging, setIsDragging] = useState(false)

  useFrame(() => {
    if (groupRef.current && !isDragging) {
      groupRef.current.rotation.y += 0.002
    }
  })

  if (!visible) return null

  return (
    <group
      ref={groupRef}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
    >
      {/* Panel Background */}
      <Plane args={[width, height]}>
        <meshStandardMaterial
          color="#1f2937"
          opacity={0.9}
          transparent
        />
      </Plane>
      
      {/* Panel Border */}
      <Plane args={[width + 0.05, height + 0.05]} position={[0, 0, -0.001]}>
        <meshBasicMaterial color="#3b82f6" opacity={0.3} transparent />
      </Plane>

      {/* Title */}
      {title && (
        <Text
          position={[0, height / 2 - 0.2, 0.01]}
          fontSize={0.15}
          color="#e5e7eb"
          anchorX="center"
          anchorY="top"
        >
          {title}
        </Text>
      )}

      {/* Content Area */}
      <Html
        transform
        position={[0, title ? -0.2 : 0, 0.01]}
        style={{
          width: `${width * 100}px`,
          height: `${(height - (title ? 0.4 : 0)) * 100}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="text-white p-4 overflow-auto">
          {children}
        </div>
      </Html>
    </group>
  )
}

interface SpatialMenuProps extends SpatialUIProps {
  items: Array<{
    id: string
    label: string
    icon?: ReactNode
    onClick: () => void
    disabled?: boolean
  }>
  layout?: 'circular' | 'linear' | 'grid'
}

const SpatialMenu: React.FC<SpatialMenuProps> = ({
  position = { x: 0, y: 0, z: 0 },
  items,
  layout = 'circular',
  interactive = true,
}) => {
  const groupRef = useRef<Group>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const { gestureData } = useImmersiveUI()

  const calculateItemPositions = useMemo(() => {
    const positions: Vector3D[] = []
    const itemCount = items.length

    switch (layout) {
      case 'circular':
        const radius = 1.5
        for (let i = 0; i < itemCount; i++) {
          const angle = (i / itemCount) * Math.PI * 2
          positions.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            z: 0,
          })
        }
        break
      case 'linear':
        for (let i = 0; i < itemCount; i++) {
          positions.push({
            x: (i - (itemCount - 1) / 2) * 0.8,
            y: 0,
            z: 0,
          })
        }
        break
      case 'grid':
        const cols = Math.ceil(Math.sqrt(itemCount))
        for (let i = 0; i < itemCount; i++) {
          const row = Math.floor(i / cols)
          const col = i % cols
          positions.push({
            x: (col - (cols - 1) / 2) * 0.8,
            y: -(row * 0.8),
            z: 0,
          })
        }
        break
    }

    return positions
  }, [items.length, layout])

  useEffect(() => {
    if (gestureData?.type === 'point' && interactive) {
      // Implement gesture-based selection
      const gesturePos = gestureData.position
      let closestIndex = -1
      let minDistance = Infinity

      calculateItemPositions.forEach((itemPos, index) => {
        const distance = Math.sqrt(
          Math.pow(gesturePos.x - itemPos.x, 2) +
          Math.pow(gesturePos.y - itemPos.y, 2) +
          Math.pow(gesturePos.z - itemPos.z, 2)
        )
        if (distance < minDistance && distance < 0.5) {
          minDistance = distance
          closestIndex = index
        }
      })

      setSelectedIndex(closestIndex)
    }
  }, [gestureData, calculateItemPositions, interactive])

  return (
    <group
      ref={groupRef}
      position={[position.x, position.y, position.z]}
    >
      {items.map((item, index) => {
        const itemPosition = calculateItemPositions[index]
        const isSelected = selectedIndex === index
        const isDisabled = item.disabled

        return (
          <ImmersiveButton3D
            key={item.id}
            position={itemPosition}
            scale={{ x: isSelected ? 1.2 : 1, y: isSelected ? 1.2 : 1, z: isSelected ? 1.2 : 1 }}
            onClick={item.onClick}
            variant={isSelected ? 'primary' : 'secondary'}
            interactive={!isDisabled}
          >
            {item.label}
          </ImmersiveButton3D>
        )
      })}
    </group>
  )
}

interface HolographicCardProps extends SpatialUIProps {
  title: string
  content: ReactNode
  imageUrl?: string
  glowing?: boolean
}

const HolographicCard: React.FC<HolographicCardProps> = ({
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  title,
  content,
  imageUrl,
  glowing = true,
}) => {
  const cardRef = useRef<Group>(null)
  const [hovering, setHovering] = useState(false)

  useFrame(({ clock }) => {
    if (cardRef.current && glowing) {
      const time = clock.getElapsedTime()
      cardRef.current.position.y = position.y + Math.sin(time * 2) * 0.05
      cardRef.current.rotation.y = rotation.y + Math.sin(time) * 0.1
    }
  })

  return (
    <group
      ref={cardRef}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      onPointerOver={() => setHovering(true)}
      onPointerOut={() => setHovering(false)}
    >
      {/* Holographic Effect */}
      {glowing && (
        <Sphere args={[1.5, 32, 32]} position={[0, 0, -0.1]}>
          <meshBasicMaterial
            color="#00ffff"
            opacity={hovering ? 0.15 : 0.08}
            transparent
            wireframe
          />
        </Sphere>
      )}

      {/* Card Surface */}
      <Plane args={[2, 2.5]}>
        <meshStandardMaterial
          color="#1a202c"
          opacity={0.9}
          transparent
          emissive={glowing ? "#001122" : "#000000"}
        />
      </Plane>

      {/* Card Content */}
      <Html
        transform
        position={[0, 0, 0.01]}
        style={{
          width: '200px',
          height: '250px',
          color: 'white',
          padding: '16px',
        }}
      >
        <Card className={cn(
          "bg-transparent border-cyan-400/30 text-white h-full",
          hovering && "border-cyan-400/60"
        )}>
          {imageUrl && (
            <div className="w-full h-24 mb-2 rounded overflow-hidden">
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            </div>
          )}
          <h3 className="text-lg font-bold mb-2 text-cyan-300">{title}</h3>
          <div className="text-sm opacity-90">{content}</div>
        </Card>
      </Html>
    </group>
  )
}

interface ImmersiveSlider3DProps extends SpatialUIProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  orientation?: 'horizontal' | 'vertical'
}

const ImmersiveSlider3D: React.FC<ImmersiveSlider3DProps> = ({
  position = { x: 0, y: 0, z: 0 },
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  orientation = 'horizontal',
}) => {
  const sliderRef = useRef<Group>(null)
  const [dragging, setDragging] = useState(false)
  const { gestureData } = useImmersiveUI()

  const trackLength = 2
  const normalizedValue = (value - min) / (max - min)
  const handlePosition = orientation === 'horizontal' 
    ? (normalizedValue - 0.5) * trackLength
    : (0.5 - normalizedValue) * trackLength

  useEffect(() => {
    if (gestureData?.type === 'grab' && dragging) {
      const gesturePos = orientation === 'horizontal' ? gestureData.position.x : gestureData.position.y
      const newNormalizedValue = orientation === 'horizontal'
        ? Math.max(0, Math.min(1, (gesturePos / trackLength) + 0.5))
        : Math.max(0, Math.min(1, 0.5 - (gesturePos / trackLength)))
      
      const newValue = min + newNormalizedValue * (max - min)
      const steppedValue = Math.round(newValue / step) * step
      onChange(steppedValue)
    }
  }, [gestureData, dragging, orientation, min, max, step, onChange, trackLength])

  return (
    <group
      ref={sliderRef}
      position={[position.x, position.y, position.z]}
      rotation={orientation === 'vertical' ? [0, 0, Math.PI / 2] : [0, 0, 0]}
    >
      {/* Slider Track */}
      <Box args={[trackLength, 0.05, 0.05]}>
        <meshStandardMaterial color="#374151"