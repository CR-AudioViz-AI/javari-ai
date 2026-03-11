```tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Sky, Environment } from '@react-three/drei';
import { Physics, usePlane, useBox, useSphere } from '@react-three/cannon';
import * as THREE from 'three';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';

/**
 * VR Environment Builder Interface Types
 */
interface SceneObject {
  id: string;
  name: string;
  type: 'primitive' | 'model' | 'light' | 'camera';
  geometry: 'box' | 'sphere' | 'plane' | 'cylinder' | 'custom';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  material: MaterialProperties;
  physics?: PhysicsProperties;
  metadata?: Record<string, any>;
}

interface MaterialProperties {
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  opacity: number;
  transparent: boolean;
  texture?: string;
  normalMap?: string;
}

interface PhysicsProperties {
  type: 'static' | 'dynamic' | 'kinematic';
  mass: number;
  friction: number;
  restitution: number;
  collisionGroup: number;
}

interface LightingConfig {
  ambientIntensity: number;
  ambientColor: string;
  directionalLight: {
    intensity: number;
    color: string;
    position: [number, number, number];
    castShadow: boolean;
  };
  pointLights: Array<{
    id: string;
    position: [number, number, number];
    color: string;
    intensity: number;
    decay: number;
  }>;
}

interface EnvironmentConfig {
  skybox: 'none' | 'sunset' | 'dawn' | 'night' | 'custom';
  fog: {
    enabled: boolean;
    color: string;
    near: number;
    far: number;
  };
  gravity: [number, number, number];
}

interface AssetLibraryItem {
  id: string;
  name: string;
  category: string;
  type: string;
  thumbnail: string;
  properties: Partial<SceneObject>;
}

/**
 * Asset Library Data
 */
const ASSET_LIBRARY: AssetLibraryItem[] = [
  {
    id: 'primitive-box',
    name: 'Box',
    category: 'Primitives',
    type: 'primitive',
    thumbnail: '📦',
    properties: {
      geometry: 'box',
      material: { color: '#ffffff', metalness: 0, roughness: 0.5, emissive: '#000000', opacity: 1, transparent: false },
      physics: { type: 'dynamic', mass: 1, friction: 0.3, restitution: 0.3, collisionGroup: 1 }
    }
  },
  {
    id: 'primitive-sphere',
    name: 'Sphere',
    category: 'Primitives',
    type: 'primitive',
    thumbnail: '⚪',
    properties: {
      geometry: 'sphere',
      material: { color: '#ffffff', metalness: 0, roughness: 0.5, emissive: '#000000', opacity: 1, transparent: false },
      physics: { type: 'dynamic', mass: 1, friction: 0.3, restitution: 0.8, collisionGroup: 1 }
    }
  },
  {
    id: 'primitive-plane',
    name: 'Plane',
    category: 'Primitives',
    type: 'primitive',
    thumbnail: '⬜',
    properties: {
      geometry: 'plane',
      material: { color: '#cccccc', metalness: 0, roughness: 1, emissive: '#000000', opacity: 1, transparent: false },
      physics: { type: 'static', mass: 0, friction: 0.8, restitution: 0.1, collisionGroup: 1 }
    }
  }
];

/**
 * Draggable Asset Item Component
 */
const AssetItem: React.FC<{ asset: AssetLibraryItem }> = ({ asset }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'asset',
    item: { asset },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }));

  return (
    <div
      ref={drag}
      className={`asset-item p-3 border rounded-lg cursor-move bg-white hover:bg-gray-50 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="text-2xl mb-1">{asset.thumbnail}</div>
      <div className="text-sm font-medium text-gray-700">{asset.name}</div>
    </div>
  );
};

/**
 * Asset Library Component
 */
const DragDropAssetLibrary: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Primitives');
  const categories = useMemo(() => [...new Set(ASSET_LIBRARY.map(asset => asset.category))], []);

  return (
    <div className="asset-library w-64 bg-gray-100 border-r overflow-y-auto">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-800">Asset Library</h3>
      </div>
      
      <div className="p-2">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full p-2 border rounded"
        >
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 p-2">
        {ASSET_LIBRARY
          .filter(asset => asset.category === selectedCategory)
          .map(asset => (
            <AssetItem key={asset.id} asset={asset} />
          ))
        }
      </div>
    </div>
  );
};

/**
 * Scene Hierarchy Component
 */
