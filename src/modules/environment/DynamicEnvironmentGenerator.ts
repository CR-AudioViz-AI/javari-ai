import { EventEmitter } from 'events';
import * as THREE from 'three';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Environment configuration interface
 */
interface EnvironmentConfig {
  dimensions: THREE.Vector3;
  biome: 'forest' | 'desert' | 'arctic' | 'urban' | 'underwater' | 'space';
  complexity: 'low' | 'medium' | 'high';
  physics: boolean;
  storytelling: boolean;
  interactivity: 'passive' | 'reactive' | 'adaptive';
}

/**
 * User preference data structure
 */
interface UserPreferences {
  userId: string;
  preferredBiomes: string[];
  interactionFrequency: number;
  storyPreferences: string[];
  physicsComplexity: number;
  visualStyle: string;
  audioPreferences: {
    ambientLevel: number;
    spatialAudio: boolean;
    naturalSounds: boolean;
  };
}

/**
 * Physics simulation configuration
 */
interface PhysicsConfig {
  gravity: THREE.Vector3;
  friction: number;
  restitution: number;
  airDensity: number;
  fluidDynamics: boolean;
}

/**
 * Storytelling element definition
 */
interface StoryElement {
  id: string;
  type: 'artifact' | 'location' | 'character' | 'event';
  position: THREE.Vector3;
  narrative: string;
  triggerDistance: number;
  dependencies: string[];
}

/**
 * Interaction heatmap data point
 */
interface HeatmapPoint {
  position: THREE.Vector3;
  intensity: number;
  timestamp: number;
  userId: string;
  actionType: string;
}

/**
 * Generated environment data
 */
interface GeneratedEnvironment {
  id: string;
  config: EnvironmentConfig;
  terrain: THREE.Mesh[];
  objects: THREE.Object3D[];
  physics: PhysicsConfig;
  storyElements: StoryElement[];
  atmosphere: AtmosphereSettings;
  heatmap: HeatmapPoint[];
}

/**
 * Atmosphere configuration
 */
interface AtmosphereSettings {
  fogDensity: number;
  fogColor: THREE.Color;
  lighting: {
    ambient: THREE.Color;
    directional: {
      color: THREE.Color;
      intensity: number;
      position: THREE.Vector3;
    };
  };
  weather: {
    type: 'clear' | 'rain' | 'snow' | 'fog' | 'storm';
    intensity: number;
  };
  timeOfDay: number;
}

/**
 * Core environment generation system
 */
class EnvironmentGeneratorCore extends EventEmitter {
  private supabase: SupabaseClient;
  private cache: Map<string, GeneratedEnvironment>;
  private worker: Worker | null;

