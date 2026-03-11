import { vec3, mat4 } from 'gl-matrix';
import { EventEmitter } from 'events';

/**
 * Represents a gravitational body in the simulation
 */
export interface GravitationalBody {
  id: string;
  name: string;
  position: Float32Array; // [x, y, z]
  velocity: Float32Array; // [vx, vy, vz]
  acceleration: Float32Array; // [ax, ay, az]
  mass: number;
  radius: number;
  type: 'planet' | 'star' | 'asteroid' | 'moon';
  fixed: boolean; // Whether the body is immovable
}

/**
 * Configuration for gravity simulation
 */
export interface GravityConfig {
  gravitationalConstant: number;
  timeStep: number;
  maxBodies: number;
  dampingFactor: number;
  collisionEnabled: boolean;
  visualizationEnabled: boolean;
  softening: number; // Prevents singularities at close distances
}

/**
 * Orbital parameters for Kepler mechanics
 */
export interface OrbitParameters {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  longitudeOfAscendingNode: number;
  argumentOfPeriapsis: number;
  meanAnomalyAtEpoch: number;
  epoch: number;
}

/**
 * WebGL-accelerated gravity simulation engine for CRAIverse
 */
export class GravityEngine extends EventEmitter {
  private gl: WebGL2RenderingContext;
  private computeProgram: WebGLProgram | null = null;
  private visualizationProgram: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private velocityBuffer: WebGLBuffer | null = null;
  private massBuffer: WebGLBuffer | null = null;
  private forceBuffer: WebGLBuffer | null = null;
  private bodies: Map<string, GravitationalBody> = new Map();
  private config: GravityConfig;
  private isRunning: boolean = false;
  private animationFrame: number | null = null;
  private timeAccumulator: number = 0;
  private orbitCalculator: OrbitCalculator;

  constructor(gl: WebGL2RenderingContext, config: Partial<GravityConfig> = {}) {
    super();
    this.gl = gl;
    this.config = {
      gravitationalConstant: 6.67430e-11,
      timeStep: 1.0 / 60.0,
      maxBodies: 1024,
      dampingFactor: 0.999,
      collisionEnabled: true,
      visualizationEnabled: true,
      softening: 0.1,
      ...config
    };
    this.orbitCalculator = new OrbitCalculator();
    this.initializeWebGL();
  }