const SceneHierarchy: React.FC<{
  objects: SceneObject[];
  selectedObject: string | null;
  onSelectObject: (id: string | null) => void;
  onDeleteObject: (id: string) => void;
  onDuplicateObject: (id: string) => void;
}> = ({ objects, selectedObject, onSelectObject, onDeleteObject, onDuplicateObject }) => {
  return (
    <div className="scene-hierarchy w-64 bg-gray-100 border-l">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-800">Scene Hierarchy</h3>
      </div>
      
      <div className="p-2">
        {objects.map(obj => (
          <div
            key={obj.id}
            className={`p-2 rounded cursor-pointer flex items-center justify-between group ${
              selectedObject === obj.id ? 'bg-blue-200' : 'hover:bg-gray-200'
            }`}
            onClick={() => onSelectObject(obj.id)}
          >
            <span className="text-sm">{obj.name}</span>
            <div className="opacity-0 group-hover:opacity-100 flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateObject(obj.id);
                }}
                className="text-xs px-2 py-1 bg-blue-500 text-white rounded"
              >
                Copy
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteObject(obj.id);
                }}
                className="text-xs px-2 py-1 bg-red-500 text-white rounded"
              >
                Del
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Properties Panel Component
 */
const PropertiesPanel: React.FC<{
  selectedObject: SceneObject | null;
  onUpdateObject: (id: string, updates: Partial<SceneObject>) => void;
}> = ({ selectedObject, onUpdateObject }) => {
  if (!selectedObject) {
    return (
      <div className="properties-panel w-80 bg-gray-100 border-l p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Properties</h3>
        <p className="text-gray-500">No object selected</p>
      </div>
    );
  }

  const updateTransform = (property: 'position' | 'rotation' | 'scale', axis: number, value: number) => {
    const current = selectedObject[property];
    const updated = [...current] as [number, number, number];
    updated[axis] = value;
    onUpdateObject(selectedObject.id, { [property]: updated });
  };

  const updateMaterial = (property: keyof MaterialProperties, value: any) => {
    onUpdateObject(selectedObject.id, {
      material: { ...selectedObject.material, [property]: value }
    });
  };

  const updatePhysics = (property: keyof PhysicsProperties, value: any) => {
    onUpdateObject(selectedObject.id, {
      physics: { ...selectedObject.physics, [property]: value }
    });
  };

  return (
    <div className="properties-panel w-80 bg-gray-100 border-l p-4 overflow-y-auto">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Properties</h3>
      
      <div className="space-y-4">
        {/* Transform */}
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Transform</h4>
          {(['position', 'rotation', 'scale'] as const).map(prop => (
            <div key={prop} className="mb-2">
              <label className="text-sm text-gray-600 capitalize">{prop}</label>
              <div className="grid grid-cols-3 gap-1">
                {selectedObject[prop].map((value, axis) => (
                  <input
                    key={axis}
                    type="number"
                    value={value}
                    step="0.1"
                    onChange={(e) => updateTransform(prop, axis, parseFloat(e.target.value) || 0)}
                    className="text-xs p-1 border rounded"
                    placeholder={['X', 'Y', 'Z'][axis]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Material */}
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Material</h4>
          <div className="space-y-2">
            <div>
              <label className="text-sm text-gray-600">Color</label>
              <input
                type="color"
                value={selectedObject.material.color}
                onChange={(e) => updateMaterial('color', e.target.value)}
                className="w-full h-8 border rounded"
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-600">Metalness</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={selectedObject.material.metalness}
                onChange={(e) => updateMaterial('metalness', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Roughness</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={selectedObject.material.roughness}
                onChange={(e) => updateMaterial('roughness', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={selectedObject.material.opacity}
                onChange={(e) => updateMaterial('opacity', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Physics */}
        {selectedObject.physics && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Physics</h4>
            <div className="space-y-2">
              <div>
                <label className="text-sm text-gray-600">Type</label>
                <select
                  value={selectedObject.physics.type}
                  onChange={(e) => updatePhysics('type', e.target.value)}
                  className="w-full p-1 border rounded text-sm"
                >
                  <option value="static">Static</option>
                  <option value="dynamic">Dynamic</option>
                  <option value="kinematic">Kinematic</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600">Mass</label>
                <input
                  type="number"
                  value={selectedObject.physics.mass}
                  onChange={(e) => updatePhysics('mass', parseFloat(e.target.value) || 0)}
                  className="w-full p-1 border rounded text-sm"
                  min="0"
                  step="0.1"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Friction</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedObject.physics.friction}
                  onChange={(e) => updatePhysics('friction', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Restitution</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedObject.physics.restitution}
                  onChange={(e) => updatePhysics('restitution', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Toolbar Actions Component
 */
const ToolbarActions: React.FC<{
  onSave: () => void;
  onLoad: () => void;
  onPreview: () => void;
  onExport: () => void;
  onClear: () => void;
}> = ({ onSave, onLoad, onPreview, onExport, onClear }) => {
  return (
    <div className="toolbar bg-gray-800 text-white p-4 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        >
          Save
        </button>
        <button
          onClick={onLoad}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
        >
          Load
        </button>
        <button
          onClick={onPreview}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
        >
          Preview VR
        </button>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded transition-colors"
        >
          Export
        </button>
        <button
          onClick={onClear}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
        >
          Clear
        </button>
      </div>
      
      <div className="ml-auto">
        <span className="text-sm text-gray-300">CRAIverse VR Environment Builder</span>
      </div>
    </div>
  );
};

/**
 * 3D Scene Object Component
 */
const SceneObjectMesh: React.FC<{
  object: SceneObject;
  selected: boolean;
  onSelect: () => void;
}> = ({ object, selected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [physicsRef] = object.physics ? 
    (object.geometry === 'box' ? useBox(() => ({ 
      mass: object.physics!.mass,
      position: object.position,
      args: object.scale
    })) :
    object.geometry === 'sphere' ? useSphere(() => ({
      mass: object.physics!.mass,
      position: object.position,
      args: [object.scale[0]]
    })) :
    usePlane(() => ({
      mass: object.physics!.mass,
      position: object.position,
      rotation: object.rotation
    }))) :
    [null];

  useEffect(() => {
    if (meshRef.current && !object.physics) {
      meshRef.current.position.fromArray(object.position);
      meshRef.current.rotation.fromArray(object.rotation);
      meshRef.current.scale.fromArray(object.scale);
    }
  }, [object.position, object.rotation, object.scale, object.physics]);

  const getGeometry = () => {
    switch (object.geometry) {
      case 'box':
        return <boxGeometry args={object.scale} />;
      case 'sphere':
        return <sphereGeometry args={[object.scale[0], 32, 32]} />;
      case 'plane':
        return <planeGeometry args={object.scale} />;
      case 'cylinder':
        return <cylinderGeometry args={[object.scale[0], object.scale[1], object.scale[2]]} />;
      default:
        return <boxGeometry args={object.scale} />;
    }
  };

  return (
    <mesh
      ref={physicsRef || meshRef}
      onClick={onSelect}
      position={object.physics ? undefined : object.position}
      rotation={object.physics ? undefined : object.rotation}
      scale={object.physics ? undefined : object.scale}
    >
      {getGeometry()}
      <meshStandardMaterial
        color={object.material.color}
        metalness={object.material.metalness}
        roughness={object.material.roughness}
        emissive={object.material.emissive}
        opacity={object.material.opacity}
        transparent={object.material.transparent}
        wireframe={selected}
      />
    </mesh>
  );
};

/**
 * Preview Canvas Component with Drop Zone
 */
const PreviewCanvas: React.FC<{
  objects: SceneObject[];
  selectedObject: string | null;
  onSelectObject: (id: string | null) => void;
  onAddObject: (asset: AssetLibraryItem, position: [number, number, number]) => void;
  onUpdateObject: (id: string, updates: Partial<SceneObject>) => void;
  lighting: LightingConfig;
  environment: EnvironmentConfig;
}> = ({ objects, selectedObject, onSelectObject, onAddObject, onUpdateObject, lighting, environment }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'asset',
    drop: (item: { asset: AssetLibraryItem }, monitor) => {
      const offset = monitor.getClientOffset();
      if (offset) {
        // Convert screen coordinates to world position
        const position: [number, number, number] = [
          (offset.x - window.innerWidth / 2) * 0.01,
          0,
          (offset.y - window.innerHeight / 2) * 0.01
        ];
        onAddObject(item.asset, position);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  }));

  const CameraControls = () => {
    const { camera, gl } = useThree();
    return <OrbitControls camera={camera} domElement={gl.domElement} enableDamping />;
  };

  const TransformGizmo = () => {
    const selectedObj = objects.find(obj => obj.id === selectedObject);
    if (!selectedObj) return null;

    return (
      <TransformControls
        object={selectedObj}
        mode="translate"
        onObjectChange={(e) => {
          if (e?.target?.object) {
            const obj = e.target.object;
            onUpdateObject(selectedObj.id, {
              position: [obj.position.x, obj.position.y, obj.position.z]
            });
          }
        }}
      />
    );
  };

  return (
    <div ref={drop} className={`preview-canvas flex-1 relative ${isOver ? 'bg-blue-50' : ''}`}>
      <Canvas
        shadows
        camera={{ position: [10, 10, 10], fov: 60 }}
        style={{ background: environment.fog.enabled ? environment.fog.color : '#87CEEB' }}
      >
        <CameraControls />
        
        {/* Lighting */}
        <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />
        <directionalLight
          position={lighting.directionalLight.position}
          intensity={lighting.directionalLight.intensity}
          color={lighting.directionalLight.color}
          castShadow={lighting.directionalLight.castShadow}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        
        {lighting.pointLights.map(light => (
          <pointLight
            key={light.id}
            position={light.position}
            color={light.color}
            intensity={light.intensity}
            decay={light.decay}
          />
        ))}

        {/* Environment */}
        {environment.skybox !== 'none' && <Sky />}
        {environment