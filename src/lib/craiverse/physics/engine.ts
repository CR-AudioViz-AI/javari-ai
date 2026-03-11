```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

interface RigidBody {
  id: string;
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  angularVelocity: Vector3;
  mass: number;
  restitution: number;
  friction: number;
  isStatic: boolean;
  shape: 'box' | 'sphere' | 'capsule' | 'mesh';
  dimensions: Vector3;
  material: string;
}

interface FluidParticle {
  id: string;
  position: Vector3;
  velocity: Vector3;
  density: number;
  pressure: number;
  viscosity: number;
  temperature: number;
}

interface CollisionEvent {
  bodyA: string;
  bodyB: string;
  point: Vector3;
  normal: Vector3;
  impulse: number;
  timestamp: number;
}

interface PhysicsState {
  worldId: string;
  timestamp: number;
  bodies: RigidBody[];
  fluidParticles: FluidParticle[];
  collisions: CollisionEvent[];
  environmentalForces: {
    gravity: Vector3;
    wind: Vector3;
    temperature: number;
    pressure: number;
  };
}

interface PredictionFrame {
  frameId: number;
  timestamp: number;
  inputs: any[];
  state: PhysicsState;
}

interface OctreeNode {
  bounds: {
    min: Vector3;
    max: Vector3;
  };
  bodies: string[];
  children: OctreeNode[];
  level: number;
}

class PhysicsEngine {
  private fixedTimeStep = 1 / 60; // 60 FPS
  private maxSubSteps = 10;
  private accumulator = 0;
  private currentTime = 0;
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  private bodies: Map<string, RigidBody> = new Map();
  private fluidParticles: Map<string, FluidParticle> = new Map();
  private octree: OctreeNode | null = null;
  private predictionFrames: Map<number, PredictionFrame> = new Map();
  private lagCompensationBuffer: PhysicsState[] = [];

  constructor(private worldId: string) {
    this.initializeOctree();
    this.setupRealtimeSync();
  }

  private initializeOctree(): void {
    this.octree = {
      bounds: {
        min: { x: -1000, y: -1000, z: -1000 },
        max: { x: 1000, y: 1000, z: 1000 }
      },
      bodies: [],
      children: [],
      level: 0
    };
  }

  private setupRealtimeSync(): void {
    const channel = this.supabase.channel(`physics:${this.worldId}`)
      .on('broadcast', { event: 'physics_update' }, (payload) => {
        this.handleRemotePhysicsUpdate(payload);
      })
      .on('broadcast', { event: 'collision' }, (payload) => {
        this.handleRemoteCollision(payload);
      })
      .subscribe();
  }

  public step(deltaTime: number): PhysicsState {
    this.accumulator += deltaTime;
    let steps = 0;

    while (this.accumulator >= this.fixedTimeStep && steps < this.maxSubSteps) {
      this.fixedStep(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      this.currentTime += this.fixedTimeStep;
      steps++;
    }

    const interpolationFactor = this.accumulator / this.fixedTimeStep;
    return this.interpolateState(interpolationFactor);
  }

  private fixedStep(dt: number): void {
    // Update octree
    this.updateSpatialPartitioning();
    
    // Broad phase collision detection
    const collisionPairs = this.broadPhaseCollision();
    
    // Narrow phase collision detection and resolution
    const collisions = this.narrowPhaseCollision(collisionPairs);
    
    // Integrate forces and velocities
    this.integrateForces(dt);
    
    // Update fluid dynamics
    this.updateFluidDynamics(dt);
    
    // Apply environmental effects
    this.applyEnvironmentalEffects(dt);
    
    // Store state for lag compensation
    this.storeLagCompensationFrame();
    
    // Broadcast physics updates
    this.broadcastPhysicsUpdate(collisions);
  }

  private updateSpatialPartitioning(): void {
    if (!this.octree) return;
    
    this.octree.bodies = [];
    this.octree.children = [];
    
    this.bodies.forEach((body, id) => {
      this.insertIntoOctree(this.octree!, id, body);
    });
  }

  private insertIntoOctree(node: OctreeNode, bodyId: string, body: RigidBody): void {
    if (node.level >= 8) {
      node.bodies.push(bodyId);
      return;
    }

    if (node.children.length === 0) {
      if (node.bodies.length < 4) {
        node.bodies.push(bodyId);
        return;
      }

      this.subdivideOctree(node);
    }

    for (const child of node.children) {
      if (this.isBodyInBounds(body, child.bounds)) {
        this.insertIntoOctree(child, bodyId, body);
        return;
      }
    }

    node.bodies.push(bodyId);
  }

  private subdivideOctree(node: OctreeNode): void {
    const { min, max } = node.bounds;
    const center = {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2
    };

    const childBounds = [
      { min: { x: min.x, y: min.y, z: min.z }, max: { x: center.x, y: center.y, z: center.z } },
      { min: { x: center.x, y: min.y, z: min.z }, max: { x: max.x, y: center.y, z: center.z } },
      { min: { x: min.x, y: center.y, z: min.z }, max: { x: center.x, y: max.y, z: center.z } },
      { min: { x: center.x, y: center.y, z: min.z }, max: { x: max.x, y: max.y, z: center.z } },
      { min: { x: min.x, y: min.y, z: center.z }, max: { x: center.x, y: center.y, z: max.z } },
      { min: { x: center.x, y: min.y, z: center.z }, max: { x: max.x, y: center.y, z: max.z } },
      { min: { x: min.x, y: center.y, z: center.z }, max: { x: center.x, y: max.y, z: max.z } },
      { min: { x: center.x, y: center.y, z: center.z }, max: { x: max.x, y: max.y, z: max.z } }
    ];

    node.children = childBounds.map(bounds => ({
      bounds,
      bodies: [],
      children: [],
      level: node.level + 1
    }));
  }

  private isBodyInBounds(body: RigidBody, bounds: { min: Vector3; max: Vector3 }): boolean {
    return body.position.x >= bounds.min.x && body.position.x <= bounds.max.x &&
           body.position.y >= bounds.min.y && body.position.y <= bounds.max.y &&
           body.position.z >= bounds.min.z && body.position.z <= bounds.max.z;
  }

  private broadPhaseCollision(): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    
    if (!this.octree) return pairs;
    
    this.collectCollisionPairs(this.octree, pairs);
    return pairs;
  }

  private collectCollisionPairs(node: OctreeNode, pairs: Array<[string, string]>): void {
    // Check collisions within this node
    for (let i = 0; i < node.bodies.length; i++) {
      for (let j = i + 1; j < node.bodies.length; j++) {
        pairs.push([node.bodies[i], node.bodies[j]]);
      }
    }

    // Recursively check children
    for (const child of node.children) {
      this.collectCollisionPairs(child, pairs);
    }
  }

  private narrowPhaseCollision(pairs: Array<[string, string]>): CollisionEvent[] {
    const collisions: CollisionEvent[] = [];
    
    for (const [bodyAId, bodyBId] of pairs) {
      const bodyA = this.bodies.get(bodyAId);
      const bodyB = this.bodies.get(bodyBId);
      
      if (!bodyA || !bodyB) continue;
      
      const collision = this.detectCollision(bodyA, bodyB);
      if (collision) {
        collisions.push({
          bodyA: bodyAId,
          bodyB: bodyBId,
          point: collision.point,
          normal: collision.normal,
          impulse: collision.impulse,
          timestamp: this.currentTime
        });
        
        this.resolveCollision(bodyA, bodyB, collision);
      }
    }
    
    return collisions;
  }

  private detectCollision(bodyA: RigidBody, bodyB: RigidBody): {
    point: Vector3;
    normal: Vector3;
    impulse: number;
  } | null {
    // Simplified sphere-sphere collision detection
    if (bodyA.shape === 'sphere' && bodyB.shape === 'sphere') {
      const distance = this.vectorDistance(bodyA.position, bodyB.position);
      const radiiSum = bodyA.dimensions.x + bodyB.dimensions.x; // Using x as radius
      
      if (distance < radiiSum) {
        const normal = this.vectorNormalize(this.vectorSubtract(bodyB.position, bodyA.position));
        const penetration = radiiSum - distance;
        const relativeVelocity = this.vectorSubtract(bodyB.velocity, bodyA.velocity);
        const velocityAlongNormal = this.vectorDot(relativeVelocity, normal);
        
        if (velocityAlongNormal > 0) return null; // Objects separating
        
        const restitution = Math.min(bodyA.restitution, bodyB.restitution);
        const impulse = -(1 + restitution) * velocityAlongNormal;
        const massSum = bodyA.mass + bodyB.mass;
        const finalImpulse = impulse / massSum;
        
        return {
          point: this.vectorAdd(bodyA.position, this.vectorScale(normal, bodyA.dimensions.x)),
          normal,
          impulse: finalImpulse
        };
      }
    }
    
    return null;
  }

  private resolveCollision(bodyA: RigidBody, bodyB: RigidBody, collision: {
    point: Vector3;
    normal: Vector3;
    impulse: number;
  }): void {
    const impulseVector = this.vectorScale(collision.normal, collision.impulse);
    
    if (!bodyA.isStatic) {
      bodyA.velocity = this.vectorSubtract(bodyA.velocity, this.vectorScale(impulseVector, 1 / bodyA.mass));
    }
    
    if (!bodyB.isStatic) {
      bodyB.velocity = this.vectorAdd(bodyB.velocity, this.vectorScale(impulseVector, 1 / bodyB.mass));
    }
  }

  private integrateForces(dt: number): void {
    this.bodies.forEach(body => {
      if (body.isStatic) return;
      
      // Apply gravity
      const gravity = { x: 0, y: -9.81, z: 0 };
      body.velocity = this.vectorAdd(body.velocity, this.vectorScale(gravity, dt));
      
      // Apply damping
      const damping = 0.99;
      body.velocity = this.vectorScale(body.velocity, damping);
      body.angularVelocity = this.vectorScale(body.angularVelocity, damping);
      
      // Integrate position
      body.position = this.vectorAdd(body.position, this.vectorScale(body.velocity, dt));
      
      // Integrate rotation (simplified)
      const angularDelta = this.vectorScale(body.angularVelocity, dt * 0.5);
      body.rotation = this.quaternionNormalize(this.quaternionAdd(body.rotation, {
        x: angularDelta.x,
        y: angularDelta.y,
        z: angularDelta.z,
        w: 0
      }));
    });
  }

  private updateFluidDynamics(dt: number): void {
    const smoothingRadius = 2.0;
    const restDensity = 1000.0;
    const stiffness = 200.0;
    const viscosity = 0.018;
    
    // Calculate density and pressure for each particle
    this.fluidParticles.forEach(particle => {
      particle.density = 0;
      
      this.fluidParticles.forEach(neighbor => {
        const distance = this.vectorDistance(particle.position, neighbor.position);
        if (distance < smoothingRadius) {
          const kernelValue = this.smoothingKernel(distance, smoothingRadius);
          particle.density += kernelValue;
        }
      });
      
      particle.pressure = stiffness * (particle.density - restDensity);
    });
    
    // Calculate forces and update positions
    this.fluidParticles.forEach(particle => {
      let pressureForce = { x: 0, y: 0, z: 0 };
      let viscosityForce = { x: 0, y: 0, z: 0 };
      
      this.fluidParticles.forEach(neighbor => {
        if (particle.id === neighbor.id) return;
        
        const distance = this.vectorDistance(particle.position, neighbor.position);
        if (distance < smoothingRadius && distance > 0) {
          const direction = this.vectorNormalize(this.vectorSubtract(particle.position, neighbor.position));
          
          // Pressure force
          const pressureGradient = this.smoothingKernelGradient(distance, smoothingRadius);
          const pressureMagnitude = (particle.pressure + neighbor.pressure) / (2 * neighbor.density);
          pressureForce = this.vectorAdd(pressureForce, this.vectorScale(direction, pressureMagnitude * pressureGradient));
          
          // Viscosity force
          const velocityDiff = this.vectorSubtract(neighbor.velocity, particle.velocity);
          const viscosityMagnitude = viscosity * this.smoothingKernelLaplacian(distance, smoothingRadius) / neighbor.density;
          viscosityForce = this.vectorAdd(viscosityForce, this.vectorScale(velocityDiff, viscosityMagnitude));
        }
      });
      
      // Apply forces
      const totalForce = this.vectorAdd(pressureForce, viscosityForce);
      const gravity = { x: 0, y: -9.81, z: 0 };
      totalForce = this.vectorAdd(totalForce, gravity);
      
      // Integrate velocity and position
      particle.velocity = this.vectorAdd(particle.velocity, this.vectorScale(totalForce, dt));
      particle.position = this.vectorAdd(particle.position, this.vectorScale(particle.velocity, dt));
    });
  }

  private smoothingKernel(distance: number, radius: number): number {
    if (distance >= radius) return 0;
    const ratio = distance / radius;
    return (315 / (64 * Math.PI * Math.pow(radius, 9))) * Math.pow(Math.pow(radius, 2) - Math.pow(distance, 2), 3);
  }

  private smoothingKernelGradient(distance: number, radius: number): number {
    if (distance >= radius) return 0;
    return -(945 / (32 * Math.PI * Math.pow(radius, 9))) * Math.pow(Math.pow(radius, 2) - Math.pow(distance, 2), 2);
  }

  private smoothingKernelLaplacian(distance: number, radius: number): number {
    if (distance >= radius) return 0;
    return (945 / (32 * Math.PI * Math.pow(radius, 9))) * (Math.pow(radius, 2) - Math.pow(distance, 2)) * (3 * Math.pow(radius, 2) - 7 * Math.pow(distance, 2));
  }

  private applyEnvironmentalEffects(dt: number): void {
    const windForce = { x: 1, y: 0, z: 0.5 };
    
    this.bodies.forEach(body => {
      if (body.isStatic) return;
      
      // Apply wind resistance based on velocity
      const velocityMagnitude = this.vectorLength(body.velocity);
      const dragCoefficient = 0.1;
      const dragForce = this.vectorScale(body.velocity, -dragCoefficient * velocityMagnitude);
      
      body.velocity = this.vectorAdd(body.velocity, this.vectorScale(dragForce, dt));
      body.velocity = this.vectorAdd(body.velocity, this.vectorScale(windForce, dt * 0.1));
    });
  }

  private storeLagCompensationFrame(): void {
    const state: PhysicsState = {
      worldId: this.worldId,
      timestamp: this.currentTime,
      bodies: Array.from(this.bodies.values()),
      fluidParticles: Array.from(this.fluidParticles.values()),
      collisions: [],
      environmentalForces: {
        gravity: { x: 0, y: -9.81, z: 0 },
        wind: { x: 1, y: 0, z: 0.5 },
        temperature: 20,
        pressure: 1013.25
      }
    };
    
    this.lagCompensationBuffer.push(state);
    
    // Keep only last 1 second of states (60 frames at 60fps)
    if (this.lagCompensationBuffer.length > 60) {
      this.lagCompensationBuffer.shift();
    }
  }

  private interpolateState(factor: number): PhysicsState {
    return {
      worldId: this.worldId,
      timestamp: this.currentTime,
      bodies: Array.from(this.bodies.values()).map(body => ({
        ...body,
        position: this.vectorAdd(body.position, this.vectorScale(body.velocity, factor * this.fixedTimeStep))
      })),
      fluidParticles: Array.from(this.fluidParticles.values()),
      collisions: [],
      environmentalForces: {
        gravity: { x: 0, y: -9.81, z: 0 },
        wind: { x: 1, y: 0, z: 0.5 },
        temperature: 20,
        pressure: 1013.25
      }
    };
  }

  private async broadcastPhysicsUpdate(collisions: CollisionEvent[]): Promise<void> {
    const updateData = {
      worldId: this.worldId,
      timestamp: this.currentTime,
      bodies: Array.from(this.bodies.values()),
      collisions
    };
    
    await this.supabase.channel(`physics:${this.worldId}`)
      .send({
        type: 'broadcast',
        event: 'physics_update',
        payload: updateData
      });
  }

  private handleRemotePhysicsUpdate(payload: any): void {
    // Handle physics updates from other clients
    if (payload.timestamp > this.currentTime) {
      // Future state - store for prediction
      // Implementation depends on specific netcode strategy
    }
  }

  private handleRemoteCollision(payload: any): void {
    // Handle collision events from other clients
    // Useful for triggering audio/visual effects
  }

  // Vector math utilities
  private vectorAdd(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  private vectorSubtract(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  private vectorScale(v: Vector3, scale: number): Vector3 {
    return { x: v.x * scale, y: v.y * scale, z: v.z * scale };
  }

  private vectorDot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  private vectorLength(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  private vectorDistance(a: Vector3, b: Vector3): number {
    return this.vectorLength(this.vectorSubtract(a, b));
  }

  private vectorNormalize(v: Vector3): Vector3 {
    const length = this.vectorLength(v);
    return length > 0 ? this.vectorScale(v, 1 / length) : { x: 0, y: 0, z: 0 };
  }

  private quaternionAdd(a: Quaternion, b: Quaternion): Quaternion {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z, w: a.w + b.w };
  }

  private quaternionNormalize(q: Quaternion): Quaternion {
    const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    return length > 0 ? {
      x: q.x / length,
      y: q.y / length,
      z: q.z / length,
      w: q.w / length