  /**
   * Initialize WebGL resources and shaders
   */
  private initializeWebGL(): void {
    try {
      this.createBuffers();
      this.createComputeShaders();
      this.createVisualizationShaders();
      this.emit('initialized');
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize WebGL: ${error}`));
    }
  }

  /**
   * Create GPU buffers for physics data
   */
  private createBuffers(): void {
    const maxBodies = this.config.maxBodies;

    // Position buffer (vec3 per body)
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, maxBodies * 3 * 4, this.gl.DYNAMIC_DRAW);

    // Velocity buffer (vec3 per body)
    this.velocityBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.velocityBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, maxBodies * 3 * 4, this.gl.DYNAMIC_DRAW);

    // Mass buffer (float per body)
    this.massBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.massBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, maxBodies * 4, this.gl.DYNAMIC_DRAW);

    // Force buffer (vec3 per body)
    this.forceBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.forceBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, maxBodies * 3 * 4, this.gl.DYNAMIC_DRAW);
  }

  /**
   * Create compute shaders for gravity calculations
   */
  private createComputeShaders(): void {
    const computeVertexShader = this.compileShader(`#version 300 es
      precision highp float;
      
      layout(location = 0) in vec3 a_position;
      
      void main() {
        gl_Position = vec4(a_position, 1.0);
      }
    `, this.gl.VERTEX_SHADER);

    const computeFragmentShader = this.compileShader(`#version 300 es
      precision highp float;
      
      uniform sampler2D u_positions;
      uniform sampler2D u_masses;
      uniform float u_gravitationalConstant;
      uniform float u_softening;
      uniform int u_numBodies;
      uniform int u_currentBody;
      
      out vec4 o_force;
      
      void main() {
        vec3 totalForce = vec3(0.0);
        vec3 currentPos = texelFetch(u_positions, ivec2(u_currentBody, 0), 0).xyz;
        
        for (int i = 0; i < u_numBodies; i++) {
          if (i == u_currentBody) continue;
          
          vec3 otherPos = texelFetch(u_positions, ivec2(i, 0), 0).xyz;
          float otherMass = texelFetch(u_masses, ivec2(i, 0), 0).x;
          
          vec3 r = otherPos - currentPos;
          float distance = length(r);
          float softDistance = distance + u_softening;
          
          if (distance > 0.001) {
            vec3 forceDir = normalize(r);
            float forceMagnitude = u_gravitationalConstant * otherMass / (softDistance * softDistance);
            totalForce += forceDir * forceMagnitude;
          }
        }
        
        o_force = vec4(totalForce, 1.0);
      }
    `, this.gl.FRAGMENT_SHADER);

    this.computeProgram = this.createProgram(computeVertexShader, computeFragmentShader);
  }

  /**
   * Create visualization shaders for gravity field rendering
   */
  private createVisualizationShaders(): void {
    const visualVertexShader = this.compileShader(`#version 300 es
      precision highp float;
      
      layout(location = 0) in vec3 a_position;
      
      uniform mat4 u_viewMatrix;
      uniform mat4 u_projectionMatrix;
      
      out vec3 v_worldPos;
      
      void main() {
        v_worldPos = a_position;
        gl_Position = u_projectionMatrix * u_viewMatrix * vec4(a_position, 1.0);
      }
    `, this.gl.VERTEX_SHADER);

    const visualFragmentShader = this.compileShader(`#version 300 es
      precision highp float;
      
      in vec3 v_worldPos;
      
      uniform sampler2D u_positions;
      uniform sampler2D u_masses;
      uniform float u_gravitationalConstant;
      uniform int u_numBodies;
      uniform float u_fieldStrength;
      
      out vec4 fragColor;
      
      vec3 calculateGravityField(vec3 position) {
        vec3 totalField = vec3(0.0);
        
        for (int i = 0; i < u_numBodies; i++) {
          vec3 bodyPos = texelFetch(u_positions, ivec2(i, 0), 0).xyz;
          float bodyMass = texelFetch(u_masses, ivec2(i, 0), 0).x;
          
          vec3 r = position - bodyPos;
          float distance = length(r);
          
          if (distance > 0.1) {
            vec3 fieldDir = normalize(r);
            float fieldMagnitude = u_gravitationalConstant * bodyMass / (distance * distance);
            totalField += fieldDir * fieldMagnitude;
          }
        }
        
        return totalField;
      }
      
      void main() {
        vec3 field = calculateGravityField(v_worldPos);
        float fieldMagnitude = length(field);
        
        vec3 color = vec3(0.2, 0.4, 0.8) * min(fieldMagnitude * u_fieldStrength, 1.0);
        float alpha = min(fieldMagnitude * u_fieldStrength * 0.5, 0.8);
        
        fragColor = vec4(color, alpha);
      }
    `, this.gl.FRAGMENT_SHADER);

    this.visualizationProgram = this.createProgram(visualVertexShader, visualFragmentShader);
  }

  /**
   * Add a gravitational body to the simulation
   */
  addBody(body: GravitationalBody): void {
    if (this.bodies.size >= this.config.maxBodies) {
      throw new Error('Maximum number of bodies exceeded');
    }

    this.bodies.set(body.id, { ...body });
    this.updateGPUBuffers();
    this.emit('bodyAdded', body);
  }

  /**
   * Remove a gravitational body from the simulation
   */
  removeBody(bodyId: string): boolean {
    const removed = this.bodies.delete(bodyId);
    if (removed) {
      this.updateGPUBuffers();
      this.emit('bodyRemoved', bodyId);
    }
    return removed;
  }

  /**
   * Update GPU buffers with current body data
   */
  private updateGPUBuffers(): void {
    const bodies = Array.from(this.bodies.values());
    const numBodies = bodies.length;

    const positions = new Float32Array(numBodies * 3);
    const velocities = new Float32Array(numBodies * 3);
    const masses = new Float32Array(numBodies);

    bodies.forEach((body, index) => {
      positions.set(body.position, index * 3);
      velocities.set(body.velocity, index * 3);
      masses[index] = body.mass;
    });

    // Update position buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, positions);

    // Update velocity buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.velocityBuffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, velocities);

    // Update mass buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.massBuffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, masses);
  }

  /**
   * Start the gravity simulation
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.timeAccumulator = 0;
    this.tick();
    this.emit('started');
  }

  /**
   * Stop the gravity simulation
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.emit('stopped');
  }

  /**
   * Main simulation tick
   */
  private tick = (): void => {
    if (!this.isRunning) return;

    const deltaTime = this.config.timeStep;
    this.timeAccumulator += deltaTime;

    // Fixed timestep physics integration
    while (this.timeAccumulator >= deltaTime) {
      this.calculateForces();
      this.integrateMotion(deltaTime);
      this.handleCollisions();
      this.timeAccumulator -= deltaTime;
    }

    this.emit('tick', { deltaTime, bodies: Array.from(this.bodies.values()) });
    this.animationFrame = requestAnimationFrame(this.tick);
  };

  /**
   * Calculate gravitational forces using GPU compute
   */
  private calculateForces(): void {
    if (!this.computeProgram) return;

    const bodies = Array.from(this.bodies.values());
    const numBodies = bodies.length;

    this.gl.useProgram(this.computeProgram);
    
    // Set uniforms
    this.gl.uniform1f(this.gl.getUniformLocation(this.computeProgram, 'u_gravitationalConstant'), 
                      this.config.gravitationalConstant);
    this.gl.uniform1f(this.gl.getUniformLocation(this.computeProgram, 'u_softening'), 
                      this.config.softening);
    this.gl.uniform1i(this.gl.getUniformLocation(this.computeProgram, 'u_numBodies'), numBodies);

    // Calculate forces for each body
    bodies.forEach((body, index) => {
      if (body.fixed) return;

      this.gl.uniform1i(this.gl.getUniformLocation(this.computeProgram, 'u_currentBody'), index);
      
      // Render to force texture (simplified - would use framebuffer in full implementation)
      const force = this.computeGravitationalForce(body, bodies);
      body.acceleration[0] = force[0] / body.mass;
      body.acceleration[1] = force[1] / body.mass;
      body.acceleration[2] = force[2] / body.mass;
    });
  }

  /**
   * Compute gravitational force for a single body (CPU fallback)
   */
  private computeGravitationalForce(body: GravitationalBody, allBodies: GravitationalBody[]): Float32Array {
    const force = new Float32Array(3);
    const bodyPos = vec3.fromValues(body.position[0], body.position[1], body.position[2]);

    allBodies.forEach(otherBody => {
      if (otherBody.id === body.id) return;

      const otherPos = vec3.fromValues(otherBody.position[0], otherBody.position[1], otherBody.position[2]);
      const r = vec3.create();
      vec3.subtract(r, otherPos, bodyPos);

      const distance = vec3.length(r);
      const softDistance = distance + this.config.softening;

      if (distance > 0.001) {
        vec3.normalize(r, r);
        const forceMagnitude = this.config.gravitationalConstant * body.mass * otherBody.mass / 
                              (softDistance * softDistance);
        
        force[0] += r[0] * forceMagnitude;
        force[1] += r[1] * forceMagnitude;
        force[2] += r[2] * forceMagnitude;
      }
    });

    return force;
  }

  /**
   * Integrate motion using Verlet integration
   */
  private integrateMotion(deltaTime: number): void {
    this.bodies.forEach(body => {
      if (body.fixed) return;

      // Verlet integration
      const dt2 = deltaTime * deltaTime;

      // Update position: x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
      body.position[0] += body.velocity[0] * deltaTime + 0.5 * body.acceleration[0] * dt2;
      body.position[1] += body.velocity[1] * deltaTime + 0.5 * body.acceleration[1] * dt2;
      body.position[2] += body.velocity[2] * deltaTime + 0.5 * body.acceleration[2] * dt2;

      // Update velocity: v(t+dt) = v(t) + a(t)*dt
      body.velocity[0] = (body.velocity[0] + body.acceleration[0] * deltaTime) * this.config.dampingFactor;
      body.velocity[1] = (body.velocity[1] + body.acceleration[1] * deltaTime) * this.config.dampingFactor;
      body.velocity[2] = (body.velocity[2] + body.acceleration[2] * deltaTime) * this.config.dampingFactor;
    });

    this.updateGPUBuffers();
  }

  /**
   * Handle collisions between bodies
   */
  private handleCollisions(): void {
    if (!this.config.collisionEnabled) return;

    const bodies = Array.from(this.bodies.values());
    
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];

        const dx = bodyA.position[0] - bodyB.position[0];
        const dy = bodyA.position[1] - bodyB.position[1];
        const dz = bodyA.position[2] - bodyB.position[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < bodyA.radius + bodyB.radius) {
          this.handleCollision(bodyA, bodyB);
        }
      }
    }
  }

  /**
   * Handle collision between two bodies
   */
  private handleCollision(bodyA: GravitationalBody, bodyB: GravitationalBody): void {
    // Simple elastic collision response
    const totalMass = bodyA.mass + bodyB.mass;
    const massRatio1 = bodyB.mass / totalMass;
    const massRatio2 = bodyA.mass / totalMass;

    const newVelA = [
      bodyA.velocity[0] * massRatio1 + bodyB.velocity[0] * massRatio2,
      bodyA.velocity[1] * massRatio1 + bodyB.velocity[1] * massRatio2,
      bodyA.velocity[2] * massRatio1 + bodyB.velocity[2] * massRatio2
    ];

    const newVelB = [
      bodyB.velocity[0] * massRatio1 + bodyA.velocity[0] * massRatio2,
      bodyB.velocity[1] * massRatio1 + bodyA.velocity[1] * massRatio2,
      bodyB.velocity[2] * massRatio1 + bodyA.velocity[2] * massRatio2
    ];

    bodyA.velocity.set(newVelA);
    bodyB.velocity.set(newVelB);

    this.emit('collision', { bodyA, bodyB });
  }

  /**
   * Get current simulation state
   */
  getSimulationState(): {
    bodies: GravitationalBody[];
    config: GravityConfig;
    isRunning: boolean;
    totalEnergy: number;
  } {
    return {
      bodies: Array.from(this.bodies.values()),
      config: { ...this.config },
      isRunning: this.isRunning,
      totalEnergy: this.calculateTotalEnergy()
    };
  }

  /**
   * Calculate total energy of the system
   */
  private calculateTotalEnergy(): number {
    let kineticEnergy = 0;
    let potentialEnergy = 0;

    const bodies = Array.from(this.bodies.values());

    // Kinetic energy
    bodies.forEach(body => {
      const v2 = body.velocity[0] ** 2 + body.velocity[1] ** 2 + body.velocity[2] ** 2;
      kineticEnergy += 0.5 * body.mass * v2;
    });

    // Potential energy
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];
        
        const dx = bodyA.position[0] - bodyB.position[0];
        const dy = bodyA.position[1] - bodyB.position[1];
        const dz = bodyA.position[2] - bodyB.position[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance > 0.001) {
          potentialEnergy -= this.config.gravitationalConstant * bodyA.mass * bodyB.mass / distance;
        }
      }
    }

    return kineticEnergy + potentialEnergy;
  }

  /**
   * Update simulation configuration
   */
  updateConfig(newConfig: Partial<GravityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Compile WebGL shader
   */
  private compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${error}`);
    }

    return shader;
  }

  /**
   * Create WebGL program from shaders
   */
  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram();
    if (!program) throw new Error('Failed to create program');

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Program linking failed: ${error}`);
    }

    return program;
  }

  /**
   * Dispose of WebGL resources
   */
  dispose(): void {
    this.stop();

    if (this.positionBuffer)