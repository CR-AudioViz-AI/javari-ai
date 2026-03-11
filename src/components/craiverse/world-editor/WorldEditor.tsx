'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Cube, 
  Move3D, 
  RotateCcw, 
  Scale, 
  Trash2, 
  Save, 
  Upload, 
  Download, 
  Share2, 
  Users, 
  Eye, 
  EyeOff,
  Plus,
  Minus,
  Copy,
  Settings,
  Play,
  Pause,
  RotateCw,
  Mountain,
  TreePine,
  Home,
  Lightbulb,
  Palette,
  Layers,
  Grid3x3,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface WorldEditorProps {
  className?: string;
  worldId?: string;
  readOnly?: boolean;
  onSave?: (worldData: WorldData) => void;
  onShare?: (worldData: WorldData) => void;
  onCollaborate?: (roomId: string) => void;
}

interface WorldData {
  id: string;
  name: string;
  description: string;
  objects: WorldObject[];
  terrain: TerrainData;
  lighting: LightingData;
  physics: PhysicsData;
  environment: EnvironmentData;
  metadata: WorldMetadata;
}

interface WorldObject {
  id: string;
  type: ObjectType;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  properties: Record<string, any>;
  visible: boolean;
  locked: boolean;
  layerId: string;
}

interface TerrainData {
  heightMap: number[][];
  size: [number, number];
  resolution: number;
  material: TerrainMaterial;
}

interface LightingData {
  ambientColor: string;
  ambientIntensity: number;
  directionalLight: {
    color: string;
    intensity: number;
    position: [number, number, number];
    castShadow: boolean;
  };
  pointLights: Array<{
    id: string;
    color: string;
    intensity: number;
    position: [number, number, number];
    distance: number;
  }>;
}

interface PhysicsData {
  enabled: boolean;
  gravity: [number, number, number];
  timeStep: number;
}

interface EnvironmentData {
  skybox: string;
  fog: {
    enabled: boolean;
    color: string;
    near: number;
    far: number;
  };
  ground: {
    enabled: boolean;
    color: string;
    size: number;
  };
}

interface WorldMetadata {
  version: string;
  created: string;
  modified: string;
  author: string;
  tags: string[];
  isPublic: boolean;
}

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  objects: string[];
}

interface Asset {
  id: string;
  name: string;
  type: ObjectType;
  thumbnail: string;
  category: string;
  properties: Record<string, any>;
}

type ObjectType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'light' | 'camera' | 'terrain' | 'model' | 'particle';
type EditorTool = 'select' | 'move' | 'rotate' | 'scale' | 'terrain' | 'paint';
type TerrainMaterial = 'grass' | 'rock' | 'sand' | 'snow' | 'water';

// Mock data
const DEFAULT_ASSETS: Asset[] = [
  {
    id: 'cube-basic',
    name: 'Cube',
    type: 'cube',
    thumbnail: '/assets/thumbnails/cube.jpg',
    category: 'Primitives',
    properties: { color: '#ffffff' }
  },
  {
    id: 'sphere-basic',
    name: 'Sphere',
    type: 'sphere',
    thumbnail: '/assets/thumbnails/sphere.jpg',
    category: 'Primitives',
    properties: { color: '#ffffff' }
  },
  {
    id: 'cylinder-basic',
    name: 'Cylinder',
    type: 'cylinder',
    thumbnail: '/assets/thumbnails/cylinder.jpg',
    category: 'Primitives',
    properties: { color: '#ffffff' }
  },
  {
    id: 'tree-pine',
    name: 'Pine Tree',
    type: 'model',
    thumbnail: '/assets/thumbnails/pine-tree.jpg',
    category: 'Nature',
    properties: { variant: 'pine' }
  },
  {
    id: 'house-basic',
    name: 'Basic House',
    type: 'model',
    thumbnail: '/assets/thumbnails/house.jpg',
    category: 'Buildings',
    properties: { style: 'modern' }
  }
];

const DEFAULT_LAYERS: Layer[] = [
  { id: 'terrain', name: 'Terrain', visible: true, locked: false, objects: [] },
  { id: 'buildings', name: 'Buildings', visible: true, locked: false, objects: [] },
  { id: 'nature', name: 'Nature', visible: true, locked: false, objects: [] },
  { id: 'lighting', name: 'Lighting', visible: true, locked: false, objects: [] }
];

// Scene Objects Component
function SceneObject({ object, isSelected, onSelect }: { 
  object: WorldObject; 
  isSelected: boolean; 
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const handleClick = useCallback((event: THREE.Event) => {
    event.stopPropagation();
    onSelect(object.id);
  }, [object.id, onSelect]);

  const geometry = useMemo(() => {
    switch (object.type) {
      case 'cube':
        return <boxGeometry args={[1, 1, 1]} />;
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'plane':
        return <planeGeometry args={[1, 1]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  }, [object.type]);

  return (
    <mesh
      ref={meshRef}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={handleClick}
      visible={object.visible}
    >
      {geometry}
      <meshStandardMaterial
        color={object.properties.color || '#ffffff'}
        wireframe={isSelected}
      />
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[meshRef.current?.geometry]} />
          <lineBasicMaterial color="#00ff00" />
        </lineSegments>
      )}
    </mesh>
  );
}

