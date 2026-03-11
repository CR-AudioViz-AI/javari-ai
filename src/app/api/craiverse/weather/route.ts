```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/auth';

// Enhanced validation schemas
const weatherSimulateSchema = z.object({
  regionId: z.string().uuid(),
  biomeType: z.enum(['desert', 'forest', 'mountain', 'coastal', 'plains', 'arctic', 'tropical']),
  duration: z.number().min(1).max(365),
  seasonOverride: z.enum(['spring', 'summer', 'autumn', 'winter']).optional(),
  intensityModifier: z.number().min(0.1).max(3.0).default(1.0),
  eventTriggers: z.array(z.string()).optional()
});

const weatherQuerySchema = z.object({
  regionId: z.string().uuid(),
  timeRange: z.enum(['current', 'hourly', 'daily', 'weekly']).default('current'),
  includeEffects: z.boolean().default(false),
  forecastDays: z.number().min(1).max(30).optional()
});

// Weather system interfaces
interface WeatherPattern {
  id: string;
  regionId: string;
  timestamp: Date;
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  cloudCover: number;
  visibility: number;
  uvIndex: number;
  season: string;
  weatherType: string;
  intensity: number;
}

interface WeatherEvent {
  id: string;
  type: 'storm' | 'heatwave' | 'drought' | 'flood' | 'blizzard' | 'hurricane';
  severity: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  affectedRegions: string[];
  effects: WeatherEffect[];
}

interface WeatherEffect {
  type: 'temperature' | 'mobility' | 'energy' | 'mood' | 'health' | 'visibility';
  modifier: number;
  duration: number;
  targetBehaviors: string[];
}

interface ClimateData {
  biome: string;
  baseTemperature: number;
  temperatureVariance: number;
  precipitationProbability: number;
  seasonalModifiers: Record<string, number>;
  weatherEventProbabilities: Record<string, number>;
}

// Weather simulation engine
class WeatherSimulationEngine {
  private climateData: Map<string, ClimateData> = new Map();

  constructor() {
    this.initializeClimateProfiles();
  }

  private initializeClimateProfiles() {
    this.climateData.set('desert', {
      biome: 'desert',
      baseTemperature: 35,
      temperatureVariance: 25,
      precipitationProbability: 0.05,
      seasonalModifiers: { spring: 0.9, summer: 1.3, autumn: 0.8, winter: 0.6 },
      weatherEventProbabilities: { heatwave: 0.15, drought: 0.25, storm: 0.02 }
    });

    this.climateData.set('forest', {
      biome: 'forest',
      baseTemperature: 18,
      temperatureVariance: 15,
      precipitationProbability: 0.35,
      seasonalModifiers: { spring: 1.1, summer: 1.2, autumn: 0.9, winter: 0.7 },
      weatherEventProbabilities: { storm: 0.12, flood: 0.08, drought: 0.05 }
    });

    this.climateData.set('coastal', {
      biome: 'coastal',
      baseTemperature: 22,
      temperatureVariance: 12,
      precipitationProbability: 0.25,
      seasonalModifiers: { spring: 1.0, summer: 1.1, autumn: 1.0, winter: 0.9 },
      weatherEventProbabilities: { hurricane: 0.08, storm: 0.18, flood: 0.10 }
    });

    this.climateData.set('mountain', {
      biome: 'mountain',
      baseTemperature: 8,
      temperatureVariance: 20,
      precipitationProbability: 0.40,
      seasonalModifiers: { spring: 1.2, summer: 1.1, autumn: 0.8, winter: 0.5 },
      weatherEventProbabilities: { blizzard: 0.20, storm: 0.15, heatwave: 0.02 }
    });

    this.climateData.set('arctic', {
      biome: 'arctic',
      baseTemperature: -15,
      temperatureVariance: 30,
      precipitationProbability: 0.15,
      seasonalModifiers: { spring: 1.4, summer: 2.0, autumn: 1.1, winter: 0.3 },
      weatherEventProbabilities: { blizzard: 0.35, storm: 0.08, heatwave: 0.01 }
    });
  }

  generateWeatherPattern(regionId: string, biomeType: string, season: string, intensityModifier: number = 1.0): WeatherPattern {
    const climate = this.climateData.get(biomeType);
    if (!climate) throw new Error(`Unknown biome type: ${biomeType}`);

    const seasonModifier = climate.seasonalModifiers[season] || 1.0;
    const baseTemp = climate.baseTemperature * seasonModifier;
    
    // Generate realistic weather values with natural variation
    const temperature = this.addNaturalVariation(baseTemp, climate.temperatureVariance) * intensityModifier;
    const humidity = this.calculateHumidity(temperature, biomeType);
    const precipitation = this.calculatePrecipitation(climate.precipitationProbability, humidity, season);
    const windSpeed = this.generateWindSpeed(biomeType, precipitation);
    const windDirection = Math.random() * 360;
    const pressure = this.calculateBarometricPressure(temperature, altitude: this.getAltitude(biomeType));
    const cloudCover = this.calculateCloudCover(humidity, precipitation);
    const visibility = this.calculateVisibility(precipitation, cloudCover);
    const uvIndex = this.calculateUVIndex(season, cloudCover, latitude: 45);

    return {
      id: crypto.randomUUID(),
      regionId,
      timestamp: new Date(),
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
      precipitation: Math.round(precipitation * 100) / 100,
      windSpeed: Math.round(windSpeed * 10) / 10,
      windDirection: Math.round(windDirection),
      pressure: Math.round(pressure * 100) / 100,
      cloudCover: Math.round(cloudCover * 10) / 10,
      visibility: Math.round(visibility * 10) / 10,
      uvIndex: Math.round(uvIndex * 10) / 10,
      season,
      weatherType: this.determineWeatherType(temperature, precipitation, windSpeed, cloudCover),
      intensity: intensityModifier
    };
  }

  private addNaturalVariation(base: number, variance: number): number {
    return base + (Math.random() - 0.5) * variance;
  }

  private calculateHumidity(temperature: number, biome: string): number {
    let baseHumidity = 50;
    
    switch (biome) {
      case 'desert': baseHumidity = 20; break;
      case 'coastal': baseHumidity = 70; break;
      case 'forest': baseHumidity = 65; break;
      case 'arctic': baseHumidity = 40; break;
    }

    // Temperature affects humidity capacity
    const tempEffect = Math.max(0, (30 - Math.abs(temperature - 20)) / 30);
    return Math.max(0, Math.min(100, baseHumidity + tempEffect * 30 + (Math.random() - 0.5) * 20));
  }

  private calculatePrecipitation(probability: number, humidity: number, season: string): number {
    const humidityBonus = Math.max(0, (humidity - 60) / 40);
    const adjustedProbability = probability + humidityBonus * 0.2;
    
    if (Math.random() < adjustedProbability) {
      return Math.random() * 25; // mm
    }
    return 0;
  }

  private generateWindSpeed(biome: string, precipitation: number): number {
    let baseWind = 5;
    
    switch (biome) {
      case 'coastal': baseWind = 12; break;
      case 'mountain': baseWind = 15; break;
      case 'plains': baseWind = 8; break;
      case 'desert': baseWind = 6; break;
    }

    const precipitationEffect = precipitation * 0.3;
    return Math.max(0, baseWind + precipitationEffect + (Math.random() - 0.5) * 8);
  }

  private calculateBarometricPressure(temperature: number, altitude: number): number {
    const seaLevelPressure = 1013.25;
    const altitudeEffect = altitude * 0.12;
    const temperatureEffect = (temperature - 15) * 0.5;
    
    return seaLevelPressure - altitudeEffect + temperatureEffect + (Math.random() - 0.5) * 10;
  }

  private getAltitude(biome: string): number {
    switch (biome) {
      case 'mountain': return 2000;
      case 'desert': return 500;
      case 'coastal': return 0;
      case 'forest': return 300;
      default: return 200;
    }
  }

  private calculateCloudCover(humidity: number, precipitation: number): number {
    const humidityEffect = humidity / 100 * 80;
    const precipitationEffect = Math.min(precipitation * 10, 20);
    return Math.max(0, Math.min(100, humidityEffect + precipitationEffect + (Math.random() - 0.5) * 20));
  }

  private calculateVisibility(precipitation: number, cloudCover: number): number {
    let visibility = 25; // km
    
    if (precipitation > 10) visibility *= 0.3;
    else if (precipitation > 2) visibility *= 0.7;
    
    if (cloudCover > 80) visibility *= 0.8;
    
    return Math.max(0.1, visibility);
  }

  private calculateUVIndex(season: string, cloudCover: number, latitude: number): number {
    const seasonMultiplier = {
      spring: 0.7,
      summer: 1.0,
      autumn: 0.6,
      winter: 0.3
    }[season] || 0.7;

    const latitudeEffect = Math.cos(latitude * Math.PI / 180);
    const cloudEffect = Math.max(0.1, 1 - cloudCover / 150);
    
    return Math.max(0, 11 * seasonMultiplier * latitudeEffect * cloudEffect);
  }

  private determineWeatherType(temperature: number, precipitation: number, windSpeed: number, cloudCover: number): string {
    if (precipitation > 10) return windSpeed > 20 ? 'thunderstorm' : 'heavy_rain';
    if (precipitation > 2) return 'light_rain';
    if (temperature < 0 && precipitation > 0) return 'snow';
    if (windSpeed > 25) return 'windy';
    if (cloudCover > 80) return 'overcast';
    if (cloudCover > 40) return 'partly_cloudy';
    if (temperature > 35) return 'hot';
    if (temperature < 5) return 'cold';
    return 'clear';
  }

  generateWeatherEvents(patterns: WeatherPattern[]): WeatherEvent[] {
    const events: WeatherEvent[] = [];
    
    for (const pattern of patterns) {
      const eventProbability = this.calculateEventProbability(pattern);
      
      if (Math.random() < eventProbability) {
        const event = this.createWeatherEvent(pattern);
        if (event) events.push(event);
      }
    }
    
    return events;
  }

  private calculateEventProbability(pattern: WeatherPattern): number {
    let probability = 0.02; // Base 2% chance
    
    if (pattern.temperature > 40) probability += 0.05; // Heatwave risk
    if (pattern.temperature < -20) probability += 0.08; // Blizzard risk
    if (pattern.precipitation > 15) probability += 0.06; // Flood risk
    if (pattern.windSpeed > 30) probability += 0.04; // Storm risk
    
    return Math.min(0.15, probability * pattern.intensity);
  }

  private createWeatherEvent(pattern: WeatherPattern): WeatherEvent | null {
    let eventType: WeatherEvent['type'];
    let severity: number;
    let duration: number;

    if (pattern.temperature > 40) {
      eventType = 'heatwave';
      severity = Math.min(5, (pattern.temperature - 35) / 5);
      duration = 24 + Math.random() * 72;
    } else if (pattern.temperature < -20) {
      eventType = 'blizzard';
      severity = Math.min(5, Math.abs(pattern.temperature + 15) / 10);
      duration = 6 + Math.random() * 18;
    } else if (pattern.precipitation > 15 && pattern.windSpeed > 25) {
      eventType = 'storm';
      severity = Math.min(5, (pattern.precipitation * pattern.windSpeed) / 300);
      duration = 2 + Math.random() * 8;
    } else if (pattern.precipitation > 20) {
      eventType = 'flood';
      severity = Math.min(5, pattern.precipitation / 10);
      duration = 12 + Math.random() * 36;
    } else {
      return null;
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

    return {
      id: crypto.randomUUID(),
      type: eventType,
      severity,
      duration,
      startTime,
      endTime,
      affectedRegions: [pattern.regionId],
      effects: this.generateWeatherEffects(eventType, severity)
    };
  }

  private generateWeatherEffects(eventType: WeatherEvent['type'], severity: number): WeatherEffect[] {
    const effects: WeatherEffect[] = [];
    
    switch (eventType) {
      case 'heatwave':
        effects.push(
          { type: 'energy', modifier: -0.2 * severity, duration: 24, targetBehaviors: ['work', 'exercise', 'exploration'] },
          { type: 'mood', modifier: -0.1 * severity, duration: 48, targetBehaviors: ['social', 'creative'] },
          { type: 'health', modifier: -0.15 * severity, duration: 72, targetBehaviors: ['rest', 'hydration'] }
        );
        break;
        
      case 'blizzard':
        effects.push(
          { type: 'mobility', modifier: -0.4 * severity, duration: 12, targetBehaviors: ['travel', 'outdoor'] },
          { type: 'visibility', modifier: -0.6 * severity, duration: 8, targetBehaviors: ['navigation', 'hunting'] },
          { type: 'temperature', modifier: -10 * severity, duration: 24, targetBehaviors: ['shelter', 'warmth'] }
        );
        break;
        
      case 'storm':
        effects.push(
          { type: 'mobility', modifier: -0.3 * severity, duration: 6, targetBehaviors: ['outdoor', 'flight'] },
          { type: 'mood', modifier: -0.2 * severity, duration: 12, targetBehaviors: ['anxiety', 'shelter-seeking'] },
          { type: 'visibility', modifier: -0.4 * severity, duration: 4, targetBehaviors: ['visual_navigation'] }
        );
        break;
        
      case 'flood':
        effects.push(
          { type: 'mobility', modifier: -0.5 * severity, duration: 24, targetBehaviors: ['ground_travel', 'foraging'] },
          { type: 'health', modifier: -0.1 * severity, duration: 48, targetBehaviors: ['water_safety', 'disease_prevention'] }
        );
        break;
    }
    
    return effects;
  }
}

// Rate limiting configuration
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await limiter.check(10, identifier); // 10 requests per minute
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || !(await validateApiKey(apiKey))) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get('regionId');
    
    if (!regionId) {
      return NextResponse.json({ error: 'Region ID is required' }, { status: 400 });
    }

    // Validate query parameters
    const queryData = weatherQuerySchema.safeParse({
      regionId,
      timeRange: searchParams.get('timeRange') || 'current',
      includeEffects: searchParams.get('includeEffects') === 'true',
      forecastDays: searchParams.get('forecastDays') ? parseInt(searchParams.get('forecastDays')!) : undefined
    });

    if (!queryData.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters',
        details: queryData.error.issues
      }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Fetch current weather data
    const { data: weatherData, error: weatherError } = await supabase
      .from('weather_systems')
      .select(`
        *,
        weather_events (
          id,
          type,
          severity,
          duration,
          start_time,
          end_time,
          effects
        )
      `)
      .eq('region_id', queryData.data.regionId)
      .order('timestamp', { ascending: false })
      .limit(queryData.data.timeRange === 'current' ? 1 : 24);

    if (weatherError) {
      console.error('Weather data fetch error:', weatherError);
      return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 });
    }

    // Fetch biome information for context
    const { data: biomeData } = await supabase
      .from('biome_climates')
      .select('biome_type, climate_profile')
      .eq('region_id', queryData.data.regionId)
      .single();

    // Calculate inhabitant behavior effects if requested
    let behaviorEffects = null;
    if (queryData.data.includeEffects && weatherData?.length > 0) {
      const { data: effectsData } = await supabase
        .from('inhabitant_behaviors')
        .select('behavior_type, weather_modifiers')
        .eq('region_id', queryData.data.regionId);

      behaviorEffects = effectsData;
    }

    // Generate forecast if requested
    let forecast = null;
    if (queryData.data.forecastDays) {
      const weatherEngine = new WeatherSimulationEngine();
      const currentSeason = this.getCurrentSeason();
      
      forecast = Array.from({ length: queryData.data.forecastDays }, (_, i) => {
        return weatherEngine.generateWeatherPattern(
          queryData.data.regionId,
          biomeData?.biome_type || 'forest',
          currentSeason,
          1.0
        );
      });
    }

    const response = {
      success: true,
      data: {
        current: weatherData?.[0] || null,
        historical: queryData.data.timeRange !== 'current' ? weatherData : null,
        biome: biomeData,
        behaviorEffects,
        forecast,
        metadata: {
          regionId: queryData.data.regionId,
          timeRange: queryData.data.timeRange,
          timestamp: new Date().toISOString(),
          includeEffects: queryData.data.includeEffects
        }
      }
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error('Weather API GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for POST requests
    const identifier = request.ip ?? 'anonymous';
    const { success } = await limiter.check(5, identifier); // 5 requests per minute
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || !(await validateApiKey(apiKey))) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request data
    const simulationData = weatherSimulateSchema.safeParse(body);
    if (!simulationData.success) {
      return NextResponse.json({ 
        error: 'Invalid simulation parameters',
        details: simulationData.error.issues
      }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const weatherEngine = new WeatherSimulationEngine();

    // Generate weather patterns for the specified duration
    const patterns: WeatherPattern[] = [];
    const events: WeatherEvent[] = [];
    const currentSeason = simulation