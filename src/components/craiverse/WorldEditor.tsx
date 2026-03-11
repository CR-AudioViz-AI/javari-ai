```tsx
'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Mountain,
  Cube,
  Sun,
  Users,
  History,
  Move,
  RotateCcw,
  Scale,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Save,
  Upload,
  Download,
  GitBranch,
  Plus,
  Trash2,
  Copy,
  Settings,
  Play,
  Palette,
  Layers,
  Camera,
  Grid3X3,
} from 'lucide-react';

// Types
interface WorldObject {
  id: string;
  type: 'mesh' | 'light' | 'camera' | 'terrain';
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  locked: boolean;
  properties: Record<string, any>;
  parent?: string;
  children?: string[];
}

interface TerrainData {
  heightmap: Float32Array;
  width: number;
  height: number;
  scale: number;
  material: {
    texture?: string;
    color: string;
    roughness: number;
    metalness: number;
  };
}

interface LightingConfig {
  ambientLight: {
    intensity: number;
    color: string;
  };
  directionalLight: {
    intensity: number;
    color: string;
    position: [number, number, number];
    castShadow: boolean;
  };
  skybox: {
    type: 'gradient' | 'hdri' | 'procedural';
    colors: string[];
    hdriUrl?: string;
  };
  fog: {
    enabled: boolean;
    color: string;
    near: number;
    far: number;
  };
}

interface WorldVersion {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  author: string;
  objects: WorldObject[];
  terrain: TerrainData;
  lighting: LightingConfig;
  isActive: boolean;
}

interface CollaborativeUser {
  id: string;
  name: string;
  avatar: string;
  cursor: [number, number, number];
  selectedObject?: string;
  color: string;
}

interface WorldEditorState {
  // World data
  worldId: string;
  objects: Map<string, WorldObject>;
  terrain: TerrainData;
  lighting: LightingConfig;
  
  // Editor state
  selectedTool: 'select' | 'move' | 'rotate' | 'scale' | 'terrain' | 'paint';
  selectedObjects: Set<string>;
  transformMode: 'translate' | 'rotate' | 'scale';
  snapToGrid: boolean;
  gridSize: number;
  
  // UI state
  activePanel: string;
  sceneHierarchyExpanded: Set<string>;
  propertyPanelTab: string;
  
  // Collaboration
  collaborativeUsers: Map<string, CollaborativeUser>;
  realtimeChannel?: RealtimeChannel;
  
  // Version control
  versions: WorldVersion[];
  currentVersion: string;
  hasUnsavedChanges: boolean;
  
  // Actions
  setSelectedTool: (tool: WorldEditorState['selectedTool']) => void;
  selectObject: (id: string, multiSelect?: boolean) => void;
  deselectAll: () => void;
  addObject: (object: WorldObject) => void;
  updateObject: (id: string, updates: Partial<WorldObject>) => void;
  deleteObject: (id: string) => void;
  updateTerrain: (terrain: TerrainData) => void;
  updateLighting: (lighting: LightingConfig) => void;
  saveWorld: () => Promise<void>;
  loadWorld: (worldId: string) => Promise<void>;
  createVersion: (name: string, description: string) => Promise<void>;
  loadVersion: (versionId: string) => Promise<void>;
  initializeCollaboration: () => Promise<void>;
  broadcastUpdate: (data: any) => void;
}

// Zustand store
const useWorldEditorStore = create<WorldEditorState>()(
  subscribeWithSelector((set, get) => ({
    worldId: '',
    objects: new Map(),
    terrain: {
      heightmap: new Float32Array(256 * 256),
      width: 256,
      height: 256,
      scale: 1,
      material: {
        color: '#4a5568',
        roughness: 0.8,
        metalness: 0.1,
      },
    },
    lighting: {
      ambientLight: {
        intensity: 0.4,
        color: '#ffffff',
      },
      directionalLight: {
        intensity: 1,
        color: '#ffffff',
        position: [10, 10, 5],
        castShadow: true,
      },
      skybox: {
        type: 'gradient',
        colors: ['#87CEEB', '#98D8E8'],
      },
      fog: {
        enabled: false,
        color: '#ffffff',
        near: 10,
        far: 100,
      },
    },
    selectedTool: 'select',
    selectedObjects: new Set(),
    transformMode: 'translate',
    snapToGrid: false,
    gridSize: 1,
    activePanel: 'scene',
    sceneHierarchyExpanded: new Set(),
    propertyPanelTab: 'transform',
    collaborativeUsers: new Map(),
    versions: [],
    currentVersion: '',
    hasUnsavedChanges: false,

    setSelectedTool: (tool) => set({ selectedTool: tool }),
    
    selectObject: (id, multiSelect = false) => set((state) => {
      const newSelected = new Set(multiSelect ? state.selectedObjects : []);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedObjects: newSelected };
    }),

    deselectAll: () => set({ selectedObjects: new Set() }),

    addObject: (object) => set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.set(object.id, object);
      return { objects: newObjects, hasUnsavedChanges: true };
    }),

    updateObject: (id, updates) => set((state) => {
      const newObjects = new Map(state.objects);
      const existing = newObjects.get(id);
      if (existing) {
        newObjects.set(id, { ...existing, ...updates });
      }
      return { objects: newObjects, hasUnsavedChanges: true };
    }),

    deleteObject: (id) => set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.delete(id);
      const newSelected = new Set(state.selectedObjects);
      newSelected.delete(id);
      return { 
        objects: newObjects, 
        selectedObjects: newSelected,
        hasUnsavedChanges: true 
      };
    }),

    updateTerrain: (terrain) => set({ terrain, hasUnsavedChanges: true }),
    updateLighting: (lighting) => set({ lighting, hasUnsavedChanges: true }),

    saveWorld: async () => {
      const state = get();
      try {
        const { error } = await supabase
          .from('worlds')
          .upsert({
            id: state.worldId,
            objects: Array.from(state.objects.values()),
            terrain: state.terrain,
            lighting: state.lighting,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
        set({ hasUnsavedChanges: false });
      } catch (error) {
        console.error('Failed to save world:', error);
      }
    },

    loadWorld: async (worldId) => {
      try {
        const { data, error } = await supabase
          .from('worlds')
          .select('*')
          .eq('id', worldId)
          .single();

        if (error) throw error;

        const objectsMap = new Map();
        data.objects?.forEach((obj: WorldObject) => {
          objectsMap.set(obj.id, obj);
        });

        set({
          worldId,
          objects: objectsMap,
          terrain: data.terrain || get().terrain,
          lighting: data.lighting || get().lighting,
          hasUnsavedChanges: false,
        });
      } catch (error) {
        console.error('Failed to load world:', error);
      }
    },

    createVersion: async (name, description) => {
      const state = get();
      try {
        const version: WorldVersion = {
          id: crypto.randomUUID(),
          name,
          description,
          timestamp: new Date().toISOString(),
          author: 'current-user', // Get from auth context
          objects: Array.from(state.objects.values()),
          terrain: state.terrain,
          lighting: state.lighting,
          isActive: false,
        };

        const { error } = await supabase
          .from('world_versions')
          .insert(version);

        if (error) throw error;

        set((state) => ({
          versions: [...state.versions, version],
        }));
      } catch (error) {
        console.error('Failed to create version:', error);
      }
    },

    loadVersion: async (versionId) => {
      try {
        const { data, error } = await supabase
          .from('world_versions')
          .select('*')
          .eq('id', versionId)
          .single();

        if (error) throw error;

        const objectsMap = new Map();
        data.objects.forEach((obj: WorldObject) => {
          objectsMap.set(obj.id, obj);
        });

        set({
          objects: objectsMap,
          terrain: data.terrain,
          lighting: data.lighting,
          currentVersion: versionId,
          hasUnsavedChanges: false,
        });
      } catch (error) {
        console.error('Failed to load version:', error);
      }
    },

    initializeCollaboration: async () => {
      const state = get();
      const channel = supabase.channel(`world-${state.worldId}`);

      channel
        .on('broadcast', { event: 'object-update' }, (payload) => {
          const { objectId, updates } = payload.payload;
          get().updateObject(objectId, updates);
        })
        .on('presence', { event: 'sync' }, () => {
          const users = channel.presenceState();
          const userMap = new Map();
          Object.entries(users).forEach(([userId, presence]: [string, any]) => {
            userMap.set(userId, presence[0]);
          });
          set({ collaborativeUsers: userMap });
        })
        .subscribe();

      set({ realtimeChannel: channel });
    },

    broadcastUpdate: (data) => {
      const channel = get().realtimeChannel;
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'object-update',
          payload: data,
        });
      }
    },
  }))
);

// 3D Scene Components
const TerrainMesh: React.FC<{ terrain: TerrainData }> = ({ terrain }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      terrain.width * terrain.scale,
      terrain.height * terrain.scale,
      terrain.width - 1,
      terrain.height - 1
    );

    const vertices = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < terrain.heightmap.length; i++) {
      vertices[i * 3 + 2] = terrain.heightmap[i] * terrain.scale;
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [terrain]);

  const material = useMemo(() => {
    return new THREE.MeshLambertMaterial({
      color: terrain.material.color,
      wireframe: false,
    });
  }, [terrain.material]);

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
  );
};

const SceneObject: React.FC<{ object: WorldObject }> = ({ object }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectedObjects, selectObject } = useWorldEditorStore();
  const isSelected = selectedObjects.has(object.id);

  const handleClick = useCallback((event: any) => {
    event.stopPropagation();
    selectObject(object.id, event.shiftKey);
  }, [object.id, selectObject]);

  if (object.type === 'mesh') {
    return (
      <mesh
        ref={meshRef}
        position={object.position}
        rotation={object.rotation}
        scale={object.scale}
        visible={object.visible}
        onClick={handleClick}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial 
          color={isSelected ? '#00ff00' : '#666666'} 
          wireframe={isSelected}
        />
      </mesh>
    );
  }

  return null;
};

const WorldCanvas: React.FC = () => {
  const { objects, terrain, lighting, selectedObjects, transformMode } = useWorldEditorStore();
  const transformControlsRef = useRef();

  return (
    <div className="flex-1 bg-gray-900 relative">
      <Canvas
        camera={{ position: [10, 10, 10], fov: 60 }}
        shadows
        className="w-full h-full"
      >
        {/* Lighting */}
        <ambientLight 
          intensity={lighting.ambientLight.intensity}
          color={lighting.ambientLight.color}
        />
        <directionalLight
          intensity={lighting.directionalLight.intensity}
          color={lighting.directionalLight.color}
          position={lighting.directionalLight.position}
          castShadow={lighting.directionalLight.castShadow}
        />

        {/* Sky */}
        <Sky />

        {/* Terrain */}
        <TerrainMesh terrain={terrain} />

        {/* Scene Objects */}
        {Array.from(objects.values()).map((object) => (
          <SceneObject key={object.id} object={object} />
        ))}

        {/* Grid */}
        <Grid args={[100, 100]} />

        {/* Controls */}
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        
        {selectedObjects.size > 0 && (
          <TransformControls
            ref={transformControlsRef}
            mode={transformMode}
            size={0.5}
          />
        )}
      </Canvas>
    </div>
  );
};

// UI Components
const ToolPalette: React.FC = () => {
  const { selectedTool, setSelectedTool } = useWorldEditorStore();

  const tools = [
    { id: 'select', icon: Move, label: 'Select' },
    { id: 'move', icon: Move, label: 'Move' },
    { id: 'rotate', icon: RotateCcw, label: 'Rotate' },
    { id: 'scale', icon: Scale, label: 'Scale' },
    { id: 'terrain', icon: Mountain, label: 'Terrain' },
    { id: 'paint', icon: Palette, label: 'Paint' },
  ] as const;

  return (
    <Card className="w-16 h-fit">
      <CardContent className="p-2">
        <div className="flex flex-col gap-1">
          {tools.map((tool) => (
            <TooltipProvider key={tool.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectedTool === tool.id ? 'default' : 'ghost'}
                    size="sm"
                    className="w-12 h-12 p-0"
                    onClick={() => setSelectedTool(tool.id)}
                  >
                    <tool.icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{tool.label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const SceneHierarchy: React.FC = () => {
  const { objects, selectedObjects, selectObject, updateObject, deleteObject } = useWorldEditorStore();

  const objectsArray = Array.from(objects.values());

  return (
    <Card className="w-80 h-full">
      <CardHeader>
        <CardTitle className="text-sm">Scene Hierarchy</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-4">
            {objectsArray.map((object) => (
              <div
                key={object.id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 ${
                  selectedObjects.has(object.id) ? 'bg-blue-100' : ''
                }`}
                onClick={() => selectObject(object.id)}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateObject(object.id, { visible: !object.visible });
                  }}
                >
                  {object.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateObject(object.id, { locked: !object.locked });
                  }}
                >
                  {object.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </Button>

                <Cube className="h-4 w-4" />
                <span className="text-sm flex-1">{object.name}</span>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                      <Settings className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteObject(object.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const PropertyInspector: React.FC = () => {
  const { selectedObjects, objects, updateObject } = useWorldEditorStore();
  
  const selectedObject = selectedObjects.size === 1 
    ? objects.get(Array.from(selectedObjects)[0])
    : null;

  if (!selectedObject) {
    return (
      <Card className="w-80 h-full">
        <CardHeader>
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No object selected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80 h-full">
      <CardHeader>
        <CardTitle className="text-sm">Properties</CardTitle>
        <CardDescription>{selectedObject.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="transform" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transform">Transform</TabsTrigger>
            <TabsTrigger value="material">Material</TabsTrigger>
            <TabsTrigger value="physics">Physics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="transform" className="space-y-4">
            <div