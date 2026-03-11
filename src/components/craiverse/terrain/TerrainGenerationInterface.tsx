'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Save,
  Settings,
  Eye,
  Layers,
  Sun,
  Cloud,
  Mountain,
  Palette,
  Grid,
  BarChart3,
  Zap
} from 'lucide-react';
import * as THREE from 'three';

// Types and Interfaces
interface TerrainParameters {
  seed: number;
  octaves: number;
  frequency: number;
  amplitude: number;
  persistence: number;
  lacunarity: number;
  ridgeOffset: number;
  ridgeGain: number;
  erosionStrength: number;
  erosionRadius: number;
  thermalErosion: number;
  hydraulicErosion: number;
}

interface MaterialConfig {
  id: string;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  normalScale: number;
  heightRange: [number, number];
  blendWidth: number;
}

interface EnvironmentalConfig {
  sunIntensity: number;
  sunPosition: [number, number, number];
  ambientIntensity: number;
  fogDensity: number;
  fogColor: string;
  skyboxType: 'clear' | 'cloudy' | 'sunset' | 'night';
  windStrength: number;
  windDirection: [number, number];
}

interface TerrainPreset {
  id: string;
  name: string;
  description: string;
  parameters: TerrainParameters;
  materials: MaterialConfig[];
  environment: EnvironmentalConfig;
  createdAt: string;
}

interface TerrainMetrics {
  vertexCount: number;
  triangleCount: number;
  maxHeight: number;
  minHeight: number;
  averageSlope: number;
  surfaceArea: number;
  generation Time: number;
}

interface TerrainGenerationInterfaceProps {
  className?: string;
  onTerrainGenerated?: (terrainData: {
    heightmap: Float32Array;
    mesh: THREE.BufferGeometry;
    materials: MaterialConfig[];
  }) => void;
  onPresetSaved?: (preset: TerrainPreset) => void;
  onExportRequested?: (format: 'obj' | 'gltf' | 'heightmap') => void;
  initialPreset?: TerrainPreset;
  maxResolution?: number;
  enableRealTimePreview?: boolean;
}

// Default configurations
const DEFAULT_TERRAIN_PARAMETERS: TerrainParameters = {
  seed: 12345,
  octaves: 6,
  frequency: 0.01,
  amplitude: 50,
  persistence: 0.5,
  lacunarity: 2.0,
  ridgeOffset: 1.0,
  ridgeGain: 2.0,
  erosionStrength: 0.1,
  erosionRadius: 3,
  thermalErosion: 0.05,
  hydraulicErosion: 0.1
};

const DEFAULT_MATERIALS: MaterialConfig[] = [
  {
    id: 'water',
    name: 'Water',
    color: '#1e40af',
    roughness: 0.1,
    metalness: 0.8,
    normalScale: 1.0,
    heightRange: [0, 0.1],
    blendWidth: 0.05
  },
  {
    id: 'sand',
    name: 'Sand',
    color: '#fbbf24',
    roughness: 0.8,
    metalness: 0.0,
    normalScale: 0.5,
    heightRange: [0.1, 0.2],
    blendWidth: 0.1
  },
  {
    id: 'grass',
    name: 'Grass',
    color: '#16a34a',
    roughness: 0.9,
    metalness: 0.0,
    normalScale: 0.3,
    heightRange: [0.2, 0.6],
    blendWidth: 0.15
  },
  {
    id: 'rock',
    name: 'Rock',
    color: '#64748b',
    roughness: 0.7,
    metalness: 0.1,
    normalScale: 0.8,
    heightRange: [0.6, 0.9],
    blendWidth: 0.1
  },
  {
    id: 'snow',
    name: 'Snow',
    color: '#f8fafc',
    roughness: 0.3,
    metalness: 0.0,
    normalScale: 0.2,
    heightRange: [0.9, 1.0],
    blendWidth: 0.05
  }
];

const DEFAULT_ENVIRONMENT: EnvironmentalConfig = {
  sunIntensity: 1.0,
  sunPosition: [100, 100, 50],
  ambientIntensity: 0.3,
  fogDensity: 0.01,
  fogColor: '#87ceeb',
  skyboxType: 'clear',
  windStrength: 0.5,
  windDirection: [1, 0]
};

// Terrain generation utilities
const generateNoise = (
  width: number,
  height: number,
  params: TerrainParameters
): Float32Array => {
  const heightmap = new Float32Array(width * height);
  const { seed, octaves, frequency, amplitude, persistence, lacunarity } = params;
  
  // Simplified noise generation (in production, use a proper noise library)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      let amp = amplitude;
      let freq = frequency;
      
      for (let i = 0; i < octaves; i++) {
        const nx = x * freq;
        const ny = y * freq;
        const noise = Math.sin(nx + seed) * Math.cos(ny + seed);
        value += noise * amp;
        amp *= persistence;
        freq *= lacunarity;
      }
      
      heightmap[y * width + x] = Math.max(0, Math.min(1, (value + 1) / 2));
    }
  }
  
  return heightmap;
};

