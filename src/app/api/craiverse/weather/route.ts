import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createNoise2D, createNoise3D } from 'simplex-noise';

// Weather data structures
interface WeatherPattern {
  id: string;
  zoneId: string;
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  cloudCover: number;
  visibility: number;
  weatherType: WeatherType;
  intensity: number;
  timestamp: Date;
  seasonalModifier: number;
  climateZone: ClimateZone;
}

interface ClimateModel {
  zoneId: string;
  climateType: ClimateZone;
  baseTemperature: number;
  temperatureVariance: number;
  precipitationLevel: number;
  seasonalIntensity: number;
  elevation: number;
  latitude: number;
  longitude: number;
  moistureRetention: number;
  windPatterns: WindPattern[];
}

interface EnvironmentalEffects {
  activityId: string;
  weatherImpact: number;
  visibilityReduction: number;
  mobilityModifier: number;
  comfortLevel: number;
  energyDrain: number;
  safetyRisk: number;
  recommendedActions: string[];
}

interface WeatherForecast {
  zoneId: string;
  predictions: WeatherPattern[];
  confidence: number;
  trendAnalysis: {
    temperatureTrend: 'rising' | 'falling' | 'stable';
    precipitationTrend: 'increasing' | 'decreasing' | 'stable';
    pressureTrend: 'rising' | 'falling' | 'stable';
  };
}

enum WeatherType {
  CLEAR = 'clear',
  CLOUDY = 'cloudy',
  OVERCAST = 'overcast',
  LIGHT_RAIN = 'light_rain',
  MODERATE_RAIN = 'moderate_rain',
  HEAVY_RAIN = 'heavy_rain',
  THUNDERSTORM = 'thunderstorm',
  SNOW = 'snow',
  BLIZZARD = 'blizzard',
  FOG = 'fog',
  MIST = 'mist',
  SANDSTORM = 'sandstorm',
  HURRICANE = 'hurricane'
}

enum ClimateZone {
  TROPICAL = 'tropical',
  ARID = 'arid',
  TEMPERATE = 'temperate',
  CONTINENTAL = 'continental',
  POLAR = 'polar',
  MEDITERRANEAN = 'mediterranean',
  OCEANIC = 'oceanic',
  SUBARCTIC = 'subarctic'
}

interface WindPattern {
  direction: number;
  speed: number;
  seasonalVariation: number;
  elevation: number;
}

// Validation schemas
const weatherQuerySchema = z.object({
  zoneId: z.string().uuid(),
  timeframe: z.enum(['current', 'hourly', 'daily']).optional().default('current'),
  includeEffects: z.boolean().optional().default(false)
});

const forecastQuerySchema = z.object({
  zoneId: z.string().uuid(),
  days: z.number().min(1).max(14).optional().default(7),
  detailed: z.boolean().optional().default(false)
});

const generateWeatherSchema = z.object({
  zoneId: z.string().uuid(),
  duration: z.number().min(1).max(168).optional().default(24), // hours
  seed: z.number().optional(),
  forcePattern: z.nativeEnum(WeatherType).optional()
});

const effectsQuerySchema = z.object({
  activityId: z.string().uuid(),
  zoneId: z.string().uuid(),
  duration: z.number().min(1).max(24).optional().default(1)
});

class WeatherEngine {
  private noise2D = createNoise2D();
  private noise3D = createNoise3D();
  private readonly WEATHER_SCALE = 0.01;
  private readonly TIME_SCALE = 0.001;

  constructor(seed?: number) {
    if (seed) {
      this.noise2D = createNoise2D(() => seed);
      this.noise3D = createNoise3D(() => seed);
    }
  }

  generateWeatherPattern(
    climateModel: ClimateModel,
    timestamp: Date,
    seasonalModifier: number
  ): WeatherPattern {
    const x = climateModel.longitude * this.WEATHER_SCALE;
    const y = climateModel.latitude * this.WEATHER_SCALE;
    const t = timestamp.getTime() * this.TIME_SCALE;

    // Generate base weather parameters using noise
    const temperatureNoise = this.noise3D(x, y, t);
    const humidityNoise = this.noise3D(x + 100, y, t);
    const precipitationNoise = this.noise3D(x, y + 100, t);
    const pressureNoise = this.noise2D(x, y);
    const windNoise = this.noise3D(x + 200, y + 200, t);

    // Apply climate model and seasonal modifications
    const temperature = this.calculateTemperature(
      climateModel,
      temperatureNoise,
      seasonalModifier
    );
    
    const humidity = this.calculateHumidity(
      climateModel,
      humidityNoise,
      temperature
    );
    
    const precipitation = this.calculatePrecipitation(
      climateModel,
      precipitationNoise,
      humidity,
      temperature
    );

    const pressure = this.calculatePressure(
      climateModel,
      pressureNoise,
      seasonalModifier
    );

    const windData = this.calculateWind(climateModel, windNoise);
    
    const cloudCover = this.calculateCloudCover(humidity, precipitation);
    
    const visibility = this.calculateVisibility(precipitation, cloudCover, humidity);

    const weatherType = this.determineWeatherType(
      temperature,
      precipitation,
      humidity,
      cloudCover
    );

    const intensity = this.calculateIntensity(precipitation, windData.speed, pressure);

    return {
      id: crypto.randomUUID(),
      zoneId: climateModel.zoneId,
      temperature,
      humidity,
      precipitation,
      windSpeed: windData.speed,
      windDirection: windData.direction,
      pressure,
      cloudCover,
      visibility,
      weatherType,
      intensity,
      timestamp,
      seasonalModifier,
      climateZone: climateModel.climateType
    };
  }

