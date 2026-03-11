import { EventEmitter } from 'events';

/**
 * 3D Vector interface for physics calculations
 */
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Quaternion interface for rotation representation
 */
interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * AABB (Axis-Aligned Bounding Box) for collision detection
 */
interface AABB {
  min: Vector3;
  max: Vector3;
}

/**
 * Physics material properties
 */
interface PhysicsMaterial {
  density: number;
  restitution: number;
  friction: number;
  viscosity?: number;
}

/**
 * Rigid body interface for physics objects
 */
interface RigidBody {
  id: string;
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  angularVelocity: Vector3;
  mass: number;
  inverseMass: number;
  material: PhysicsMaterial;
  isStatic: boolean;
  isActive: boolean;
  bounds: AABB;
  forces: Vector3[];
  torques: Vector3[];
  shape: CollisionShape;
}

/**
 * Collision shape types
 */
type CollisionShape = {
  type: 'sphere';
  radius: number;
} | {
  type: 'box';
  extents: Vector3;
} | {
  type: 'plane';
  normal: Vector3;
  distance: number;
} | {
  type: 'mesh';
  vertices: Vector3[];
  indices: number[];
};

/**
 * Particle system configuration
 */
interface ParticleSystemConfig {
  maxParticles: number;
  emissionRate: number;
  lifetime: number;
  startVelocity: Vector3;
  gravity: Vector3;
  damping: number;
  size: number;
  color: [number, number, number, number];
}

/**
 * Individual particle state
 */
interface Particle {
  position: Vector3;
  velocity: Vector3;
  lifetime: number;
  age: number;
  size: number;
  color: [number, number, number, number];
  active: boolean;
}

/**
 * Fluid particle for SPH simulation
 */
interface FluidParticle {
  position: Vector3;
  velocity: Vector3;
  density: number;
  pressure: number;
  force: Vector3;
  mass: number;
  id: number;
}

/**
 * Gravity field configuration
 */
interface GravityField {
  position: Vector3;
  strength: number;
  radius: number;
  type: 'point' | 'directional' | 'vortex';
  direction?: Vector3;
}

/**
 * Collision event data
 */
interface CollisionEvent {
  bodyA: string;
  bodyB: string;
  contactPoint: Vector3;
  normal: Vector3;
  impulse: number;
  timestamp: number;
}

/**
 * Physics world configuration
 */
interface PhysicsWorldConfig {
  gravity: Vector3;
  damping: number;
  timeStep: number;
  maxSubSteps: number;
  broadphaseType: 'naive' | 'grid' | 'octree';
  enableContinuousCollisionDetection: boolean;
}

/**
 * Physics debug visualization options
 */
interface PhysicsDebugOptions {
  showBounds: boolean;
  showVelocities: boolean;
  showForces: boolean;
  showContacts: boolean;
  showParticles: boolean;
  showFluidDensity: boolean;
}

/**
 * Performance metrics for physics simulation
 */
interface PhysicsMetrics {
  frameTime: number;
  rigidBodyCount: number;
  particleCount: number;
  fluidParticleCount: number;
  collisionPairs: number;
  memoryUsage: number;
}

/**
 * Physics simulation service error types
 */
class PhysicsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: any
  ) {
    super(message);
    this.name = 'PhysicsError';
  }
}

/**
 * Comprehensive physics simulation service for CRAIverse
 * Provides realistic physics with gravity, collisions, fluids, and particles
 */
export class PhysicsSimulationService extends EventEmitter {
  private readonly rigidBodies = new Map<string, RigidBody>();
  private readonly particleSystems = new Map<string, Particle[]>();
  private readonly fluidParticles = new Map<string, FluidParticle[]>();
  private readonly gravityFields: GravityField[] = [];
  private readonly spatialGrid = new Map<string, string[]>();
  
  private worldConfig: PhysicsWorldConfig;
  private isRunning = false;
  private lastUpdateTime = 0;
  private accumulator = 0;
  private worker?: Worker;
  private debugOptions: PhysicsDebugOptions;
  private metrics: PhysicsMetrics;

  // SPH fluid simulation constants
  private readonly SPH_REST_DENSITY = 1000;
  private readonly SPH_GAS_CONSTANT = 2000;
  private readonly SPH_VISCOSITY = 250;
  private readonly SPH_SMOOTHING_RADIUS = 16;

