```tsx
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, 
  Palette, 
  Brain, 
  Play, 
  Download, 
  Save, 
  Eye,
  Lightbulb,
  Settings,
  Monitor,
  Smartphone,
  Tablet,
  CheckCircle,
  AlertTriangle,
  Zap,
  Sparkles,
  RotateCcw,
  Upload,
  Copy,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AvatarFeatures {
  face: {
    shape: string;
    skinTone: string;
    eyeColor: string;
    eyeShape: string;
    noseShape: string;
    mouthShape: string;
    facialHair: string;
  };
  hair: {
    style: string;
    color: string;
    length: string;
  };
  body: {
    height: number;
    build: string;
    posture: string;
  };
  clothing: {
    style: string;
    colors: string[];
    accessories: string[];
  };
}

interface EmotionMapping {
  happiness: number;
  sadness: number;
  anger: number;
  surprise: number;
  fear: number;
  disgust: number;
  neutral: number;
}

interface BehavioralTraits {
  personality: {
    extroversion: number;
    agreeableness: number;
    conscientiousness: number;
    neuroticism: number;
    openness: number;
  };
  communication: {
    formality: number;
    enthusiasm: number;
    empathy: number;
    directness: number;
  };
  responses: {
    responseTime: number;
    adaptability: number;
    consistency: number;
  };
}

interface CompatibilityStatus {
  webgl: boolean;
  mobile: boolean;
  vr: boolean;
  performance: 'high' | 'medium' | 'low';
  recommendations: string[];
}

interface AvatarCreationInterfaceProps {
  onSave?: (avatar: AvatarData) => void;
  onExport?: (avatar: AvatarData, format: string) => void;
  initialAvatar?: Partial<AvatarData>;
  className?: string;
}

interface AvatarData {
  id: string;
  name: string;
  features: AvatarFeatures;
  emotions: EmotionMapping;
  traits: BehavioralTraits;
  animations: string[];
  metadata: {
    created: Date;
    version: string;
    compatibility: CompatibilityStatus;
  };
}

const AvatarCreationInterface: React.FC<AvatarCreationInterfaceProps> = ({
  onSave,
  onExport,
  initialAvatar,
  className = ""
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<string>("appearance");
  const [avatar, setAvatar] = useState<AvatarData>({
    id: `avatar_${Date.now()}`,
    name: "New Avatar",
    features: {
      face: {
        shape: "oval",
        skinTone: "#F5DEB3",
        eyeColor: "#4169E1",
        eyeShape: "almond",
        noseShape: "straight",
        mouthShape: "medium",
        facialHair: "none"
      },
      hair: {
        style: "medium",
        color: "#8B4513",
        length: "shoulder"
      },
      body: {
        height: 170,
        build: "average",
        posture: "neutral"
      },
      clothing: {
        style: "casual",
        colors: ["#4F46E5", "#FFFFFF"],
        accessories: []
      }
    },
    emotions: {
      happiness: 70,
      sadness: 10,
      anger: 5,
      surprise: 30,
      fear: 15,
      disgust: 5,
      neutral: 50
    },
    traits: {
      personality: {
        extroversion: 50,
        agreeableness: 70,
        conscientiousness: 60,
        neuroticism: 30,
        openness: 80
      },
      communication: {
        formality: 40,
        enthusiasm: 70,
        empathy: 80,
        directness: 60
      },
      responses: {
        responseTime: 50,
        adaptability: 70,
        consistency: 80
      }
    },
    animations: ["idle", "greeting", "thinking"],
    metadata: {
      created: new Date(),
      version: "1.0.0",
      compatibility: {
        webgl: true,
        mobile: true,
        vr: false,
        performance: "high",
        recommendations: []
      }
    }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState<"3d" | "animation">("3d");
  const [selectedAnimation, setSelectedAnimation] = useState("idle");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [compatibilityStatus, setCompatibilityStatus] = useState<CompatibilityStatus>({
    webgl: true,
    mobile: true,
    vr: false,
    performance: "high",
    recommendations: []
  });

  // Initialize with provided avatar data
  useEffect(() => {
    if (initialAvatar) {
      setAvatar(prev => ({ ...prev, ...initialAvatar }));
    }
  }, [initialAvatar]);

  // Compatibility check
  useEffect(() => {
    const checkCompatibility = () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      const webglSupported = !!gl;
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isVRCapable = 'xr' in navigator;
      
      setCompatibilityStatus({
        webgl: webglSupported,
        mobile: isMobile,
        vr: isVRCapable,
        performance: webglSupported ? 'high' : 'low',
        recommendations: [
          ...(webglSupported ? [] : ['Enable hardware acceleration']),
          ...(isMobile ? ['Optimize for mobile performance'] : [])
        ]
      });
    };

    checkCompatibility();
  }, []);

  const handleFeatureChange = useCallback((category: keyof AvatarFeatures, property: string, value: any) => {
    setAvatar(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [category]: {
          ...prev.features[category],
          [property]: value
        }
      }
    }));
  }, []);

  const handleEmotionChange = useCallback((emotion: keyof EmotionMapping, value: number) => {
    setAvatar(prev => ({
      ...prev,
      emotions: {
        ...prev.emotions,
        [emotion]: value
      }
    }));
  }, []);

  const handleTraitChange = useCallback((category: keyof BehavioralTraits, trait: string, value: number) => {
    setAvatar(prev => ({
      ...prev,
      traits: {
        ...prev.traits,
        [category]: {
          ...prev.traits[category],
          [trait]: value
        }
      }
    }));
  }, []);

  const generateAISuggestions = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Simulate AI generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const suggestions = [
        "Add warm smile for more approachable appearance",
        "Increase empathy trait for better user connection",
        "Consider adding casual accessories for modern look",
        "Adjust eye shape for more expressive emotions"
      ];
      
      setAiSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to generate AI suggestions:', error);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(avatar);
  }, [avatar, onSave]);

  const handleExport = useCallback((format: string) => {
    onExport?.(avatar, format);
  }, [avatar, onExport]);

  const resetToDefaults = useCallback(() => {
    setAvatar(prev => ({
      ...prev,
      features: {
        face: {
          shape: "oval",
          skinTone: "#F5DEB3",
          eyeColor: "#4169E1",
          eyeShape: "almond",
          noseShape: "straight",
          mouthShape: "medium",
          facialHair: "none"
        },
        hair: {
          style: "medium",
          color: "#8B4513",
          length: "shoulder"
        },
        body: {
          height: 170,
          build: "average",
          posture: "neutral"
        },
        clothing: {
          style: "casual",
          colors: ["#4F46E5", "#FFFFFF"],
          accessories: []
        }
      }
    }));
  }, []);

  return (
    <div className={`max-w-7xl mx-auto p-6 space-y-6 ${className}`}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Avatar Creation Studio</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Design your CRAIverse avatar with AI-powered customization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button onClick={() => handleExport('glb')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Interface */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="appearance" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Appearance
              </TabsTrigger>
              <TabsTrigger value="emotions" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Emotions
              </TabsTrigger>
              <TabsTrigger value="traits" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Traits
              </TabsTrigger>
              <TabsTrigger value="animations" className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Animations
              </TabsTrigger>
              <TabsTrigger value="compatibility" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Compatibility
              </TabsTrigger>
            </TabsList>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Physical Features
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Face Configuration */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Face</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="face-shape">Face Shape</Label>
                        <Select
                          value={avatar.features.face.shape}
                          onValueChange={(value) => handleFeatureChange('face', 'shape', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="oval">Oval</SelectItem>
                            <SelectItem value="round">Round</SelectItem>
                            <SelectItem value="square">Square</SelectItem>
                            <SelectItem value="heart">Heart</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="skin-tone">Skin Tone</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            type="color"
                            value={avatar.features.face.skinTone}
                            onChange={(e) => handleFeatureChange('face', 'skinTone', e.target.value)}
                            className="w-12 h-8 p-1"
                          />
                          <Input
                            value={avatar.features.face.skinTone}
                            onChange={(e) => handleFeatureChange('face', 'skinTone', e.target.value)}
                            placeholder="#F5DEB3"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Hair Configuration */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Hair</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Style</Label>
                        <Select
                          value={avatar.features.hair.style}
                          onValueChange={(value) => handleFeatureChange('hair', 'style', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">Short</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="long">Long</SelectItem>
                            <SelectItem value="curly">Curly</SelectItem>
                            <SelectItem value="straight">Straight</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Color</Label>
                        <Input
                          type="color"
                          value={avatar.features.hair.color}
                          onChange={(e) => handleFeatureChange('hair', 'color', e.target.value)}
                          className="h-10"
                        />
                      </div>
                      <div>
                        <Label>Length</Label>
                        <Select
                          value={avatar.features.hair.length}
                          onValueChange={(value) => handleFeatureChange('hair', 'length', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="buzz">Buzz</SelectItem>
                            <SelectItem value="short">Short</SelectItem>
                            <SelectItem value="shoulder">Shoulder</SelectItem>
                            <SelectItem value="long">Long</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Body Configuration */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Body</h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Height: {avatar.features.body.height}cm</Label>
                        <Slider
                          value={[avatar.features.body.height]}
                          onValueChange={([value]) => handleFeatureChange('body', 'height', value)}
                          min={150}
                          max={200}
                          step={1}
                          className="mt-2"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Build</Label>
                          <Select
                            value={avatar.features.body.build}
                            onValueChange={(value) => handleFeatureChange('body', 'build', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="slim">Slim</SelectItem>
                              <SelectItem value="average">Average</SelectItem>
                              <SelectItem value="athletic">Athletic</SelectItem>
                              <SelectItem value="heavy">Heavy</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Posture</Label>
                          <Select
                            value={avatar.features.body.posture}
                            onValueChange={(value) => handleFeatureChange('body', 'posture', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upright">Upright</SelectItem>
                              <SelectItem value="neutral">Neutral</SelectItem>
                              <SelectItem value="relaxed">Relaxed</SelectItem>
                              <SelectItem value="confident">Confident</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Emotions Tab */}
            <TabsContent value="emotions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Emotion Mapping
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(avatar.emotions).map(([emotion, value]) => (
                    <div key={emotion} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="capitalize">{emotion}</Label>
                        <Badge variant="secondary">{value}%</Badge>
                      </div>
                      <Slider
                        value={[value]}
                        onValueChange={([newValue]) => handleEmotionChange(emotion as keyof EmotionMapping, newValue)}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Behavioral Traits Tab */}
            <TabsContent value="traits" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Behavioral Traits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Personality Traits */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Personality</h3>
                    {Object.entries(avatar.traits.personality).map(([trait, value]) => (
                      <div key={trait} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="capitalize">{trait}</Label>
                          <Badge variant="outline">{value}%</Badge>
                        </div>
                        <Slider
                          value={[value]}
                          onValueChange={([newValue]) => handleTraitChange('personality', trait, newValue)}
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Communication Traits */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Communication</h3>
                    {Object.entries(avatar.traits.communication).map(([trait, value]) => (
                      <div key={trait} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="capitalize">{trait}</Label>
                          <Badge variant="outline">{value}%</Badge>
                        </div>
                        <Slider
                          value={[value]}
                          onValueChange={([newValue]) => handleTraitChange('communication', trait, newValue)}
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Animations Tab */}
            <TabsContent value="animations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Animation Testing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Test Animation</Label>
                    <Select value={selectedAnimation} onValueChange={setSelectedAnimation}>
                      <SelectTrigger>