const createTerrainGeometry = (
  heightmap: Float32Array,
  width: number,
  height: number,
  scale: number = 100
): THREE.BufferGeometry => {
  const geometry = new THREE.PlaneGeometry(scale, scale, width - 1, height - 1);
  const vertices = geometry.attributes.position.array as Float32Array;
  
  for (let i = 0; i < vertices.length; i += 3) {
    const index = Math.floor(i / 3);
    vertices[i + 2] = heightmap[index] * scale * 0.2;
  }
  
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
  
  return geometry;
};

// Terrain Preview Component
const TerrainPreview: React.FC<{
  heightmap: Float32Array;
  resolution: number;
  materials: MaterialConfig[];
  environment: EnvironmentalConfig;
  isGenerating: boolean;
}> = ({ heightmap, resolution, materials, environment, isGenerating }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { scene } = useThree();
  
  const geometry = useMemo(() => {
    if (!heightmap || heightmap.length === 0) return new THREE.PlaneGeometry(1, 1);
    return createTerrainGeometry(heightmap, resolution, resolution);
  }, [heightmap, resolution]);
  
  const material = useMemo(() => {
    // Create a material that blends based on height
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(materials[2]?.color || '#16a34a'),
      roughness: 0.8,
      metalness: 0.1,
      wireframe: false
    });
  }, [materials]);
  
  useFrame(() => {
    if (meshRef.current && !isGenerating) {
      meshRef.current.rotation.z += 0.001;
    }
  });
  
  useEffect(() => {
    // Update fog
    scene.fog = new THREE.Fog(
      new THREE.Color(environment.fogColor),
      1,
      environment.fogDensity * 1000
    );
  }, [scene, environment]);
  
  return (
    <mesh ref={meshRef} geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]}>
      <directionalLight
        position={environment.sunPosition}
        intensity={environment.sunIntensity}
        castShadow
      />
      <ambientLight intensity={environment.ambientIntensity} />
    </mesh>
  );
};