  constructor() {
    super();
    
    this.worldConfig = {
      gravity: { x: 0, y: -9.81, z: 0 },
      damping: 0.999,
      timeStep: 1/60,
      maxSubSteps: 10,
      broadphaseType: 'grid',
      enableContinuousCollisionDetection: false
    };

    this.debugOptions = {
      showBounds: false,
      showVelocities: false,
      showForces: false,
      showContacts: false,
      showParticles: false,
      showFluidDensity: false
    };

    this.metrics = {
      frameTime: 0,
      rigidBodyCount: 0,
      particleCount: 0,
      fluidParticleCount: 0,
      collisionPairs: 0,
      memoryUsage: 0
    };

    this.initializeWorker();
    this.setupEventHandlers();
  }

  /**
   * Initialize WebWorker for threaded physics calculations
   */
  private initializeWorker(): void {
    try {
      const workerScript = `
        self.onmessage = function(e) {
          const { type, data } = e.data;
          
          switch(type) {
            case 'STEP_SIMULATION':
              // Perform physics step calculations
              const result = performPhysicsStep(data);
              self.postMessage({ type: 'STEP_COMPLETE', result });
              break;
              
            case 'FLUID_SIMULATION':
              const fluidResult = simulateFluidDynamics(data);
              self.postMessage({ type: 'FLUID_COMPLETE', result: fluidResult });
              break;
          }
        };
        
        function performPhysicsStep(data) {
          // Worker-side physics calculations
          return { updated: true, timestamp: Date.now() };
        }
        
        function simulateFluidDynamics(data) {
          // SPH fluid simulation
          return { particles: data.particles };
        }
      `;

      const blob = new Blob([workerScript], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));

      this.worker.onmessage = (e) => {
        const { type, result } = e.data;
        this.handleWorkerMessage(type, result);
      };

    } catch (error) {
      console.warn('WebWorker not available, using main thread for physics');
    }
  }

  /**
   * Handle messages from physics worker
   */
  private handleWorkerMessage(type: string, result: any): void {
    switch (type) {
      case 'STEP_COMPLETE':
        this.emit('stepComplete', result);
        break;
      case 'FLUID_COMPLETE':
        this.emit('fluidUpdated', result);
        break;
    }
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    this.on('collision', (event: CollisionEvent) => {
      this.handleCollisionEvent(event);
    });

    this.on('particleExpired', (systemId: string, particleIndex: number) => {
      this.recycleParticle(systemId, particleIndex);
    });
  }

  /**
   * Start the physics simulation loop
   */
  public async start(): Promise<void> {
    try {
      if (this.isRunning) {
        throw new PhysicsError('Physics simulation already running', 'ALREADY_RUNNING');
      }

      this.isRunning = true;
      this.lastUpdateTime = performance.now();
      this.accumulator = 0;

      this.simulationLoop();
      this.emit('started');

    } catch (error) {
      throw new PhysicsError(
        `Failed to start physics simulation: ${error.message}`,
        'START_FAILED',
        { error }
      );
    }
  }

  /**
   * Stop the physics simulation
   */
  public async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      if (this.worker) {
        this.worker.terminate();
        this.worker = undefined;
      }

      this.emit('stopped');

    } catch (error) {
      throw new PhysicsError(
        `Failed to stop physics simulation: ${error.message}`,
        'STOP_FAILED',
        { error }
      );
    }
  }

  /**
   * Main simulation loop
   */
  private simulationLoop(): void {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastUpdateTime) / 1000, 0.1);
    this.lastUpdateTime = currentTime;

    this.accumulator += deltaTime;

    let subSteps = 0;
    while (this.accumulator >= this.worldConfig.timeStep && subSteps < this.worldConfig.maxSubSteps) {
      this.stepSimulation(this.worldConfig.timeStep);
      this.accumulator -= this.worldConfig.timeStep;
      subSteps++;
    }

    this.updateMetrics(performance.now() - currentTime);
    this.emit('updated', this.metrics);

    requestAnimationFrame(() => this.simulationLoop());
  }

  /**
   * Perform a single simulation step
   */
  private stepSimulation(deltaTime: number): void {
    // Update rigid bodies
    this.updateRigidBodies(deltaTime);
    
    // Detect and resolve collisions
    this.detectCollisions();
    
    // Update particle systems
    this.updateParticleSystems(deltaTime);
    
    // Update fluid dynamics
    this.updateFluidDynamics(deltaTime);
    
    // Apply gravity fields
    this.applyGravityFields();
  }

  /**
   * Create a rigid body in the physics world
   */
  public createRigidBody(config: {
    id: string;
    position: Vector3;
    rotation?: Quaternion;
    mass: number;
    material: PhysicsMaterial;
    shape: CollisionShape;
    isStatic?: boolean;
  }): RigidBody {
    try {
      if (this.rigidBodies.has(config.id)) {
        throw new PhysicsError('Rigid body already exists', 'DUPLICATE_ID', { id: config.id });
      }

      const body: RigidBody = {
        id: config.id,
        position: { ...config.position },
        rotation: config.rotation || { x: 0, y: 0, z: 0, w: 1 },
        velocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        mass: config.mass,
        inverseMass: config.isStatic ? 0 : 1 / config.mass,
        material: { ...config.material },
        isStatic: config.isStatic || false,
        isActive: true,
        bounds: this.calculateBounds(config.shape, config.position),
        forces: [],
        torques: [],
        shape: { ...config.shape }
      };

      this.rigidBodies.set(config.id, body);
      this.updateSpatialGrid(body);

      this.emit('rigidBodyCreated', body);
      return body;

    } catch (error) {
      throw new PhysicsError(
        `Failed to create rigid body: ${error.message}`,
        'CREATE_BODY_FAILED',
        { config, error }
      );
    }
  }

  /**
   * Remove a rigid body from the physics world
   */
  public removeRigidBody(id: string): boolean {
    try {
      const body = this.rigidBodies.get(id);
      if (!body) return false;

      this.rigidBodies.delete(id);
      this.removeFromSpatialGrid(body);

      this.emit('rigidBodyRemoved', { id });
      return true;

    } catch (error) {
      throw new PhysicsError(
        `Failed to remove rigid body: ${error.message}`,
        'REMOVE_BODY_FAILED',
        { id, error }
      );
    }
  }

  /**
   * Apply force to a rigid body
   */
  public applyForce(bodyId: string, force: Vector3, position?: Vector3): void {
    try {
      const body = this.rigidBodies.get(bodyId);
      if (!body || body.isStatic) return;

      body.forces.push({ ...force });

      if (position) {
        // Calculate torque from force at position
        const torque = this.cross(this.subtract(position, body.position), force);
        body.torques.push(torque);
      }

    } catch (error) {
      throw new PhysicsError(
        `Failed to apply force: ${error.message}`,
        'APPLY_FORCE_FAILED',
        { bodyId, force, error }
      );
    }
  }

  /**
   * Create a particle system
   */
  public createParticleSystem(id: string, config: ParticleSystemConfig): void {
    try {
      if (this.particleSystems.has(id)) {
        throw new PhysicsError('Particle system already exists', 'DUPLICATE_ID', { id });
      }

      const particles: Particle[] = [];
      for (let i = 0; i < config.maxParticles; i++) {
        particles.push(this.createParticle(config));
      }

      this.particleSystems.set(id, particles);
      this.emit('particleSystemCreated', { id, config });

    } catch (error) {
      throw new PhysicsError(
        `Failed to create particle system: ${error.message}`,
        'CREATE_PARTICLES_FAILED',
        { id, config, error }
      );
    }
  }

  /**
   * Create fluid simulation
   */
  public createFluidSimulation(id: string, particles: Vector3[], config: {
    viscosity: number;
    density: number;
    pressure: number;
  }): void {
    try {
      const fluidParticles: FluidParticle[] = particles.map((pos, index) => ({
        position: { ...pos },
        velocity: { x: 0, y: 0, z: 0 },
        density: config.density,
        pressure: config.pressure,
        force: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        id: index
      }));

      this.fluidParticles.set(id, fluidParticles);
      this.emit('fluidSimulationCreated', { id, particleCount: particles.length });

    } catch (error) {
      throw new PhysicsError(
        `Failed to create fluid simulation: ${error.message}`,
        'CREATE_FLUID_FAILED',
        { id, error }
      );
    }
  }

  /**
   * Add gravity field
   */
  public addGravityField(field: GravityField): void {
    try {
      this.gravityFields.push({ ...field });
      this.emit('gravityFieldAdded', field);

    } catch (error) {
      throw new PhysicsError(
        `Failed to add gravity field: ${error.message}`,
        'ADD_GRAVITY_FAILED',
        { field, error }
      );
    }
  }

  /**
   * Update rigid bodies physics
   */
  private updateRigidBodies(deltaTime: number): void {
    for (const body of this.rigidBodies.values()) {
      if (body.isStatic || !body.isActive) continue;

      // Apply gravity
      const gravityForce = this.multiplyScalar(this.worldConfig.gravity, body.mass);
      body.forces.push(gravityForce);

      // Integrate forces
      const acceleration = this.multiplyScalar(
        this.sumVectors(body.forces), 
        body.inverseMass
      );

      body.velocity = this.add(body.velocity, this.multiplyScalar(acceleration, deltaTime));
      body.velocity = this.multiplyScalar(body.velocity, this.worldConfig.damping);

      // Integrate position
      body.position = this.add(body.position, this.multiplyScalar(body.velocity, deltaTime));

      // Clear forces for next frame
      body.forces = [];
      body.torques = [];

      // Update bounds and spatial grid
      body.bounds = this.calculateBounds(body.shape, body.position);
      this.updateSpatialGrid(body);
    }
  }

  /**
   * Detect collisions between rigid bodies
   */
  private detectCollisions(): void {
    const collisionPairs: string[] = [];

    // Broad phase collision detection
    const potentialPairs = this.getBroadphasePairs();

    // Narrow phase collision detection
    for (const pair of potentialPairs) {
      const [bodyA, bodyB] = pair.split('|').map(id => this.rigidBodies.get(id));
      if (!bodyA || !bodyB) continue;

      const collision = this.detectCollision(bodyA, bodyB);
      if (collision) {
        this.resolveCollision(bodyA, bodyB, collision);
        collisionPairs.push(pair);

        const event: CollisionEvent = {
          bodyA: bodyA.id,
          bodyB: bodyB.id,
          contactPoint: collision.point,
          normal: collision.normal,
          impulse: collision.impulse,
          timestamp: Date.now()
        };

        this.emit('collision', event);
      }
    }

    this.metrics.collisionPairs = collisionPairs.length;
  }

  /**
   * Update particle systems
   */
  private updateParticleSystems(deltaTime: number): void {
    let totalParticles = 0;

    for (const [systemId, particles] of this.particleSystems.entries()) {
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        if (!particle.active) continue;

        // Update age
        particle.age += deltaTime;
        
        if (particle.age >= particle.lifetime) {
          particle.active = false;
          this.emit('particleExpired', systemId, i);
          continue;
        }

        // Apply gravity
        particle.velocity = this.add(
          particle.velocity,
          this.multiplyScalar(this.worldConfig.gravity, deltaTime)
        );

        // Update position
        particle.position = this.add(
          particle.position,
          this.multiplyScalar(particle.velocity, deltaTime)
        );

        totalParticles++;
      }
    }

    this.metrics.particleCount = totalParticles;
  }

  /**
   * Update fluid dynamics using SPH (Smoothed Particle Hydrodynamics)
   */
  private updateFluidDynamics(deltaTime: number): void {
    let totalFluidParticles = 0;

    for (const particles of this.fluidParticles.values()) {
      // Reset forces
      for (const particle of particles) {
        particle.force = { x: 0, y: 0, z: 0 };
        particle.density = 0;
      }

      // Calculate density and pressure
      for (let i = 0; i < particles.length; i++) {
        for (let j = 0; j < particles.length; j++) {
          if (i === j) continue;

          const distance = this.distance(particles[i].position, particles[j].position);
          if (distance < this.SPH_SMOOTHING_RADIUS) {
            const kernel = this.sphKernel(distance, this.SPH_SMOOTHING_RADIUS);
            particles[i].density += particles[j].mass * kernel;
          }
        }

        particles[i].pressure = this.SPH_GAS_CONSTANT * (particles[i].density - this.SPH_REST_DENSITY);
      }

      // Calculate forces
      for (let i = 0; i < particles.length; i++) {
        for (let j = 0; j < particles.length; j++) {
          if (i === j) continue;

          const distance = this.distance(particles[i].position, particles[j].position);
          if (distance < this.SPH_SMOOTHING_RADIUS) {
            const direction = this.normalize(this.subtract(particles[j].position, particles[i].position));
            
            // Pressure force
            const pressureKernel = this.sphPressureKernel(distance, this.SPH_SMOOTHING_RADIUS);
            const pressureForce = this.multiplyScalar(
              direction,
              -particles[j].mass * (particles[i].pressure + particles[j].pressure) / (2 * particles[j].density) * pressureKernel
            );

            // Viscosity force
            const viscosityKernel = this.sphViscosityKernel(distance, this.SPH_SMOOTHING_RADIUS);
            const velocityDiff = this.subtract(particles[j].velocity, particles[i].velocity);
            const viscosityForce = this.multiplyScalar(
              velocityDiff,
              this.SPH_VISCOSITY * particles[j].mass / particles[j].density * viscosityKernel
            );

            particles[i].force = this.add(particles[i].force, this.add(pressureForce, viscosityForce));
          }
        }

        // Apply gravity
        particles[i].force = this.add(particles[i].force, this.multiplyScalar(this.worldConfig.gravity, particles[i].mass));
      }

      // Integrate
      for (const particle of particles) {
        const acceleration = this.multiplyScalar(particle.force, 1 / particle.mass);
        particle.velocity = this.add(particle.velocity,