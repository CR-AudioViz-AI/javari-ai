import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { createClient } from '@supabase/supabase-js';

/**
 * WebGL compute shader for Navier-Stokes fluid simulation
 */
const FLUID_COMPUTE_SHADER = `#version 300 es
layout(local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

uniform float uTime;
uniform float uDeltaTime;
uniform float uViscosity;
uniform float uPressure;
uniform vec2 uResolution;
uniform vec2 uForceCenter;
uniform float uForceStrength;
uniform float uAudioAmplitude;

layout(rgba32f, binding = 0) uniform image2D velocityField;
layout(rgba32f, binding = 1) uniform image2D pressureField;
layout(rgba32f, binding = 2) uniform image2D divergenceField;

void main() {
    ivec2 coord = ivec2(gl_GlobalInvocationID.xy);
    if(coord.x >= int(uResolution.x) || coord.y >= int(uResolution.y)) return;
    
    vec2 texCoord = vec2(coord) / uResolution;
    vec4 velocity = imageLoad(velocityField, coord);
    vec4 pressure = imageLoad(pressureField, coord);
    
    // Apply audio-reactive parameters
    float audioViscosity = uViscosity * (1.0 + uAudioAmplitude * 0.5);
    
    // Navier-Stokes velocity update
    vec2 newVelocity = velocity.xy;
    
    // Add external forces
    float dist = distance(texCoord, uForceCenter);
    if(dist < 0.1) {
        vec2 forceDir = normalize(texCoord - uForceCenter);
        newVelocity += forceDir * uForceStrength * uDeltaTime;
    }
    
    // Viscosity damping
    newVelocity *= (1.0 - audioViscosity * uDeltaTime);
    
    imageStore(velocityField, coord, vec4(newVelocity, 0.0, 1.0));
}`;

/**
 * Particle system compute shader for GPU-accelerated fluid particles
 */
const PARTICLE_COMPUTE_SHADER = `#version 300 es
layout(local_size_x = 64, local_size_y = 1, local_size_z = 1) in;

uniform float uTime;
uniform float uDeltaTime;
uniform vec2 uResolution;
uniform sampler2D uVelocityField;
uniform float uAudioAmplitude;

layout(std430, binding = 0) buffer ParticleBuffer {
    vec4 particles[];
};

void main() {
    uint index = gl_GlobalInvocationID.x;
    if(index >= particles.length()) return;
    
    vec4 particle = particles[index];
    vec2 position = particle.xy;
    vec2 velocity = particle.zw;
    
    // Sample velocity field
    vec2 fieldVelocity = texture(uVelocityField, position / uResolution).xy;
    
    // Update particle velocity with field influence
    velocity += fieldVelocity * uDeltaTime * 0.5;
    
    // Audio-reactive movement
    velocity += sin(uTime + position.x * 10.0) * uAudioAmplitude * 0.1;
    
    // Update position
    position += velocity * uDeltaTime;
    
    // Boundary conditions
    if(position.x < 0.0 || position.x > uResolution.x) velocity.x *= -0.8;
    if(position.y < 0.0 || position.y > uResolution.y) velocity.y *= -0.8;
    
    position = clamp(position, vec2(0.0), uResolution);
    
    particles[index] = vec4(position, velocity);
}`;

/**
 * Fragment shader for fluid visualization
 */
const FLUID_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uVelocityField;
uniform sampler2D uPressureField;
uniform float uTime;
uniform float uAudioAmplitude;
uniform vec3 uColorPalette[5];