// Parameter Control Panel Component
const ParameterControlPanel: React.FC<{
  parameters: TerrainParameters;
  onParametersChange: (parameters: Partial<TerrainParameters>) => void;
  isGenerating: boolean;
}> = ({ parameters, onParametersChange, isGenerating }) => {
  const handleSliderChange = useCallback((key: keyof TerrainParameters, value: number[]) => {
    onParametersChange({ [key]: value[0] });
  }, [onParametersChange]);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Seed</Label>
          <Input
            type="number"
            value={parameters.seed}
            onChange={(e) => onParametersChange({ seed: parseInt(e.target.value) || 0 })}
            disabled={isGenerating}
            className="h-8"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Octaves: {parameters.octaves}</Label>
          <Slider
            value={[parameters.octaves]}
            onValueChange={(value) => handleSliderChange('octaves', value)}
            min={1}
            max={12}
            step={1}
            disabled={isGenerating}
            className="w-full"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Frequency: {parameters.frequency.toFixed(3)}</Label>
          <Slider
            value={[parameters.frequency]}
            onValueChange={(value) => handleSliderChange('frequency', value)}
            min={0.001}
            max={0.1}
            step={0.001}
            disabled={isGenerating}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Amplitude: {parameters.amplitude}</Label>
          <Slider
            value={[parameters.amplitude]}
            onValueChange={(value) => handleSliderChange('amplitude', value)}
            min={1}
            max={200}
            step={1}
            disabled={isGenerating}
            className="w-full"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Persistence: {parameters.persistence.toFixed(2)}</Label>
          <Slider
            value={[parameters.persistence]}
            onValueChange={(value) => handleSliderChange('persistence', value)}
            min={0.1}
            max={1.0}
            step={0.01}
            disabled={isGenerating}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Lacunarity: {parameters.lacunarity.toFixed(1)}</Label>
          <Slider
            value={[parameters.lacunarity]}
            onValueChange={(value) => handleSliderChange('lacunarity', value)}
            min={1.0}
            max={4.0}
            step={0.1}
            disabled={isGenerating}
            className="w-full"
          />
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Mountain className="w-4 h-4" />
          Erosion Parameters
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Thermal: {parameters.thermalErosion.toFixed(3)}</Label>
            <Slider
              value={[parameters.thermalErosion]}
              onValueChange={(value) => handleSliderChange('thermalErosion', value)}
              min={0}
              max={0.2}
              step={0.001}
              disabled={isGenerating}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hydraulic: {parameters.hydraulicErosion.toFixed(3)}</Label>
            <Slider
              value={[parameters.hydraulicErosion]}
              onValueChange={(value) => handleSliderChange('hydraulicErosion', value)}
              min={0}
              max={0.3}
              step={0.001}
              disabled={isGenerating}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Material Assignment Panel Component
const MaterialAssignmentPanel: React.FC<{
  materials: MaterialConfig[];
  onMaterialsChange: (materials: MaterialConfig[]) => void;
  isGenerating: boolean;
}> = ({ materials, onMaterialsChange, isGenerating }) => {
  const updateMaterial = useCallback((index: number, updates: Partial<MaterialConfig>) => {
    const newMaterials = materials.map((mat, i) => 
      i === index ? { ...mat, ...updates } : mat
    );
    onMaterialsChange(newMaterials);
  }, [materials, onMaterialsChange]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Material Layers
        </h4>
        <Button size="sm" variant="outline" disabled={isGenerating}>
          <Layers className="w-4 h-4" />
          Add Layer
        </Button>
      </div>
      
      <div className="space-y-3">
        {materials.map((material, index) => (
          <Card key={material.id} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: material.color }}
                />
                <span className="text-sm font-medium">{material.name}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {(material.heightRange[0] * 100).toFixed(0)}-{(material.heightRange[1] * 100).toFixed(0)}%
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <Label className="text-xs">Height Range</Label>
                <div className="flex gap-1 mt-1">
                  <Input
                    type="number"
                    value={material.heightRange[0]}
                    onChange={(e) => updateMaterial(index, {
                      heightRange: [parseFloat(e.target.value) || 0, material.heightRange[1]]
                    })}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={isGenerating}
                    className="h-6 text-xs"
                  />
                  <Input
                    type="number"
                    value={material.heightRange[1]}
                    onChange={(e) => updateMaterial(index, {
                      heightRange: [material.heightRange[0], parseFloat(e.target.value) || 1]
                    })}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={isGenerating}
                    className="h-6 text-xs"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Roughness: {material.roughness.toFixed(2)}</Label>
                <Slider
                  value={[material.roughness]}
                  onValueChange={(value) => updateMaterial(index, { roughness: value[0] })}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={isGenerating}
                  className="mt-1"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Environmental Controls Component
const EnvironmentalControls: React.FC<{
  environment: EnvironmentalConfig;
  onEnvironmentChange: (environment: Partial<EnvironmentalConfig>) => void;
  isGenerating: boolean;
}> = ({ environment, onEnvironmentChange, isGenerating }) => {
  const handleSliderChange = useCallback((key: keyof EnvironmentalConfig, value: number[]) => {
    onEnvironmentChange({ [key]: value[0] });
  }, [onEnvironmentChange]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sun className="w-4 h-4" />
        <h4 className="text-sm font-semibold">Lighting & Atmosphere</h4>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Sun Intensity: {environment.sunIntensity.toFixed(1)}</Label>
          <Slider
            value={[environment.sunIntensity]}
            onValueChange={(value) => handleSliderChange('sunIntensity', value)}
            min={0}
            max={3}
            step={0.1}
            disabled={isGenerating}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Ambient: {environment.ambientIntensity.toFixed(1)}</Label>
          <Slider
            value={[environment.ambientIntensity]}
            onValueChange={(value) => handleSliderChange('ambientIntensity', value)}
            min={0}
            max={1}
            step={0.1}
            disabled={isGenerating}
            className="w-full"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm font-medium">Skybox</Label>
        <Select
          value={environment.skyboxType}
          onValueChange={(value: EnvironmentalConfig['skyboxType']) => 
            onEnvironmentChange({ skyboxType: value })
          }
          disabled={isGenerating}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clear">Clear Sky</SelectItem>
            <SelectItem value="cloudy">Cloudy</SelectItem>
            <SelectItem value="sunset">Sunset</SelectItem>
            <SelectItem value="night">Night</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Separator />
      
      <div className="flex items-center gap-2">
        <Cloud className="w-4 h-4" />
        <h4 className="text-sm font-semibold">Weather Effects</h4>
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm font-medium">Fog Density: {environment.fogDensity.toFixed(3)}</Label>
        <Slider
          value={[environment.fogDensity]}
          onValueChange={(value) => handleSliderChange('fogDensity', value)}
          min={0}
          max={0.1}
          step={0.001}
          disabled={isGenerating}
          className="w-full"
        />
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm font-medium">Wind Strength: {environment.windStrength.toFixed(1)}</Label>
        <Slider
          value={[environment.windStrength]}
          onValueChange={(value) => handleSliderChange('windStrength', value)}
          min={0}
          max={2}
          step={0.1}
          disabled={isGenerating}
          className="w-full"
        />
      </div>
    </div>
  );
};

// Terrain Metrics Component
const TerrainMetrics: React.FC<{
  metrics: TerrainMetrics | null;
  generationProgress: number;
  isGenerating: boolean;
}> = ({ metrics, generationProgress, isGenerating }) => {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Terrain Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isGenerating ? (