  private calculateTemperature(
    climate: ClimateModel,
    noise: number,
    seasonal: number
  ): number {
    const baseTemp = climate.baseTemperature + (seasonal * 10);
    const variance = climate.temperatureVariance * noise;
    const elevationEffect = -0.0065 * climate.elevation; // Temperature lapse rate
    
    return Math.round((baseTemp + variance + elevationEffect) * 10) / 10;
  }

  private calculateHumidity(
    climate: ClimateModel,
    noise: number,
    temperature: number
  ): number {
    let baseHumidity = 50;
    
    // Climate-based humidity adjustments
    switch (climate.climateType) {
      case ClimateZone.TROPICAL:
        baseHumidity = 80;
        break;
      case ClimateZone.ARID:
        baseHumidity = 20;
        break;
      case ClimateZone.OCEANIC:
        baseHumidity = 70;
        break;
      case ClimateZone.POLAR:
        baseHumidity = 60;
        break;
      default:
        baseHumidity = 50;
    }

    const noiseEffect = noise * 30;
    const temperatureEffect = Math.max(0, (30 - temperature) * 0.5);
    
    return Math.max(0, Math.min(100, baseHumidity + noiseEffect + temperatureEffect));
  }

  private calculatePrecipitation(
    climate: ClimateModel,
    noise: number,
    humidity: number,
    temperature: number
  ): number {
    const humidityFactor = Math.max(0, (humidity - 60) / 40);
    const climateFactor = climate.precipitationLevel;
    const noiseFactor = Math.max(0, noise);
    
    let precipitation = humidityFactor * climateFactor * noiseFactor * 50;
    
    // Reduce precipitation for very low temperatures (snow threshold)
    if (temperature < 0) {
      precipitation *= 0.7;
    }
    
    return Math.max(0, precipitation);
  }

  private calculatePressure(
    climate: ClimateModel,
    noise: number,
    seasonal: number
  ): number {
    const seaLevelPressure = 1013.25;
    const elevationEffect = -climate.elevation * 0.12; // hPa per meter
    const noiseEffect = noise * 20;
    const seasonalEffect = seasonal * 5;
    
    return Math.round((seaLevelPressure + elevationEffect + noiseEffect + seasonalEffect) * 10) / 10;
  }

  private calculateWind(climate: ClimateModel, noise: number): { speed: number; direction: number } {
    const baseWindPattern = climate.windPatterns[0] || { direction: 0, speed: 5, seasonalVariation: 1, elevation: 0 };
    
    const speed = Math.max(0, baseWindPattern.speed + (noise * 15));
    const direction = (baseWindPattern.direction + (noise * 60)) % 360;
    
    return { speed: Math.round(speed * 10) / 10, direction: Math.round(direction) };
  }

  private calculateCloudCover(humidity: number, precipitation: number): number {
    const humidityContrib = humidity * 0.8;
    const precipContrib = Math.min(precipitation * 2, 40);
    
    return Math.max(0, Math.min(100, humidityContrib + precipContrib));
  }

  private calculateVisibility(precipitation: number, cloudCover: number, humidity: number): number {
    let visibility = 50; // km base visibility
    
    // Reduce visibility based on precipitation
    visibility -= precipitation * 0.5;
    
    // Reduce visibility based on humidity (fog factor)
    if (humidity > 95) {
      visibility *= 0.1;
    } else if (humidity > 85) {
      visibility *= 0.5;
    }
    
    // Reduce visibility based on cloud cover
    visibility -= (cloudCover / 100) * 10;
    
    return Math.max(0.1, Math.min(50, visibility));
  }

