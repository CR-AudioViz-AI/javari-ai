import { EventEmitter } from 'events';
import { WebGLRenderer } from '../rendering/WebGLRenderer';
import { SceneManager } from '../core/SceneManager';
import { SpatialAudio } from '../audio/SpatialAudio';
import { RealtimeSync } from '../networking/RealtimeSync';

/**
 * Vector3 utility class for 3D mathematics
 */
export class Vector3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(v: Vector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  subtract(v: Vector3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  multiply(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize(): Vector3 {
    const mag = this.magnitude();
    return mag > 0 ? new Vector3(this.x / mag, this.y / mag, this.z / mag) : new Vector3();
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
}

/**
 * Quaternion for rotations
 */
export class Quaternion {
  public x: number;
  public y: number;
  public z: number;
  public w: number;

  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  multiply(q: Quaternion): Quaternion {
    return new Quaternion(
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z
    );
  }

  normalize(): Quaternion {
    const mag = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    return mag > 0 ? new Quaternion(this.x / mag, this.y / mag, this.z / mag, this.w / mag) : new Quaternion();
  }

  rotateVector(v: Vector3): Vector3 {
    const qv = new Quaternion(v.x, v.y, v.z, 0);
    const qConj = new Quaternion(-this.x, -this.y, -this.z, this.w);
    const result = this.multiply(qv).multiply(qConj);
    return new Vector3(result.x, result.y, result.z);
  }
}

/**
 * Material properties for physics objects
 */
export interface MaterialProperties {
  density: number;
  friction: number;
  restitution: number;
  viscosity?: number;
  thermalConductivity?: number;
  soundVelocity?: number;
}

/**
 * Predefined material types
 */
export class PhysicsMaterials {
  static readonly STEEL: MaterialProperties = {
    density: 7850,
    friction: 0.8,
    restitution: 0.4,
    thermalConductivity: 50,
    soundVelocity: 5960
  };

  static readonly WOOD: MaterialProperties = {
    density: 600,
    friction: 0.6,
    restitution: 0.3,
    thermalConductivity: 0.2,
    soundVelocity: 4000
  };

  static readonly WATER: MaterialProperties = {
    density: 1000,
    friction: 0.1,
    restitution: 0.0,
    viscosity: 0.001,
    thermalConductivity: 0.6,
    soundVelocity: 1500
  };

  static readonly RUBBER: MaterialProperties = {
    density: 1200,
    friction: 0.9,
    restitution: 0.8,
    thermalConductivity: 0.2,
    soundVelocity: 1500
  };
}

/**
 * Collision shape types
 */
export enum CollisionShapeType {
  BOX = 'box',
  SPHERE = 'sphere',
  CYLINDER = 'cylinder',
  MESH = 'mesh',
  HEIGHTFIELD = 'heightfield'
}

/**
 * Collision shape definition
 */
export interface CollisionShape {
  type: CollisionShapeType;
  dimensions: Vector3;
  vertices?: Float32Array;
  indices?: Uint32Array;
}

/**
 * Rigid body physics object
 */
export class RigidBody {
  public id: string;
  public position: Vector3;
  public rotation: Quaternion;
  public velocity: Vector3;
  public angularVelocity: Vector3;
  public mass: number;
  public invMass: number;
  public inertia: Vector3;
  public invInertia: Vector3;
  public shape: CollisionShape;
  public material: MaterialProperties;
  public isStatic: boolean;
  public isSleeping: boolean;
  public sleepTimer: number;
  public boundingBox: { min: Vector3; max: Vector3 };
  public forces: Vector3;
  public torques: Vector3;
  private readonly sleepThreshold: number = 0.01;
  private readonly sleepTimeout: number = 2.0;

  constructor(
    id: string,
    shape: CollisionShape,
    material: MaterialProperties,
    mass: number = 1.0,
    isStatic: boolean = false
  ) {
    this.id = id;
    this.position = new Vector3();
    this.rotation = new Quaternion();
    this.velocity = new Vector3();
    this.angularVelocity = new Vector3();
    this.mass = isStatic ? 0 : mass;
    this.invMass = isStatic ? 0 : 1 / mass;
    this.shape = shape;
    this.material = material;
    this.isStatic = isStatic;
    this.isSleeping = false;
    this.sleepTimer = 0;
    this.forces = new Vector3();
    this.torques = new Vector3();

    this.calculateInertia();
    this.updateBoundingBox();
  }

  /**
   * Calculate moment of inertia based on shape and mass
   */
  private calculateInertia(): void {
    if (this.isStatic) {
      this.inertia = new Vector3();
      this.invInertia = new Vector3();
      return;
    }

    const { dimensions } = this.shape;
    let ix: number, iy: number, iz: number;

    switch (this.shape.type) {
      case CollisionShapeType.BOX:
        ix = (this.mass / 12) * (dimensions.y * dimensions.y + dimensions.z * dimensions.z);
        iy = (this.mass / 12) * (dimensions.x * dimensions.x + dimensions.z * dimensions.z);
        iz = (this.mass / 12) * (dimensions.x * dimensions.x + dimensions.y * dimensions.y);
        break;
      case CollisionShapeType.SPHERE:
        const r = dimensions.x; // radius
        ix = iy = iz = (2 / 5) * this.mass * r * r;
        break;
      case CollisionShapeType.CYLINDER:
        const radius = dimensions.x;
        const height = dimensions.y;
        ix = iz = (this.mass / 12) * (3 * radius * radius + height * height);
        iy = (this.mass / 2) * radius * radius;
        break;
      default:
        ix = iy = iz = this.mass; // Simple approximation
    }

    this.inertia = new Vector3(ix, iy, iz);
    this.invInertia = new Vector3(
      ix > 0 ? 1 / ix : 0,
      iy > 0 ? 1 / iy : 0,
      iz > 0 ? 1 / iz : 0
    );
  }

  /**
   * Update axis-aligned bounding box
   */
  updateBoundingBox(): void {
    const { dimensions } = this.shape;
    this.boundingBox = {
      min: this.position.subtract(dimensions.multiply(0.5)),
      max: this.position.add(dimensions.multiply(0.5))
    };
  }

  /**
   * Apply force at center of mass
   */
  applyForce(force: Vector3): void {
    if (this.isStatic) return;
    this.forces = this.forces.add(force);
    this.wakeUp();
  }

  /**
   * Apply force at specific point (generates torque)
   */
  applyForceAtPoint(force: Vector3, point: Vector3): void {
    if (this.isStatic) return;
    this.forces = this.forces.add(force);
    const r = point.subtract(this.position);
    const torque = r.cross(force);
    this.torques = this.torques.add(torque);
    this.wakeUp();
  }

  /**
   * Apply impulse (instantaneous force)
   */
  applyImpulse(impulse: Vector3): void {
    if (this.isStatic) return;
    this.velocity = this.velocity.add(impulse.multiply(this.invMass));
    this.wakeUp();
  }

  /**
   * Wake up from sleep
   */
  wakeUp(): void {
    this.isSleeping = false;
    this.sleepTimer = 0;
  }

  /**
   * Update sleep state
   */
  updateSleep(deltaTime: number): void {
    if (this.isStatic) return;

    const velocityMag = this.velocity.magnitude();
    const angularVelocityMag = this.angularVelocity.magnitude();

    if (velocityMag < this.sleepThreshold && angularVelocityMag < this.sleepThreshold) {
      this.sleepTimer += deltaTime;
      if (this.sleepTimer > this.sleepTimeout) {
        this.isSleeping = true;
        this.velocity = new Vector3();
        this.angularVelocity = new Vector3();
      }
    } else {
      this.sleepTimer = 0;
      this.isSleeping = false;
    }
  }

  /**
   * Integrate physics properties
   */
  integrate(deltaTime: number, gravity: Vector3): void {
    if (this.isStatic || this.isSleeping) return;

    // Apply gravity
    if (this.mass > 0) {
      this.forces = this.forces.add(gravity.multiply(this.mass));
    }

    // Update linear motion
    const acceleration = this.forces.multiply(this.invMass);
    this.velocity = this.velocity.add(acceleration.multiply(deltaTime));
    this.position = this.position.add(this.velocity.multiply(deltaTime));

    // Update angular motion
    const angularAcceleration = new Vector3(
      this.torques.x * this.invInertia.x,
      this.torques.y * this.invInertia.y,
      this.torques.z * this.invInertia.z
    );
    this.angularVelocity = this.angularVelocity.add(angularAcceleration.multiply(deltaTime));

    // Update rotation
    const deltaRotation = new Quaternion(
      this.angularVelocity.x * deltaTime * 0.5,
      this.angularVelocity.y * deltaTime * 0.5,
      this.angularVelocity.z * deltaTime * 0.5,
      0
    );
    this.rotation = this.rotation.add(this.rotation.multiply(deltaRotation)).normalize();

    // Apply damping
    this.velocity = this.velocity.multiply(0.999);
    this.angularVelocity = this.angularVelocity.multiply(0.999);

    // Clear forces
    this.forces = new Vector3();
    this.torques = new Vector3();

    // Update bounding box
    this.updateBoundingBox();
  }
}

/**
 * Collision contact information
 */
export interface CollisionContact {
  bodyA: RigidBody;
  bodyB: RigidBody;
  point: Vector3;
  normal: Vector3;
  penetration: number;
  impulse?: number;
}

/**
 * Spatial partitioning using octree for collision detection
 */
export class Octree {
  private bounds: { min: Vector3; max: Vector3 };
  private objects: RigidBody[];
  private children: Octree[];
  private maxObjects: number;
  private maxDepth: number;
  private depth: number;

  constructor(bounds: { min: Vector3; max: Vector3 }, maxObjects: number = 10, maxDepth: number = 5, depth: number = 0) {
    this.bounds = bounds;
    this.objects = [];
    this.children = [];
    this.maxObjects = maxObjects;
    this.maxDepth = maxDepth;
    this.depth = depth;
  }

  /**
   * Clear octree
   */
  clear(): void {
    this.objects = [];
    this.children = [];
  }

  /**
   * Split octree into 8 children
   */
  private split(): void {
    const { min, max } = this.bounds;
    const mid = new Vector3(
      (min.x + max.x) * 0.5,
      (min.y + max.y) * 0.5,
      (min.z + max.z) * 0.5
    );

    this.children = [
      new Octree({ min: new Vector3(min.x, min.y, min.z), max: new Vector3(mid.x, mid.y, mid.z) }, this.maxObjects, this.maxDepth, this.depth + 1),
      new Octree({ min: new Vector3(mid.x, min.y, min.z), max: new Vector3(max.x, mid.y, mid.z) }, this.maxObjects, this.maxDepth, this.depth + 1),
      new Octree({ min: new Vector3(min.x, mid.y, min.z), max: new Vector3(mid.x, max.y, mid.z) }, this.maxObjects, this.maxDepth, this.depth + 1),
      new Octree({ min: new Vector3(mid.x, mid.y, min.z), max: new Vector3(max.x, max.y, mid.z) }, this.maxObjects, this.maxDepth, this.depth + 1),
      new Octree({ min: new Vector3(min.x, min.y, mid.z), max: new Vector3(mid.x, mid.y, max.z) }, this.maxObjects, this.maxDepth, this.depth + 1),
      new Octree({ min: new Vector3(mid.x, min.y, mid.z), max: new Vector3(max.x, mid.y, max.z) }, this.maxObjects, this.maxDepth, this.depth + 1),
      new Octree({ min: new Vector3(min.x, mid.y, mid.z), max: new Vector3(mid.x, max.y, max.z) }, this.maxObjects, this.maxDepth, this.depth + 1),
      new Octree({ min: new Vector3(mid.x, mid.y, mid.z), max: new Vector3(max.x, max.y, max.z) }, this.maxObjects, this.maxDepth, this.depth + 1)
    ];
  }

  /**
   * Get octree index for object
   */
  private getIndex(object: RigidBody): number {
    const { min, max } = this.bounds;
    const mid = new Vector3(
      (min.x + max.x) * 0.5,
      (min.y + max.y) * 0.5,
      (min.z + max.z) * 0.5
    );

    const { min: objMin, max: objMax } = object.boundingBox;
    
    let index = -1;
    const topQuadrant = objMin.y > mid.y;
    const bottomQuadrant = objMax.y < mid.y;
    const rightQuadrant = objMin.x > mid.x;
    const leftQuadrant = objMax.x < mid.x;
    const frontQuadrant = objMin.z > mid.z;
    const backQuadrant = objMax.z < mid.z;

    if (leftQuadrant) {
      if (topQuadrant) {
        if (backQuadrant) index = 2;
        else if (frontQuadrant) index = 6;
      } else if (bottomQuadrant) {
        if (backQuadrant) index = 0;
        else if (frontQuadrant) index = 4;
      }
    } else if (rightQuadrant) {
      if (topQuadrant) {
        if (backQuadrant) index = 3;
        else if (frontQuadrant) index = 7;
      } else if (bottomQuadrant) {
        if (backQuadrant) index = 1;
        else if (frontQuadrant) index = 5;
      }
    }

    return index;
  }

  /**
   * Insert object into octree
   */
  insert(object: RigidBody): void {
    if (this.children.length > 0) {
      const index = this.getIndex(object);
      if (index >= 0) {
        this.children[index].insert(object);
        return;
      }
    }

    this.objects.push(object);

    if (this.objects.length > this.maxObjects && this.depth < this.maxDepth && this.children.length === 0) {
      this.split();

      let i = 0;
      while (i < this.objects.length) {
        const index = this.getIndex(this.objects[i]);
        if (index >= 0) {
          const obj = this.objects.splice(i, 1)[0];
          this.children[index].insert(obj);
        } else {
          i++;
        }
      }
    }
  }

  /**
   * Retrieve potential collision candidates
   */
  retrieve(object: RigidBody): RigidBody[] {
    const candidates: RigidBody[] = [...this.objects];

    if (this.children.length > 0) {
      const index = this.getIndex(object);
      if (index >= 0) {
        candidates.push(...this.children[index].retrieve(object));
      } else {
        // Object spans multiple quadrants, check all children
        for (const child of this.children) {
          candidates.push(...child.retrieve(object));
        }
      }
    }

    return candidates;
  }
}

/**
 * Collision detection system
 */
export class CollisionDetection {
  private octree: Octree;
  private worldBounds: { min: Vector3; max: Vector3 };

  constructor(worldBounds: { min: Vector3; max: Vector3 }) {
    this.worldBounds = worldBounds;
    this.octree = new Octree(worldBounds);
  }

  /**
   * Detect collisions between all objects
   */
  detectCollisions(objects: RigidBody[]): CollisionContact[] {
    const contacts: CollisionContact[] = [];
    
    // Clear and rebuild octree
    this.octree.clear();
    for (const obj of objects) {
      this.octree.insert(obj);
    }

    // Check for collisions
    for (const obj of objects) {
      const candidates = this.octree.retrieve(obj);
      for (const candidate of candidates) {
        if (obj.id !== candidate.id && this.shouldCheckCollision(obj, candidate)) {
          const contact = this.checkCollision(obj, candidate);
          if (contact) {
            contacts.push(contact);
          }
        }
      }
    }

    return contacts;
  }

  /**
   * Check if two objects should be tested for collision
   */
  private shouldCheckCollision(objA: RigidBody, objB: RigidBody): boolean {
    if (objA.isStatic && objB.isStatic) return false;
    if (objA.isSleeping && objB.isSleeping) return false;
    return this.aabbIntersection(objA.boundingBox, objB.boundingBox);
  }

  /**
   * AABB intersection test
   */
  private aabbIntersection(boxA: { min: Vector3; max: Vector3 }, boxB: { min: Vector3; max: Vector3 }): boolean {
    return (
      boxA.min.x <= boxB.max.x && boxA.max.x >= boxB.min.x &&
      boxA.min.y <= boxB.max.y && boxA.max.y >= boxB.min.y &&
      boxA.min.z <= boxB.max.z && boxA.max.z >= boxB.min.z
    );
  }

  /**
   * Check collision between two objects
   */
  private checkCollision(objA: RigidBody, objB: RigidBody): CollisionContact | null {
    if (objA.shape.type === CollisionShapeType.SPHERE && objB.shape.type === CollisionShapeType.SPHERE) {
      return this.sphereSphereCollision(objA, objB);
    } else if (objA.shape.type === CollisionShapeType.BOX && objB.shape.type === CollisionShapeType.BOX) {
      return this.boxBoxCollision(objA, objB);
    } else if ((objA.shape.type === CollisionShapeType.SPHERE