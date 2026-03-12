```tsx
'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  Handle,
  Position,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toast, ToastAction } from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import {
  Play,
  Save,
  FolderOpen,
  Download,
  Upload,
  Settings,
  Eye,
  Zap,
  Brain,
  Mic,
  Music,
  FileAudio,
  Waveform,
  Bot,
  MessageSquare,
  Image,
  Video,
  Database,
  Globe,
  Plus,
  Trash2,
  Copy,
  Edit3,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';

interface AgentCapability {
  id: string;
  type: 'audio-processing' | 'nlp' | 'vision' | 'integration' | 'storage' | 'workflow';
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  inputs: CapabilityPort[];
  outputs: CapabilityPort[];
  properties: CapabilityProperty[];
  category: string;
  color: string;
}

interface CapabilityPort {
  id: string;
  name: string;
  dataType: 'audio' | 'text' | 'image' | 'video' | 'data' | 'trigger';
  required: boolean;
}

interface CapabilityProperty {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'range';
  defaultValue: any;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  description: string;
}

interface AgentConfiguration {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  properties: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface AgentCapabilityNodeData {
  capability: AgentCapability;
  properties: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

interface ConnectionValidation {
  isValid: boolean;
  message: string;
}

interface VisualAgentConfigurationBuilderProps {
  className?: string;
  onConfigurationChange?: (config: AgentConfiguration) => void;
  onPreviewUpdate?: (previewData: any) => void;
  defaultConfiguration?: Partial<AgentConfiguration>;
  readOnly?: boolean;
}

// Predefined agent capabilities
const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    id: 'audio-input',
    type: 'audio-processing',
    name: 'Audio Input',
    description: 'Capture audio from microphone or file',
    icon: Mic,
    category: 'Input',
    color: '#3b82f6',
    inputs: [],
    outputs: [{ id: 'audio_out', name: 'Audio Stream', dataType: 'audio', required: true }],
    properties: [
      { id: 'source', name: 'Source', type: 'select', defaultValue: 'microphone', options: ['microphone', 'file'], description: 'Audio input source' },
      { id: 'sample_rate', name: 'Sample Rate', type: 'select', defaultValue: '44100', options: ['22050', '44100', '48000'], description: 'Audio sample rate in Hz' },
      { id: 'channels', name: 'Channels', type: 'select', defaultValue: 'stereo', options: ['mono', 'stereo'], description: 'Audio channel configuration' },
    ]
  },
  {
    id: 'speech-to-text',
    type: 'nlp',
    name: 'Speech to Text',
    description: 'Convert speech to text using AI',
    icon: MessageSquare,
    category: 'Processing',
    color: '#10b981',
    inputs: [{ id: 'audio_in', name: 'Audio Stream', dataType: 'audio', required: true }],
    outputs: [{ id: 'text_out', name: 'Text', dataType: 'text', required: true }],
    properties: [
      { id: 'language', name: 'Language', type: 'select', defaultValue: 'en-US', options: ['en-US', 'es-ES', 'fr-FR', 'de-DE'], description: 'Speech recognition language' },
      { id: 'confidence_threshold', name: 'Confidence Threshold', type: 'range', defaultValue: 0.7, min: 0, max: 1, step: 0.1, description: 'Minimum confidence for speech recognition' },
    ]
  },
  {
    id: 'sentiment-analysis',
    type: 'nlp',
    name: 'Sentiment Analysis',
    description: 'Analyze emotional tone of text',
    icon: Brain,
    category: 'Processing',
    color: '#8b5cf6',
    inputs: [{ id: 'text_in', name: 'Text', dataType: 'text', required: true }],
    outputs: [
      { id: 'sentiment_out', name: 'Sentiment', dataType: 'data', required: true },
      { id: 'score_out', name: 'Score', dataType: 'data', required: true }
    ],
    properties: [
      { id: 'model', name: 'Model', type: 'select', defaultValue: 'roberta', options: ['roberta', 'bert', 'distilbert'], description: 'Sentiment analysis model' },
      { id: 'return_scores', name: 'Return Scores', type: 'boolean', defaultValue: true, description: 'Include confidence scores in output' },
    ]
  },
  {
    id: 'audio-visualizer',
    type: 'audio-processing',
    name: 'Audio Visualizer',
    description: 'Generate visual representations of audio',
    icon: Waveform,
    category: 'Visualization',
    color: '#f59e0b',
    inputs: [{ id: 'audio_in', name: 'Audio Stream', dataType: 'audio', required: true }],
    outputs: [{ id: 'visual_out', name: 'Visualization', dataType: 'image', required: true }],
    properties: [
      { id: 'viz_type', name: 'Visualization Type', type: 'select', defaultValue: 'waveform', options: ['waveform', 'spectrogram', 'bars'], description: 'Type of audio visualization' },
      { id: 'colors', name: 'Color Scheme', type: 'select', defaultValue: 'blue', options: ['blue', 'green', 'purple', 'rainbow'], description: 'Visualization color scheme' },
      { id: 'resolution', name: 'Resolution', type: 'range', defaultValue: 512, min: 256, max: 2048, step: 256, description: 'Visualization resolution' },
    ]
  },
  {
    id: 'data-storage',
    type: 'storage',
    name: 'Data Storage',
    description: 'Store and retrieve data',
    icon: Database,
    category: 'Storage',
    color: '#ef4444',
    inputs: [{ id: 'data_in', name: 'Data', dataType: 'data', required: true }],
    outputs: [{ id: 'stored_out', name: 'Stored Data', dataType: 'data', required: false }],
    properties: [
      { id: 'storage_type', name: 'Storage Type', type: 'select', defaultValue: 'database', options: ['database', 'file', 'cache'], description: 'Type of data storage' },
      { id: 'persistence', name: 'Persistence', type: 'boolean', defaultValue: true, description: 'Keep data after session ends' },
    ]
  },
];

// Custom Node Component for Agent Capabilities
const AgentCapabilityNode: React.FC<{ data: AgentCapabilityNodeData }> = ({ data }) => {
  const { capability, properties, isValid, errors } = data;
  const IconComponent = capability.icon;

  return (
    <div 
      className={`
        bg-white border-2 rounded-lg shadow-lg min-w-[200px] p-3
        ${isValid ? 'border-gray-200' : 'border-red-400'}
        hover:shadow-xl transition-shadow
      `}
      style={{ borderTopColor: capability.color }}
    >
      {/* Node Header */}
      <div className="flex items-center gap-2 mb-2">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${capability.color}20` }}
        >
          <IconComponent className="w-4 h-4" style={{ color: capability.color }} />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-gray-900">{capability.name}</h4>
          <Badge variant="outline" className="text-xs">{capability.category}</Badge>
        </div>
      </div>

      {/* Input Handles */}
      {capability.inputs.map((input, index) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{ 
            top: `${30 + (index * 20)}px`,
            background: input.required ? '#ef4444' : '#6b7280',
            width: '8px',
            height: '8px'
          }}
          title={`${input.name} (${input.dataType})`}
        />
      ))}

      {/* Output Handles */}
      {capability.outputs.map((output, index) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{ 
            top: `${30 + (index * 20)}px`,
            background: output.required ? '#ef4444' : '#6b7280',
            width: '8px',
            height: '8px'
          }}
          title={`${output.name} (${output.dataType})`}
        />
      ))}

      {/* Error Indicators */}
      {!isValid && errors.length > 0 && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
          <div className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-red-500" />
            <span className="text-xs text-red-700">{errors.length} error(s)</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Component Palette for dragging capabilities
const ComponentPalette: React.FC<{
  onDragStart: (event: React.DragEvent, capability: AgentCapability) => void;
}> = ({ onDragStart }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const categories = ['All', ...Array.from(new Set(AGENT_CAPABILITIES.map(cap => cap.category)))];
  const filteredCapabilities = selectedCategory === 'All' 
    ? AGENT_CAPABILITIES 
    : AGENT_CAPABILITIES.filter(cap => cap.category === selectedCategory);

  return (
    <Card className="w-80 h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Agent Components</CardTitle>
        <CardDescription>Drag components to build your agent</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="mb-4">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {filteredCapabilities.map(capability => {
              const IconComponent = capability.icon;
              return (
                <div
                  key={capability.id}
                  draggable
                  onDragStart={(event) => onDragStart(event, capability)}
                  className="p-3 border rounded-lg cursor-grab hover:bg-gray-50 active:cursor-grabbing transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${capability.color}20` }}
                    >
                      <IconComponent className="w-4 h-4" style={{ color: capability.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {capability.name}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {capability.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Property Panel for configuring selected nodes
const PropertyPanel: React.FC<{
  selectedNode: Node | null;
  onPropertyChange: (nodeId: string, propertyId: string, value: any) => void;
}> = ({ selectedNode, onPropertyChange }) => {
  if (!selectedNode || !selectedNode.data?.capability) {
    return (
      <Card className="w-80 h-full">
        <CardHeader>
          <CardTitle className="text-lg">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Select a component to configure its properties</p>
        </CardContent>
      </Card>
    );
  }

  const { capability, properties } = selectedNode.data as AgentCapabilityNodeData;

  return (
    <Card className="w-80 h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Properties</CardTitle>
        <CardDescription>{capability.name}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {capability.properties.map(property => (
              <div key={property.id} className="space-y-2">
                <Label className="text-sm font-medium">{property.name}</Label>
                {property.type === 'string' && (
                  <Input
                    value={properties[property.id] || property.defaultValue}
                    onChange={(e) => onPropertyChange(selectedNode.id, property.id, e.target.value)}
                    placeholder={property.description}
                  />
                )}
                {property.type === 'number' && (
                  <Input
                    type="number"
                    value={properties[property.id] || property.defaultValue}
                    onChange={(e) => onPropertyChange(selectedNode.id, property.id, Number(e.target.value))}
                    placeholder={property.description}
                  />
                )}
                {property.type === 'boolean' && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={properties[property.id] ?? property.defaultValue}
                      onCheckedChange={(checked) => onPropertyChange(selectedNode.id, property.id, checked)}
                    />
                    <span className="text-sm text-gray-600">{property.description}</span>
                  </div>
                )}
                {property.type === 'select' && (
                  <Select
                    value={properties[property.id] || property.defaultValue}
                    onValueChange={(value) => onPropertyChange(selectedNode.id, property.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      {property.options?.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {property.type === 'range' && (
                  <div className="space-y-2">
                    <Slider
                      value={[properties[property.id] ?? property.defaultValue]}
                      onValueChange={([value]) => onPropertyChange(selectedNode.id, property.id, value)}
                      min={property.min || 0}
                      max={property.max || 100}
                      step={property.step || 1}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 flex justify-between">
                      <span>{property.min || 0}</span>
                      <span>{properties[property.id] ?? property.defaultValue}</span>
                      <span>{property.max || 100}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500">{property.description}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Agent Preview Component
const AgentPreview: React.FC<{
  configuration: AgentConfiguration | null;
  isRunning: boolean;
  previewData: any;
}> = ({ configuration, isRunning, previewData }) => {
  return (
    <Card className="w-80 h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Agent Preview</CardTitle>
            <CardDescription>Real-time agent output</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600">Running</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-xs text-gray-500">Stopped</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ScrollArea className="h-full">
          {!configuration ? (
            <p className="text-sm text-gray-500">No configuration loaded</p>
          ) : !isRunning ? (
            <p className="text-sm text-gray-500">Click play to start preview</p>
          ) : (
            <div className="space-y-3">
              {previewData?.outputs?.map((output: any, index: number) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{output.name}</span>
                    <Badge variant="outline">{output.type}</Badge>
                  </div>
                  <div className="text-sm text-gray-700">
                    {output.type === 'text' && <p>{output.value}</p>}
                    {output.type === 'audio' && (
                      <div className="flex items-center gap-2">
                        <Waveform className="w-4 h-4" />
                        <span>Audio stream active</span>
                      </div>
                    )}
                    {output.type === 'image' && (
                      <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    {output.type === 'data' && (
                      <pre className="text-xs bg-white p-2 rounded border overflow-auto">
                        {JSON.stringify(output.value, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Configuration Toolbar
const ConfigurationToolbar: React.FC<{
  onPlay: () => void;
  onStop: () => void;
  onSave: () => void;
  onLoad: () => void;
  onNew: () => void;
  onExport: () => void;
  onImport: () => void;
  isRunning: boolean;
  hasChanges: boolean;
}> = ({ onPlay, onStop, onSave, onLoad, onNew, onExport, onImport, isRunning, hasChanges }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-white border-b">