  private determineWeatherType(
    temperature: number,
    precipitation: number,
    humidity: number,
    cloudCover: number
  ): WeatherType {
    if (precipitation > 20) {
      if (temperature < 0) return WeatherType.SNOW;
      if (precipitation > 40) return WeatherType.HEAVY_RAIN;
      if (precipitation > 10) return WeatherType.MODERATE_RAIN;
      return WeatherType.LIGHT_RAIN;
    }
    
    if (humidity > 95 && cloudCover < 30) return WeatherType.FOG;
    if (humidity > 85 && cloudCover < 50) return WeatherType.MIST;
    
    if (cloudCover > 80) return WeatherType.OVERCAST;
    if (cloudCover > 50) return WeatherType.CLOUDY;
    
    return WeatherType.CLEAR;
  }

  private calculateIntensity(precipitation: number, windSpeed: number, pressure: number): number {
    const precipIntensity = Math.min(precipitation / 50, 1);
    const windIntensity = Math.min(windSpeed / 50, 1);
    const pressureIntensity = Math.abs(1013.25 - pressure) / 100;
    
    return Math.min(1, (precipIntensity + windIntensity + pressureIntensity) / 3);
  }
}

class ActivityImpactCalculator {
  calculateEnvironmentalEffects(
    weather: WeatherPattern,
    activityType: string
  ): EnvironmentalEffects {
    const effects: EnvironmentalEffects = {
      activityId: crypto.randomUUID(),
      weatherImpact: 0,
      visibilityReduction: 0,
      mobilityModifier: 1,
      comfortLevel: 1,
      energyDrain: 1,
      safetyRisk: 0,
      recommendedActions: []
    };

    // Temperature effects
    if (weather.temperature < -10 || weather.temperature > 35) {
      effects.comfortLevel *= 0.6;
      effects.energyDrain *= 1.5;
      effects.safetyRisk += 0.3;
    }

    // Precipitation effects
    if (weather.precipitation > 0) {
      effects.mobilityModifier *= Math.max(0.3, 1 - (weather.precipitation / 50));
      effects.visibilityReduction = Math.min(0.8, weather.precipitation / 30);
      effects.safetyRisk += weather.precipitation / 100;
    }

    // Wind effects
    if (weather.windSpeed > 30) {
      effects.mobilityModifier *= 0.7;
      effects.safetyRisk += 0.2;
      effects.energyDrain *= 1.3;
    }

    // Visibility effects
    if (weather.visibility < 1) {
      effects.mobilityModifier *= 0.2;
      effects.safetyRisk += 0.5;
      effects.recommendedActions.push('Avoid outdoor activities');
    }

    // Activity-specific modifications
    effects.weatherImpact = 1 - ((effects.mobilityModifier + effects.comfortLevel) / 2);
    
    return effects;
  }
}

class WeatherZoneManager {
  constructor(private supabase: any) {}

  async getClimateModel(zoneId: string): Promise<ClimateModel | null> {
    const { data, error } = await this.supabase
      .from('craiverse_zones')
      .select(`
        id,
        climate_type,
        base_temperature,
        temperature_variance,
        precipitation_level,
        seasonal_intensity,
        elevation,
        latitude,
        longitude,
        moisture_retention,
        wind_patterns
      `)
      .eq('id', zoneId)
      .single();

    if (error || !data) return null;

    return {
      zoneId: data.id,
      climateType: data.climate_type as ClimateZone,
      baseTemperature: data.base_temperature,
      temperatureVariance: data.temperature_variance,
      precipitationLevel: data.precipitation_level,
      seasonalIntensity: data.seasonal_intensity,
      elevation: data.elevation,
      latitude: data.latitude,
      longitude: data.longitude,
      moistureRetention: data.moisture_retention,
      windPatterns: data.wind_patterns || [{ direction: 0, speed: 5, seasonalVariation: 1, elevation: 0 }]
    };
  }

  async saveWeatherPattern(pattern: WeatherPattern): Promise<void> {
    const { error } = await this.supabase
      .from('weather_patterns')
      .upsert({
        id: pattern.id,
        zone_id: pattern.zoneId,
        temperature: pattern.temperature,
        humidity: pattern.humidity,
        precipitation: pattern.precipitation,
        wind_speed: pattern.windSpeed,
        wind_direction: pattern.windDirection,
        pressure: pattern.pressure,
        cloud_cover: pattern.cloudCover,
        visibility: pattern.visibility,
        weather_type: pattern.weatherType,
        intensity: pattern.intensity,
        timestamp: pattern.timestamp.toISOString(),
        seasonal_modifier: pattern.seasonalModifier,
        climate_zone: pattern.climateZone
      });

    if (error) {
      throw new Error(`Failed to save weather pattern: ${error.message}`);
    }
  }

