```tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mountain, 
  Waves, 
  TreePine, 
  Download, 
  Upload, 
  RotateCcw, 
  Play, 
  Pause,
  Settings,
  Eye,
  Layers,
  Brush,
  Zap
} from 'lucide-react';

interface TerrainParameters {
  width: number;
  height: number;
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  seed: number;
}

interface NoiseSettings {
  type: 'perlin' | 'simplex' | 'ridged' | 'fbm';
  frequency: number;
  amplitude: number;
  ridgeOffset?: number;
  gain?: number;
}

interface TextureLayer {
  id: string;
  name: string;
  texture: string;
  heightMin: number;
  heightMax: number;
  blendMode: 'multiply' | 'overlay' | 'normal';
  opacity: number;
  scale: number;
}

interface GeologicalFeature {
  id: string;
  type: 'volcano' | 'crater' | 'ridge' | 'valley' | 'plateau';
  x: number;
  y: number;
  radius: number;
  intensity: number;
  falloff: number;
}

interface ErosionSettings {
  iterations: number;
  strength: number;
  evaporation: number;
  deposition: number;
  capacity: number;
  minSlope: number;
  gravity: number;
}

interface BrushSettings {
  size: number;
  strength: number;
  mode: 'raise' | 'lower' | 'smooth' | 'plateau';
  falloff: 'linear' | 'smooth' | 'sharp';
}

interface TerrainGeneratorProps {
  className?: string;
  onTerrainGenerated?: (terrainData: ImageData) => void;
  onExport?: (format: string, data: any) => void;
  initialParameters?: Partial<TerrainParameters>;
}

export default function TerrainGenerator({
  className = '',
  onTerrainGenerated,
  onExport,
  initialParameters = {}
}: TerrainGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isErosionRunning, setIsErosionRunning] = useState(false);
  
  const [parameters, setParameters] = useState<TerrainParameters>({
    width: 512,
    height: 512,
    scale: 100,
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.0,
    seed: Math.floor(Math.random() * 1000),
    ...initialParameters
  });

  const [noiseSettings, setNoiseSettings] = useState<NoiseSettings>({
    type: 'perlin',
    frequency: 0.01,
    amplitude: 1.0,
    ridgeOffset: 1.0,
    gain: 2.0
  });

  const [textureLayers, setTextureLayers] = useState<TextureLayer[]>([
    {
      id: '1',
      name: 'Bedrock',
      texture: 'rock',
      heightMin: 0,
      heightMax: 0.3,
      blendMode: 'normal',
      opacity: 1.0,
      scale: 1.0
    },
    {
      id: '2',
      name: 'Grass',
      texture: 'grass',
      heightMin: 0.2,
      heightMax: 0.7,
      blendMode: 'normal',
      opacity: 0.8,
      scale: 1.0
    },
    {
      id: '3',
      name: 'Snow',
      texture: 'snow',
      heightMin: 0.6,
      heightMax: 1.0,
      blendMode: 'normal',
      opacity: 0.9,
      scale: 1.0
    }
  ]);

  const [geologicalFeatures, setGeologicalFeatures] = useState<GeologicalFeature[]>([]);

  const [erosionSettings, setErosionSettings] = useState<ErosionSettings>({
    iterations: 100,
    strength: 0.1,
    evaporation: 0.01,
    deposition: 0.3,
    capacity: 0.01,
    minSlope: 0.01,
    gravity: 4.0
  });

  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 20,
    strength: 0.1,
    mode: 'raise',
    falloff: 'smooth'
  });

  const [activeTab, setActiveTab] = useState('heightmap');
  const [selectedTool, setSelectedTool] = useState<'brush' | 'feature' | 'view'>('view');
  const [heightMapData, setHeightMapData] = useState<ImageData | null>(null);

  // Simplified noise function (in production, use a proper noise library)
  const simpleNoise = useCallback((x: number, y: number, seed: number = 0): number => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return (n - Math.floor(n));
  }, []);

  const generateTerrain = useCallback(async () => {
    if (!canvasRef.current) return;

    setIsGenerating(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = parameters.width;
    canvas.height = parameters.height;

    const imageData = ctx.createImageData(parameters.width, parameters.height);
    const data = imageData.data;

    // Generate height map using noise
    for (let y = 0; y < parameters.height; y++) {
      for (let x = 0; x < parameters.width; x++) {
        let height = 0;
        let amplitude = 1;
        let frequency = noiseSettings.frequency;

        // Generate fractal noise
        for (let octave = 0; octave < parameters.octaves; octave++) {
          const sampleX = x * frequency;
          const sampleY = y * frequency;
          
          let noise = 0;
          switch (noiseSettings.type) {
            case 'perlin':
              noise = simpleNoise(sampleX, sampleY, parameters.seed + octave);
              break;
            case 'simplex':
              noise = simpleNoise(sampleX * 1.4, sampleY * 1.4, parameters.seed + octave);
              break;
            case 'ridged':
              noise = 1 - Math.abs(simpleNoise(sampleX, sampleY, parameters.seed + octave));
              noise = Math.pow(noise, noiseSettings.ridgeOffset || 1);
              break;
            case 'fbm':
              noise = simpleNoise(sampleX, sampleY, parameters.seed + octave) * 2 - 1;
              break;
          }

          height += noise * amplitude;
          amplitude *= parameters.persistence;
          frequency *= parameters.lacunarity;
        }

        // Apply geological features
        geologicalFeatures.forEach(feature => {
          const dx = x - feature.x;
          const dy = y - feature.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < feature.radius) {
            const falloff = Math.pow(1 - (distance / feature.radius), feature.falloff);
            const influence = feature.intensity * falloff;
            
            switch (feature.type) {
              case 'volcano':
                height += influence * (1 - distance / feature.radius);
                break;
              case 'crater':
                height -= influence * (1 - distance / feature.radius);
                break;
              case 'ridge':
                height += influence * Math.exp(-distance / feature.radius);
                break;
              case 'valley':
                height -= influence * Math.exp(-distance / feature.radius);
                break;
              case 'plateau':
                height = Math.max(height, influence);
                break;
            }
          }
        });

        // Normalize height to 0-1 range
        height = Math.max(0, Math.min(1, (height + 1) / 2));

        const pixelIndex = (y * parameters.width + x) * 4;
        const heightValue = Math.floor(height * 255);
        
        data[pixelIndex] = heightValue;     // R
        data[pixelIndex + 1] = heightValue; // G
        data[pixelIndex + 2] = heightValue; // B
        data[pixelIndex + 3] = 255;         // A
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setHeightMapData(imageData);
    onTerrainGenerated?.(imageData);
    setIsGenerating(false);

    // Generate preview
    generatePreview(imageData);
  }, [parameters, noiseSettings, geologicalFeatures, simpleNoise, onTerrainGenerated]);

  const generatePreview = useCallback((heightData: ImageData) => {
    if (!previewRef.current) return;

    const canvas = previewRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 256;
    canvas.height = 256;

    // Create a scaled down preview with texture blending
    const previewData = ctx.createImageData(256, 256);
    const data = previewData.data;

    const scaleX = heightData.width / 256;
    const scaleY = heightData.height / 256;

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const sourceX = Math.floor(x * scaleX);
        const sourceY = Math.floor(y * scaleY);
        const sourceIndex = (sourceY * heightData.width + sourceX) * 4;
        const height = heightData.data[sourceIndex] / 255;

        let r = 0, g = 0, b = 0, totalOpacity = 0;

        // Blend textures based on height
        textureLayers.forEach(layer => {
          if (height >= layer.heightMin && height <= layer.heightMax) {
            const influence = layer.opacity * Math.min(1, 
              (height - layer.heightMin) / (layer.heightMax - layer.heightMin)
            );

            // Simple texture color mapping
            let layerR = 128, layerG = 128, layerB = 128;
            switch (layer.texture) {
              case 'rock':
                layerR = 100; layerG = 80; layerB = 60;
                break;
              case 'grass':
                layerR = 60; layerG = 120; layerB = 40;
                break;
              case 'snow':
                layerR = 240; layerG = 240; layerB = 250;
                break;
              case 'sand':
                layerR = 200; layerG = 180; layerB = 120;
                break;
              case 'water':
                layerR = 40; layerG = 80; layerB = 160;
                break;
            }

            r += layerR * influence;
            g += layerG * influence;
            b += layerB * influence;
            totalOpacity += influence;
          }
        });

        if (totalOpacity > 0) {
          r /= totalOpacity;
          g /= totalOpacity;
          b /= totalOpacity;
        }

        const pixelIndex = (y * 256 + x) * 4;
        data[pixelIndex] = Math.floor(r);
        data[pixelIndex + 1] = Math.floor(g);
        data[pixelIndex + 2] = Math.floor(b);
        data[pixelIndex + 3] = 255;
      }
    }

    ctx.putImageData(previewData, 0, 0);
  }, [textureLayers]);

  const applyErosion = useCallback(async () => {
    if (!heightMapData) return;

    setIsErosionRunning(true);
    
    // Simplified erosion simulation
    const workingData = new ImageData(
      new Uint8ClampedArray(heightMapData.data),
      heightMapData.width,
      heightMapData.height
    );

    for (let iteration = 0; iteration < erosionSettings.iterations; iteration++) {
      // Apply erosion effects (simplified)
      for (let y = 1; y < workingData.height - 1; y++) {
        for (let x = 1; x < workingData.width - 1; x++) {
          const currentIndex = (y * workingData.width + x) * 4;
          const currentHeight = workingData.data[currentIndex];
          
          let totalHeight = 0;
          let neighbors = 0;
          
          // Check neighbors
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              
              const neighborIndex = ((y + dy) * workingData.width + (x + dx)) * 4;
              totalHeight += workingData.data[neighborIndex];
              neighbors++;
            }
          }
          
          const averageHeight = totalHeight / neighbors;
          const heightDiff = currentHeight - averageHeight;
          
          if (Math.abs(heightDiff) > erosionSettings.minSlope * 255) {
            const erosionAmount = erosionSettings.strength * heightDiff;
            const newHeight = currentHeight - erosionAmount * erosionSettings.deposition;
            
            workingData.data[currentIndex] = Math.max(0, Math.min(255, newHeight));
            workingData.data[currentIndex + 1] = workingData.data[currentIndex];
            workingData.data[currentIndex + 2] = workingData.data[currentIndex];
          }
        }
      }
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.putImageData(workingData, 0, 0);
        setHeightMapData(workingData);
        generatePreview(workingData);
      }
    }

    setIsErosionRunning(false);
  }, [heightMapData, erosionSettings, generatePreview]);

  const addGeologicalFeature = useCallback((type: GeologicalFeature['type'], x: number, y: number) => {
    const newFeature: GeologicalFeature = {
      id: Date.now().toString(),
      type,
      x,
      y,
      radius: 50,
      intensity: 0.5,
      falloff: 2
    };
    
    setGeologicalFeatures(prev => [...prev, newFeature]);
  }, []);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== 'feature' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * parameters.width;
    const y = ((event.clientY - rect.top) / rect.height) * parameters.height;

    addGeologicalFeature('volcano', x, y);
  }, [selectedTool, parameters.width, parameters.height, addGeologicalFeature]);

  const exportTerrain = useCallback((format: 'png' | 'heightmap' | 'obj') => {
    if (!heightMapData || !canvasRef.current) return;

    switch (format) {
      case 'png':
        const link = document.createElement('a');
        link.download = 'terrain-heightmap.png';
        link.href = canvasRef.current.toDataURL();
        link.click();
        break;
      case 'heightmap':
        const heightData = Array.from(heightMapData.data)
          .filter((_, i) => i % 4 === 0)
          .map(v => v / 255);
        onExport?.('heightmap', heightData);
        break;
      case 'obj':
        // Generate OBJ mesh data
        let objData = 'o Terrain\n';
        const scale = 10;
        
        // Generate vertices
        for (let y = 0; y < parameters.height; y += 4) {
          for (let x = 0; x < parameters.width; x += 4) {
            const index = (y * parameters.width + x) * 4;
            const height = (heightMapData.data[index] / 255) * scale;
            objData += `v ${x / 10} ${height} ${y / 10}\n`;
          }
        }
        
        onExport?.('obj', objData);
        break;
    }
  }, [heightMapData, parameters, onExport]);

  useEffect(() => {
    generateTerrain();
  }, [generateTerrain]);

  return (
    <div className={`terrain-generator grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 ${className}`}>
      {/* Main Canvas Area */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mountain className="w-5 h-5" />
                Terrain Height Map
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedTool === 'view' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTool('view')}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant={selectedTool === 'brush' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTool('brush')}
                >
                  <Brush className="w-4 h-4" />
                </Button>
                <Button
                  variant={selectedTool === 'feature' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTool('feature')}
                >
                  <Zap className="w-4 h-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative border rounded-lg overflow-hidden bg-muted">
              <canvas
                ref={canvasRef}
                className="w-full h-auto cursor-crosshair"
                onClick={handleCanvasClick}
                style={{ aspectRatio: `${parameters.width}/${parameters.height}` }}
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white font-medium">Generating terrain...</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              3D Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={previewRef}
              className="w-full h-64 border rounded-lg bg-muted"
            />
          </CardContent>
        </Card>
      </div>

      {/* Controls Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Terrain Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="heightmap">Height</TabsTrigger>
                <TabsTrigger value="textures">Texture</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="erosion">Erosion</TabsTrigger>
              </TabsList>

              <TabsContent value="heightmap" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Width</Label>
                      <Input
                        type="number"
                        value={parameters.width}
                        onChange={(e) => setParameters(prev => ({
                          ...prev,
                          width: parseInt(e.target.value)
                        }))}
                        min={64}
                        max={2048}
                        step={64}
                      />
                    </div>
                    <div>
                      <Label>Height</Label>
                      <Input
                        type="number"
                        value={parameters.height}
                        onChange={(e) => setParameters(prev => ({
                          ...prev,
                          height: parseInt(e.target.value)
                        }))}
                        min={64}
                        max={2048}
                        step={64}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Noise Type</Label>
                    <Select
                      value={noiseSettings.type}
                      onValueChange={(value: NoiseSettings['type']) => 
                        setNoiseSettings(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="perlin">Perlin