```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import Redis from 'ioredis';

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const redisUrl = process.env.REDIS_URL!;

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const redis = new Redis(redisUrl);

// Validation schemas
const WeatherPatternSchema = z.object({
  environmentId: z.string().uuid(),
  temperature: z.number().min(-50).max(60),
  humidity: z.number().min(0).max(100),
  windSpeed: z.number().min(0).max(200),
  windDirection: z.number().min(0).max(360),
  precipitation: z.number().min(0).max(100),
  pressure: z.number().min(900).max(1100),
  visibility: z.number().min(0).max(50),
  cloudCover: z.number().min(0).max(100),
  season: z.enum(['spring', 'summer', 'autumn', 'winter']),
  climateZone: z.enum(['arctic', 'temperate', 'tropical', 'desert', 'mediterranean']),
});

const WeatherEventSchema = z.object({
  environmentId: z.string().uuid(),
  eventType: z.enum(['storm', 'blizzard', 'heatwave', 'drought', 'fog', 'tornado']),
  intensity: z.number().min(1).max(10),
  duration: z.number().min(1).max(24),
});

const ForecastRequestSchema = z.object({
  environmentId: z.string().uuid(),
  hours: z.number().min(1).max(168).optional().default(24),
});

// Types
interface WeatherPattern {
  id?: string;
  environmentId: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  pressure: number;
  visibility: number;
  cloudCover: number;
  season: string;
  climateZone: string;
  timestamp: Date;
  conditions?: string;
}

interface WeatherEvent {
  id?: string;
  environmentId: string;
  eventType: string;
  intensity: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
}

class WeatherEngine {
  private static readonly SEASONAL_MODIFIERS = {
    spring: { tempMod: 0, humidityMod: 10, precipMod: 20 },
    summer: { tempMod: 15, humidityMod: -5, precipMod: -10 },
    autumn: { tempMod: -5, humidityMod: 5, precipMod: 15 },
    winter: { tempMod: -20, humidityMod: -10, precipMod: 10 }
  };

  private static readonly CLIMATE_BASELINES = {
    arctic: { temp: -10, humidity: 70, precip: 20 },
    temperate: { temp: 15, humidity: 65, precip: 40 },
    tropical: { temp: 28, humidity: 85, precip: 60 },
    desert: { temp: 30, humidity: 20, precip: 5 },
    mediterranean: { temp: 20, humidity: 60, precip: 30 }
  };

  static generateWeatherPattern(
    environmentId: string,
    season: string,
    climateZone: string,
    existingPattern?: WeatherPattern
  ): WeatherPattern {
    const baseline = this.CLIMATE_BASELINES[climateZone as keyof typeof this.CLIMATE_BASELINES];
    const seasonal = this.SEASONAL_MODIFIERS[season as keyof typeof this.SEASONAL_MODIFIERS];

    // Add realistic variability
    const tempVariation = (Math.random() - 0.5) * 10;
    const humidityVariation = (Math.random() - 0.5) * 20;
    const precipVariation = (Math.random() - 0.5) * 30;

    // Smooth transitions from existing pattern
    let temperature = baseline.temp + seasonal.tempMod + tempVariation;
    let humidity = baseline.humidity + seasonal.humidityMod + humidityVariation;
    let precipitation = Math.max(0, baseline.precip + seasonal.precipMod + precipVariation);

    if (existingPattern) {
      temperature = this.smoothTransition(existingPattern.temperature, temperature, 0.3);
      humidity = this.smoothTransition(existingPattern.humidity, humidity, 0.2);
      precipitation = this.smoothTransition(existingPattern.precipitation, precipitation, 0.4);
    }

    // Generate correlated weather parameters
    const windSpeed = Math.max(0, 5 + (Math.random() * 30) + (precipitation * 0.3));
    const windDirection = Math.floor(Math.random() * 360);
    const pressure = 1013 + (Math.random() - 0.5) * 50 - (precipitation * 0.5);
    const cloudCover = Math.min(100, precipitation * 1.5 + (Math.random() * 20));
    const visibility = Math.max(1, 20 - (precipitation * 0.3) - (cloudCover * 0.1));

    return {
      environmentId,
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.max(0, Math.min(100, Math.round(humidity))),
      windSpeed: Math.round(windSpeed * 10) / 10,
      windDirection: Math.round(windDirection),
      precipitation: Math.max(0, Math.min(100, Math.round(precipitation))),
      pressure: Math.round(pressure * 10) / 10,
      visibility: Math.round(visibility * 10) / 10,
      cloudCover: Math.max(0, Math.min(100, Math.round(cloudCover))),
      season,
      climateZone,
      timestamp: new Date(),
      conditions: this.determineConditions(temperature, precipitation, cloudCover, windSpeed)
    };
  }

  private static smoothTransition(current: number, target: number, factor: number): number {
    return current + (target - current) * factor;
  }

  private static determineConditions(temp: number, precip: number, clouds: number, wind: number): string {
    if (precip > 60) return wind > 20 ? 'thunderstorm' : 'heavy_rain';
    if (precip > 30) return 'rain';
    if (precip > 10) return 'light_rain';
    if (clouds > 80) return 'overcast';
    if (clouds > 50) return 'cloudy';
    if (clouds > 20) return 'partly_cloudy';
    if (temp > 30 && precip < 5) return 'hot';
    if (temp < 0) return precip > 0 ? 'snow' : 'cold';
    return 'clear';
  }

  static generateForecast(currentPattern: WeatherPattern, hours: number): WeatherPattern[] {
    const forecast: WeatherPattern[] = [];
    let current = { ...currentPattern };

    for (let i = 1; i <= hours; i++) {
      const next = this.generateWeatherPattern(
        current.environmentId,
        current.season,
        current.climateZone,
        current
      );
      
      next.timestamp = new Date(Date.now() + (i * 60 * 60 * 1000));
      forecast.push(next);
      current = next;
    }

    return forecast;
  }
}

class SeasonalManager {
  static getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }
}

class WeatherEventSimulator {
  static async createWeatherEvent(eventData: any): Promise<WeatherEvent> {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + (eventData.duration * 60 * 60 * 1000));

    const event: WeatherEvent = {
      environmentId: eventData.environmentId,
      eventType: eventData.eventType,
      intensity: eventData.intensity,
      duration: eventData.duration,
      startTime,
      endTime,
      isActive: true
    };

    // Store in database
    const { data, error } = await supabase
      .from('weather_events')
      .insert([event])
      .select()
      .single();

    if (error) throw new Error(`Failed to create weather event: ${error.message}`);

    return data;
  }

  static applyEventEffects(pattern: WeatherPattern, events: WeatherEvent[]): WeatherPattern {
    let modified = { ...pattern };

    events.filter(event => event.isActive).forEach(event => {
      const intensityFactor = event.intensity / 10;

      switch (event.eventType) {
        case 'storm':
          modified.windSpeed += 20 * intensityFactor;
          modified.precipitation += 30 * intensityFactor;
          modified.pressure -= 20 * intensityFactor;
          break;
        case 'heatwave':
          modified.temperature += 10 * intensityFactor;
          modified.humidity -= 20 * intensityFactor;
          break;
        case 'blizzard':
          modified.temperature -= 15 * intensityFactor;
          modified.windSpeed += 25 * intensityFactor;
          modified.precipitation += 20 * intensityFactor;
          modified.visibility -= 15 * intensityFactor;
          break;
        case 'fog':
          modified.visibility -= 15 * intensityFactor;
          modified.humidity += 15 * intensityFactor;
          break;
      }
    });

    return modified;
  }
}

// Cache helpers
async function getCachedWeather(environmentId: string): Promise<WeatherPattern | null> {
  try {
    const cached = await redis.get(`weather:${environmentId}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

