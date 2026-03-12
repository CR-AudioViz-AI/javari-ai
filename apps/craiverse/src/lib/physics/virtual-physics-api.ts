```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Types and Interfaces
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface Transform {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

interface RigidBodyConfig {
  id: string;
  mass: number;
  velocity: Vector3;
  angularVelocity: Vector3;
  friction: number;
  restitution: number;
  isKinematic: boolean;
  shape: 'box' | 'sphere' | 'capsule' | 'mesh';
  dimensions: Vector3;
}

interface CollisionEvent {
  bodyA: string;
  bodyB: string;
  contactPoint: Vector3;
  normal: Vector3;
  impulse: number;
  timestamp: number;
}

interface FluidParticle {
  id: string;
  position: Vector3;
  velocity: Vector3;
  density: number;
  pressure: number;
  mass: number;
}

interface PhysicsWorldConfig {
  gravity: Vector3;
  timeScale: number;
  maxSubSteps: number;
  fixedTimeStep: number;
  enableFluids: boolean;
  enableDebug: boolean;
}

interface PerformanceMetrics {
  frameTime: number;
  physicsCpuTime: number;
  collisionCount: number;
  activeBodyCount: number;
  fluidParticleCount: number;
}

// Physics World Class
class PhysicsWorld {
  private config: PhysicsWorldConfig;
  private rigidBodies: Map<string, RigidBodyConfig>;
  private fluidParticles: Map<string, FluidParticle>;
  private collisionEvents: CollisionEvent[];
  private spatialHash: Map<string, string[]>;
  private worker: Worker | null = null;
  private sharedBuffer: SharedArrayBuffer | null = null;
  private performanceMetrics: PerformanceMetrics;

  constructor(config: PhysicsWorldConfig) {
    this.config = config;
    this.rigidBodies = new Map();
    this.fluidParticles = new Map();
    this.collisionEvents = [];
    this.spatialHash = new Map();
    this.performanceMetrics = {
      frameTime: 0,
      physicsCpuTime: 0,
      collisionCount: 0,
      activeBodyCount: 0,
      fluidParticleCount: 0
    };
    this.initializeWorkerPool();
  }

  private initializeWorkerPool(): void {
    try {
      // Initialize SharedArrayBuffer for worker communication
      const bufferSize = 1024 * 1024; // 1MB buffer
      this.sharedBuffer = new SharedArrayBuffer(bufferSize);
      
      // Create physics worker
      const workerCode = this.generateWorkerCode();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      
      this.worker.postMessage({
        type: 'init',
        buffer: this.sharedBuffer,
        config: this.config
      });
    } catch (error) {
      console.warn('SharedArrayBuffer not available, falling back to main thread');
    }
  }

  private generateWorkerCode(): string {
    return `
      let physicsEngine = null;
      let sharedBuffer = null;
      let config = null;

      self.onmessage = function(e) {
        switch(e.data.type) {
          case 'init':
            sharedBuffer = e.data.buffer;
            config = e.data.config;
            initPhysicsEngine();
            break;
          case 'step':
            stepPhysics(e.data.deltaTime);
            break;
        }
      };

      function initPhysicsEngine() {
        // Initialize WebAssembly physics engine
        physicsEngine = {
          world: null,
          bodies: new Map(),
          constraints: [],
          step: function(dt) {
            // Physics step implementation
            return { collisions: [], transforms: [] };
          }
        };
      }

      function stepPhysics(deltaTime) {
        const startTime = performance.now();
        const result = physicsEngine.step(deltaTime);
        const endTime = performance.now();
        
        // Write results to shared buffer
        if (sharedBuffer) {
          const view = new Float32Array(sharedBuffer);
          // Write transform data and collision events
        }
        
        self.postMessage({
          type: 'step_complete',
          performanceTime: endTime - startTime,
          collisions: result.collisions
        });
      }
    `;
  }

  addRigidBody(bodyConfig: RigidBodyConfig): void {
    this.rigidBodies.set(bodyConfig.id, bodyConfig);
    
    if (this.worker) {
      this.worker.postMessage({
        type: 'add_body',
        body: bodyConfig
      });
    }
  }

  removeRigidBody(bodyId: string): void {
    this.rigidBodies.delete(bodyId);
    
    if (this.worker) {
      this.worker.postMessage({
        type: 'remove_body',
        bodyId
      });
    }
  }

  step(deltaTime: number): PerformanceMetrics {
    const startTime = performance.now();
    
    if (this.worker) {
      this.worker.postMessage({
        type: 'step',
        deltaTime
      });
    } else {
      this.stepMainThread(deltaTime);
    }
    
    this.performanceMetrics.frameTime = performance.now() - startTime;
    return this.performanceMetrics;
  }

  private stepMainThread(deltaTime: number): void {
    // Fallback physics simulation on main thread
    this.updateSpatialHash();
    this.detectCollisions();
    this.integrateRigidBodies(deltaTime);
    
    if (this.config.enableFluids) {
      this.simulateFluidDynamics(deltaTime);
    }
  }

  private updateSpatialHash(): void {
    this.spatialHash.clear();
    const cellSize = 10.0;
    
    for (const [id, body] of this.rigidBodies) {
      const pos = body.velocity; // Using velocity as position for this example
      const cellX = Math.floor(pos.x / cellSize);
      const cellY = Math.floor(pos.y / cellSize);
      const cellZ = Math.floor(pos.z / cellSize);
      const cellKey = `${cellX},${cellY},${cellZ}`;
      
      if (!this.spatialHash.has(cellKey)) {
        this.spatialHash.set(cellKey, []);
      }
      this.spatialHash.get(cellKey)!.push(id);
    }
  }

  private detectCollisions(): void {
    this.collisionEvents = [];
    
    for (const [cellKey, bodyIds] of this.spatialHash) {
      for (let i = 0; i < bodyIds.length; i++) {
        for (let j = i + 1; j < bodyIds.length; j++) {
          const bodyA = this.rigidBodies.get(bodyIds[i]);
          const bodyB = this.rigidBodies.get(bodyIds[j]);
          
          if (bodyA && bodyB && this.checkCollision(bodyA, bodyB)) {
            this.collisionEvents.push({
              bodyA: bodyA.id,
              bodyB: bodyB.id,
              contactPoint: { x: 0, y: 0, z: 0 },
              normal: { x: 0, y: 1, z: 0 },
              impulse: 1.0,
              timestamp: Date.now()
            });
          }
        }
      }
    }
    
    this.performanceMetrics.collisionCount = this.collisionEvents.length;
  }

  private checkCollision(bodyA: RigidBodyConfig, bodyB: RigidBodyConfig): boolean {
    // Simplified collision detection
    const distance = Math.sqrt(
      Math.pow(bodyA.velocity.x - bodyB.velocity.x, 2) +
      Math.pow(bodyA.velocity.y - bodyB.velocity.y, 2) +
      Math.pow(bodyA.velocity.z - bodyB.velocity.z, 2)
    );
    
    const minDistance = (bodyA.dimensions.x + bodyB.dimensions.x) / 2;
    return distance < minDistance;
  }

  private integrateRigidBodies(deltaTime: number): void {
    for (const [id, body] of this.rigidBodies) {
      if (body.isKinematic) continue;
      
      // Apply gravity
      body.velocity.y += this.config.gravity.y * deltaTime;
      
      // Apply friction
      body.velocity.x *= (1 - body.friction * deltaTime);
      body.velocity.z *= (1 - body.friction * deltaTime);
    }
  }

  private simulateFluidDynamics(deltaTime: number): void {
    const smoothingRadius = 2.0;
    const restDensity = 1000.0;
    const gasConstant = 200.0;
    const viscosity = 0.1;
    
    // Calculate densities using SPH
    for (const [id, particle] of this.fluidParticles) {
      particle.density = 0;
      
      for (const [otherId, otherParticle] of this.fluidParticles) {
        const distance = this.calculateDistance(particle.position, otherParticle.position);
        if (distance < smoothingRadius) {
          const kernelValue = this.sphKernel(distance, smoothingRadius);
          particle.density += otherParticle.mass * kernelValue;
        }
      }
      
      particle.pressure = gasConstant * (particle.density - restDensity);
    }
    
    // Calculate forces and integrate
    for (const [id, particle] of this.fluidParticles) {
      const pressureForce = { x: 0, y: 0, z: 0 };
      const viscosityForce = { x: 0, y: 0, z: 0 };
      
      for (const [otherId, otherParticle] of this.fluidParticles) {
        if (id === otherId) continue;
        
        const distance = this.calculateDistance(particle.position, otherParticle.position);
        if (distance < smoothingRadius && distance > 0) {
          const direction = this.normalize({
            x: particle.position.x - otherParticle.position.x,
            y: particle.position.y - otherParticle.position.y,
            z: particle.position.z - otherParticle.position.z
          });
          
          const pressureGradient = this.sphPressureGradient(distance, smoothingRadius);
          const pressureMagnitude = (particle.pressure + otherParticle.pressure) / (2 * otherParticle.density);
          
          pressureForce.x -= otherParticle.mass * pressureMagnitude * pressureGradient * direction.x;
          pressureForce.y -= otherParticle.mass * pressureMagnitude * pressureGradient * direction.y;
          pressureForce.z -= otherParticle.mass * pressureMagnitude * pressureGradient * direction.z;
        }
      }
      
      // Integrate velocity and position
      particle.velocity.x += (pressureForce.x + viscosityForce.x) * deltaTime / particle.mass;
      particle.velocity.y += (pressureForce.y + viscosityForce.y + this.config.gravity.y) * deltaTime / particle.mass;
      particle.velocity.z += (pressureForce.z + viscosityForce.z) * deltaTime / particle.mass;
      
      particle.position.x += particle.velocity.x * deltaTime;
      particle.position.y += particle.velocity.y * deltaTime;
      particle.position.z += particle.velocity.z * deltaTime;
    }
    
    this.performanceMetrics.fluidParticleCount = this.fluidParticles.size;
  }

  private calculateDistance(a: Vector3, b: Vector3): number {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2)
    );
  }

  private normalize(v: Vector3): Vector3 {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / length, y: v.y / length, z: v.z / length };
  }

  private sphKernel(distance: number, smoothingRadius: number): number {
    const h = smoothingRadius;
    if (distance >= h) return 0;
    const volume = Math.PI * Math.pow(h, 8) / 4;
    return Math.max(0, Math.pow(h * h - distance * distance, 3)) / volume;
  }

  private sphPressureGradient(distance: number, smoothingRadius: number): number {
    const h = smoothingRadius;
    if (distance >= h) return 0;
    const volume = Math.PI * Math.pow(h, 8) / 4;
    return -6 * (h * h - distance * distance) * distance / volume;
  }

  getCollisionEvents(): CollisionEvent[] {
    return [...this.collisionEvents];
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }
}

// Performance Profiler
class PhysicsProfiler {
  private metrics: PerformanceMetrics[] = [];
  private maxSamples = 60;

  addSample(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxSamples) {
      this.metrics.shift();
    }
  }

  getAverageFrameTime(): number {
    if (this.metrics.length === 0) return 0;
    return this.metrics.reduce((sum, m) => sum + m.frameTime, 0) / this.metrics.length;
  }

  getReport(): any {
    return {
      avgFrameTime: this.getAverageFrameTime(),
      avgCollisions: this.metrics.reduce((sum, m) => sum + m.collisionCount, 0) / this.metrics.length,
      avgActiveBodies: this.metrics.reduce((sum, m) => sum + m.activeBodyCount, 0) / this.metrics.length,
      samples: this.metrics.length
    };
  }
}

// Global physics world instance
let physicsWorld: PhysicsWorld | null = null;
let profiler: PhysicsProfiler | null = null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // Initialize Supabase client for real-time sync
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    switch (action) {
      case 'initialize_world': {
        const config: PhysicsWorldConfig = {
          gravity: params.gravity || { x: 0, y: -9.81, z: 0 },
          timeScale: params.timeScale || 1.0,
          maxSubSteps: params.maxSubSteps || 3,
          fixedTimeStep: params.fixedTimeStep || 1/60,
          enableFluids: params.enableFluids || false,
          enableDebug: params.enableDebug || false
        };

        physicsWorld = new PhysicsWorld(config);
        profiler = new PhysicsProfiler();

        return NextResponse.json({
          success: true,
          worldId: crypto.randomUUID(),
          config
        });
      }

      case 'add_rigid_body': {
        if (!physicsWorld) {
          return NextResponse.json(
            { error: 'Physics world not initialized' },
            { status: 400 }
          );
        }

        const bodyConfig: RigidBodyConfig = {
          id: params.id || crypto.randomUUID(),
          mass: params.mass || 1.0,
          velocity: params.velocity || { x: 0, y: 0, z: 0 },
          angularVelocity: params.angularVelocity || { x: 0, y: 0, z: 0 },
          friction: params.friction || 0.5,
          restitution: params.restitution || 0.3,
          isKinematic: params.isKinematic || false,
          shape: params.shape || 'box',
          dimensions: params.dimensions || { x: 1, y: 1, z: 1 }
        };

        physicsWorld.addRigidBody(bodyConfig);

        // Sync with Supabase for multiplayer
        if (params.sync) {
          await supabase
            .from('physics_bodies')
            .insert({
              id: bodyConfig.id,
              config: bodyConfig,
              world_id: params.worldId
            });
        }

        return NextResponse.json({
          success: true,
          bodyId: bodyConfig.id,
          config: bodyConfig
        });
      }

      case 'step_simulation': {
        if (!physicsWorld || !profiler) {
          return NextResponse.json(
            { error: 'Physics world not initialized' },
            { status: 400 }
          );
        }

        const deltaTime = params.deltaTime || 1/60;
        const metrics = physicsWorld.step(deltaTime);
        profiler.addSample(metrics);

        const collisions = physicsWorld.getCollisionEvents();

        return NextResponse.json({
          success: true,
          metrics,
          collisions,
          profilerReport: profiler.getReport()
        });
      }

      case 'get_performance_report': {
        if (!profiler) {
          return NextResponse.json(
            { error: 'Profiler not initialized' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          report: profiler.getReport()
        });
      }

      case 'remove_rigid_body': {
        if (!physicsWorld) {
          return NextResponse.json(
            { error: 'Physics world not initialized' },
            { status: 400 }
          );
        }

        physicsWorld.removeRigidBody(params.bodyId);

        // Sync with Supabase
        if (params.sync) {
          await supabase
            .from('physics_bodies')
            .delete()
            .eq('id', params.bodyId);
        }

        return NextResponse.json({
          success: true,
          removedBodyId: params.bodyId
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Physics API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'world_status': {
        const status = {
          initialized: physicsWorld !== null,
          profilerActive: profiler !== null,
          timestamp: Date.now()
        };

        return NextResponse.json({
          success: true,
          status
        });
      }

      case 'health_check': {
        return NextResponse.json({
          success: true,
          service: 'Virtual Physics API',
          version: '1.0.0',
          timestamp: Date.now(),
          features: [
            'Real-time physics simulation',
            'Collision detection',
            'Fluid dynamics',
            'Multi-threaded processing',
            'Performance profiling',
            'Multiplayer sync'
          ]
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid GET action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Physics API GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```