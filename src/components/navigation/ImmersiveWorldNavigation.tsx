'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Navigation, 
  Volume2, 
  Vibrate, 
  Eye, 
  Hand, 
  Compass,
  Move3D,
  Headphones,
  Gamepad2,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types and Interfaces
interface Vector3D {
  x: number;
  y: number;
  z: number;
}

interface NavigationNode {
  id: string;
  position: Vector3D;
  label: string;
  description: string;
  audioUrl?: string;
  isActive: boolean;
  connections: string[];
}

interface GestureEvent {
  type: 'point' | 'grab' | 'swipe' | 'pinch';
  position: Vector3D;
  confidence: number;
  timestamp: number;
}

interface HapticPattern {
  duration: number;
  intensity: number;
  pattern: 'pulse' | 'continuous' | 'wave';
}

interface ImmersiveWorldNavigationProps {
  nodes: NavigationNode[];
  currentNodeId?: string;
  vrEnabled?: boolean;
  spatialAudioEnabled?: boolean;
  hapticsEnabled?: boolean;
  gestureRecognitionEnabled?: boolean;
  onNodeSelect?: (nodeId: string) => void;
  onNavigationUpdate?: (position: Vector3D, rotation: Vector3D) => void;
  onGestureDetected?: (gesture: GestureEvent) => void;
  className?: string;
}

interface SpatialNavigationNodeProps {
  node: NavigationNode;
  isSelected: boolean;
  distance: number;
  direction: Vector3D;
  onSelect: (nodeId: string) => void;
  audioContext?: AudioContext;
}

interface GestureRecognitionAreaProps {
  enabled: boolean;
  onGestureDetected: (gesture: GestureEvent) => void;
  children: React.ReactNode;
}

interface HapticFeedbackManagerProps {
  enabled: boolean;
  intensity: number;
  onFeedbackTriggered?: (pattern: HapticPattern) => void;
}

interface AudioSpatializerProps {
  audioContext?: AudioContext;
  position: Vector3D;
  orientation: Vector3D;
  nodes: NavigationNode[];
}

interface NavigationCompassProps {
  heading: number;
  pitch: number;
  roll: number;
  targetDirection?: Vector3D;
}

