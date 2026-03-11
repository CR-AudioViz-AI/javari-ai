```tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Environment } from '@react-three/drei';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { supabase } from '@/lib/supabase';
import { useWorldStore } from '@/store/worldStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { 
  Palette, 
  Layers, 
  Sun, 
  Mountain, 
  Trees, 
  Cube, 
  Users, 
  Eye, 
  EyeOff, 
  Save, 
  Upload, 
  Download, 
  Undo, 
  Redo, 
  Settings, 
  Move3d, 
  RotateCcw, 
  Scale,
  Brush,
  Eraser,
  Grid3x3,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MousePointer,
  Hand,
  Zap,
  Globe
} from 'lucide-react';
import * as THREE from 'three';

// Types
interface WorldBuilderProps {
  worldId?: string;
  onSave?: (worldData: WorldData) => void;
  onLoad?: (worldId: string) => void;
  className?: string;
}

interface WorldData {
  id: string;
  name: string;
  terrain: TerrainData;
  assets: AssetInstance[];
  lighting: LightingConfig;
  materials: MaterialConfig[];
  settings: WorldSettings;
  collaborators: Collaborator[];
}

interface TerrainData {
  heightMap: number[][];
  size: { width: number; height: number };
  resolution: number;
  materials: string[];
}

interface AssetInstance {
  id: string;
  assetId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  properties: Record<string, unknown>;
}

interface LightingConfig {
  ambientLight: { intensity: number; color: string };
  directionalLight: { 
    intensity: number; 
    color: string; 
    position: [number, number, number];
  };
  pointLights: Array<{
    id: string;
    intensity: number;
    color: string;
    position: [number, number, number];
    distance: number;
  }>;
  environment: string;
}

interface MaterialConfig {
  id: string;
  name: string;
  type: 'standard' | 'physical' | 'custom';
  properties: Record<string, unknown>;
}

interface WorldSettings {
  skybox: string;
  fog: { enabled: boolean; color: string; density: number };
  physics: { enabled: boolean; gravity: number };
  audio: { enabled: boolean; volume: number };
}

interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  cursor: [number, number, number];
  tool: string;
  isOnline: boolean;
}

interface Tool {
  id: string;
  name: string;
  icon: React.ComponentType;
  hotkey: string;
}

// Custom hooks
const useCollaboration = (worldId: string) => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!worldId) return;

    const channel = supabase.channel(`world:${worldId}`)
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users = Object.values(presenceState).flat() as Collaborator[];
        setCollaborators(users);
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        setCollaborators(prev => 
          prev.map(user => 
            user.id === payload.userId 
              ? { ...user, cursor: payload.position }
              : user
          )
        );
      })
      .subscribe();

    setIsConnected(true);

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [worldId]);

  const broadcastCursor = useCallback((position: [number, number, number]) => {
    if (!worldId) return;
    
    supabase.channel(`world:${worldId}`).send({
      type: 'broadcast',
      event: 'cursor',
      payload: { position }
    });
  }, [worldId]);

  return { collaborators, isConnected, broadcastCursor };
};

// Asset library component
const AssetLibrary: React.FC<{
  onAssetSelect: (asset: { id: string; type: string; name: string }) => void;
}> = ({ onAssetSelect }) => {
  const [assets, setAssets] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const assetCategories = [
    { id: 'terrain', name: 'Terrain', icon: Mountain },
    { id: 'vegetation', name: 'Vegetation', icon: Trees },
    { id: 'structures', name: 'Structures', icon: Cube },
    { id: 'props', name: 'Props', icon: Palette }
  ];

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const { data, error } = await supabase.storage
        .from('world-assets')
        .upload(`assets/${file.name}`, file);

      if (error) throw error;

      setUploadProgress(100);
      // Add asset to library
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cube className="h-5 w-5" />
          Asset Library
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="terrain" className="h-full">
          <TabsList className="grid w-full grid-cols-4 rounded-none border-b">
            {assetCategories.map((category) => (
              <TabsTrigger 
                key={category.id} 
                value={category.id}
                className="flex items-center gap-1"
              >
                <category.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{category.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          
          {assetCategories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-0">
              <ScrollArea className="h-64 p-4">
                <div className="grid grid-cols-2 gap-2">
                  {/* Asset items would be mapped here */}
                  <div 
                    className="aspect-square bg-muted rounded cursor-pointer hover:bg-muted/80 flex items-center justify-center"
                    onClick={() => onAssetSelect({ id: '1', type: category.id, name: 'Sample Asset' })}
                  >
                    <category.icon className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
              </ScrollArea>
              
              <Separator />
              
              <div className="p-4">
                <Label htmlFor="asset-upload" className="cursor-pointer">
                  <Button variant="outline" className="w-full" asChild>
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Asset
                    </div>
                  </Button>
                </Label>
                <Input
                  id="asset-upload"
                  type="file"
                  accept=".glb,.gltf,.obj,.fbx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                
                {isUploading && (
                  <div className="mt-2">
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Tool palette component
const ToolPalette: React.FC<{
  activeTool: string;
  onToolSelect: (toolId: string) => void;
}> = ({ activeTool, onToolSelect }) => {
  const tools: Tool[] = [
    { id: 'select', name: 'Select', icon: MousePointer, hotkey: 'V' },
    { id: 'move', name: 'Move', icon: Move3d, hotkey: 'G' },
    { id: 'rotate', name: 'Rotate', icon: RotateCcw, hotkey: 'R' },
    { id: 'scale', name: 'Scale', icon: Scale, hotkey: 'S' },
    { id: 'sculpt', name: 'Sculpt', icon: Brush, hotkey: 'B' },
    { id: 'erase', name: 'Erase', icon: Eraser, hotkey: 'E' },
    { id: 'paint', name: 'Paint', icon: Palette, hotkey: 'P' }
  ];

  return (
    <Card className="w-fit">
      <CardContent className="p-2">
        <div className="flex flex-col gap-1">
          {tools.map((tool) => (
            <TooltipProvider key={tool.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === tool.id ? "default" : "ghost"}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => onToolSelect(tool.id)}
                  >
                    <tool.icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{tool.name} ({tool.hotkey})</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Lighting controls component
const LightingPanel: React.FC<{
  lighting: LightingConfig;
  onLightingChange: (lighting: LightingConfig) => void;
}> = ({ lighting, onLightingChange }) => {
  const updateLighting = (updates: Partial<LightingConfig>) => {
    onLightingChange({ ...lighting, ...updates });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="h-5 w-5" />
          Lighting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Ambient Light Intensity</Label>
          <Slider
            value={[lighting.ambientLight.intensity]}
            onValueChange={([value]) => 
              updateLighting({
                ambientLight: { ...lighting.ambientLight, intensity: value }
              })
            }
            max={2}
            step={0.1}
            className="mt-2"
          />
        </div>
        
        <div>
          <Label>Directional Light Intensity</Label>
          <Slider
            value={[lighting.directionalLight.intensity]}
            onValueChange={([value]) =>
              updateLighting({
                directionalLight: { ...lighting.directionalLight, intensity: value }
              })
            }
            max={2}
            step={0.1}
            className="mt-2"
          />
        </div>
        
        <div>
          <Label>Environment</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {lighting.environment || 'None'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => updateLighting({ environment: 'sunset' })}>
                Sunset
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateLighting({ environment: 'dawn' })}>
                Dawn
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateLighting({ environment: 'night' })}>
                Night
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};

// Terrain sculptor component
const TerrainSculptor: React.FC<{
  terrain: TerrainData;
  onTerrainChange: (terrain: TerrainData) => void;
  brushSize: number;
  brushStrength: number;
}> = ({ terrain, onTerrainChange, brushSize, brushStrength }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isScultping, setIsSculpting] = useState(false);

  const sculptTerrain = useCallback((position: THREE.Vector3, delta: number) => {
    if (!terrain.heightMap) return;

    const newHeightMap = [...terrain.heightMap];
    const x = Math.floor(position.x + terrain.size.width / 2);
    const z = Math.floor(position.z + terrain.size.height / 2);

    for (let i = -brushSize; i <= brushSize; i++) {
      for (let j = -brushSize; j <= brushSize; j++) {
        const px = x + i;
        const pz = z + j;
        
        if (px >= 0 && px < terrain.size.width && pz >= 0 && pz < terrain.size.height) {
          const distance = Math.sqrt(i * i + j * j);
          if (distance <= brushSize) {
            const influence = Math.cos(distance / brushSize * Math.PI / 2);
            newHeightMap[px][pz] += delta * brushStrength * influence;
          }
        }
      }
    }

    onTerrainChange({ ...terrain, heightMap: newHeightMap });
  }, [terrain, brushSize, brushStrength, onTerrainChange]);

  const generateTerrain = useMemo(() => {
    if (!terrain.heightMap) return null;

    const geometry = new THREE.PlaneGeometry(
      terrain.size.width,
      terrain.size.height,
      terrain.resolution,
      terrain.resolution
    );

    const vertices = geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < vertices.length; i += 3) {
      const x = Math.floor((vertices[i] + terrain.size.width / 2));
      const z = Math.floor((vertices[i + 2] + terrain.size.height / 2));
      
      if (x >= 0 && x < terrain.size.width && z >= 0 && z < terrain.size.height) {
        vertices[i + 1] = terrain.heightMap[x][z];
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    return geometry;
  }, [terrain]);

  return (
    <>
      {generateTerrain && (
        <mesh
          ref={meshRef}
          geometry={generateTerrain}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={() => setIsSculpting(true)}
          onPointerUp={() => setIsSculpting(false)}
          onPointerMove={(e) => {
            if (isScultping) {
              sculptTerrain(e.point, 0.1);
            }
          }}
        >
          <meshStandardMaterial color="#8B7355" wireframe />
        </mesh>
      )}
    </>
  );
};

// Collaborator cursors component
const CollaboratorCursors: React.FC<{ collaborators: Collaborator[] }> = ({ 
  collaborators 
}) => {
  return (
    <>
      {collaborators.map((collaborator) => (
        <group key={collaborator.id} position={collaborator.cursor}>
          <mesh>
            <sphereGeometry args={[0.1]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>
          <Html>
            <div className="bg-background border rounded px-2 py-1 text-xs whitespace-nowrap">
              {collaborator.name}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
};

// 3D Scene component
const Scene: React.FC<{
  worldData: WorldData;
  onObjectSelect: (objectId: string) => void;
  activeTool: string;
  brushSize: number;
  brushStrength: number;
  collaborators: Collaborator[];
}> = ({ 
  worldData, 
  onObjectSelect, 
  activeTool, 
  brushSize, 
  brushStrength, 
  collaborators 
}) => {
  const { camera, raycaster, mouse, scene } = useThree();
  const [selectedObject, setSelectedObject] = useState<string | null>(null);

  useFrame((state) => {
    // Update raycaster for object selection
    raycaster.setFromCamera(mouse, camera);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[10, 10, 10]} />
      <OrbitControls enablePan enableZoom enableRotate />
      
      <ambientLight 
        intensity={worldData.lighting.ambientLight.intensity} 
        color={worldData.lighting.ambientLight.color} 
      />
      
      <directionalLight
        intensity={worldData.lighting.directionalLight.intensity}
        color={worldData.lighting.directionalLight.color}
        position={worldData.lighting.directionalLight.position}
        castShadow
      />

      {worldData.lighting.pointLights.map((light) => (
        <pointLight
          key={light.id}
          intensity={light.intensity}
          color={light.color}
          position={light.position}
          distance={light.distance}
        />
      ))}

      <TerrainSculptor
        terrain={worldData.terrain}
        onTerrainChange={() => {}}
        brushSize={brushSize}
        brushStrength={brushStrength}
      />

      {worldData.assets.map((asset) => (
        <mesh
          key={asset.id}
          position={asset.position}
          rotation={asset.rotation}
          scale={asset.scale}
          onClick={() => onObjectSelect(asset.id)}
        >
          <boxGeometry />
          <meshStandardMaterial 
            color={selectedObject === asset.id ? "#ff6b6b" : "#4ecdc4"} 
          />
        </mesh>
      ))}

      <CollaboratorCursors collaborators={collaborators} />
      
      <Grid infiniteGrid fadeDistance={50} fadeStrength={5} />
      
      {worldData.lighting.environment && (
        <Environment preset={worldData.lighting.environment as any} />
      )}
    </>
  );
};

// Layer manager component
const LayerManager: React.FC<{
  layers: Array<{ id: string; name: string; visible: boolean; locked: boolean }>;
  onLayerToggle: (layerId: string, property: 'visible' | 'locked') => void;
}> = ({ layers, onLayerToggle }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Layers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-40">
          {layers.map((layer) => (
            <div key={layer.id} className="flex items-center justify-between py-2">
              <span className="text-sm">{layer.name}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onLayerToggle(layer.id, 'visible')}
                >
                  {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onLayerToggle(layer.id, 'locked')}
                >
                  {layer.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Main world builder component
const WorldBuilder: React.FC<WorldBuilderProps> = ({
  worldId = 'default',
  onSave,
  onLoad,
  className
}) => {
  const { worldData, setWorldData, updateTerrain, addAsset } = useWorldStore();
  const { collaborators, isConnected, broadcastCursor } = useColl