// Terrain Component
function TerrainMesh({ terrainData }: { terrainData: TerrainData }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!meshRef.current || !terrainData.heightMap) return;

    const geometry = new THREE.PlaneGeometry(
      terrainData.size[0],
      terrainData.size[1],
      terrainData.resolution - 1,
      terrainData.resolution - 1
    );

    const vertices = geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < vertices.length; i += 3) {
      const x = Math.floor((i / 3) % terrainData.resolution);
      const z = Math.floor((i / 3) / terrainData.resolution);
      
      if (terrainData.heightMap[z] && terrainData.heightMap[z][x] !== undefined) {
        vertices[i + 1] = terrainData.heightMap[z][x];
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    meshRef.current.geometry = geometry;
  }, [terrainData]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[terrainData.size[0], terrainData.size[1], terrainData.resolution - 1, terrainData.resolution - 1]} />
      <meshStandardMaterial color="#4ade80" />
    </mesh>
  );
}

// 3D Scene Component
function Scene({ 
  worldData, 
  selectedObjectId, 
  onSelectObject,
  activeTool,
  onObjectUpdate 
}: {
  worldData: WorldData;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  activeTool: EditorTool;
  onObjectUpdate: (id: string, updates: Partial<WorldObject>) => void;
}) {
  const { camera, gl, scene } = useThree();

  useEffect(() => {
    // Setup lighting based on worldData.lighting
    scene.clear();
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(
      worldData.lighting.ambientColor,
      worldData.lighting.ambientIntensity
    );
    scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(
      worldData.lighting.directionalLight.color,
      worldData.lighting.directionalLight.intensity
    );
    directionalLight.position.set(...worldData.lighting.directionalLight.position);
    directionalLight.castShadow = worldData.lighting.directionalLight.castShadow;
    scene.add(directionalLight);

    // Point lights
    worldData.lighting.pointLights.forEach(light => {
      const pointLight = new THREE.PointLight(
        light.color,
        light.intensity,
        light.distance
      );
      pointLight.position.set(...light.position);
      scene.add(pointLight);
    });
  }, [worldData.lighting, scene]);

  const handleBackgroundClick = useCallback(() => {
    onSelectObject(null);
  }, [onSelectObject]);

  return (
    <>
      <Sky sunPosition={[100, 20, 100]} />
      
      {/* Terrain */}
      <TerrainMesh terrainData={worldData.terrain} />
      
      {/* World Objects */}
      {worldData.objects.map(object => (
        <SceneObject
          key={object.id}
          object={object}
          isSelected={selectedObjectId === object.id}
          onSelect={onSelectObject}
        />
      ))}
      
      {/* Grid */}
      <Grid 
        args={[100, 100]} 
        cellSize={1} 
        cellThickness={0.5} 
        cellColor="#6b7280" 
        sectionSize={10} 
        sectionThickness={1} 
        sectionColor="#374151"
      />
      
      {/* Background click handler */}
      <mesh onClick={handleBackgroundClick} visible={false}>
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

export default function WorldEditor({
  className,
  worldId,
  readOnly = false,
  onSave,
  onShare,
  onCollaborate
}: WorldEditorProps) {
  // State
  const [worldData, setWorldData] = useState<WorldData>({
    id: worldId || 'new-world',
    name: 'Untitled World',
    description: '',
    objects: [],
    terrain: {
      heightMap: Array(64).fill(null).map(() => Array(64).fill(0)),
      size: [100, 100],
      resolution: 64,
      material: 'grass'
    },
    lighting: {
      ambientColor: '#404040',
      ambientIntensity: 0.4,
      directionalLight: {
        color: '#ffffff',
        intensity: 1,
        position: [10, 10, 5],
        castShadow: true
      },
      pointLights: []
    },
    physics: {
      enabled: true,
      gravity: [0, -9.81, 0],
      timeStep: 1/60
    },
    environment: {
      skybox: 'default',
      fog: {
        enabled: false,
        color: '#cccccc',
        near: 1,
        far: 1000
      },
      ground: {
        enabled: true,
        color: '#4ade80',
        size: 100
      }
    },
    metadata: {
      version: '1.0.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      author: 'User',
      tags: [],
      isPublic: false
    }
  });

  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string>('buildings');
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [viewportFullscreen, setViewportFullscreen] = useState(false);
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Asset library
  const [assets] = useState<Asset[]>(DEFAULT_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetFilter, setAssetFilter] = useState<string>('');

  // Drag and drop
  const [draggedAsset, setDraggedAsset] = useState<Asset | null>(null);
  const [dropPosition, setDropPosition] = useState<[number, number, number] | null>(null);

  // Computed values
  const selectedObject = useMemo(() => {
    return worldData.objects.find(obj => obj.id === selectedObjectId) || null;
  }, [worldData.objects, selectedObjectId]);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => 
      asset.name.toLowerCase().includes(assetFilter.toLowerCase()) ||
      asset.category.toLowerCase().includes(assetFilter.toLowerCase())
    );
  }, [assets, assetFilter]);

  const assetCategories = useMemo(() => {
    return [...new Set(assets.map(asset => asset.category))];
  }, [assets]);

  // Handlers
  const handleAddObject = useCallback((asset: Asset, position: [number, number, number] = [0, 0, 0]) => {
    const newObject: WorldObject = {
      id: `${asset.type}-${Date.now()}`,
      type: asset.type,
      name: asset.name,
      position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      properties: { ...asset.properties },
      visible: true,
      locked: false,
      layerId: selectedLayerId
    };

    setWorldData(prev => ({
      ...prev,
      objects: [...prev.objects, newObject],
      metadata: {
        ...prev.metadata,
        modified: new Date().toISOString()
      }
    }));

    // Update layer
    setLayers(prev => prev.map(layer => 
      layer.id === selectedLayerId 
        ? { ...layer, objects: [...layer.objects, newObject.id] }
        : layer
    ));

    setSelectedObjectId(newObject.id);
  }, [selectedLayerId]);

  const handleUpdateObject = useCallback((id: string, updates: Partial<WorldObject>) => {
    setWorldData(prev => ({
      ...prev,
      objects: prev.objects.map(obj => 
        obj.id === id ? { ...obj, ...updates } : obj
      ),
      metadata: {
        ...prev.metadata,
        modified: new Date().toISOString()
      }
    }));
  }, []);

  const handleDeleteObject = useCallback((id: string) => {
    const object = worldData.objects.find(obj => obj.id === id);
    if (!object) return;

    setWorldData(prev => ({
      ...prev,
      objects: prev.objects.filter(obj => obj.id !== id),
      metadata: {
        ...prev.metadata,
        modified: new Date().toISOString()
      }
    }));

    // Update layer
    setLayers(prev => prev.map(layer => 
      layer.id === object.layerId 
        ? { ...layer, objects: layer.objects.filter(objId => objId !== id) }
        : layer
    ));

    if (selectedObjectId === id) {
      setSelectedObjectId(null);
    }
  }, [worldData.objects, selectedObjectId]);

  const handleDuplicateObject = useCallback((id: string) => {
    const object = worldData.objects.find(obj => obj.id === id);
    if (!object) return;

    const duplicatedObject: WorldObject = {
      ...object,
      id: `${object.type}-${Date.now()}`,
      name: `${object.name} Copy`,
      position: [object.position[0] + 2, object.position[1], object.position[2]]
    };

    setWorldData(prev => ({
      ...prev,
      objects: [...prev.objects, duplicatedObject],
      metadata: {
        ...prev.metadata,
        modified: new Date().toISOString()
      }
    }));

    setSelectedObjectId(duplicatedObject.id);
  }, [worldData.objects]);

  const handleSave = useCallback(() => {
    onSave?.(worldData);
    setShowSaveDialog(false);
  }, [worldData, onSave]);

  const handleShare = useCallback(() => {
    onShare?.(worldData);
    setShowShareDialog(false);
  }, [worldData, onShare]);

  const handleStartCollaboration = useCallback(() => {
    const roomId = `world-${worldData.id}`;
    onCollaborate?.(roomId);
    setIsCollaborating(true);
  }, [worldData.id, onCollaborate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            handleSave();
            break;
          case 'z':
            event.preventDefault();
            // Handle undo
            break;
          case 'y':
            event.preventDefault();
            // Handle redo
            break;
          case 'd':
            if (selectedObjectId) {
              event.preventDefault();
              handleDuplicateObject(selectedObjectId);
            }
            break;
        }
      } else {
        switch (event.key) {
          case 'Delete':
            if (selectedObjectId) {
              handleDeleteObject(selectedObjectId);
            }
            break;
          case 'q':
            setActiveTool('select');
            break;
          case 'w':
            setActiveTool('move');
            break;
          case 'e':
            setActiveTool('rotate');
            break;
          case 'r':
            setActiveTool('scale');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, handleSave, handleDuplicateObject, handleDeleteObject]);

  return (
    <div className={cn('flex h-screen bg-gray-100 dark:bg-gray-900', className)}>
      {/* Left Sidebar - Asset Library and Layers */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <Tabs defaultValue="assets" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 m-4">
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="layers">Layers</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="flex-1 flex flex-col px-4 pb-4">
            <div className="mb-4">
              <Input
                placeholder="Search assets..."
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                className="mb-2"
              />
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {assetCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-2">
                {filt