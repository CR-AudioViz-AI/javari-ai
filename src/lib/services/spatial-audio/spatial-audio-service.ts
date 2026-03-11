```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * 3D position in space
 */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Listener orientation in 3D space
 */
export interface ListenerOrientation {
  position: Vector3D;
  forward: Vector3D;
  up: Vector3D;
}

/**
 * Audio source configuration
 */
export interface AudioSourceConfig {
  id: string;
  position: Vector3D;
  audioBuffer?: AudioBuffer;
  audioElement?: HTMLAudioElement;
  volume: number;
  loop: boolean;
  maxDistance: number;
  rolloffFactor: number;
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
}

/**
 * Environment acoustic properties
 */
export interface EnvironmentConfig {
  reverbType: 'none' | 'small_room' | 'large_room' | 'hall' | 'cathedral' | 'outdoor';
  wetness: number; // 0-1, amount of reverb
  dryness: number; // 0-1, amount of direct sound
  roomSize: number; // 0-1, affects reverb characteristics
  dampening: number; // 0-1, high frequency absorption
  ambientVolume: number; // 0-1, background ambient level
}

/**
 * Speaker configuration for multi-channel audio
 */
export interface SpeakerConfig {
  channels: number;
  layout: 'stereo' | 'surround_5_1' | 'surround_7_1' | 'binaural';
  crossfadeRadius: number;
}

/**
 * Audio scene state
 */
export interface AudioSceneState {
  listener: ListenerOrientation;
  sources: Map<string, SpatialAudioSource>;
  environment: EnvironmentConfig;
  isActive: boolean;
  masterVolume: number;
}

/**
 * Spatial audio events
 */
export interface SpatialAudioEvents {
  sourceAdded: (source: SpatialAudioSource) => void;
  sourceRemoved: (sourceId: string) => void;
  sourceUpdated: (source: SpatialAudioSource) => void;
  listenerMoved: (orientation: ListenerOrientation) => void;
  environmentChanged: (config: EnvironmentConfig) => void;
  sceneActivated: () => void;
  sceneDeactivated: () => void;
}

/**
 * Audio worklet for performance-critical processing
 */
class SpatialAudioWorklet extends AudioWorkletProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    // Custom spatial processing logic would go here
    // This is a placeholder for the actual worklet implementation
    return true;
  }
}

/**
 * Manages Web Audio API context and lifecycle
 */
export class AudioContextManager {
  private context: AudioContext | null = null;
  private isInitialized = false;

  /**
   * Initialize audio context
   */
  async initialize(): Promise<AudioContext> {
    if (this.context && this.context.state !== 'closed') {
      return this.context;
    }

    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 44100
      });

      // Resume context if suspended
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      // Load audio worklet for performance-critical processing
      try {
        await this.context.audioWorklet.addModule('/audio-worklets/spatial-processor.js');
      } catch (error) {
        console.warn('Failed to load spatial audio worklet:', error);
      }

      this.isInitialized = true;
      return this.context;
    } catch (error) {
      throw new Error(`Failed to initialize audio context: ${error}`);
    }
  }

  /**
   * Get current audio context
   */
  getContext(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      throw new Error('Audio context not initialized or closed');
    }
    return this.context;
  }

  /**
   * Suspend audio context
   */
  async suspend(): Promise<void> {
    if (this.context && this.context.state === 'running') {
      await this.context.suspend();
    }
  }

  /**
   * Resume audio context
   */
  async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Close audio context
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if context is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.context !== null && this.context.state !== 'closed';
  }
}

/**
 * Handles distance-based attenuation and frequency filtering
 */
export class DistanceAttenuationEngine {
  private context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Create distance attenuation node chain
   */
  createAttenuationChain(maxDistance: number, rolloffFactor: number): {
    gainNode: GainNode;
    filterNode: BiquadFilterNode;
    update: (distance: number) => void;
  } {
    const gainNode = this.context.createGain();
    const filterNode = this.context.createBiquadFilter();

    // Configure low-pass filter for distance-based frequency attenuation
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 20000; // Start with full frequency range

    // Connect nodes
    filterNode.connect(gainNode);

    const update = (distance: number) => {
      // Calculate distance attenuation
      const normalizedDistance = Math.min(distance / maxDistance, 1);
      const attenuation = Math.pow(1 - normalizedDistance, rolloffFactor);
      
      // Update gain
      gainNode.gain.setTargetAtTime(attenuation, this.context.currentTime, 0.1);

      // Update frequency filtering (simulate air absorption)
      const cutoffFrequency = 20000 * (1 - normalizedDistance * 0.8);
      filterNode.frequency.setTargetAtTime(cutoffFrequency, this.context.currentTime, 0.1);
    };

    return { gainNode, filterNode, update };
  }
}

/**
 * Processes environmental audio effects
 */
export class EnvironmentProcessor {
  private context: AudioContext;
  private convolver: ConvolverNode | null = null;
  private wetGain: GainNode;
  private dryGain: GainNode;
  private outputGain: GainNode;

  constructor(context: AudioContext) {
    this.context = context;
    this.wetGain = context.createGain();
    this.dryGain = context.createGain();
    this.outputGain = context.createGain();

    // Create initial routing
    this.dryGain.connect(this.outputGain);
    this.wetGain.connect(this.outputGain);
  }

  /**
   * Apply environment configuration
   */
  async applyEnvironment(config: EnvironmentConfig): Promise<AudioNode> {
    try {
      // Update gain values
      this.wetGain.gain.setTargetAtTime(config.wetness, this.context.currentTime, 0.3);
      this.dryGain.gain.setTargetAtTime(config.dryness, this.context.currentTime, 0.3);

      // Create or update convolver for reverb
      if (config.reverbType !== 'none') {
        await this.setupReverb(config);
      } else {
        this.removeReverb();
      }

      return this.createProcessingChain();
    } catch (error) {
      console.error('Failed to apply environment:', error);
      return this.outputGain;
    }
  }

  /**
   * Setup reverb convolution
   */
  private async setupReverb(config: EnvironmentConfig): Promise<void> {
    try {
      // Remove existing convolver
      if (this.convolver) {
        this.convolver.disconnect();
      }

      // Create new convolver
      this.convolver = this.context.createConvolver();
      
      // Generate impulse response based on environment type
      const impulseBuffer = await this.generateImpulseResponse(config);
      this.convolver.buffer = impulseBuffer;

      // Connect convolver to wet gain
      this.convolver.connect(this.wetGain);
    } catch (error) {
      console.error('Failed to setup reverb:', error);
    }
  }

  /**
   * Generate impulse response for reverb
   */
  private async generateImpulseResponse(config: EnvironmentConfig): Promise<AudioBuffer> {
    const duration = this.getReverbDuration(config.reverbType);
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        const time = i / sampleRate;
        const decay = Math.pow(1 - time / duration, config.roomSize * 2);
        const damping = Math.exp(-time * config.dampening * 10);
        
        // Generate noise with exponential decay
        channelData[i] = (Math.random() * 2 - 1) * decay * damping * 0.3;
      }
    }

    return buffer;
  }

  /**
   * Get reverb duration based on environment type
   */
  private getReverbDuration(reverbType: EnvironmentConfig['reverbType']): number {
    switch (reverbType) {
      case 'small_room': return 0.5;
      case 'large_room': return 1.0;
      case 'hall': return 2.0;
      case 'cathedral': return 4.0;
      case 'outdoor': return 0.1;
      default: return 0;
    }
  }

  /**
   * Remove reverb processing
   */
  private removeReverb(): void {
    if (this.convolver) {
      this.convolver.disconnect();
      this.convolver = null;
    }
  }

  /**
   * Create complete processing chain
   */
  private createProcessingChain(): AudioNode {
    // Return a splitter that routes to both dry and wet paths
    const splitter = this.context.createChannelSplitter(2);
    const merger = this.context.createChannelMerger(2);

    // Connect splitter to processing paths
    splitter.connect(this.dryGain);
    if (this.convolver) {
      splitter.connect(this.convolver);
    }

    // Connect processed signals to merger
    this.dryGain.connect(merger, 0, 0);
    this.dryGain.connect(merger, 0, 1);
    this.wetGain.connect(merger, 0, 0);
    this.wetGain.connect(merger, 0, 1);

    merger.connect(this.outputGain);

    return splitter;
  }

  /**
   * Get output node
   */
  getOutput(): AudioNode {
    return this.outputGain;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.removeReverb();
    this.wetGain.disconnect();
    this.dryGain.disconnect();
    this.outputGain.disconnect();
  }
}

/**
 * Manages multi-speaker positioning and stereo imaging
 */
export class MultiSpeakerManager {
  private context: AudioContext;
  private config: SpeakerConfig;
  private panners: Map<string, StereoPannerNode | PannerNode> = new Map();

  constructor(context: AudioContext, config: SpeakerConfig) {
    this.context = context;
    this.config = config;
  }

  /**
   * Create spatial positioning node for source
   */
  createPositionalNode(sourceId: string, position: Vector3D, listenerPos: Vector3D): AudioNode {
    if (this.config.layout === 'binaural' || this.config.layout === 'stereo') {
      return this.createStereoPanner(sourceId, position, listenerPos);
    } else {
      return this.createSurroundPanner(sourceId, position, listenerPos);
    }
  }

  /**
   * Create stereo panner for simple stereo positioning
   */
  private createStereoPanner(sourceId: string, position: Vector3D, listenerPos: Vector3D): StereoPannerNode {
    const panner = this.context.createStereoPanner();
    
    // Calculate stereo position (-1 to 1)
    const relativeX = position.x - listenerPos.x;
    const distance = Math.sqrt(relativeX * relativeX + (position.z - listenerPos.z) ** 2);
    const maxPan = Math.min(distance / this.config.crossfadeRadius, 1);
    const pan = Math.sign(relativeX) * maxPan;
    
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    this.panners.set(sourceId, panner);

    return panner;
  }

  /**
   * Create 3D panner for surround sound positioning
   */
  private createSurroundPanner(sourceId: string, position: Vector3D, listenerPos: Vector3D): PannerNode {
    const panner = this.context.createPanner();
    
    // Configure 3D panning
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 1000;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 0;
    panner.coneOuterGain = 0;

    // Set position
    panner.positionX.value = position.x - listenerPos.x;
    panner.positionY.value = position.y - listenerPos.y;
    panner.positionZ.value = position.z - listenerPos.z;

    this.panners.set(sourceId, panner);
    return panner;
  }

  /**
   * Update source position
   */
  updateSourcePosition(sourceId: string, position: Vector3D, listenerPos: Vector3D): void {
    const panner = this.panners.get(sourceId);
    if (!panner) return;

    if (panner instanceof PannerNode) {
      panner.positionX.setTargetAtTime(position.x - listenerPos.x, this.context.currentTime, 0.1);
      panner.positionY.setTargetAtTime(position.y - listenerPos.y, this.context.currentTime, 0.1);
      panner.positionZ.setTargetAtTime(position.z - listenerPos.z, this.context.currentTime, 0.1);
    } else if (panner instanceof StereoPannerNode) {
      const relativeX = position.x - listenerPos.x;
      const distance = Math.sqrt(relativeX * relativeX + (position.z - listenerPos.z) ** 2);
      const maxPan = Math.min(distance / this.config.crossfadeRadius, 1);
      const pan = Math.sign(relativeX) * maxPan;
      panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), this.context.currentTime, 0.1);
    }
  }

  /**
   * Update listener orientation
   */
  updateListenerOrientation(orientation: ListenerOrientation): void {
    const listener = this.context.listener;
    
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(orientation.position.x, this.context.currentTime, 0.1);
      listener.positionY.setTargetAtTime(orientation.position.y, this.context.currentTime, 0.1);
      listener.positionZ.setTargetAtTime(orientation.position.z, this.context.currentTime, 0.1);

      listener.forwardX.setTargetAtTime(orientation.forward.x, this.context.currentTime, 0.1);
      listener.forwardY.setTargetAtTime(orientation.forward.y, this.context.currentTime, 0.1);
      listener.forwardZ.setTargetAtTime(orientation.forward.z, this.context.currentTime, 0.1);

      listener.upX.setTargetAtTime(orientation.up.x, this.context.currentTime, 0.1);
      listener.upY.setTargetAtTime(orientation.up.y, this.context.currentTime, 0.1);
      listener.upZ.setTargetAtTime(orientation.up.z, this.context.currentTime, 0.1);
    }
  }

  /**
   * Remove source positioning
   */
  removeSource(sourceId: string): void {
    const panner = this.panners.get(sourceId);
    if (panner) {
      panner.disconnect();
      this.panners.delete(sourceId);
    }
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.panners.forEach(panner => panner.disconnect());
    this.panners.clear();
  }
}

/**
 * Individual spatial audio source
 */
export class SpatialAudioSource {
  public readonly id: string;
  public position: Vector3D;
  public volume: number;
  public isPlaying = false;
  
  private context: AudioContext;
  private config: AudioSourceConfig;
  private sourceNode: AudioBufferSourceNode | MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode;
  private pannerNode: AudioNode | null = null;
  private attenuationChain: ReturnType<DistanceAttenuationEngine['createAttenuationChain']> | null = null;
  private outputNode: AudioNode;

  constructor(context: AudioContext, config: AudioSourceConfig) {
    this.context = context;
    this.config = config;
    this.id = config.id;
    this.position = { ...config.position };
    this.volume = config.volume;

    // Create gain node for volume control
    this.gainNode = context.createGain();
    this.gainNode.gain.value = config.volume;
    this.outputNode = this.gainNode;
  }

  /**
   * Initialize audio source
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.audioBuffer) {
        await this.setupBufferSource();
      } else if (this.config.audioElement) {
        await this.setupMediaElementSource();
      } else {
        throw new Error('No audio source provided');
      }
    } catch (error) {
      throw new Error(`Failed to initialize audio source ${this.id}: ${error}`);
    }
  }

  /**
   * Setup buffer-based audio source
   */
  private async setupBufferSource(): Promise<void> {
    if (!this.config.audioBuffer) return;

    const source = this.context.createBufferSource();
    source.buffer = this.config.audioBuffer;
    source.loop = this.config.loop;
    
    source.connect(this.gainNode);
    this.sourceNode = source;
  }

  /**
   * Setup media element audio source
   */
  private async setupMediaElementSource(): Promise<void> {
    if (!this.config.audioElement) return;

    const source = this.context.createMediaElementSource(this.config.audioElement);
    source.connect(this.gainNode);
    this.sourceNode = source;
  }

  /**
   * Setup spatial positioning
   */
  setupSpatialProcessing(
    speakerManager: MultiSpeakerManager,
    attenuationEngine: DistanceAttenuationEngine,
    listenerPos: Vector3D
  ): void {
    // Create spatial positioning
    this.pannerNode = speakerManager.createPositionalNode(this.id, this.position, listenerPos);
    
    // Create distance attenuation
    this.attenuationChain = attenuationEngine.createAttenuationChain(
      this.config.maxDistance,
      this.config.rolloffFactor
    );

    // Connect processing chain
    this.gainNode.connect(this.attenuationChain.filterNode);
    this.attenuationChain.gainNode.connect(this.pannerNode);
    this.outputNode = this.pannerNode;

    // Update initial distance
    const distance = this.calculateDistance(listenerPos);
    this.attenuationChain.update(distance);
  }

  /**
   * Update source position
   */
  updatePosition(newPosition: Vector3D, listenerPos: Vector3D, speakerManager: MultiSpeakerManager): void {
    this.position = { ...newPosition };
    
    // Update spatial positioning
    speakerManager.updateSourcePosition(this.id, this.position, listenerPos);
    
    // Update distance attenuation
    if (this.attenuationChain) {
      const distance = this.calculateDistance(listenerPos);
      this.attenuationChain.update(distance);
    }
  }

  /**
   * Start playback
   */
  async play(): Promise<void> {
    if (this.isPlaying) return;

    try {
      if (this.sourceNode instanceof AudioBufferSourceNode) {
        this.sourceNode.start();
      } else if (this.config.audioElement) {
        await this.config.audioElement.play();
      }
      
      this.isPlaying = true;
    } catch (error) {
      throw new Error(`Failed to play audio source ${this.id}: ${error}`);
    }
  }

  /**
   * Stop playback
   */
  stop(): void {
    if (!this.isPlaying) return;

    try {
      if (this.sourceNode instanceof AudioBufferSourceNode) {
        this.sourceNode.stop();
      } else if (this.config.audioElement) {
        this.config.audioElement.pause();
        this.config.audioElement.currentTime = 0;
      }
      
      this.isPlaying = false;
    } catch (error) {
      console.error(`Failed to stop audio source ${this.id}:`, error);
    }
  }

  /**
   * Update volume
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.