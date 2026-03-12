```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Matter from 'matter-js';
import * as THREE from 'three';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Physics Engine Class
class PhysicsEngine {
  private engine: Matter.Engine;
  private world: Matter.World;
  private runner: Matter.Runner | null = null;
  private bodies: Map<string, Matter.Body> = new Map();
  private constraints: Map<string, Matter.Constraint> = new Map();
  private updateCallbacks: Set<(delta: number) => void> = new Set();

  constructor() {
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    
    // Configure engine for better performance
    this.engine.world.gravity.y = 0.8;
    this.engine.positionIterations = 6;
    this.engine.velocityIterations = 4;
    this.engine.constraintIterations = 2;
  }

  start(): void {
    if (!this.runner) {
      this.runner = Matter.Runner.create();
      Matter.Runner.run(this.runner, this.engine);
      
      Matter.Events.on(this.engine, 'beforeUpdate', (event) => {
        const delta = event.timestamp - (this.engine.timing.timestamp || 0);
        this.updateCallbacks.forEach(callback => callback(delta));
      });
    }
  }

  stop(): void {
    if (this.runner) {
      Matter.Runner.stop(this.runner);
      this.runner = null;
    }
  }

  addBody(id: string, body: Matter.Body): void {
    this.bodies.set(id, body);
    Matter.World.add(this.world, body);
  }

  removeBody(id: string): void {
    const body = this.bodies.get(id);
    if (body) {
      Matter.World.remove(this.world, body);
      this.bodies.delete(id);
    }
  }

  getBody(id: string): Matter.Body | undefined {
    return this.bodies.get(id);
  }

  addConstraint(id: string, constraint: Matter.Constraint): void {
    this.constraints.set(id, constraint);
    Matter.World.add(this.world, constraint);
  }

  onUpdate(callback: (delta: number) => void): void {
    this.updateCallbacks.add(callback);
  }

  getPhysicsState(): any {
    return {
      bodies: Array.from(this.bodies.entries()).map(([id, body]) => ({
        id,
        position: body.position,
        velocity: body.velocity,
        angle: body.angle,
        angularVelocity: body.angularVelocity
      })),
      timestamp: Date.now()
    };
  }
}

// Gravity Simulator
class GravitySimulator {
  private gravitationalConstant: number = 6.674e-11;
  private bodies: Map<string, GravitationalBody> = new Map();

  constructor(private physicsEngine: PhysicsEngine) {}

  addGravitationalBody(id: string, mass: number, position: THREE.Vector3): void {
    const body = {
      id,
      mass,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      acceleration: new THREE.Vector3()
    };
    
    this.bodies.set(id, body);
  }

  updateGravitationalForces(): void {
    const bodies = Array.from(this.bodies.values());
    
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].acceleration.set(0, 0, 0);
      
      for (let j = 0; j < bodies.length; j++) {
        if (i === j) continue;
        
        const distance = bodies[i].position.distanceTo(bodies[j].position);
        const force = this.gravitationalConstant * bodies[i].mass * bodies[j].mass / (distance * distance);
        
        const direction = new THREE.Vector3()
          .subVectors(bodies[j].position, bodies[i].position)
          .normalize();
        
        bodies[i].acceleration.add(direction.multiplyScalar(force / bodies[i].mass));
      }
    }
  }

  simulate(deltaTime: number): void {
    this.updateGravitationalForces();
    
    this.bodies.forEach(body => {
      body.velocity.add(body.acceleration.clone().multiplyScalar(deltaTime));
      body.position.add(body.velocity.clone().multiplyScalar(deltaTime));
    });
  }
}

interface GravitationalBody {
  id: string;
  mass: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
}

// Collision Detector with Spatial Partitioning
class CollisionDetector {
  private spatialGrid: Map<string, Set<string>> = new Map();
  private gridSize: number = 100;
  private collisionCallbacks: Map<string, (bodyA: string, bodyB: string) => void> = new Map();

  constructor(private physicsEngine: PhysicsEngine) {
    // Listen for Matter.js collision events
    Matter.Events.on(physicsEngine['engine'], 'collisionStart', (event) => {
      event.pairs.forEach(pair => {
        const bodyA = this.findBodyId(pair.bodyA);
        const bodyB = this.findBodyId(pair.bodyB);
        
        if (bodyA && bodyB) {
          this.triggerCollisionCallback(bodyA, bodyB);
        }
      });
    });
  }

  private findBodyId(body: Matter.Body): string | null {
    for (const [id, physicsBody] of this.physicsEngine['bodies']) {
      if (physicsBody === body) return id;
    }
    return null;
  }

  updateSpatialGrid(): void {
    this.spatialGrid.clear();
    
    this.physicsEngine['bodies'].forEach((body, id) => {
      const gridX = Math.floor(body.position.x / this.gridSize);
      const gridY = Math.floor(body.position.y / this.gridSize);
      const cellId = `${gridX},${gridY}`;
      
      if (!this.spatialGrid.has(cellId)) {
        this.spatialGrid.set(cellId, new Set());
      }
      
      this.spatialGrid.get(cellId)!.add(id);
    });
  }

  onCollision(bodyId: string, callback: (bodyA: string, bodyB: string) => void): void {
    this.collisionCallbacks.set(bodyId, callback);
  }

  private triggerCollisionCallback(bodyA: string, bodyB: string): void {
    const callbackA = this.collisionCallbacks.get(bodyA);
    const callbackB = this.collisionCallbacks.get(bodyB);
    
    if (callbackA) callbackA(bodyA, bodyB);
    if (callbackB) callbackB(bodyB, bodyA);
  }

  broadPhaseDetection(): Array<[string, string]> {
    const potentialCollisions: Array<[string, string]> = [];
    
    this.spatialGrid.forEach(cellBodies => {
      const bodies = Array.from(cellBodies);
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          potentialCollisions.push([bodies[i], bodies[j]]);
        }
      }
    });
    
    return potentialCollisions;
  }
}

// Fluid Dynamics with SPH
class FluidDynamics {
  private particles: Map<string, FluidParticle> = new Map();
  private smoothingRadius: number = 16;
  private restDensity: number = 1000;
  private gasConstant: number = 2000;
  private viscosity: number = 250;
  private mass: number = 65;

  addParticle(id: string, position: THREE.Vector3, velocity: THREE.Vector3 = new THREE.Vector3()): void {
    this.particles.set(id, {
      id,
      position: position.clone(),
      velocity: velocity.clone(),
      density: 0,
      pressure: 0,
      force: new THREE.Vector3()
    });
  }

  simulate(deltaTime: number): void {
    this.calculateDensityPressure();
    this.calculateForces();
    this.integrate(deltaTime);
  }

  private calculateDensityPressure(): void {
    this.particles.forEach(particle => {
      particle.density = 0;
      
      this.particles.forEach(neighbor => {
        const distance = particle.position.distanceTo(neighbor.position);
        if (distance < this.smoothingRadius) {
          particle.density += this.mass * this.poly6Kernel(distance, this.smoothingRadius);
        }
      });
      
      particle.pressure = this.gasConstant * (particle.density - this.restDensity);
    });
  }

  private calculateForces(): void {
    this.particles.forEach(particle => {
      const pressureForce = new THREE.Vector3();
      const viscosityForce = new THREE.Vector3();
      
      this.particles.forEach(neighbor => {
        if (particle === neighbor) return;
        
        const distance = particle.position.distanceTo(neighbor.position);
        if (distance < this.smoothingRadius && distance > 0) {
          const direction = new THREE.Vector3()
            .subVectors(particle.position, neighbor.position)
            .normalize();
          
          // Pressure force
          const pressureKernel = this.spikyGradientKernel(distance, this.smoothingRadius);
          const pressureMagnitude = -this.mass * (particle.pressure + neighbor.pressure) / (2 * neighbor.density) * pressureKernel;
          pressureForce.add(direction.clone().multiplyScalar(pressureMagnitude));
          
          // Viscosity force
          const viscosityKernel = this.viscosityLaplacianKernel(distance, this.smoothingRadius);
          const velocityDiff = new THREE.Vector3().subVectors(neighbor.velocity, particle.velocity);
          const viscosityMagnitude = this.viscosity * this.mass / neighbor.density * viscosityKernel;
          viscosityForce.add(velocityDiff.multiplyScalar(viscosityMagnitude));
        }
      });
      
      particle.force = pressureForce.add(viscosityForce);
    });
  }

  private integrate(deltaTime: number): void {
    this.particles.forEach(particle => {
      const acceleration = particle.force.clone().divideScalar(particle.density);
      particle.velocity.add(acceleration.multiplyScalar(deltaTime));
      particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
    });
  }

  private poly6Kernel(distance: number, radius: number): number {
    if (distance >= radius) return 0;
    const coefficient = 315 / (64 * Math.PI * Math.pow(radius, 9));
    return coefficient * Math.pow(radius * radius - distance * distance, 3);
  }

  private spikyGradientKernel(distance: number, radius: number): number {
    if (distance >= radius) return 0;
    const coefficient = -45 / (Math.PI * Math.pow(radius, 6));
    return coefficient * Math.pow(radius - distance, 2);
  }

  private viscosityLaplacianKernel(distance: number, radius: number): number {
    if (distance >= radius) return 0;
    const coefficient = 45 / (Math.PI * Math.pow(radius, 6));
    return coefficient * (radius - distance);
  }

  getParticles(): FluidParticle[] {
    return Array.from(this.particles.values());
  }
}

interface FluidParticle {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  density: number;
  pressure: number;
  force: THREE.Vector3;
}

// Particle System
class ParticleSystem {
  private particles: Map<string, Particle> = new Map();
  private emitters: Map<string, ParticleEmitter> = new Map();
  private globalForces: THREE.Vector3[] = [];

  addEmitter(id: string, emitter: ParticleEmitter): void {
    this.emitters.set(id, emitter);
  }

  addGlobalForce(force: THREE.Vector3): void {
    this.globalForces.push(force);
  }

  update(deltaTime: number): void {
    // Update emitters
    this.emitters.forEach(emitter => {
      emitter.update(deltaTime);
      
      // Emit new particles
      const newParticles = emitter.emit(deltaTime);
      newParticles.forEach(particle => {
        this.particles.set(particle.id, particle);
      });
    });

    // Update particles
    this.particles.forEach((particle, id) => {
      // Apply global forces
      this.globalForces.forEach(force => {
        particle.acceleration.add(force);
      });

      // Update physics
      particle.velocity.add(particle.acceleration.clone().multiplyScalar(deltaTime));
      particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
      
      // Update life
      particle.life -= deltaTime;
      particle.age += deltaTime;
      
      // Reset acceleration
      particle.acceleration.set(0, 0, 0);
      
      // Remove dead particles
      if (particle.life <= 0) {
        this.particles.delete(id);
      }
    });
  }

  getParticles(): Particle[] {
    return Array.from(this.particles.values());
  }
}

interface Particle {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  life: number;
  age: number;
  size: number;
  color: THREE.Color;
}

interface ParticleEmitter {
  position: THREE.Vector3;
  rate: number;
  life: number;
  velocity: THREE.Vector3;
  velocityRandomness: number;
  size: number;
  sizeRandomness: number;
  color: THREE.Color;
  
  update(deltaTime: number): void;
  emit(deltaTime: number): Particle[];
}

// Physics API Manager
class PhysicsAPI {
  private physicsEngine: PhysicsEngine;
  private gravitySimulator: GravitySimulator;
  private collisionDetector: CollisionDetector;
  private fluidDynamics: FluidDynamics;
  private particleSystem: ParticleSystem;
  private sessions: Map<string, PhysicsSession> = new Map();

  constructor() {
    this.physicsEngine = new PhysicsEngine();
    this.gravitySimulator = new GravitySimulator(this.physicsEngine);
    this.collisionDetector = new CollisionDetector(this.physicsEngine);
    this.fluidDynamics = new FluidDynamics();
    this.particleSystem = new ParticleSystem();
    
    this.setupPhysicsLoop();
  }

  private setupPhysicsLoop(): void {
    this.physicsEngine.onUpdate((deltaTime) => {
      this.gravitySimulator.simulate(deltaTime / 1000);
      this.collisionDetector.updateSpatialGrid();
      this.fluidDynamics.simulate(deltaTime / 1000);
      this.particleSystem.update(deltaTime / 1000);
    });
    
    this.physicsEngine.start();
  }

  createSession(userId: string, config: PhysicsConfig): string {
    const sessionId = `session_${userId}_${Date.now()}`;
    const session: PhysicsSession = {
      id: sessionId,
      userId,
      config,
      createdAt: new Date(),
      lastUpdate: new Date(),
      bodies: new Map(),
      active: true
    };
    
    this.sessions.set(sessionId, session);
    return sessionId;
  }

  async savePhysicsState(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const state = {
      session_id: sessionId,
      user_id: session.userId,
      physics_state: this.physicsEngine.getPhysicsState(),
      fluid_particles: this.fluidDynamics.getParticles(),
      particle_systems: this.particleSystem.getParticles(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('physics_states')
      .upsert(state, { onConflict: 'session_id' });

    if (error) throw error;
  }

  async loadPhysicsState(sessionId: string): Promise<any> {
    const { data, error } = await supabase
      .from('physics_states')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) throw error;
    return data;
  }
}

interface PhysicsConfig {
  gravity: THREE.Vector3;
  enableCollisions: boolean;
  enableFluids: boolean;
  enableParticles: boolean;
  maxBodies: number;
  simulationSpeed: number;
}

interface PhysicsSession {
  id: string;
  userId: string;
  config: PhysicsConfig;
  createdAt: Date;
  lastUpdate: Date;
  bodies: Map<string, any>;
  active: boolean;
}

// Global physics API instance
const physicsAPI = new PhysicsAPI();

// API Route Handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const action = searchParams.get('action');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    switch (action) {
      case 'state':
        const state = physicsAPI['physicsEngine'].getPhysicsState();
        return NextResponse.json({ success: true, data: state });

      case 'load':
        const loadedState = await physicsAPI.loadPhysicsState(sessionId);
        return NextResponse.json({ success: true, data: loadedState });

      case 'particles':
        const particles = physicsAPI['particleSystem'].getParticles();
        return NextResponse.json({ success: true, data: particles });

      case 'fluids':
        const fluidParticles = physicsAPI['fluidDynamics'].getParticles();
        return NextResponse.json({ success: true, data: fluidParticles });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Physics API GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, userId, config, data } = body;

    switch (action) {
      case 'createSession':
        if (!userId || !config) {
          return NextResponse.json({ error: 'User ID and config required' }, { status: 400 });
        }
        
        const newSessionId = physicsAPI.createSession(userId, config);
        return NextResponse.json({ success: true, sessionId: newSessionId });

      case 'addBody':
        if (!sessionId || !data) {
          return NextResponse.json({ error: 'Session ID and body data required' }, { status: 400 });
        }
        
        const body = Matter.Bodies.rectangle(
          data.position.x,
          data.position.y,
          data.width,
          data.height,
          data.options || {}
        );
        
        physicsAPI['physicsEngine'].addBody(data.id, body);
        return NextResponse.json({ success: true });

      case 'addFluidParticle':
        if (!data) {
          return NextResponse.json({ error: 'Particle data required' }, { status: 400 });
        }
        
        physicsAPI['fluidDynamics'].addParticle(
          data.id,
          new THREE.Vector3(data.position.x, data.position.y, data.position.z),
          data.velocity ? new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z) : undefined
        );
        return NextResponse.json({ success: true });

      case 'addGravitationalBody':
        if (!data) {
          return NextResponse.json({ error: 'Gravitational body data required' }, { status: 400 });
        }
        
        physicsAPI['gravitySimulator'].addGravitationalBody(
          data.id,
          data.mass,
          new THREE.Vector3(data.position.x, data.position.y, data.position.z)
        );
        return NextResponse.json({ success: true });

      case 'save':
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }
        
        await physicsAPI.savePhysicsState(sessionId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Physics API POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, bodyId, updates } = body;

    if (!sessionId || !bodyId) {
      return NextResponse.json({ error: 'Session ID and body ID required' }, { status: 400 });
    }

    const physicsBody = physicsAPI['physicsEngine'].getBody(bodyId);
    if (!physicsBody) {
      return NextResponse.json({ error: 'Body not found' }, { status: 404 });
    }

    // Apply updates to physics body
    if (updates.position) {
      Matter.Body.setPosition(physicsBody, updates.position);
    }
    
    if (updates.velocity) {
      Matter.Body.setVelocity(physicsBody, updates.velocity);
    }
    
    if (updates.angle !== undefined) {
      Matter.Body.setAngle(physicsBody, updates.angle);
    }

    return NextResponse