  async getWeatherHistory(zoneId: string, hours: number = 24): Promise<WeatherPattern[]> {
    const { data, error } = await this.supabase
      .from('weather_patterns')
      .select('*')
      .eq('zone_id', zoneId)
      .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw new Error(error.message);

    return data?.map(this.mapDbToWeatherPattern) || [];
  }

  private mapDbToWeatherPattern(dbData: any): WeatherPattern {
    return {
      id: dbData.id,
      zoneId: dbData.zone_id,
      temperature: dbData.temperature,
      humidity: dbData.humidity,
      precipitation: dbData.precipitation,
      windSpeed: dbData.wind_speed,
      windDirection: dbData.wind_direction,
      pressure: dbData.pressure,
      cloudCover: dbData.cloud_cover,
      visibility: dbData.visibility,
      weatherType: dbData.weather_type as WeatherType,
      intensity: dbData.intensity,
      timestamp: new Date(dbData.timestamp),
      seasonalModifier: dbData.seasonal_modifier,
      climateZone: dbData.climate_zone as ClimateZone
    };
  }
}

class SeasonalTransition {
  calculateSeasonalModifier(date: Date, latitude: number): number {
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const latitudeEffect = Math.abs(latitude) / 90;
    
    // Northern hemisphere seasonal pattern
    let seasonal = Math.sin((dayOfYear - 81) * 2 * Math.PI / 365.25);
    
    // Southern hemisphere (flip the seasons)
    if (latitude < 0) {
      seasonal = -seasonal;
    }
    
    return seasonal * latitudeEffect;
  }
}

// GET /api/craiverse/weather
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    
    // Handle different query patterns
    if (searchParams.has('forecast')) {
      return handleForecastRequest(request, supabase);
    }
    
    if (searchParams.has('effects')) {
      return handleEffectsRequest(request, supabase);
    }
    
    // Default weather query
    const query = weatherQuerySchema.parse({
      zoneId: searchParams.get('zoneId'),
      timeframe: searchParams.get('timeframe'),
      includeEffects: searchParams.get('includeEffects') === 'true'
    });

    const weatherManager = new WeatherZoneManager(supabase);
    const weatherEngine = new WeatherEngine();
    const seasonalTransition = new SeasonalTransition();

    const climateModel = await weatherManager.getClimateModel(query.zoneId);
    if (!climateModel) {
      return NextResponse.json(
        { error: 'Zone not found or no climate data available' },
        { status: 404 }
      );
    }

    const now = new Date();
    const seasonalModifier = seasonalTransition.calculateSeasonalModifier(
      now,
      climateModel.latitude
    );

    const currentWeather = weatherEngine.generateWeatherPattern(
      climateModel,
      now,
      seasonalModifier
    );

    // Save current weather pattern
    await weatherManager.saveWeatherPattern(currentWeather);

    let response: any = { weather: currentWeather };

    if (query.includeEffects) {
      const impactCalculator = new ActivityImpactCalculator();
      const effects = impactCalculator.calculateEnvironmentalEffects(
        currentWeather,
        'general'
      );
      response.effects = effects;
    }

    if (query.timeframe === 'hourly') {
      const history = await weatherManager.getWeatherHistory(query.zoneId, 24);
      response.hourlyData = history;
    } else if (query.timeframe === 'daily') {
      const history = await weatherManager.getWeatherHistory(query.zoneId, 168); // 7 days
      response.dailyData = history;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Weather API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/craiverse/weather/generate
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    
    const params = generateWeatherSchema.parse(body);
    
    const weatherManager = new WeatherZoneManager(supabase);
    const weatherEngine = new WeatherEngine(params.seed);
    const seasonalTransition = new SeasonalTransition();

    const climateModel = await weatherManager.getClimateModel(params.zoneId);
    if (!climateModel) {
      return NextResponse.json(
        { error: 'Zone not found or no climate data available' },
        { status: 404 }
      );
    }

    const patterns: WeatherPattern[] = [];
    const startTime = new Date();

    for (let hour = 0; hour < params.duration; hour++) {
      const timestamp = new Date(startTime.getTime() + hour * 60 * 60 * 1000);
      const seasonalModifier = seasonalTransition.calculateSeasonalModifier(
        timestamp,
        climateModel.latitude
      );

      let pattern = weatherEngine.generateWeatherPattern(
        climateModel,
        timestamp,
        seasonalModifier
      );

      // Override weather type if forced
      if (params.forcePattern) {
        pattern.weatherType = params.forcePattern;
      }

      patterns.push(pattern);
      await weatherManager.saveWeatherPattern(pattern);
    }

    return NextResponse.json({
      generated: patterns.length,
      patterns: patterns,
      zoneId: params.zoneId,
      duration: params.duration
    });

  } catch (error) {
    console.error('Weather generation error:', error);
    
    if (error instanceof z.Z