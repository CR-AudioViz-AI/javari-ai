'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Play,
  Square,
  RotateCcw,
  Settings,
  Share2,
  Download,
  Copy,
  Info,
  Zap,
  Activity,
  FileText,
  Image,
  BarChart3,
  Code2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Cpu,
  MemoryStick,
  PlayCircle,
  Sparkles
} from 'lucide-react';

interface AgentCapability {
  id: string;
  name: string;
  description: string;
  inputType: 'text' | 'file' | 'image' | 'audio' | 'json';
  outputType: 'text' | 'json' | 'image' | 'audio' | 'chart';
  parameters: AgentParameter[];
}

interface AgentParameter {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'range';
  description: string;
  defaultValue: any;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

interface ExecutionResult {
  id: string;
  timestamp: Date;
  status: 'running' | 'completed' | 'error' | 'timeout';
  output: any;
  error?: string;
  duration: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    tokens?: number;
  };
}

interface SandboxStatus {
  isRunning: boolean;
  queueSize: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  };
  uptime: number;
}

interface DemoScenario {
  id: string;
  name: string;
  description: string;
  inputs: Record<string, any>;
  parameters: Record<string, any>;
}

interface AgentDemoPlaygroundProps {
  agentId: string;
  agentName: string;
  agentDescription: string;
  capabilities: AgentCapability[];
  demoScenarios: DemoScenario[];
  onExecute: (capabilityId: string, inputs: any, parameters: any) => Promise<ExecutionResult>;
  onShare: (result: ExecutionResult) => void;
  className?: string;
}

