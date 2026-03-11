'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
  Thermometer,
  Droplets,
  Eye,
  Zap,
  Leaf,
  Mountain,
  Fish,
  Bird,
  Settings,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';

// Types
interface WeatherState {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  visibility: number;
  cloudCover: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  weatherType: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy';
}

interface EcosystemMetrics {
  plantGrowth: number;
  animalActivity: number;
  waterLevels: number;
  airQuality: number;
  soilMoisture: number;
  biodiversityIndex: number;
}

interface ActivityImpact {
  outdoor: number;
  agriculture: number;
  recreation: number;
  transportation: number;
  energy: number;
}

interface WeatherSystemInterfaceProps {
  className?: string;
  onWeatherChange?: (weather: WeatherState) => void;
  onEcosystemUpdate?: (metrics: EcosystemMetrics) => void;
  enableUserControls?: boolean;
  showAtmosphericEffects?: boolean;
  autoProgress?: boolean;
}

// Weather Display Component
const WeatherDisplay: React.FC<{
  weather: WeatherState;
  className?: string;
}> = ({ weather, className = '' }) => {
  const getWeatherIcon = (type: string) => {
    switch (type) {
      case 'sunny': return <Sun className="w-8 h-8 text-yellow-500" />;
      case 'cloudy': return <Cloud className="w-8 h-8 text-gray-500" />;
      case 'rainy': return <CloudRain className="w-8 h-8 text-blue-500" />;
      case 'snowy': return <CloudSnow className="w-8 h-8 text-blue-200" />;
      case 'stormy': return <Zap className="w-8 h-8 text-purple-500" />;
      case 'foggy': return <Eye className="w-8 h-8 text-gray-400" />;
      default: return <Cloud className="w-8 h-8 text-gray-500" />;
    }
  };

  const getSeasonColor = (season: string) => {
    switch (season) {
      case 'spring': return 'text-green-600';
      case 'summer': return 'text-yellow-600';
      case 'autumn': return 'text-orange-600';
      case 'winter': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {getWeatherIcon(weather.weatherType)}
          <span className="capitalize">{weather.weatherType}</span>
          <span className={`text-sm capitalize ${getSeasonColor(weather.season)}`}>
            ({weather.season})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-red-500" />
            <span className="text-sm">{weather.temperature}°C</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500" />
            <span className="text-sm">{weather.humidity}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{weather.windSpeed} km/h</span>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{weather.cloudCover}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Atmospheric Effects Component
const AtmosphericEffects: React.FC<{
  weather: WeatherState;
  className?: string;
}> = ({ weather, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let animationId: number;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];

    const createParticle = () => {
      return {
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * weather.windSpeed * 0.1,
        vy: Math.random() * 2 + 1,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.8 + 0.2
      };
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Add particles based on weather type
      if (weather.weatherType === 'rainy' && particles.length < weather.precipitation * 2) {
        particles.push(createParticle());
      } else if (weather.weatherType === 'snowy' && particles.length < weather.precipitation * 1.5) {
        const particle = createParticle();
        particle.vy *= 0.3;
        particle.size *= 2;
        particles.push(particle);
      }

      // Update and draw particles
      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.y > canvas.height || particle.x < 0 || particle.x > canvas.width) {
          particles.splice(index, 1);
          return;
        }

        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = weather.weatherType === 'snowy' ? '#ffffff' : '#4fc3f7';
        
        if (weather.weatherType === 'snowy') {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(particle.x, particle.y, 2, particle.size * 4);
        }
      });

      // Add fog effect
      if (weather.weatherType === 'foggy') {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [weather]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ background: `linear-gradient(to bottom, 
          ${weather.season === 'winter' ? '#87ceeb' : 
            weather.season === 'autumn' ? '#deb887' :
            weather.season === 'summer' ? '#87ceeb' : '#98fb98'}, 
          transparent)` }}
      />
    </div>
  );
};

