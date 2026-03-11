```typescript
/**
 * CRAIverse 3D Spatial Audio Engine
 * 
 * Advanced 3D spatial audio system with real-time processing, environmental acoustics
 * simulation, HRTF processing, and multi-source audio mixing for immersive experiences.
 * 
 * @fileoverview Implements comprehensive spatial audio with distance models, occlusion,
 * reverb, binaural rendering, and Doppler effects for CRAIverse platform.
 */

import { EventEmitter } from 'events';

/**
 * 3D position vector interface
 */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D orientation quaternion interface
 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Audio source configuration options
 */
export interface AudioSourceConfig {
  id: string;
  position: Vector3D;
  velocity?: Vector3D;
  maxDistance: number;
  rolloffFactor: number;
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
  loop?: boolean;
  volume: number;
  pitch?: number;
}

/**
 * Environment configuration for acoustics simulation
 */
export interface EnvironmentConfig {
  roomSize: Vector3D;
  reverbTime: number;
  dampening: number;
  reflection: number;
  absorption: number;
  materialProperties: MaterialProperties[];
}

/**
 * Material acoustic properties
 */
export interface MaterialProperties {
  name: string;
  absorption: number[];
  scattering: number[];
  transmission: number[];
}

/**
 * Distance attenuation model types
 */
export enum DistanceModel {
  LINEAR = 'linear',
  INVERSE = 'inverse',
  EXPONENTIAL = 'exponential'
}

/**
 * Audio quality presets
 */
export enum AudioQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra'
}

/**
 * Individual positioned 3D audio source with distance attenuation
 */
export class AudioSource3D extends EventEmitter {
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private pannerNode: PannerNode;
  private convolver: ConvolverNode | null = null;
  private isPlaying = false;
  private startTime = 0;
  private pauseTime = 0;

  constructor(
    private context: AudioContext,
    private config: AudioSourceConfig,
    private destination: AudioNode
  ) {
    super();
    this.gainNode = this.context.createGain();
    this.pannerNode = this.context.createPanner();
    this.setupPanner();
    this.connectNodes();
  }

  /**
   * Configure panner node properties
   */
  private setupPanner(): void {
    this.pannerNode.panningModel = 'HRTF';
    this.pannerNode.distanceModel = 'inverse';
    this.pannerNode.refDistance = 1;
    this.pannerNode.maxDistance = this.config.maxDistance;
    this.pannerNode.rolloffFactor = this.config.rolloffFactor;
    
    if (this.config.coneInnerAngle !== undefined) {
      this.pannerNode.coneInnerAngle = this.config.coneInnerAngle;
      this.pannerNode.coneOuterAngle = this.config.coneOuterAngle || 360;
      this.pannerNode.coneOuterGain = this.config.coneOuterGain || 0;
    }
    
    this.updatePosition();
  }

  /**
   * Connect audio nodes in processing chain
   */
  private connectNodes(): void {
    this.gainNode.connect(this.pannerNode);
    this.pannerNode.connect(this.destination);
    this.gainNode.gain.value = this.config.volume;
  }

  /**
   * Load audio buffer from URL or ArrayBuffer
   */
  async loadAudio(source: string | ArrayBuffer): Promise<void> {
    try {
      let arrayBuffer: ArrayBuffer;
      
      if (typeof source === 'string') {
        const response = await fetch(source);
        arrayBuffer = await response.arrayBuffer();
      } else {
        arrayBuffer = source;
      }
      
      this.audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.emit('loaded', this.config.id);
    } catch (error) {
      this.emit('error', { id: this.config.id, error });
      throw new Error(`Failed to load audio for source ${this.config.id}: ${error}`);
    }
  }

  /**
   * Start audio playback
   */
  play(): void {
    if (!this.audioBuffer) {
      throw new Error(`Audio buffer not loaded for source ${this.config.id}`);
    }

    this.stop();
    
    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.loop = this.config.loop || false;
    
    if (this.config.pitch && this.config.pitch !== 1) {
      this.sourceNode.playbackRate.value = this.config.pitch;
    }
    
    this.sourceNode.connect(this.gainNode);
    
    const offset = this.pauseTime || 0;
    this.sourceNode.start(0, offset);
    this.startTime = this.context.currentTime - offset;
    this.isPlaying = true;
    this.pauseTime = 0;
    
    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.emit('ended', this.config.id);
      }
    };
    
    this.emit('play', this.config.id);
  }

  /**
   * Pause audio playback
   */
  pause(): void {
    if (!this.isPlaying || !this.sourceNode) return;
    
    this.pauseTime = this.context.currentTime - this.startTime;
    this.sourceNode.stop();
    this.isPlaying = false;
    this.emit('pause', this.config.id);
  }

  /**
   * Stop audio playback
   */
  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    this.isPlaying = false;
    this.pauseTime = 0;
    this.emit('stop', this.config.id);
  }

  /**
   * Update source position
   */
  updatePosition(position?: Vector3D): void {
    if (position) {
      this.config.position = position;
    }
    
    this.pannerNode.positionX.value = this.config.position.x;
    this.pannerNode.positionY.value = this.config.position.y;
    this.pannerNode.positionZ.value = this.config.position.z;
  }

  /**
   * Update source velocity for Doppler effect
   */
  updateVelocity(velocity: Vector3D): void {
    this.config.velocity = velocity;
    // Web Audio API doesn't support velocity directly, handled by DopplerProcessor
  }

  /**
   * Set source volume
   */
  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.setValueAtTime(this.config.volume, this.context.currentTime);
  }

  /**
   * Apply convolution reverb
   */
  setConvolutionReverb(impulseResponse: AudioBuffer): void {
    if (this.convolver) {
      this.convolver.disconnect();
    }
    
    this.convolver = this.context.createConvolver();
    this.convolver.buffer = impulseResponse;
    
    this.pannerNode.disconnect();
    this.pannerNode.connect(this.convolver);
    this.convolver.connect(this.destination);
  }

  /**
   * Get current playback state
   */
  getState(): { isPlaying: boolean; currentTime: number; duration: number } {
    const currentTime = this.isPlaying ? this.context.currentTime - this.startTime : this.pauseTime;
    const duration = this.audioBuffer ? this.audioBuffer.duration : 0;
    
    return { isPlaying: this.isPlaying, currentTime, duration };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    this.gainNode.disconnect();
    this.pannerNode.disconnect();
    if (this.convolver) this.convolver.disconnect();
    this.removeAllListeners();
  }
}

/**
 * 3D audio listener with head tracking and HRTF processing
 */
export class ListenerNode {
  private listener: AudioListener;

  constructor(private context: AudioContext) {
    this.listener = context.listener;
    this.setupDefaults();
  }

  /**
   * Setup default listener configuration
   */
  private setupDefaults(): void {
    // Set default forward and up vectors
    this.setOrientation({ x: 0, y: 0, z: -1, w: 1 });
  }

  /**
   * Update listener position
   */
  setPosition(position: Vector3D): void {
    if (this.listener.positionX) {
      this.listener.positionX.value = position.x;
      this.listener.positionY.value = position.y;
      this.listener.positionZ.value = position.z;
    } else {
      // Fallback for older browsers
      this.listener.setPosition(position.x, position.y, position.z);
    }
  }

  /**
   * Update listener orientation from quaternion
   */
  setOrientation(quaternion: Quaternion): void {
    // Convert quaternion to forward and up vectors
    const forward = this.quaternionToForward(quaternion);
    const up = this.quaternionToUp(quaternion);

    if (this.listener.forwardX) {
      this.listener.forwardX.value = forward.x;
      this.listener.forwardY.value = forward.y;
      this.listener.forwardZ.value = forward.z;
      this.listener.upX.value = up.x;
      this.listener.upY.value = up.y;
      this.listener.upZ.value = up.z;
    } else {
      // Fallback for older browsers
      this.listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /**
   * Convert quaternion to forward vector
   */
  private quaternionToForward(q: Quaternion): Vector3D {
    return {
      x: 2 * (q.x * q.z + q.w * q.y),
      y: 2 * (q.y * q.z - q.w * q.x),
      z: 1 - 2 * (q.x * q.x + q.y * q.y)
    };
  }

  /**
   * Convert quaternion to up vector
   */
  private quaternionToUp(q: Quaternion): Vector3D {
    return {
      x: 2 * (q.x * q.y - q.w * q.z),
      y: 1 - 2 * (q.x * q.x + q.z * q.z),
      z: 2 * (q.y * q.z + q.w * q.x)
    };
  }
}

/**
 * Room acoustics and reverb simulation engine
 */
export class EnvironmentProcessor {
  private reverbGain: GainNode;
  private convolver: ConvolverNode;
  private impulseResponse: AudioBuffer | null = null;

  constructor(
    private context: AudioContext,
    private config: EnvironmentConfig
  ) {
    this.reverbGain = this.context.createGain();
    this.convolver = this.context.createConvolver();
    this.generateImpulseResponse();
  }

  /**
   * Generate impulse response for room simulation
   */
  private generateImpulseResponse(): void {
    const sampleRate = this.context.sampleRate;
    const length = Math.floor(sampleRate * this.config.reverbTime);
    this.impulseResponse = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = this.impulseResponse.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(i / length, this.config.dampening);
        const reflection = this.calculateReflection(i, length);
        channelData[i] = (Math.random() * 2 - 1) * decay * reflection * this.config.reflection;
      }
    }

    this.convolver.buffer = this.impulseResponse;
  }

  /**
   * Calculate reflection coefficient based on position and materials
   */
  private calculateReflection(sample: number, totalSamples: number): number {
    const time = sample / this.context.sampleRate;
    const distance = time * 343; // Speed of sound
    
    // Simplified reflection calculation
    let reflectionCoeff = 1;
    
    this.config.materialProperties.forEach(material => {
      const avgAbsorption = material.absorption.reduce((sum, val) => sum + val, 0) / material.absorption.length;
      reflectionCoeff *= (1 - avgAbsorption);
    });
    
    return reflectionCoeff * Math.exp(-distance * this.config.absorption);
  }

  /**
   * Process audio through environmental acoustics
   */
  process(input: AudioNode, output: AudioNode): void {
    const dryGain = this.context.createGain();
    const wetGain = this.context.createGain();
    
    dryGain.gain.value = 1 - this.config.reflection;
    wetGain.gain.value = this.config.reflection;
    
    // Dry signal
    input.connect(dryGain);
    dryGain.connect(output);
    
    // Wet signal through convolution
    input.connect(this.convolver);
    this.convolver.connect(wetGain);
    wetGain.connect(output);
  }

  /**
   * Update environment configuration
   */
  updateConfig(config: Partial<EnvironmentConfig>): void {
    Object.assign(this.config, config);
    this.generateImpulseResponse();
  }

  /**
   * Get impulse response buffer
   */
  getImpulseResponse(): AudioBuffer | null {
    return this.impulseResponse;
  }
}

/**
 * Impulse response-based environmental reverb
 */
export class ConvolutionReverb {
  private convolver: ConvolverNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  private output: GainNode;

  constructor(
    private context: AudioContext,
    impulseResponse: AudioBuffer
  ) {
    this.convolver = this.context.createConvolver();
    this.wetGain = this.context.createGain();
    this.dryGain = this.context.createGain();
    this.output = this.context.createGain();
    
    this.convolver.buffer = impulseResponse;
    this.setupRouting();
  }

  /**
   * Setup audio routing for dry/wet mix
   */
  private setupRouting(): void {
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
    
    this.setMix(0.3); // Default 30% wet
  }

  /**
   * Set dry/wet mix ratio
   */
  setMix(wetAmount: number): void {
    const wet = Math.max(0, Math.min(1, wetAmount));
    const dry = 1 - wet;
    
    this.wetGain.gain.value = wet;
    this.dryGain.gain.value = dry;
  }

  /**
   * Connect input source
   */
  connect(input: AudioNode): void {
    input.connect(this.convolver);
    input.connect(this.dryGain);
  }

  /**
   * Get output node
   */
  getOutput(): AudioNode {
    return this.output;
  }
}

/**
 * HRTF-based binaural audio rendering
 */
export class BinausalRenderer {
  private leftConvolver: ConvolverNode;
  private rightConvolver: ConvolverNode;
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  private hrtfData: Map<string, { left: AudioBuffer; right: AudioBuffer }> = new Map();

  constructor(private context: AudioContext) {
    this.leftConvolver = this.context.createConvolver();
    this.rightConvolver = this.context.createConvolver();
    this.splitter = this.context.createChannelSplitter(2);
    this.merger = this.context.createChannelMerger(2);
    
    this.setupRouting();
    this.loadDefaultHRTFs();
  }

  /**
   * Setup binaural rendering audio graph
   */
  private setupRouting(): void {
    this.splitter.connect(this.leftConvolver, 0);
    this.splitter.connect(this.rightConvolver, 1);
    
    this.leftConvolver.connect(this.merger, 0, 0);
    this.rightConvolver.connect(this.merger, 0, 1);
  }

  /**
   * Load default HRTF dataset
   */
  private async loadDefaultHRTFs(): Promise<void> {
    // Simplified HRTF loading - in production, load from comprehensive dataset
    try {
      const angles = [0, 15, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
      
      for (const angle of angles) {
        const leftHRTF = await this.generateHRTF(angle, 'left');
        const rightHRTF = await this.generateHRTF(angle, 'right');
        this.hrtfData.set(`${angle}`, { left: leftHRTF, right: rightHRTF });
      }
    } catch (error) {
      console.warn('Failed to load HRTF data:', error);
    }
  }

  /**
   * Generate simplified HRTF for given angle
   */
  private async generateHRTF(angle: number, ear: 'left' | 'right'): Promise<AudioBuffer> {
    const sampleRate = this.context.sampleRate;
    const length = 128; // Typical HRTF length
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    // Simplified HRTF generation based on angle
    const radians = (angle * Math.PI) / 180;
    const earOffset = ear === 'left' ? -Math.PI / 2 : Math.PI / 2;
    const relativeAngle = radians + earOffset;
    
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const delay = Math.abs(Math.sin(relativeAngle)) * 0.0006; // Head shadow delay
      const amplitude = Math.cos(relativeAngle) * 0.5 + 0.5; // Simplified amplitude
      
      data[i] = amplitude * Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 1000);
    }
    
    return buffer;
  }

  /**
   * Apply HRTF processing based on source position
   */
  processPosition(position: Vector3D, listenerPosition: Vector3D): void {
    const angle = this.calculateAngle(position, listenerPosition);
    const nearestAngle = this.findNearestHRTF(angle);
    const hrtf = this.hrtfData.get(`${nearestAngle}`);
    
    if (hrtf) {
      this.leftConvolver.buffer = hrtf.left;
      this.rightConvolver.buffer = hrtf.right;
    }
  }

  /**
   * Calculate angle between source and listener
   */
  private calculateAngle(source: Vector3D, listener: Vector3D): number {
    const dx = source.x - listener.x;
    const dz = source.z - listener.z;
    let angle = (Math.atan2(dx, dz) * 180) / Math.PI;
    
    if (angle < 0) angle += 360;
    return angle;
  }

  /**
   * Find nearest HRTF angle
   */
  private findNearestHRTF(targetAngle: number): number {
    const angles = Array.from(this.hrtfData.keys()).map(Number);
    return angles.reduce((nearest, current) => {
      const currentDiff = Math.abs(current - targetAngle);
      const nearestDiff = Math.abs(nearest - targetAngle);
      return currentDiff < nearestDiff ? current : nearest;
    });
  }

  /**
   * Connect input and get output
   */
  connect(input: AudioNode): AudioNode {
    input.connect(this.splitter);
    return this.merger;
  }
}

/**
 * Audio occlusion and obstruction simulation
 */
export class OcclusionEngine {
  private lowPassFilters: Map<string, BiquadFilterNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();

  constructor(private context: AudioContext) {}

  /**
   * Create occlusion processing for audio source
   */
  createOcclusionProcessor(sourceId: string): { input: AudioNode; output: AudioNode } {
    const lowPass = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 22050; // Default no filtering
    lowPass.Q.value = 1;
    
    lowPass.connect(gain);
    
    this.lowPassFilters.set(sourceId, lowPass);
    this.gainNodes.set(sourceId, gain);
    
    return { input: lowPass, output: gain };
  }

  /**
   * Update occlusion based on geometry obstruction
   */
  updateOcclusion(sourceId: string, occlusionFactor: number): void {
    const lowPass = this.lowPassFilters.get(sourceId);
    const gain = this.gainNodes.