const AgentDemoPlayground: React.FC<AgentDemoPlaygroundProps> = ({
  agentId,
  agentName,
  agentDescription,
  capabilities,
  demoScenarios,
  onExecute,
  onShare,
  className
}) => {
  const [selectedCapability, setSelectedCapability] = useState<AgentCapability | null>(
    capabilities[0] || null
  );
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [currentExecution, setCurrentExecution] = useState<ExecutionResult | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>({
    isRunning: false,
    queueSize: 0,
    resourceUsage: { cpu: 0, memory: 0, storage: 0 },
    uptime: 0
  });
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ExecutionResult | null>(null);

  const executionRef = useRef<AbortController | null>(null);
  const statusInterval = useRef<NodeJS.Timeout>();

  // Initialize parameters when capability changes
  useEffect(() => {
    if (selectedCapability) {
      const initialParams: Record<string, any> = {};
      selectedCapability.parameters.forEach(param => {
        initialParams[param.id] = param.defaultValue;
      });
      setParameters(initialParams);
      setInputs({});
    }
  }, [selectedCapability]);

  // Monitor sandbox status
  useEffect(() => {
    statusInterval.current = setInterval(() => {
      setSandboxStatus(prev => ({
        ...prev,
        uptime: prev.uptime + 1
      }));
    }, 1000);

    return () => {
      if (statusInterval.current) {
        clearInterval(statusInterval.current);
      }
    };
  }, []);

  const handleExecute = useCallback(async () => {
    if (!selectedCapability) return;

    // Abort any running execution
    if (executionRef.current) {
      executionRef.current.abort();
    }

    executionRef.current = new AbortController();

    const execution: ExecutionResult = {
      id: `exec_${Date.now()}`,
      timestamp: new Date(),
      status: 'running',
      output: null,
      duration: 0,
      resourceUsage: { cpu: 0, memory: 0 }
    };

    setCurrentExecution(execution);
    setSandboxStatus(prev => ({ ...prev, isRunning: true }));

    try {
      const result = await onExecute(selectedCapability.id, inputs, parameters);
      setCurrentExecution(result);
      setExecutionResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
    } catch (error) {
      const errorResult: ExecutionResult = {
        ...execution,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - execution.timestamp.getTime()
      };
      setCurrentExecution(errorResult);
      setExecutionResults(prev => [errorResult, ...prev.slice(0, 9)]);
    } finally {
      setSandboxStatus(prev => ({ ...prev, isRunning: false }));
      executionRef.current = null;
    }
  }, [selectedCapability, inputs, parameters, onExecute]);

  const handleStop = useCallback(() => {
    if (executionRef.current) {
      executionRef.current.abort();
      setSandboxStatus(prev => ({ ...prev, isRunning: false }));
      setCurrentExecution(prev => prev ? { ...prev, status: 'error', error: 'Execution stopped by user' } : null);
    }
  }, []);

  const handleReset = useCallback(() => {
    handleStop();
    setInputs({});
    if (selectedCapability) {
      const initialParams: Record<string, any> = {};
      selectedCapability.parameters.forEach(param => {
        initialParams[param.id] = param.defaultValue;
      });
      setParameters(initialParams);
    }
    setCurrentExecution(null);
  }, [selectedCapability, handleStop]);

  const handleScenarioLoad = useCallback((scenarioId: string) => {
    const scenario = demoScenarios.find(s => s.id === scenarioId);
    if (scenario) {
      setInputs(scenario.inputs);
      setParameters(scenario.parameters);
      setSelectedScenario(scenarioId);
    }
  }, [demoScenarios]);

  const handleParameterChange = useCallback((paramId: string, value: any) => {
    setParameters(prev => ({ ...prev, [paramId]: value }));
  }, []);

  const handleInputChange = useCallback((key: string, value: any) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleShare = useCallback((result: ExecutionResult) => {
    setSelectedResult(result);
    setShareDialogOpen(true);
  }, []);

  const renderParameterControl = (param: AgentParameter) => {
    const value = parameters[param.id];

    switch (param.type) {
      case 'string':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleParameterChange(param.id, e.target.value)}
            placeholder={param.description}
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleParameterChange(param.id, parseFloat(e.target.value) || 0)}
            min={param.min}
            max={param.max}
            step={param.step}
          />
        );
      
      case 'boolean':
        return (
          <Switch
            checked={value || false}
            onCheckedChange={(checked) => handleParameterChange(param.id, checked)}
          />
        );
      
      case 'select':
        return (
          <Select value={value || ''} onValueChange={(val) => handleParameterChange(param.id, val)}>
            <SelectTrigger>
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              {param.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'range':
        return (
          <div className="space-y-2">
            <Slider
              value={[value || param.min || 0]}
              onValueChange={(vals) => handleParameterChange(param.id, vals[0])}
              min={param.min}
              max={param.max}
              step={param.step}
              className="w-full"
            />
            <div className="text-sm text-muted-foreground text-center">
              {value || param.min || 0}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderExecutionResult = (result: ExecutionResult) => {
    const getStatusIcon = () => {
      switch (result.status) {
        case 'running':
          return <Loader2 className="h-4 w-4 animate-spin" />;
        case 'completed':
          return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'error':
          return <AlertCircle className="h-4 w-4 text-red-500" />;
        case 'timeout':
          return <Clock className="h-4 w-4 text-yellow-500" />;
        default:
          return null;
      }
    };

    const renderOutput = () => {
      if (!result.output) return null;

      if (typeof result.output === 'string') {
        return <pre className="whitespace-pre-wrap font-mono text-sm">{result.output}</pre>;
      }

      if (typeof result.output === 'object') {
        return <pre className="whitespace-pre-wrap font-mono text-sm">{JSON.stringify(result.output, null, 2)}</pre>;
      }

      return <div className="text-muted-foreground">Output format not supported for preview</div>;
    };

    return (
      <Card key={result.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium">
                {result.timestamp.toLocaleTimeString()}
              </span>
              <Badge variant={result.status === 'completed' ? 'default' : 'destructive'}>
                {result.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{result.duration}ms</span>
              {result.status === 'completed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleShare(result)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {result.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {renderOutput()}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  CPU: {result.resourceUsage.cpu}%
                </span>
                <span className="flex items-center gap-1">
                  <MemoryStick className="h-3 w-3" />
                  Memory: {result.resourceUsage.memory}MB
                </span>
                {result.resourceUsage.tokens && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Tokens: {result.resourceUsage.tokens}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <TooltipProvider>
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${className}`}>
        {/* Main Playground Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Playground Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    {agentName} Demo
                  </CardTitle>
                  <CardDescription>{agentDescription}</CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  {sandboxStatus.isRunning ? 'Running' : 'Ready'}
                </Badge>
              </div>
              
              {/* Capability Selector */}
              <div className="space-y-2">
                <Label>Test Capability</Label>
                <Select
                  value={selectedCapability?.id || ''}
                  onValueChange={(id) => {
                    const capability = capabilities.find(c => c.id === id);
                    setSelectedCapability(capability || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select capability to test" />
                  </SelectTrigger>
                  <SelectContent>
                    {capabilities.map((capability) => (
                      <SelectItem key={capability.id} value={capability.id}>
                        <div className="space-y-1">
                          <div>{capability.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {capability.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>

          {/* Quick Actions */}
          {demoScenarios.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Demo Scenarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {demoScenarios.slice(0, 4).map((scenario) => (
                    <Button
                      key={scenario.id}
                      variant={selectedScenario === scenario.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleScenarioLoad(scenario.id)}
                      className="justify-start h-auto p-3 text-left"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{scenario.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {scenario.description}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Execution Area */}
          {selectedCapability && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Input Configuration</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      disabled={sandboxStatus.isRunning}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                    <Button
                      variant={sandboxStatus.isRunning ? 'destructive' : 'default'}
                      size="sm"
                      onClick={sandboxStatus.isRunning ? handleStop : handleExecute}
                      disabled={!selectedCapability}
                    >
                      {sandboxStatus.isRunning ? (
                        <>
                          <Square className="h-4 w-4 mr-1" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Execute
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Input Section */}
                <div className="space-y-3">
                  <Label>Input Data</Label>
                  {selectedCapability.inputType === 'text' && (
                    <Textarea
                      placeholder="Enter your input text here..."
                      value={inputs.text || ''}
                      onChange={(e) => handleInputChange('text', e.target.value)}
                      rows={4}
                    />
                  )}
                  {selectedCapability.inputType === 'json' && (
                    <Textarea
                      placeholder='{"key": "value"}'
                      value={inputs.json || ''}
                      onChange={(e) => handleInputChange('json', e.target.value)}
                      rows={6}
                      className="font-mono"
                    />
                  )}
                  {selectedCapability.inputType === 'file' && (
                    <Input
                      type="file"
                      onChange={(e) => handleInputChange('file', e.target.files?.[0])}
                    />
                  )}
                </div>

                {/* Parameters Section */}
                {selectedCapability.parameters.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Parameters</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Advanced
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedCapability.parameters
                        .filter(param => param.required || showAdvanced)
                        .map((param) => (
                          <div key={param.id} className="space-y-2">
                            <Label className="flex items-center gap-1">
                              {param.name}
                              {param.required && <span className="text-red-500">*</span>}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{param.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            {renderParameterControl(param)}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Sandbox Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Sandbox Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>CPU Usage</span>
                  <span>{sandboxStatus.resourceUsage.cpu}%</span>
                </div>
                <Progress value={sandboxStatus.resourceUsage.cpu} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Memory</span>
                  <span>{sandboxStatus.resourceUsage.memory}MB</span>
                </div>
                <Progress value={(sandboxStatus.resourceUsage.memory / 1024) * 100} className="h-2" />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Queue</div>
                  <div className="font-medium">{sandboxStatus.queueSize}</div>
                </div>
                <div>
                  <div className="text-muted-foreground