void main() {
    vec2 velocity = texture(uVelocityField, vUv).xy;
    float pressure = texture(uPressureField, vUv).r;
    
    float speed = length(velocity);
    float colorIndex = speed * 4.0;
    
    // Audio-reactive color modulation
    float audioMod = sin(uTime * 2.0 + speed * 10.0) * uAudioAmplitude;
    colorIndex += audioMod * 2.0;
    
    int index = int(colorIndex) % 5;
    vec3 color = uColorPalette[index];
    
    // Add pressure visualization
    color += vec3(pressure * 0.2);
    
    fragColor = vec4(color, 0.8 + speed * 0.2);
}`;

/**
 * Configuration interface for fluid dynamics parameters
 */
interface FluidDynamicsConfig {
  resolution: { width: number; height: number };
  particleCount: number;
  viscosity: number;
  pressure: number;
  audioReactive: boolean;
  colorPalette: string[];
  enableWaves: boolean;
  waveSpeed: number;
  interactionStrength: number;
}

/**
 * Fluid simulation state interface
 */
interface FluidState {
  time: number;
  deltaTime: number;
  mousePosition: THREE.Vector2;
  audioAmplitude: number;
  isInteracting: boolean;
  performance: {
    fps: number;
    computeTime: number;
    renderTime: number;
  };
}

/**
 * Props interface for FluidDynamicsEngine component
 */
interface FluidDynamicsEngineProps {
  config?: Partial<FluidDynamicsConfig>;
  audioData?: Float32Array;
  onStateChange?: (state: FluidState) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * GPU-accelerated particle system for fluid simulation
 */
class ParticleSystem {
  private gl: WebGL2RenderingContext;
  private computeShader: WebGLShader | null = null;
  private program: WebGLProgram | null = null;
  private particleBuffer: WebGLBuffer | null = null;
  private particleCount: number;

  constructor(gl: WebGL2RenderingContext, particleCount: number) {
    this.gl = gl;
    this.particleCount = particleCount;
    this.initializeShaders();
    this.initializeBuffers();
  }

  /**
   * Initialize compute shaders for particle system
   */
  private initializeShaders(): void {
    const { gl } = this;
    
    this.computeShader = gl.createShader(gl.COMPUTE_SHADER);
    if (!this.computeShader) throw new Error('Failed to create compute shader');
    
    gl.shaderSource(this.computeShader, PARTICLE_COMPUTE_SHADER);
    gl.compileShader(this.computeShader);
    
    if (!gl.getShaderParameter(this.computeShader, gl.COMPILE_STATUS)) {
      throw new Error(`Compute shader compilation error: ${gl.getShaderInfoLog(this.computeShader)}`);
    }
    
    this.program = gl.createProgram();
    if (!this.program) throw new Error('Failed to create program');
    
    gl.attachShader(this.program, this.computeShader);
    gl.linkProgram(this.program);
    
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(`Program linking error: ${gl.getProgramInfoLog(this.program)}`);
    }
  }

  /**
   * Initialize particle buffers with random initial positions
   */
  private initializeBuffers(): void {
    const { gl, particleCount } = this;
    
    const particleData = new Float32Array(particleCount * 4);
    for (let i = 0; i < particleCount; i++) {
      const offset = i * 4;
      particleData[offset] = Math.random() * 512; // x position
      particleData[offset + 1] = Math.random() * 512; // y position
      particleData[offset + 2] = (Math.random() - 0.5) * 10; // x velocity
      particleData[offset + 3] = (Math.random() - 0.5) * 10; // y velocity
    }
    
    this.particleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this.particleBuffer);
    gl.bufferData(gl.SHADER_STORAGE_BUFFER, particleData, gl.DYNAMIC_DRAW);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this.particleBuffer);
  }

  /**
   * Update particles using compute shader
   */
  public update(time: number, deltaTime: number, velocityTexture: WebGLTexture, audioAmplitude: number): void {
    const { gl, program, particleCount } = this;
    if (!program) return;
    
    gl.useProgram(program);
    
    // Set uniforms
    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
    gl.uniform1f(gl.getUniformLocation(program, 'uDeltaTime'), deltaTime);
    gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), 512, 512);
    gl.uniform1f(gl.getUniformLocation(program, 'uAudioAmplitude'), audioAmplitude);
    
    // Bind velocity texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityTexture);
    gl.uniform1i(gl.getUniformLocation(program, 'uVelocityField'), 0);
    
    // Dispatch compute shader
    const workGroupSize = 64;
    const numWorkGroups = Math.ceil(particleCount / workGroupSize);
    gl.dispatchCompute(numWorkGroups, 1, 1);
    gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);
  }

  /**
   * Get particle buffer for rendering
   */
  public getParticleBuffer(): WebGLBuffer | null {
    return this.particleBuffer;
  }

  /**
   * Clean up GPU resources
   */
  public dispose(): void {
    const { gl } = this;
    if (this.particleBuffer) gl.deleteBuffer(this.particleBuffer);
    if (this.computeShader) gl.deleteShader(this.computeShader);
    if (this.program) gl.deleteProgram(this.program);
  }
}

/**
 * Wave propagation system for fluid surface effects
 */
class WavePropagator {
  private waveEquations: Float32Array;
  private resolution: number;
  private waveSpeed: number;
  private dampening: number;

  constructor(resolution: number, waveSpeed: number = 1.0) {
    this.resolution = resolution;
    this.waveSpeed = waveSpeed;
    this.dampening = 0.99;
    this.waveEquations = new Float32Array(resolution * resolution * 3); // height, velocity, previous
  }

  /**
   * Update wave propagation using finite difference method
   */
  public update(deltaTime: number, audioAmplitude: number): void {
    const { waveEquations, resolution, waveSpeed, dampening } = this;
    const dt2 = deltaTime * deltaTime;
    const c2 = waveSpeed * waveSpeed;
    
    for (let y = 1; y < resolution - 1; y++) {
      for (let x = 1; x < resolution - 1; x++) {
        const index = (y * resolution + x) * 3;
        
        // Current height and velocity
        const h = waveEquations[index];
        const v = waveEquations[index + 1];
        const prev = waveEquations[index + 2];
        
        // Neighboring heights for Laplacian
        const hLeft = waveEquations[((y * resolution + x - 1) * 3)];
        const hRight = waveEquations[((y * resolution + x + 1) * 3)];
        const hUp = waveEquations[(((y - 1) * resolution + x) * 3)];
        const hDown = waveEquations[(((y + 1) * resolution + x) * 3)];
        
        // Wave equation: ∂²h/∂t² = c²∇²h
        const laplacian = hLeft + hRight + hUp + hDown - 4 * h;
        const newH = 2 * h - prev + c2 * dt2 * laplacian;
        
        // Audio-reactive wave generation
        if (Math.random() < audioAmplitude * 0.01) {
          waveEquations[index] = newH * dampening + audioAmplitude * 0.5;
        } else {
          waveEquations[index] = newH * dampening;
        }
        
        waveEquations[index + 1] = (newH - h) / deltaTime; // Update velocity
        waveEquations[index + 2] = h; // Store previous height
      }
    }
  }

  /**
   * Get wave height at specific coordinates
   */
  public getWaveHeight(x: number, y: number): number {
    const xi = Math.floor(x * this.resolution);
    const yi = Math.floor(y * this.resolution);
    const index = (yi * this.resolution + xi) * 3;
    return this.waveEquations[index] || 0;
  }

  /**
   * Add wave disturbance at position
   */
  public addDisturbance(x: number, y: number, strength: number): void {
    const xi = Math.floor(x * this.resolution);
    const yi = Math.floor(y * this.resolution);
    const radius = 5;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = xi + dx;
        const ny = yi + dy;
        
        if (nx >= 0 && nx < this.resolution && ny >= 0 && ny < this.resolution) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const falloff = 1 - distance / radius;
            const index = (ny * this.resolution + nx) * 3;
            this.waveEquations[index] += strength * falloff;
          }
        }
      }
    }
  }
}

/**
 * WebGL2 fluid renderer with advanced visual effects
 */
class FluidRenderer {
  private gl: WebGL2RenderingContext;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private fluidMaterial: THREE.ShaderMaterial;
  private fluidGeometry: THREE.PlaneGeometry;
  private fluidMesh: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement, config: FluidDynamicsConfig) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(config.resolution.width, config.resolution.height);
    this.gl = this.renderer.getContext() as WebGL2RenderingContext;
    
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.z = 1;
    
    this.initializeFluidMaterial(config);
    this.setupScene();
  }

  /**
   * Initialize fluid visualization material
   */
  private initializeFluidMaterial(config: FluidDynamicsConfig): void {
    const colorPalette = config.colorPalette.map(color => new THREE.Color(color));
    
    this.fluidMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: FLUID_FRAGMENT_SHADER,
      uniforms: {
        uVelocityField: { value: null },
        uPressureField: { value: null },
        uTime: { value: 0.0 },
        uAudioAmplitude: { value: 0.0 },
        uColorPalette: { value: colorPalette }
      },
      transparent: true,
      blending: THREE.AdditiveBlending
    });
  }

  /**
   * Setup Three.js scene with fluid mesh
   */
  private setupScene(): void {
    this.fluidGeometry = new THREE.PlaneGeometry(2, 2);
    this.fluidMesh = new THREE.Mesh(this.fluidGeometry, this.fluidMaterial);
    this.scene.add(this.fluidMesh);
  }

  /**
   * Render fluid simulation frame
   */
  public render(velocityTexture: WebGLTexture, pressureTexture: WebGLTexture, time: number, audioAmplitude: number): void {
    // Update shader uniforms
    this.fluidMaterial.uniforms.uVelocityField.value = new THREE.Texture();
    this.fluidMaterial.uniforms.uVelocityField.value.image = { data: null, width: 512, height: 512 };
    this.fluidMaterial.uniforms.uTime.value = time;
    this.fluidMaterial.uniforms.uAudioAmplitude.value = audioAmplitude;
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Resize renderer
   */
  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.fluidGeometry.dispose();
    this.fluidMaterial.dispose();
    this.renderer.dispose();
  }
}

/**
 * Navier-Stokes physics solver for realistic fluid simulation
 */
class FluidPhysics {
  private gl: WebGL2RenderingContext;
  private computeProgram: WebGLProgram | null = null;
  private velocityTextures: WebGLTexture[] = [];
  private pressureTextures: WebGLTexture[] = [];
  private divergenceTexture: WebGLTexture | null = null;
  private framebuffers: WebGLFramebuffer[] = [];
  private resolution: { width: number; height: number };

  constructor(gl: WebGL2RenderingContext, resolution: { width: number; height: number }) {
    this.gl = gl;
    this.resolution = resolution;
    this.initializeShaders();
    this.initializeTextures();
  }

  /**
   * Initialize compute shaders for fluid physics
   */
  private initializeShaders(): void {
    const { gl } = this;
    
    const computeShader = gl.createShader(gl.COMPUTE_SHADER);
    if (!computeShader) throw new Error('Failed to create compute shader');
    
    gl.shaderSource(computeShader, FLUID_COMPUTE_SHADER);
    gl.compileShader(computeShader);
    
    if (!gl.getShaderParameter(computeShader, gl.COMPILE_STATUS)) {
      throw new Error(`Compute shader error: ${gl.getShaderInfoLog(computeShader)}`);
    }
    
    this.computeProgram = gl.createProgram();
    if (!this.computeProgram) throw new Error('Failed to create program');
    
    gl.attachShader(this.computeProgram, computeShader);
    gl.linkProgram(this.computeProgram);
    
    if (!gl.getProgramParameter(this.computeProgram, gl.LINK_STATUS)) {
      throw new Error(`Program linking error: ${gl.getProgramInfoLog(this.computeProgram)}`);
    }
  }

  /**
   * Initialize textures for fluid fields
   */
  private initializeTextures(): void {
    const { gl, resolution } = this;
    
    // Create double-buffered velocity textures
    for (let i = 0; i < 2; i++) {
      const velocityTexture = gl.createTexture();
      if (!velocityTexture) throw new Error('Failed to create velocity texture');
      
      gl.bindTexture(gl.TEXTURE_2D, velocityTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, resolution.width, resolution.height, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      
      this.velocityTextures.push(velocityTexture);
    }
    
    // Create pressure textures
    for (let i = 0; i < 2; i++) {
      const pressureTexture = gl.createTexture();
      if (!pressureTexture) throw new Error('Failed to create pressure texture');
      
      gl.bindTexture(gl.TEXTURE_2D, pressureTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, resolution.width, resolution.height, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      
      this.pressureTextures.push(pressureTexture);
    }
    
    // Create divergence texture
    this.divergenceTexture = gl.createTexture();
    if (!this.divergenceTexture) throw new Error('Failed to create divergence texture');
    
    gl.bindTexture(gl.TEXTURE_2D, this.divergenceTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, resolution.width, resolution.height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2