  constructor(supabaseUrl: string, supabaseKey: string) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.cache = new Map();
    this.worker = null;
    this.initializeWorker();
  }

  /**
   * Initialize WebWorker for physics calculations
   */
  private async initializeWorker(): Promise<void> {
    try {
      const workerBlob = new Blob([this.getWorkerCode()], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(workerBlob));
      
      this.worker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Physics worker error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      throw error;
    }
  }

  /**
   * Generate environment based on configuration
   */
  public async generateEnvironment(config: EnvironmentConfig, userId: string): Promise<GeneratedEnvironment> {
    try {
      const cacheKey = this.generateCacheKey(config, userId);
      
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }

      const environment: GeneratedEnvironment = {
        id: this.generateId(),
        config,
        terrain: [],
        objects: [],
        physics: this.generatePhysicsConfig(config),
        storyElements: [],
        atmosphere: this.generateAtmosphere(config),
        heatmap: []
      };

      // Generate terrain
      environment.terrain = await this.generateTerrain(config);
      
      // Generate objects
      environment.objects = await this.generateObjects(config);
      
      // Generate story elements if enabled
      if (config.storytelling) {
        environment.storyElements = await this.generateStoryElements(config, userId);
      }

      // Cache the generated environment
      this.cache.set(cacheKey, environment);
      
      // Store in database
      await this.storeEnvironment(environment, userId);

      this.emit('environmentGenerated', environment);
      return environment;
    } catch (error) {
      console.error('Environment generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate terrain meshes
   */
  private async generateTerrain(config: EnvironmentConfig): Promise<THREE.Mesh[]> {
    const terrain: THREE.Mesh[] = [];
    const generator = new TerrainGenerator();
    
    switch (config.biome) {
      case 'forest':
        terrain.push(...generator.generateForestTerrain(config.dimensions, config.complexity));
        break;
      case 'desert':
        terrain.push(...generator.generateDesertTerrain(config.dimensions, config.complexity));
        break;
      case 'arctic':
        terrain.push(...generator.generateArcticTerrain(config.dimensions, config.complexity));
        break;
      case 'urban':
        terrain.push(...generator.generateUrbanTerrain(config.dimensions, config.complexity));
        break;
      case 'underwater':
        terrain.push(...generator.generateUnderwaterTerrain(config.dimensions, config.complexity));
        break;
      case 'space':
        terrain.push(...generator.generateSpaceTerrain(config.dimensions, config.complexity));
        break;
      default:
        terrain.push(...generator.generateDefaultTerrain(config.dimensions, config.complexity));
    }

    return terrain;
  }

  /**
   * Generate environment objects
   */
  private async generateObjects(config: EnvironmentConfig): Promise<THREE.Object3D[]> {
    const objects: THREE.Object3D[] = [];
    const density = this.getObjectDensity(config.complexity);
    const area = config.dimensions.x * config.dimensions.z;
    const objectCount = Math.floor(area * density);

    for (let i = 0; i < objectCount; i++) {
      const obj = this.createBiomeSpecificObject(config.biome);
      obj.position.set(
        Math.random() * config.dimensions.x - config.dimensions.x / 2,
        0,
        Math.random() * config.dimensions.z - config.dimensions.z / 2
      );
      objects.push(obj);
    }

    return objects;
  }

  /**
   * Generate story elements for the environment
   */
  private async generateStoryElements(config: EnvironmentConfig, userId: string): Promise<StoryElement[]> {
    try {
      const { data: userStoryData } = await this.supabase
        .from('user_preferences')
        .select('story_preferences')
        .eq('user_id', userId)
        .single();

      const storyPreferences = userStoryData?.story_preferences || [];
      const storytelling = new StorytellingSystem();
      
      return storytelling.generateElements(config, storyPreferences);
    } catch (error) {
      console.error('Story element generation failed:', error);
      return [];
    }
  }

  /**
   * Generate physics configuration
   */
  private generatePhysicsConfig(config: EnvironmentConfig): PhysicsConfig {
    const baseGravity = new THREE.Vector3(0, -9.81, 0);
    
    switch (config.biome) {
      case 'space':
        return {
          gravity: new THREE.Vector3(0, 0, 0),
          friction: 0.1,
          restitution: 0.9,
          airDensity: 0,
          fluidDynamics: false
        };
      case 'underwater':
        return {
          gravity: new THREE.Vector3(0, -2, 0),
          friction: 0.8,
          restitution: 0.3,
          airDensity: 1000,
          fluidDynamics: true
        };
      default:
        return {
          gravity: baseGravity,
          friction: 0.5,
          restitution: 0.5,
          airDensity: 1.2,
          fluidDynamics: false
        };
    }
  }

  /**
   * Generate atmosphere settings
   */
  private generateAtmosphere(config: EnvironmentConfig): AtmosphereSettings {
    const atmosphere = new AtmosphereController();
    return atmosphere.generateSettings(config.biome);
  }

  /**
   * Store environment in database
   */
  private async storeEnvironment(environment: GeneratedEnvironment, userId: string): Promise<void> {
    try {
      await this.supabase
        .from('environment_templates')
        .insert({
          id: environment.id,
          user_id: userId,
          config: environment.config,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to store environment:', error);
    }
  }

  /**
   * Helper methods
   */
  private generateCacheKey(config: EnvironmentConfig, userId: string): string {
    return `${userId}_${JSON.stringify(config)}`;
  }

  private generateId(): string {
    return `env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getObjectDensity(complexity: string): number {
    switch (complexity) {
      case 'low': return 0.01;
      case 'medium': return 0.05;
      case 'high': return 0.1;
      default: return 0.05;
    }
  }

  private createBiomeSpecificObject(biome: string): THREE.Object3D {
    const group = new THREE.Group();
    
    switch (biome) {
      case 'forest':
        const tree = this.createTree();
        group.add(tree);
        break;
      case 'desert':
        const cactus = this.createCactus();
        group.add(cactus);
        break;
      case 'urban':
        const building = this.createBuilding();
        group.add(building);
        break;
      default:
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        group.add(cube);
    }

    return group;
  }

  private createTree(): THREE.Object3D {
    const group = new THREE.Group();
    
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 2),
      new THREE.MeshLambertMaterial({ color: 0x8B4513 })
    );
    trunk.position.y = 1;
    
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(1.5),
      new THREE.MeshLambertMaterial({ color: 0x228B22 })
    );
    foliage.position.y = 2.5;
    
    group.add(trunk, foliage);
    return group;
  }

  private createCactus(): THREE.Object3D {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 3),
      new THREE.MeshLambertMaterial({ color: 0x32CD32 })
    );
  }

  private createBuilding(): THREE.Object3D {
    const height = Math.random() * 10 + 5;
    return new THREE.Mesh(
      new THREE.BoxGeometry(2, height, 2),
      new THREE.MeshLambertMaterial({ color: 0x666666 })
    );
  }

  private handleWorkerMessage(data: any): void {
    switch (data.type) {
      case 'physicsUpdate':
        this.emit('physicsUpdate', data.payload);
        break;
      case 'error':
        this.emit('error', data.error);
        break;
    }
  }

  private getWorkerCode(): string {
    return `
      // Physics simulation worker
      self.onmessage = function(e) {
        const { type, payload } = e.data;
        
        switch (type) {
          case 'simulate':
            try {
              const result = simulatePhysics(payload);
              self.postMessage({ type: 'physicsUpdate', payload: result });
            } catch (error) {
              self.postMessage({ type: 'error', error: error.message });
            }
            break;
        }
      };
      
      function simulatePhysics(data) {
        // Basic physics simulation
        return {
          timestamp: Date.now(),
          objects: data.objects.map(obj => ({
            ...obj,
            position: updatePosition(obj),
            velocity: updateVelocity(obj)
          }))
        };
      }
      
      function updatePosition(obj) {
        return {
          x: obj.position.x + obj.velocity.x * 0.016,
          y: obj.position.y + obj.velocity.y * 0.016,
          z: obj.position.z + obj.velocity.z * 0.016
        };
      }
      
      function updateVelocity(obj) {
        return {
          x: obj.velocity.x * 0.99,
          y: obj.velocity.y - 9.81 * 0.016,
          z: obj.velocity.z * 0.99
        };
      }
    `;
  }
}

/**
 * Physics simulation engine
 */
class PhysicsSimulationEngine extends EventEmitter {
  private config: PhysicsConfig;
  private objects: Map<string, any>;
  private running: boolean;

  constructor(config: PhysicsConfig) {
    super();
    this.config = config;
    this.objects = new Map();
    this.running = false;
  }

  public start(): void {
    if (this.running) return;
    
    this.running = true;
    this.simulate();
  }

  public stop(): void {
    this.running = false;
  }

  public addObject(id: string, object: any): void {
    this.objects.set(id, object);
  }

  public removeObject(id: string): void {
    this.objects.delete(id);
  }

  private simulate(): void {
    if (!this.running) return;

    const deltaTime = 1 / 60; // 60 FPS
    
    for (const [id, obj] of this.objects) {
      this.updateObject(obj, deltaTime);
    }

    this.emit('update', Array.from(this.objects.values()));
    
    requestAnimationFrame(() => this.simulate());
  }

  private updateObject(obj: any, deltaTime: number): void {
    // Apply gravity
    obj.velocity.add(this.config.gravity.clone().multiplyScalar(deltaTime));
    
    // Apply friction
    obj.velocity.multiplyScalar(1 - this.config.friction * deltaTime);
    
    // Update position
    obj.position.add(obj.velocity.clone().multiplyScalar(deltaTime));
    
    // Handle collisions
    this.handleCollisions(obj);
  }

  private handleCollisions(obj: any): void {
    // Simple ground collision
    if (obj.position.y < 0) {
      obj.position.y = 0;
      obj.velocity.y *= -this.config.restitution;
    }
  }
}

/**
 * User preference analyzer
 */
class UserPreferenceAnalyzer {
  private supabase: SupabaseClient;
  private cache: Map<string, UserPreferences>;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.cache = new Map();
  }

  public async analyzePreferences(userId: string): Promise<UserPreferences> {
    try {
      if (this.cache.has(userId)) {
        return this.cache.get(userId)!;
      }

      const { data } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!data) {
        return this.createDefaultPreferences(userId);
      }

      const preferences: UserPreferences = {
        userId: data.user_id,
        preferredBiomes: data.preferred_biomes || ['forest'],
        interactionFrequency: data.interaction_frequency || 0.5,
        storyPreferences: data.story_preferences || ['adventure'],
        physicsComplexity: data.physics_complexity || 0.5,
        visualStyle: data.visual_style || 'realistic',
        audioPreferences: {
          ambientLevel: data.ambient_level || 0.5,
          spatialAudio: data.spatial_audio || true,
          naturalSounds: data.natural_sounds || true
        }
      };

      this.cache.set(userId, preferences);
      return preferences;
    } catch (error) {
      console.error('Failed to analyze preferences:', error);
      return this.createDefaultPreferences(userId);
    }
  }

  public async updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    try {
      await this.supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          ...updates,
          updated_at: new Date().toISOString()
        });

      this.cache.delete(userId);
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  }

  private createDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      preferredBiomes: ['forest', 'urban'],
      interactionFrequency: 0.5,
      storyPreferences: ['adventure', 'mystery'],
      physicsComplexity: 0.5,
      visualStyle: 'realistic',
      audioPreferences: {
        ambientLevel: 0.5,
        spatialAudio: true,
        naturalSounds: true
      }
    };
  }
}

/**
 * Environmental storytelling system
 */
class StorytellingSystem {
  private narratives: Map<string, any>;
  private dependencies: Map<string, string[]>;

  constructor() {
    this.narratives = new Map();
    this.dependencies = new Map();
  }

  public generateElements(config: EnvironmentConfig, preferences: string[]): StoryElement[] {
    const elements: StoryElement[] = [];
    const storyCount = this.getStoryCount(config.complexity);

    for (let i = 0; i < storyCount; i++) {
      const element = this.createStoryElement(config, preferences);
      elements.push(element);
    }

    return this.resolveElementDependencies(elements);
  }

  private createStoryElement(config: EnvironmentConfig, preferences: string[]): StoryElement {
    const types = ['artifact', 'location', 'character', 'event'];
    const type = types[Math.floor(Math.random() * types.length)] as StoryElement['type'];

    return {
      id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      position: new THREE.Vector3(
        Math.random() * config.dimensions.x - config.dimensions.x / 2,
        Math.random() * config.dimensions.y,
        Math.random() * config.dimensions.z - config.dimensions.z / 2
      ),
      narrative: this.generateNarrative(type, config.biome, preferences),
      triggerDistance: 5,
      dependencies: []
    };
  }

  private generateNarrative(type: string, biome: string, preferences: string[]): string {
    const narratives = {
      artifact: {
        forest: 'An ancient runestone covered in mysterious symbols...',
        desert: 'A weathered compass pointing to unknown destinations...',
        urban: 'A forgotten time capsule from decades past...'
      },
      location: {
        forest: 'A clearing where the trees whisper ancient secrets...',
        desert: 'An oasis that appears only to those who truly need it...',
        urban: 'A rooftop garden hidden among the concrete jungle...'
      }
    };

    return narratives[type]?.[biome] || 'A mysterious element awaits discovery...';
  }

  private getStoryCount(complexity: string): number {
    switch (complexity) {
      case 'low': return 2;
      case 'medium': return 5;
      case 'high': return 10;
      default: return 5;
    }
  }

  private resolveElementDependencies(elements: StoryElement[]): StoryElement[] {
    // Simple dependency resolution - elements discovered in sequence
    for (let i = 1; i < elements.length; i++) {
      if (Math.random() < 0.3) {
        elements[i].dependencies.push(elements[i - 1].id);
      }
    }

    return elements;
  }
}

/**
 * Terrain generation utilities
 */
class TerrainGenerator {
  public generateForestTerrain(dimensions: THREE.Vector3, complexity: string): THREE.Mesh[] {
    const terrain: THREE.Mesh[] = [];
    
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(dimensions.x, dimensions.z, 32, 32);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4a5d23 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    terrain.push(ground);

    // Add hills if complexity is medium or high
    if (complexity !== 'low') {
      const hillCount = complexity === 'high' ? 5 : 2;
      for (let i = 0; i < hillCount; i++) {
        const hill = this.createHill();
        hill.position.set(
          Math.random() * dimensions.x - dimensions.x / 2,
          0,
          Math.random() * dimensions.z - dimensions.z / 2
        );
        terrain.push(hill);
      }
    }

    return terrain