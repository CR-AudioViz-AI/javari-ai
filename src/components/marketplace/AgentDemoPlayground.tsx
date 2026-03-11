```tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { debounce } from 'lodash-es';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  Code,
  Eye,
  Download,
  Share,
  AlertCircle,
  CheckCircle,
  Loader2,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ShoppingCart
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// Parameter schema validation
const parameterSchema = z.object({
  sampleRate: z.number().min(8000).max(192000),
  bufferSize: z.number().min(128).max(8192),
  windowSize: z.number().min(512).max(8192),
  hopSize: z.number().min(128).max(2048),
  threshold: z.number().min(0).max(1),
  gain: z.number().min(0).max(10),
  enableReverb: z.boolean(),
  reverbRoom: z.number().min(0).max(1),
  filterCutoff: z.number().min(20).max(20000),
  analysisMode: z.enum(['realtime', 'batch', 'streaming']),
  outputFormat: z.enum(['wav', 'mp3', 'flac']),
  customPrompt: z.string().optional(),
});

type ParameterValues = z.infer<typeof parameterSchema>;

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  rating: number;
  tags: string[];
  parameters: Array<{
    key: keyof ParameterValues;
    label: string;
    type: 'slider' | 'input' | 'switch' | 'select' | 'textarea';
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    defaultValue: any;
    description: string;
  }>;
}

interface ExecutionResult {
  id: string;
  timestamp: number;
  status: 'success' | 'error' | 'processing';
  output?: {
    audioUrl?: string;
    visualData?: number[];
    metadata?: Record<string, any>;
    logs?: string[];
  };
  error?: string;
  executionTime?: number;
  resourceUsage?: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

interface AgentDemoPlaygroundProps {
  agent: AgentInfo;
  onPurchase: (agentId: string) => void;
  onShare: (agentId: string, parameters: ParameterValues) => void;
  className?: string;
}

const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
  );
};

const ParameterSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step, description, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-sm text-muted-foreground">{value}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
};

const CodeSnippet: React.FC<{
  code: string;
  language: string;
  title?: string;
}> = ({ code, language, title }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <div className="relative">
      {title && (
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium">{title}</h4>
          <Button
            size="sm"
            variant="outline"
            onClick={copyToClipboard}
            className="h-7 px-2"
          >
            {copied ? <CheckCircle className="w-3 h-3" /> : <Code className="w-3 h-3" />}
            <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      )}
      <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
};

const DemoControls: React.FC<{
  isPlaying: boolean;
  isProcessing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset: () => void;
}> = ({ isPlaying, isProcessing, onPlay, onPause, onStop, onReset }) => {
  return (
    <div className="flex gap-2">
      {!isPlaying ? (
        <Button
          size="sm"
          onClick={onPlay}
          disabled={isProcessing}
          className="flex items-center gap-2"
        >
          {isProcessing ? <LoadingSpinner size="sm" /> : <Play className="w-4 h-4" />}
          {isProcessing ? 'Processing...' : 'Execute'}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={onPause}
          className="flex items-center gap-2"
        >
          <Pause className="w-4 h-4" />
          Pause
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onStop}
        disabled={!isPlaying && !isProcessing}
        className="flex items-center gap-2"
      >
        <Square className="w-4 h-4" />
        Stop
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onReset}
        className="flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Reset
      </Button>
    </div>
  );
};

const ParameterPanel: React.FC<{
  agent: AgentInfo;
  parameters: ParameterValues;
  onChange: (parameters: ParameterValues) => void;
}> = ({ agent, parameters, onChange }) => {
  const handleParameterChange = (key: keyof ParameterValues, value: any) => {
    const newParameters = { ...parameters, [key]: value };
    onChange(newParameters);
  };

  const renderParameterControl = (param: AgentInfo['parameters'][0]) => {
    const value = parameters[param.key];

    switch (param.type) {
      case 'slider':
        return (
          <ParameterSlider
            key={param.key}
            label={param.label}
            value={value as number}
            min={param.min || 0}
            max={param.max || 100}
            step={param.step || 1}
            description={param.description}
            onChange={(newValue) => handleParameterChange(param.key, newValue)}
          />
        );

      case 'input':
        return (
          <div key={param.key} className="space-y-2">
            <Label className="text-sm font-medium">{param.label}</Label>
            <Input
              type="number"
              value={value as number}
              onChange={(e) => handleParameterChange(param.key, parseFloat(e.target.value))}
              min={param.min}
              max={param.max}
              step={param.step}
            />
            <p className="text-xs text-muted-foreground">{param.description}</p>
          </div>
        );

      case 'switch':
        return (
          <div key={param.key} className="flex items-center justify-between space-y-2">
            <div>
              <Label className="text-sm font-medium">{param.label}</Label>
              <p className="text-xs text-muted-foreground">{param.description}</p>
            </div>
            <Switch
              checked={value as boolean}
              onCheckedChange={(checked) => handleParameterChange(param.key, checked)}
            />
          </div>
        );

      case 'select':
        return (
          <div key={param.key} className="space-y-2">
            <Label className="text-sm font-medium">{param.label}</Label>
            <Select
              value={value as string}
              onValueChange={(newValue) => handleParameterChange(param.key, newValue)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {param.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{param.description}</p>
          </div>
        );

      case 'textarea':
        return (
          <div key={param.key} className="space-y-2">
            <Label className="text-sm font-medium">{param.label}</Label>
            <Textarea
              value={value as string}
              onChange={(e) => handleParameterChange(param.key, e.target.value)}
              placeholder={param.description}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{param.description}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Parameters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-6">
            {agent.parameters.map(renderParameterControl)}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const PreviewArea: React.FC<{
  result: ExecutionResult | null;
  isProcessing: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}> = ({ result, isProcessing, isFullscreen, onToggleFullscreen }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioMuted, setAudioMuted] = useState(false);

  useEffect(() => {
    if (!result?.output?.visualData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw visualization
    const data = result.output.visualData;
    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / data.length;

    ctx.fillStyle = 'hsl(var(--primary))';
    
    data.forEach((value, index) => {
      const barHeight = (value / 255) * height;
      ctx.fillRect(index * barWidth, height - barHeight, barWidth - 1, barHeight);
    });
  }, [result]);

  return (
    <Card className={`flex-1 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Preview
          </CardTitle>
          <div className="flex gap-2">
            {result?.output?.audioUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAudioMuted(!audioMuted)}
              >
                {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-full flex items-center justify-center bg-muted rounded-lg relative">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" />
              <p className="text-muted-foreground">Processing agent execution...</p>
            </div>
          ) : result ? (
            <div className="w-full h-full flex flex-col">
              <canvas
                ref={canvasRef}
                width={800}
                height={400}
                className="w-full h-64 bg-background rounded border"
              />
              {result.output?.audioUrl && (
                <div className="mt-4">
                  <audio
                    controls
                    muted={audioMuted}
                    className="w-full"
                  >
                    <source src={result.output.audioUrl} type="audio/wav" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-muted-foreground/20 rounded-full flex items-center justify-center">
                <Play className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Ready to Execute</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Adjust parameters and click Execute to see the agent in action
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ResultsPanel: React.FC<{
  result: ExecutionResult | null;
  agent: AgentInfo;
  parameters: ParameterValues;
  onPurchase: () => void;
  onShare: () => void;
}> = ({ result, agent, parameters, onPurchase, onShare }) => {
  const [activeTab, setActiveTab] = useState('output');

  const generateCodeExample = () => {
    return `import { ${agent.name}Agent } from '@cr-audioviz/agents';

const agent = new ${agent.name}Agent({
${Object.entries(parameters)
  .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
  .join(',\n')}
});

const result = await agent.execute(inputData);
console.log('Result:', result);`;
  };

  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Results</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>

          <TabsContent value="output" className="space-y-4">
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {result.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : result.status === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <LoadingSpinner size="sm" />
                  )}
                  <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                    {result.status}
                  </Badge>
                </div>

                {result.executionTime && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Execution Time: </span>
                    <span className="font-mono">{result.executionTime}ms</span>
                  </div>
                )}

                {result.resourceUsage && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Resource Usage</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>CPU</span>
                        <span>{result.resourceUsage.cpu}%</span>
                      </div>
                      <Progress value={result.resourceUsage.cpu} className="h-1" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Memory</span>
                        <span>{result.resourceUsage.memory}%</span>
                      </div>
                      <Progress value={result.resourceUsage.memory} className="h-1" />
                    </div>
                  </div>
                )}

                {result.output?.metadata && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Metadata</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(result.output.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {result.error && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{result.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No results yet. Execute the agent to see output.
              </p>
            )}
          </TabsContent>

          <TabsContent value="logs">
            <ScrollArea className="h-64">
              {result?.output?.logs ? (
                <div className="space-y-1">
                  {result.output.logs.map((log, index) => (
                    <div key={index} className="text-xs font-mono bg-muted p-2 rounded">
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No logs available.
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="code">
            <ScrollArea className="h-64">
              <CodeSnippet
                code={generateCodeExample()}
                language="javascript"
                title="Usage Example"
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        <div className="space-y-3">
          <Button onClick={onPurchase} className="w-full">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Purchase Agent (${agent.price})
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onShare} className="flex-1">
              <Share className="w-4 h-4 mr-1" />
              Share
            </Button>
            {result && (
              <Button variant="outline" size="sm" className="flex-1">
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const AgentDemoPlayground: React.FC<AgentDemoPlaygroundProps> = ({
  agent,
  onPurchase,
  onShare,
  className = '',
}) => {
  const [parameters, setParameters] = useState<ParameterValues>(() => {
    const defaults: Partial<ParameterValues> = {};
    agent.parameters.forEach(param => {
      defaults[param.key] = param.defaultValue;
    });
    return defaults as ParameterValues;
  });

  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(