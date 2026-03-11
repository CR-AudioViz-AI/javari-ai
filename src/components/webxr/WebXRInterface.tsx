```tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, Controllers, Hands, useXR, useController, useHitTest } from '@react-three/xr';
import { Text, Box, Sphere, Plane } from '@react-three/drei';
import { Vector3, Euler, Matrix4, Quaternion, Color } from 'three';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Mic, 
  MicOff, 
  Hand, 
  Eye, 
  Volume2, 
  Settings, 
  Menu,
  X,
  Play,
  Pause,
  SkipForward,
  SkipBack
} from 'lucide-react';

// Types
interface WebXRSessionData {
  isSupported: boolean;
  isActive: boolean;
  sessionMode: 'immersive-vr' | 'immersive-ar' | null;
  referenceSpace: XRReferenceSpace | null;
  handTracking: boolean;
  voiceCommands: boolean;
}

interface GestureData {
  type: 'pinch' | 'grab' | 'point' | 'swipe' | 'tap';
  confidence: number;
  position: Vector3;
  direction?: Vector3;
  handedness: 'left' | 'right';
}

interface SpatialMenuProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  onItemSelect?: (item: string) => void;
  items?: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
    action?: () => void;
  }>;
}

interface HolographicDisplayProps {
  position?: [number, number, number];
  content: ReactNode;
  scale?: number;
  opacity?: number;
  animated?: boolean;
}

interface SpatialButtonProps {
  position?: [number, number, number];
  onClick?: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

interface WebXRContextType {
  session: WebXRSessionData;
  gestures: GestureData[];
  spatialAudio: boolean;
  voiceEnabled: boolean;
  handTrackingEnabled: boolean;
  toggleVoiceCommands: () => void;
  toggleHandTracking: () => void;
  toggleSpatialAudio: () => void;
}

// Context
const WebXRContext = createContext<WebXRContextType | null>(null);

// Custom Hooks
const useWebXRSession = () => {
  const [session, setSession] = useState<WebXRSessionData>({
    isSupported: false,
    isActive: false,
    sessionMode: null,
    referenceSpace: null,
    handTracking: false,
    voiceCommands: false
  });

  useEffect(() => {
    const checkWebXRSupport = async () => {
      if ('xr' in navigator) {
        try {
          const isVRSupported = await navigator.xr.isSessionSupported('immersive-vr');
          const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
          
          setSession(prev => ({
            ...prev,
            isSupported: isVRSupported || isARSupported
          }));
        } catch (error) {
          console.warn('WebXR support check failed:', error);
        }
      }
    };

    checkWebXRSupport();
  }, []);

  return session;
};

const useGestureRecognition = () => {
  const [gestures, setGestures] = useState<GestureData[]>([]);
  const { controllers } = useXR();

  useEffect(() => {
    // Mock gesture recognition - in real implementation, this would
    // process hand tracking data and recognize gestures
    const interval = setInterval(() => {
      if (controllers.length > 0) {
        // Simulate gesture detection
        const mockGesture: GestureData = {
          type: 'point',
          confidence: 0.85,
          position: new Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5),
          handedness: 'right'
        };
        
        setGestures(prev => [...prev.slice(-4), mockGesture]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [controllers]);

  return gestures;
};

// Spatial Components
const SpatialButton: React.FC<SpatialButtonProps> = ({
  position = [0, 0, 0],
  onClick,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false
}) => {
  const meshRef = useRef<any>();
  const [hovered, setHovered] = useState(false);

  const colors = {
    primary: new Color('#3b82f6'),
    secondary: new Color('#64748b'),
    ghost: new Color('#f1f5f9')
  };

  const scales = {
    sm: 0.8,
    md: 1.0,
    lg: 1.2
  };

  const scale = scales[size];
  const baseColor = colors[variant];
  const currentColor = hovered ? baseColor.clone().multiplyScalar(1.2) : baseColor;

  useFrame(() => {
    if (meshRef.current && hovered) {
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group position={position}>
      <Box
        ref={meshRef}
        scale={[scale, scale * 0.5, scale * 0.1]}
        onClick={disabled ? undefined : onClick}
        onPointerEnter={() => !disabled && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <meshPhongMaterial
          color={currentColor}
          transparent
          opacity={disabled ? 0.5 : hovered ? 0.9 : 0.8}
        />
      </Box>
      <Text
        position={[0, 0, 0.06]}
        fontSize={0.1 * scale}
        color={variant === 'ghost' ? '#000' : '#fff'}
        anchorX="center"
        anchorY="middle"
      >
        {children}
      </Text>
    </group>
  );
};

const SpatialMenu: React.FC<SpatialMenuProps> = ({
  position = [0, 1.5, -1],
  rotation = [0, 0, 0],
  visible = true,
  onItemSelect,
  items = []
}) => {
  const groupRef = useRef<any>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useFrame(({ clock }) => {
    if (groupRef.current && visible) {
      groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.1;
    }
  });

  const defaultItems = [
    { id: 'audio', label: 'Audio Controls', action: () => onItemSelect?.('audio') },
    { id: 'settings', label: 'Settings', action: () => onItemSelect?.('settings') },
    { id: 'help', label: 'Help', action: () => onItemSelect?.('help') },
    { id: 'exit', label: 'Exit XR', action: () => onItemSelect?.('exit') }
  ];

  const menuItems = items.length > 0 ? items : defaultItems;

  if (!visible) return null;

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Menu Background */}
      <Plane scale={[2, 1.5, 1]}>
        <meshPhongMaterial
          color="#1e293b"
          transparent
          opacity={0.8}
        />
      </Plane>

      {/* Menu Items */}
      {menuItems.map((item, index) => (
        <SpatialButton
          key={item.id}
          position={[0, 0.5 - index * 0.3, 0.01]}
          onClick={item.action}
          variant={index === selectedIndex ? 'primary' : 'secondary'}
        >
          {item.label}
        </SpatialButton>
      ))}
    </group>
  );
};

const HolographicDisplay: React.FC<HolographicDisplayProps> = ({
  position = [0, 1, -0.5],
  content,
  scale = 1,
  opacity = 0.8,
  animated = true
}) => {
  const meshRef = useRef<any>();

  useFrame(({ clock }) => {
    if (meshRef.current && animated) {
      meshRef.current.position.y = position[1] + Math.sin(clock.elapsedTime) * 0.05;
      meshRef.current.material.opacity = opacity + Math.sin(clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <group position={position} scale={scale}>
      <Plane ref={meshRef} scale={[1, 0.6, 1]}>
        <meshPhongMaterial
          color="#00ffff"
          transparent
          opacity={opacity}
          emissive="#004444"
        />
      </Plane>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.08}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {content}
      </Text>
    </group>
  );
};

const HandTrackingIndicator: React.FC = () => {
  const { controllers } = useXR();
  
  return (
    <>
      {controllers.map((controller, index) => (
        <group key={index}>
          <Sphere
            position={[controller.grip?.position.x || 0, controller.grip?.position.y || 0, controller.grip?.position.z || 0]}
            scale={0.02}
          >
            <meshPhongMaterial color="#ff6b6b" emissive="#ff0000" />
          </Sphere>
        </group>
      ))}
    </>
  );
};

const WebXRGestureController: React.FC = () => {
  const gestures = useGestureRecognition();
  
  return (
    <>
      {gestures.map((gesture, index) => (
        <group key={index} position={gesture.position.toArray()}>
          <Text
            fontSize={0.05}
            color="#00ff00"
            position={[0, 0.1, 0]}
            anchorX="center"
          >
            {gesture.type} ({Math.round(gesture.confidence * 100)}%)
          </Text>
          <Sphere scale={0.01}>
            <meshPhongMaterial color="#00ff00" />
          </Sphere>
        </group>
      ))}
    </>
  );
};

const VoiceCommandInterface: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const [listening, setListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Mock voice command recognition
    const interval = setInterval(() => {
      if (listening) {
        const commands = ['play music', 'pause', 'next track', 'show menu'];
        const randomCommand = commands[Math.floor(Math.random() * commands.length)];
        setLastCommand(randomCommand);
        setListening(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [enabled, listening]);

  if (!enabled) return null;

  return (
    <group position={[-1, 2, -1]}>
      <HolographicDisplay
        content={
          listening ? 'Listening...' : 
          lastCommand ? `"${lastCommand}"` : 
          'Voice Ready'
        }
        animated={listening}
        opacity={listening ? 1 : 0.6}
      />
      <SpatialButton
        position={[0, -0.3, 0]}
        onClick={() => setListening(!listening)}
        variant={listening ? 'primary' : 'secondary'}
      >
        {listening ? 'Stop' : 'Listen'}
      </SpatialButton>
    </group>
  );
};

const FloatingPanel: React.FC<{
  children: ReactNode;
  position?: [number, number, number];
  title?: string;
}> = ({ children, position = [0, 1.5, -2], title }) => {
  return (
    <group position={position}>
      <Plane scale={[3, 2, 1]}>
        <meshPhongMaterial
          color="#0f172a"
          transparent
          opacity={0.9}
        />
      </Plane>
      
      {title && (
        <Text
          position={[0, 0.8, 0.01]}
          fontSize={0.12}
          color="#ffffff"
          anchorX="center"
        >
          {title}
        </Text>
      )}
      
      <group position={[0, 0, 0.01]}>
        {children}
      </group>
    </group>
  );
};

const SpatialUIContainer: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <group>
      {/* Ambient lighting for UI elements */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[0, 5, 5]} intensity={0.8} />
      
      {children}
    </group>
  );
};

// Main Provider Component
const WebXRProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const session = useWebXRSession();
  const [gestures, setGestures] = useState<GestureData[]>([]);
  const [spatialAudio, setSpatialAudio] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [handTrackingEnabled, setHandTrackingEnabled] = useState(true);

  const contextValue = useMemo<WebXRContextType>(() => ({
    session,
    gestures,
    spatialAudio,
    voiceEnabled,
    handTrackingEnabled,
    toggleVoiceCommands: () => setVoiceEnabled(prev => !prev),
    toggleHandTracking: () => setHandTrackingEnabled(prev => !prev),
    toggleSpatialAudio: () => setSpatialAudio(prev => !prev)
  }), [session, gestures, spatialAudio, voiceEnabled, handTrackingEnabled]);

  return (
    <WebXRContext.Provider value={contextValue}>
      {children}
    </WebXRContext.Provider>
  );
};

// Main WebXR Interface Component
const WebXRInterface: React.FC<{
  className?: string;
  children?: ReactNode;
}> = ({ className, children }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  return (
    <WebXRProvider>
      <div className={cn('w-full h-screen bg-black relative', className)}>
        {/* Fallback 2D UI for non-XR */}
        <div className="absolute top-4 right-4 z-50 space-y-2">
          <Card className="bg-black/80 text-white border-cyan-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                WebXR Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge variant="secondary" className="text-xs">
                Initializing...
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Canvas camera={{ position: [0, 1.6, 3] }}>
          <XR>
            <SpatialUIContainer>
              {/* Hand Tracking */}
              <Hands />
              <Controllers />
              <HandTrackingIndicator />
              
              {/* Gesture Recognition */}
              <WebXRGestureController />
              
              {/* Voice Commands */}
              <VoiceCommandInterface enabled={true} />
              
              {/* Spatial Menu */}
              <SpatialMenu
                visible={menuVisible}
                onItemSelect={(item) => {
                  console.log('Menu item selected:', item);
                  if (item === 'exit') {
                    setMenuVisible(false);
                  }
                }}
              />
              
              {/* Audio Controls Panel */}
              <FloatingPanel
                position={[2, 1.5, -1.5]}
                title="Audio Controls"
              >
                <SpatialButton
                  position={[-0.8, 0, 0]}
                  onClick={() => console.log('Previous track')}
                  size="sm"
                >
                  ⏮
                </SpatialButton>
                
                <SpatialButton
                  position={[-0.3, 0, 0]}
                  onClick={() => console.log('Play/Pause')}
                >
                  ⏯
                </SpatialButton>
                
                <SpatialButton
                  position={[0.3, 0, 0]}
                  onClick={() => console.log('Next track')}
                  size="sm"
                >
                  ⏭
                </SpatialButton>
                
                <SpatialButton
                  position={[0.8, 0, 0]}
                  onClick={() => setMenuVisible(!menuVisible)}
                  size="sm"
                >
                  ☰
                </SpatialButton>
              </FloatingPanel>
              
              {/* Holographic Displays */}
              <HolographicDisplay
                position={[0, 2.5, -2]}
                content="Welcome to CRAIverse XR"
                scale={1.5}
              />
              
              <HolographicDisplay
                position={[-2, 1, -1]}
                content="Now Playing: AI Symphony #1"
                scale={0.8}
                animated={false}
              />
              
              {children}
            </SpatialUIContainer>
          </XR>
        </Canvas>
      </div>
    </WebXRProvider>
  );
};

// Export hook for consuming components
export const useWebXR = () => {
  const context = useContext(WebXRContext);
  if (!context) {
    throw new Error('useWebXR must be used within WebXRProvider');
  }
  return context;
};

export default WebXRInterface;
export {
  WebXRProvider,
  SpatialButton,
  SpatialMenu,
  HolographicDisplay,
  HandTrackingIndicator,
  WebXRGestureController,
  VoiceCommandInterface,
  FloatingPanel,
  SpatialUIContainer
};
```