async function setCachedWeather(environmentId: string, pattern: WeatherPattern): Promise<void> {
  try {
    await redis.setex(`weather:${environmentId}`, 300, JSON.stringify(pattern)); // 5 min cache
  } catch {
    // Silent fail for cache errors
  }
}

// API Route Handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const environmentId = searchParams.get('environmentId');
    const forecast = searchParams.get('forecast');

    if (!environmentId) {
      return NextResponse.json(
        { error: 'Environment ID is required' },
        { status: 400 }
      );
    }

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(environmentId)) {
      return NextResponse.json(
        { error: 'Invalid environment ID format' },
        { status: 400 }
      );
    }

    // Check cache first
    let weatherPattern = await getCachedWeather(environmentId);

    if (!weatherPattern) {
      // Fetch from database
      const { data, error } = await supabase
        .from('weather_patterns')
        .select('*')
        .eq('environment_id', environmentId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        return NextResponse.json(
          { error: 'Failed to fetch weather data' },
          { status: 500 }
        );
      }

      weatherPattern = data || null;
    }

    // Generate forecast if requested
    if (forecast === 'true' && weatherPattern) {
      const hours = parseInt(searchParams.get('hours') || '24');
      const forecastData = WeatherEngine.generateForecast(weatherPattern, hours);
      
      return NextResponse.json({
        current: weatherPattern,
        forecast: forecastData
      });
    }

    return NextResponse.json({ weather: weatherPattern });

  } catch (error) {
    console.error('Weather API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = WeatherPatternSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { environmentId, season, climateZone } = validation.data;

    // Get existing pattern for smooth transitions
    const existingPattern = await getCachedWeather(environmentId);

    // Generate new weather pattern
    const newPattern = WeatherEngine.generateWeatherPattern(
      environmentId,
      season || SeasonalManager.getCurrentSeason(),
      climateZone,
      existingPattern || undefined
    );

    // Check for active weather events
    const { data: events } = await supabase
      .from('weather_events')
      .select('*')
      .eq('environment_id', environmentId)
      .eq('is_active', true);

    // Apply event effects if any
    const finalPattern = events && events.length > 0 
      ? WeatherEventSimulator.applyEventEffects(newPattern, events)
      : newPattern;

    // Store in database
    const { data, error } = await supabase
      .from('weather_patterns')
      .insert([{
        environment_id: finalPattern.environmentId,
        temperature: finalPattern.temperature,
        humidity: finalPattern.humidity,
        wind_speed: finalPattern.windSpeed,
        wind_direction: finalPattern.windDirection,
        precipitation: finalPattern.precipitation,
        pressure: finalPattern.pressure,
        visibility: finalPattern.visibility,
        cloud_cover: finalPattern.cloudCover,
        season: finalPattern.season,
        climate_zone: finalPattern.climateZone,
        conditions: finalPattern.conditions,
        timestamp: finalPattern.timestamp
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save weather pattern' },
        { status: 500 }
      );
    }

    // Update cache
    await setCachedWeather(environmentId, finalPattern);

    return NextResponse.json({ 
      weather: finalPattern,
      message: 'Weather pattern generated successfully' 
    }, { status: 201 });

  } catch (error) {
    console.error('Weather API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const environmentId = searchParams.get('environmentId');

    if (!environmentId) {
      return NextResponse.json(
        { error: 'Environment ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = WeatherEventSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid event data', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Create weather event
    const event = await WeatherEventSimulator.createWeatherEvent(validation.data);

    // Get current weather pattern
    let currentPattern = await getCachedWeather(environmentId);
    
    if (!currentPattern) {
      const { data } = await supabase
        .from('weather_patterns')
        .select('*')
        .eq('environment_id', environmentId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      currentPattern = data;
    }

    if (currentPattern) {
      // Apply event effects
      const modifiedPattern = WeatherEventSimulator.applyEventEffects(currentPattern, [event]);
      await setCachedWeather(environmentId, modifiedPattern);
    }

    return NextResponse.json({ 
      event,
      message: 'Weather event created successfully' 
    }, { status: 201 });

  } catch (error) {
    console.error('Weather API PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const environmentId = searchParams.get('environmentId');
    const eventId = searchParams.get('eventId');

    if (!environmentId || !eventId) {
      return NextResponse.json(
        { error: 'Environment ID and Event ID are required' },
        { status: 400 }
      );
    }

    // Deactivate weather event
    const { error } = await supabase
      .from('weather_events')
      .update({ is_active: false })
      .eq('id', eventId)
      .eq('environment_id', environmentId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to deactivate weather event' },
        { status: 500 }
      );
    }

    // Clear cache to force regeneration
    await redis.del(`weather:${environmentId}`);

    return NextResponse.json({ 
      message: 'Weather event deactivated successfully' 
    });

  } catch (error) {
    console.error('Weather API DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```