// Spatial Navigation Node Component
const SpatialNavigationNode: React.FC<SpatialNavigationNodeProps> = ({
  node,
  isSelected,
  distance,
  direction,
  onSelect,
  audioContext
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const gainNodeRef = useRef<GainNode>();
  const pannerNodeRef = useRef<PannerNode>();

  useEffect(() => {
    if (audioContext && node.audioUrl) {
      const audio = audioRef.current;
      if (audio) {
        const source = audioContext.createMediaElementSource(audio);
        const gainNode = audioContext.createGain();
        const pannerNode = audioContext.createPanner();

        // Configure 3D audio
        pannerNode.panningModel = 'HRTF';
        pannerNode.distanceModel = 'inverse';
        pannerNode.refDistance = 1;
        pannerNode.maxDistance = 100;
        pannerNode.rolloffFactor = 1;
        pannerNode.coneInnerAngle = 360;
        pannerNode.coneOuterAngle = 0;
        pannerNode.coneOuterGain = 0;

        // Position audio based on node position
        pannerNode.positionX.setValueAtTime(direction.x, audioContext.currentTime);
        pannerNode.positionY.setValueAtTime(direction.y, audioContext.currentTime);
        pannerNode.positionZ.setValueAtTime(direction.z, audioContext.currentTime);

        // Adjust volume based on distance
        const volume = Math.max(0.1, 1 / (1 + distance * 0.1));
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

        source.connect(gainNode).connect(pannerNode).connect(audioContext.destination);
        
        gainNodeRef.current = gainNode;
        pannerNodeRef.current = pannerNode;
      }
    }
  }, [audioContext, node.audioUrl, direction, distance]);

  const handleNodeInteraction = useCallback(() => {
    if (audioRef.current && isSelected) {
      audioRef.current.play().catch(console.warn);
    }
    onSelect(node.id);
  }, [node.id, isSelected, onSelect]);

  const nodeScale = useMemo(() => {
    const baseScale = isSelected ? 1.2 : 1;
    const distanceScale = Math.max(0.5, 1 / (1 + distance * 0.05));
    return baseScale * distanceScale * (isHovered ? 1.1 : 1);
  }, [isSelected, distance, isHovered]);

  return (
    <div
      className={cn(
        "absolute transform-gpu transition-all duration-300 cursor-pointer",
        "flex flex-col items-center justify-center",
        isSelected && "z-10"
      )}
      style={{
        transform: `translate3d(${direction.x * 100}px, ${direction.y * 100}px, ${direction.z * 10}px) scale(${nodeScale})`,
        filter: `brightness(${isSelected ? 1.2 : isHovered ? 1.1 : 1})`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleNodeInteraction}
      role="button"
      tabIndex={0}
      aria-label={`Navigation node: ${node.label}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNodeInteraction();
        }
      }}
    >
      {node.audioUrl && (
        <audio
          ref={audioRef}
          src={node.audioUrl}
          preload="metadata"
          aria-hidden="true"
        />
      )}
      
      <Card className={cn(
        "p-4 backdrop-blur-sm border-2 transition-all duration-200",
        isSelected ? "border-primary shadow-lg shadow-primary/20" : "border-border",
        isHovered && "shadow-md"
      )}>
        <div className="flex items-center space-x-2">
          <div className={cn(
            "w-3 h-3 rounded-full transition-colors",
            node.isActive ? "bg-green-500" : "bg-gray-400"
          )} />
          <span className="font-medium text-sm">{node.label}</span>
        </div>
        {distance > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            {distance.toFixed(1)}m away
          </div>
        )}
      </Card>
    </div>
  );
};

// Gesture Recognition Area Component
const GestureRecognitionArea: React.FC<GestureRecognitionAreaProps> = ({
  enabled,
  onGestureDetected,
  children
}) => {
  const gestureAreaRef = useRef<HTMLDivElement>(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let animationFrame: number;
    let mediaStream: MediaStream;

    const initializeHandTracking = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' } 
        });
        setIsTracking(true);
        
        // Simulated gesture recognition - in reality, this would use ML models
        const detectGestures = () => {
          // Mock gesture detection
          if (Math.random() > 0.99) {
            const gesture: GestureEvent = {
              type: ['point', 'grab', 'swipe', 'pinch'][Math.floor(Math.random() * 4)] as GestureEvent['type'],
              position: {
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2,
                z: (Math.random() - 0.5) * 2
              },
              confidence: 0.8 + Math.random() * 0.2,
              timestamp: Date.now()
            };
            onGestureDetected(gesture);
          }
          
          animationFrame = requestAnimationFrame(detectGestures);
        };
        
        detectGestures();
      } catch (error) {
        console.warn('Hand tracking initialization failed:', error);
        setIsTracking(false);
      }
    };

    initializeHandTracking();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      setIsTracking(false);
    };
  }, [enabled, onGestureDetected]);

  return (
    <div
      ref={gestureAreaRef}
      className={cn(
        "relative w-full h-full",
        enabled && "cursor-none"
      )}
      role="region"
      aria-label="Gesture recognition area"
    >
      {enabled && (
        <div className="absolute top-4 right-4 z-50">
          <div className={cn(
            "flex items-center space-x-2 px-3 py-1 rounded-full text-xs",
            "bg-background/80 backdrop-blur-sm border",
            isTracking ? "text-green-600 border-green-200" : "text-gray-600 border-gray-200"
          )}>
            <Hand className="w-3 h-3" />
            <span>{isTracking ? 'Tracking' : 'Initializing'}</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

// Haptic Feedback Manager Component
const HapticFeedbackManager: React.FC<HapticFeedbackManagerProps> = ({
  enabled,
  intensity,
  onFeedbackTriggered
}) => {
  const triggerHapticFeedback = useCallback((pattern: HapticPattern) => {
    if (!enabled || !navigator.vibrate) return;

    const vibrationPattern = (() => {
      switch (pattern.pattern) {
        case 'pulse':
          return [pattern.duration * pattern.intensity];
        case 'wave':
          return Array(5).fill([100 * pattern.intensity, 50]).flat();
        case 'continuous':
        default:
          return [pattern.duration * pattern.intensity];
      }
    })();

    navigator.vibrate(vibrationPattern);
    onFeedbackTriggered?.(pattern);
  }, [enabled, onFeedbackTriggered]);

  useEffect(() => {
    // Expose haptic feedback function to parent components
    (window as any).triggerHapticFeedback = triggerHapticFeedback;
    
    return () => {
      delete (window as any).triggerHapticFeedback;
    };
  }, [triggerHapticFeedback]);

  if (!enabled) return null;

  return (
    <div className="absolute bottom-4 left-4 z-50">
      <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs bg-background/80 backdrop-blur-sm border">
        <Vibrate className="w-3 h-3" />
        <span>Haptics Active</span>
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
    </div>
  );
};

// Audio Spatializer Component
const AudioSpatializer: React.FC<AudioSpatializerProps> = ({
  audioContext,
  position,
  orientation,
  nodes
}) => {
  const listenerRef = useRef<AudioListener>();

  useEffect(() => {
    if (!audioContext) return;

    const listener = audioContext.listener;
    listenerRef.current = listener;

    // Update listener position and orientation
    if (listener.positionX) {
      listener.positionX.setValueAtTime(position.x, audioContext.currentTime);
      listener.positionY.setValueAtTime(position.y, audioContext.currentTime);
      listener.positionZ.setValueAtTime(position.z, audioContext.currentTime);
    }

    if (listener.forwardX) {
      listener.forwardX.setValueAtTime(orientation.x, audioContext.currentTime);
      listener.forwardY.setValueAtTime(orientation.y, audioContext.currentTime);
      listener.forwardZ.setValueAtTime(orientation.z, audioContext.currentTime);
    }

    if (listener.upX) {
      listener.upX.setValueAtTime(0, audioContext.currentTime);
      listener.upY.setValueAtTime(1, audioContext.currentTime);
      listener.upZ.setValueAtTime(0, audioContext.currentTime);
    }
  }, [audioContext, position, orientation]);

  return null;
};

// Navigation Compass Component
const NavigationCompass: React.FC<NavigationCompassProps> = ({
  heading,
  pitch,
  roll,
  targetDirection
}) => {
  const compassStyle = useMemo(() => ({
    transform: `rotate(${-heading}deg)`
  }), [heading]);

  const targetBearing = useMemo(() => {
    if (!targetDirection) return null;
    return Math.atan2(targetDirection.x, targetDirection.z) * (180 / Math.PI);
  }, [targetDirection]);

  return (
    <div className="absolute top-4 left-4 z-50">
      <Card className="p-3 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Compass className="w-8 h-8" style={compassStyle} />
            {targetBearing !== null && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ transform: `rotate(${targetBearing}deg)` }}
              >
                <div className="w-1 h-4 bg-primary rounded-full" />
              </div>
            )}
          </div>
          <div className="text-xs space-y-1">
            <div>H: {heading.toFixed(0)}°</div>
            <div>P: {pitch.toFixed(0)}°</div>
            <div>R: {roll.toFixed(0)}°</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Main Immersive World Navigation Component
export const ImmersiveWorldNavigation: React.FC<ImmersiveWorldNavigationProps> = ({
  nodes,
  currentNodeId,
  vrEnabled = false,
  spatialAudioEnabled = true,
  hapticsEnabled = true,
  gestureRecognitionEnabled = true,
  onNodeSelect,
  onNavigationUpdate,
  onGestureDetected,
  className
}) => {
  // State management
  const [isVRActive, setIsVRActive] = useState(false);
  const [userPosition, setUserPosition] = useState<Vector3D>({ x: 0, y: 0, z: 0 });
  const [userOrientation, setUserOrientation] = useState<Vector3D>({ x: 0, y: 0, z: 0 });
  const [audioContext, setAudioContext] = useState<AudioContext>();
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  // Initialize audio context
  useEffect(() => {
    if (spatialAudioEnabled && !audioContext) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(context);
      
      // Resume audio context on user interaction
      const resumeAudio = () => {
        if (context.state === 'suspended') {
          context.resume();
        }
      };
      
      document.addEventListener('click', resumeAudio, { once: true });
      document.addEventListener('keydown', resumeAudio, { once: true });
      
      return () => {
        document.removeEventListener('click', resumeAudio);
        document.removeEventListener('keydown', resumeAudio);
      };
    }
  }, [spatialAudioEnabled, audioContext]);

  // WebXR initialization
  useEffect(() => {
    if (!vrEnabled) return;

    const initializeWebXR = async () => {
      try {
        if ('xr' in navigator) {
          const supported = await (navigator as any).xr.isSessionSupported('immersive-vr');
          if (supported) {
            setLoadingProgress(50);
            // WebXR initialization would go here
            setLoadingProgress(100);
            setIsInitialized(true);
          }
        }
      } catch (error) {
        console.warn('WebXR initialization failed:', error);
        setIsInitialized(true);
      }
    };

    initializeWebXR();
  }, [vrEnabled]);

  // Animation loop
  useEffect(() => {
    if (!isInitialized) return;

    const animate = () => {
      // Update navigation state
      onNavigationUpdate?.(userPosition, userOrientation);
      
      // Trigger haptic feedback for navigation events
      if (hapticsEnabled && (window as any).triggerHapticFeedback) {
        // Example: pulse when near a node
        const nearNode = nodes.find(node => {
          const distance = Math.sqrt(
            Math.pow(node.position.x - userPosition.x, 2) +
            Math.pow(node.position.y - userPosition.y, 2) +
            Math.pow(node.position.z - userPosition.z, 2)
          );
          return distance < 2;
        });
        
        if (nearNode) {
          (window as any).triggerHapticFeedback({
            duration: 100,
            intensity: 0.3,
            pattern: 'pulse'
          });
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized, userPosition, userOrientation, nodes, hapticsEnabled, onNavigationUpdate]);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string) => {
    onNodeSelect?.(nodeId);
    
    // Trigger haptic feedback
    if (hapticsEnabled && (window as any).triggerHapticFeedback) {
      (window as any).triggerHapticFeedback({
        duration: 200,
        intensity: 0.5,
        pattern: 'pulse'
      });
    }
  }, [onNodeSelect, hapticsEnabled]);

  // Handle gesture detection
  const handleGestureDetected = useCallback((gesture: GestureEvent) => {
    onGestureDetected?.(gesture);
    
    // Handle navigation gestures
    switch (gesture.type) {
      case 'point':
        // Find nearest node to pointing direction
        const pointedNode = nodes.find(node => {
          const direction = {
            x: node.position.x - userPosition.x,
            y: node.position.y - userPosition.y,
            z: node.position.z - userPosition.z
          };
          const gestureDirection = gesture.position;
          const dot = direction.x * gestureDirection.x + 
                     direction.y * gestureDirection.y + 
                     direction.z * gestureDirection.z;
          return dot > 0.8; // Threshold for pointing accuracy
        });
        
        if (pointedNode) {
          handleNodeSelect(pointedNode.id);
        }
        break;
        
      case 'swipe':
        // Navigate between connected nodes
        const currentNode = nodes.find(n => n.id === currentNodeId);
        if (currentNode && currentNode.connections.length > 0) {
          const nextNodeId = currentNode.connections[0];
          handleNodeSelect(nextNodeId);
        }
        break;
    }
  }, [onGestureDetected, nodes, userPosition, currentNodeId, handleNodeSelect]);

  // Calculate node distances and directions
  const nodeMetrics = useMemo(() => 
    nodes.map(node => {
      const distance = Math.sqrt(
        Math.pow(node.position.x - userPosition.x, 2) +
        Math.pow(node.position.y - userPosition.y, 2) +
        Math.pow(node.position.z - userPosition.z, 2)
      );
      
      const direction = {
        x: (node.position.x - userPosition.x) / (distance || 1),
        y: (node.position.y - userPosition.y) / (distance || 1),
        z: (node.position.z - userPosition.z) / (distance || 1)
      };
      
      return { node, distance, direction };
    }),
    [nodes, userPosition]
  );

  if (!isInitialized) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full space-y-4", className)}>
        <div className="text-center space-y-2">
          <div className="text-lg font-medium">Initializing CRAIverse Navigation</div>
          <div className="text-sm text-muted-foreground">
            {vrEnabled ? 'Preparing WebXR environment...' : 'Loading spatial interface...'}
          </div>
        </div>
        <Progress value={loadingProgress} className="w-64" />
        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Eye className="w-3 h-3" />
            <span>{vrEnabled ? 'VR Ready' : 'Display'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Volume2 className="w-3 h-3" />
            <span>{spatialAudioEnabled ? 'Spatial Audio' : 'Standard Audio'}