// Ecosystem Impact Panel Component
const EcosystemImpactPanel: React.FC<{
  weather: WeatherState;
  metrics: EcosystemMetrics;
  className?: string;
}> = ({ weather, metrics, className = '' }) => {
  const getImpactColor = (value: number) => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-yellow-600';
    if (value >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getProgressColor = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    if (value >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-500" />
          Ecosystem Impact
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm flex items-center gap-2">
                <Leaf className="w-4 h-4" />
                Plant Growth
              </span>
              <span className={`text-sm font-medium ${getImpactColor(metrics.plantGrowth)}`}>
                {metrics.plantGrowth}%
              </span>
            </div>
            <Progress value={metrics.plantGrowth} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm flex items-center gap-2">
                <Bird className="w-4 h-4" />
                Animal Activity
              </span>
              <span className={`text-sm font-medium ${getImpactColor(metrics.animalActivity)}`}>
                {metrics.animalActivity}%
              </span>
            </div>
            <Progress value={metrics.animalActivity} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm flex items-center gap-2">
                <Fish className="w-4 h-4" />
                Water Levels
              </span>
              <span className={`text-sm font-medium ${getImpactColor(metrics.waterLevels)}`}>
                {metrics.waterLevels}%
              </span>
            </div>
            <Progress value={metrics.waterLevels} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm flex items-center gap-2">
                <Wind className="w-4 h-4" />
                Air Quality
              </span>
              <span className={`text-sm font-medium ${getImpactColor(metrics.airQuality)}`}>
                {metrics.airQuality}%
              </span>
            </div>
            <Progress value={metrics.airQuality} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Weather Controls Component
const WeatherControls: React.FC<{
  weather: WeatherState;
  onWeatherChange: (updates: Partial<WeatherState>) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  className?: string;
}> = ({ weather, onWeatherChange, isPlaying, onPlayPause, onReset, className = '' }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Weather Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={isPlaying ? "default" : "outline"}
            size="sm"
            onClick={onPlayPause}
            className="flex-1"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Temperature: {weather.temperature}°C</label>
            <Slider
              value={[weather.temperature]}
              onValueChange={([value]) => onWeatherChange({ temperature: value })}
              min={-30}
              max={45}
              step={1}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Humidity: {weather.humidity}%</label>
            <Slider
              value={[weather.humidity]}
              onValueChange={([value]) => onWeatherChange({ humidity: value })}
              min={0}
              max={100}
              step={1}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Wind Speed: {weather.windSpeed} km/h</label>
            <Slider
              value={[weather.windSpeed]}
              onValueChange={([value]) => onWeatherChange({ windSpeed: value })}
              min={0}
              max={100}
              step={1}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Precipitation: {weather.precipitation}%</label>
            <Slider
              value={[weather.precipitation]}
              onValueChange={([value]) => onWeatherChange({ precipitation: value })}
              min={0}
              max={100}
              step={1}
              className="mt-2"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Activity Adaptation View Component
const ActivityAdaptationView: React.FC<{
  weather: WeatherState;
  impacts: ActivityImpact;
  className?: string;
}> = ({ weather, impacts, className = '' }) => {
  const getAdaptationRecommendations = () => {
    const recommendations = [];
    
    if (weather.temperature < 0) {
      recommendations.push({ type: 'warning', message: 'Cold weather: Increase indoor activities' });
    }
    if (weather.precipitation > 70) {
      recommendations.push({ type: 'alert', message: 'Heavy precipitation: Limit outdoor activities' });
    }
    if (weather.windSpeed > 50) {
      recommendations.push({ type: 'warning', message: 'High winds: Aviation restrictions' });
    }
    if (weather.visibility < 30) {
      recommendations.push({ type: 'alert', message: 'Low visibility: Transportation delays' });
    }

    return recommendations;
  };

  const recommendations = getAdaptationRecommendations();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Activity Impact
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Outdoor</span>
              <span className="text-sm font-medium">{impacts.outdoor}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Agriculture</span>
              <span className="text-sm font-medium">{impacts.agriculture}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Recreation</span>
              <span className="text-sm font-medium">{impacts.recreation}%</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Transport</span>
              <span className="text-sm font-medium">{impacts.transportation}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Energy</span>
              <span className="text-sm font-medium">{impacts.energy}%</span>
            </div>
          </div>
        </div>

        {recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recommendations:</h4>
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className={`text-xs p-2 rounded ${
                  rec.type === 'alert' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                }`}
              >
                {rec.message}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Weather System Interface Component
const WeatherSystemInterface: React.FC<WeatherSystemInterfaceProps> = ({
  className = '',
  onWeatherChange,
  onEcosystemUpdate,
  enableUserControls = true,
  showAtmosphericEffects = true,
  autoProgress = false
}) => {
  const [weather, setWeather] = useState<WeatherState>({
    temperature: 22,
    humidity: 65,
    pressure: 1013,
    windSpeed: 15,
    windDirection: 180,
    precipitation: 20,
    visibility: 90,
    cloudCover: 40,
    season: 'spring',
    weatherType: 'cloudy'
  });

  const [isPlaying, setIsPlaying] = useState(autoProgress);
  const [seasonProgress, setSeasonProgress] = useState(0);

  // Calculate ecosystem metrics based on weather
  const ecosystemMetrics = useMemo<EcosystemMetrics>(() => {
    const tempFactor = Math.max(0, Math.min(100, 100 - Math.abs(weather.temperature - 20) * 2));
    const humidityFactor = weather.humidity;
    const precipitationFactor = Math.max(0, 100 - Math.abs(weather.precipitation - 50));
    
    return {
      plantGrowth: Math.round((tempFactor + humidityFactor + precipitationFactor) / 3),
      animalActivity: Math.round((tempFactor + (100 - weather.windSpeed)) / 2),
      waterLevels: Math.round(weather.precipitation + weather.humidity / 2),
      airQuality: Math.round(100 - (weather.windSpeed * 0.3) - (weather.precipitation * 0.2)),
      soilMoisture: Math.round((weather.humidity + weather.precipitation) / 2),
      biodiversityIndex: Math.round((tempFactor + humidityFactor + precipitationFactor) / 3)
    };
  }, [weather]);

  // Calculate activity impacts
  const activityImpacts = useMemo<ActivityImpact>(() => {
    const weatherSeverity = Math.max(
      Math.abs(weather.temperature - 20),
      weather.windSpeed / 2,
      weather.precipitation
    );

    return {
      outdoor: Math.max(0, 100 - weatherSeverity * 2),
      agriculture: Math.max(20, ecosystemMetrics.plantGrowth),
      recreation: Math.max(0, 100 - weatherSeverity * 1.5),
      transportation: Math.max(20, 100 - weather.windSpeed - (weather.precipitation * 0.5)),
      energy: Math.min(100, 50 + Math.abs(weather.temperature - 20) + weather.windSpeed * 0.5)
    };
  }, [weather, ecosystemMetrics]);

  // Auto-progression effect
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSeasonProgress(prev => {
        const newProgress = (prev + 1) % 400; // 400 steps per cycle
        const seasonIndex = Math.floor(newProgress / 100);
        const seasons: WeatherState['season'][] = ['spring', 'summer', 'autumn', 'winter'];
        
        setWeather(prev => ({
          ...prev,
          season: seasons[seasonIndex],
          temperature: prev.temperature + (Math.random() - 0.5) * 2,
          humidity: Math.max(0, Math.min(100, prev.humidity + (Math.random() - 0.5) * 5)),
          windSpeed: Math.max(0, Math.min(100, prev.windSpeed + (Math.random() - 0.5) * 10)),
          precipitation: Math.max(0, Math.min(100, prev.precipitation + (Math.random() - 0.5) * 10))
        }));
        
        return newProgress;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Handle weather changes
  const handleWeatherChange = (updates: Partial<WeatherState>) => {
    const newWeather = { ...weather, ...updates };
    setWeather(newWeather);
    onWeatherChange?.(newWeather);
  };

  // Handle ecosystem updates
  useEffect(() => {
    onEcosystemUpdate?.(ecosystemMetrics);
  }, [ecosystemMetrics, onEcosystemUpdate]);

  const handlePlayPause = () => {
    setIsPlaying(!is