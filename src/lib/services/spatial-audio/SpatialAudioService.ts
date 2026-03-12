```typescript
import { EventEmitter } from 'events';
import type {
  SpatialAudioConfig,
  AudioSource,
  ListenerPosition,
  EnvironmentGeometry,
  AcousticProperties,
  SpatialAudioState,
  AudioProcessingOptions,
  HRTFData,
  ReverbSettings,
  AudioStreamConfig,
  SpatialAudioError,
  Vector3D,
  AudioSourceUpdate,
  EnvironmentUpdate
} from '../../types/spatial-audio';

/**
 * Real-time 3D Spatial Audio Processing Service
 * 
 * Provides immersive spatial audio with HRTF-based positioning,
 * environmental acoustics simulation, and dynamic audio mixing
 * based on virtual environment geometry and user positioning.
 * 
 * Features:
 * - Real-time HRTF processing for accurate 3D positioning
 * - Environmental acoustics simulation with reverb and occlusion
 * - Multi-source audio mixing with distance attenuation
 * - WebAudio API integration for low-latency processing
 * - WebRTC support for multi-user environments
 * - Automatic optimization and resource management
 * 
 * @example
 * ```typescript
 * const spatialAudio = new SpatialAudioService({
 *   sampleRate: 48000,
 *   bufferSize: 512,
 *   maxSources: 64,
 *   enableHRTF: true,
 *   enableReverb: true
 * });
 * 
 * await spatialAudio.initialize();
 * 
 * // Add audio source
 * const sourceId = await spatialAudio.addAudioSource({
 *   id: 'ambient-sound',
 *   url: '/audio/ambient.mp3',
 *   position: { x: 10, y: 0, z: 5 },
 *   volume: 0.8,
 *   loop: true
 * });
 * 
 * // Update listener position
 * spatialAudio.updateListenerPosition({
 *   position: { x: 0, y: 1.7, z: 0 },
 *   orientation: { forward: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 } }
 * });
 * ```
 */
export class SpatialAudioService extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private listenerNode: AudioListener | null = null;
  private convolverNodes: Map<string, ConvolverNode> = new Map();
  private pannerNodes: Map<string, PannerNode> = new Map();
  private audioSources: Map<string, AudioSource> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private hrtfData: HRTFData | null = null;
  private environmentGeometry: EnvironmentGeometry | null = null;
  private acousticProperties: AcousticProperties | null = null;
  private isInitialized = false;
  private isProcessing = false;
  private processingWorklet: AudioWorkletNode | null = null;
  private streamManager: MediaStreamAudioDestinationNode | null = null;
  private realtimeUpdateInterval: NodeJS.Timeout | null = null;

  constructor(private readonly config: SpatialAudioConfig) {
    super();
    this.validateConfig();
  }

  /**
   * Initialize the spatial audio service
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        throw new Error('Spatial audio service already initialized');
      }

      await this.initializeAudioContext();
      await this.setupAudioGraph();
      await this.loadHRTFData();
      await this.setupAudioWorklet();
      await this.startRealtimeUpdates();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('Spatial audio service initialized successfully');
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'INITIALIZATION_FAILED',
        message: `Failed to initialize spatial audio service: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
      throw error;
    }
  }

  /**
   * Add an audio source to the spatial environment
   */
  public async addAudioSource(source: Omit<AudioSource, 'id' | 'node' | 'buffer'>): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Spatial audio service not initialized');
      }

      const sourceId = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const audioBuffer = await this.loadAudioBuffer(source.url);
      
      const bufferSourceNode = this.audioContext!.createBufferSource();
      bufferSourceNode.buffer = audioBuffer;
      bufferSourceNode.loop = source.loop || false;

      const gainNode = this.audioContext!.createGain();
      gainNode.gain.setValueAtTime(source.volume || 1.0, this.audioContext!.currentTime);

      const pannerNode = this.audioContext!.createPanner();
      pannerNode.panningModel = 'HRTF';
      pannerNode.distanceModel = 'inverse';
      pannerNode.refDistance = source.refDistance || 1;
      pannerNode.maxDistance = source.maxDistance || 10000;
      pannerNode.rolloffFactor = source.rolloffFactor || 1;
      pannerNode.coneInnerAngle = source.coneInnerAngle || 360;
      pannerNode.coneOuterAngle = source.coneOuterAngle || 0;
      pannerNode.coneOuterGain = source.coneOuterGain || 0;

      this.updatePannerPosition(pannerNode, source.position);
      
      if (source.orientation) {
        this.updatePannerOrientation(pannerNode, source.orientation);
      }

      // Setup audio graph connections
      bufferSourceNode.connect(gainNode);
      gainNode.connect(pannerNode);
      
      // Apply environmental effects if enabled
      if (this.config.enableReverb && this.convolverNodes.size > 0) {
        const reverbGain = this.audioContext!.createGain();
        reverbGain.gain.setValueAtTime(source.reverbLevel || 0.3, this.audioContext!.currentTime);
        
        pannerNode.connect(reverbGain);
        reverbGain.connect(this.convolverNodes.values().next().value);
      }
      
      pannerNode.connect(this.masterGainNode!);

      const audioSource: AudioSource = {
        id: sourceId,
        url: source.url,
        position: source.position,
        orientation: source.orientation,
        volume: source.volume || 1.0,
        loop: source.loop || false,
        refDistance: source.refDistance || 1,
        maxDistance: source.maxDistance || 10000,
        rolloffFactor: source.rolloffFactor || 1,
        coneInnerAngle: source.coneInnerAngle || 360,
        coneOuterAngle: source.coneOuterAngle || 0,
        coneOuterGain: source.coneOuterGain || 0,
        reverbLevel: source.reverbLevel || 0.3,
        node: bufferSourceNode,
        buffer: audioBuffer,
        gainNode,
        pannerNode,
        isPlaying: false
      };

      this.audioSources.set(sourceId, audioSource);
      this.pannerNodes.set(sourceId, pannerNode);

      this.emit('sourceAdded', { sourceId, source: audioSource });

      return sourceId;
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'SOURCE_ADD_FAILED',
        message: `Failed to add audio source: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
      throw error;
    }
  }

  /**
   * Play an audio source
   */
  public async playSource(sourceId: string, when: number = 0): Promise<void> {
    try {
      const source = this.audioSources.get(sourceId);
      if (!source) {
        throw new Error(`Audio source ${sourceId} not found`);
      }

      if (source.isPlaying) {
        return;
      }

      const startTime = when > 0 ? when : this.audioContext!.currentTime;
      source.node.start(startTime);
      source.isPlaying = true;

      this.emit('sourceStarted', { sourceId });
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'SOURCE_PLAY_FAILED',
        message: `Failed to play audio source ${sourceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
      throw error;
    }
  }

  /**
   * Stop an audio source
   */
  public async stopSource(sourceId: string, when: number = 0): Promise<void> {
    try {
      const source = this.audioSources.get(sourceId);
      if (!source) {
        throw new Error(`Audio source ${sourceId} not found`);
      }

      if (!source.isPlaying) {
        return;
      }

      const stopTime = when > 0 ? when : this.audioContext!.currentTime;
      source.node.stop(stopTime);
      source.isPlaying = false;

      this.emit('sourceStopped', { sourceId });
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'SOURCE_STOP_FAILED',
        message: `Failed to stop audio source ${sourceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
      throw error;
    }
  }

  /**
   * Update audio source position
   */
  public updateSourcePosition(sourceId: string, position: Vector3D): void {
    try {
      const source = this.audioSources.get(sourceId);
      const pannerNode = this.pannerNodes.get(sourceId);
      
      if (!source || !pannerNode) {
        throw new Error(`Audio source ${sourceId} not found`);
      }

      source.position = position;
      this.updatePannerPosition(pannerNode, position);

      this.emit('sourcePositionUpdated', { sourceId, position });
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'SOURCE_UPDATE_FAILED',
        message: `Failed to update source position: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
    }
  }

  /**
   * Update listener position and orientation
   */
  public updateListenerPosition(listener: ListenerPosition): void {
    try {
      if (!this.listenerNode) {
        throw new Error('Audio listener not initialized');
      }

      const currentTime = this.audioContext!.currentTime;

      // Update position
      this.listenerNode.positionX.setValueAtTime(listener.position.x, currentTime);
      this.listenerNode.positionY.setValueAtTime(listener.position.y, currentTime);
      this.listenerNode.positionZ.setValueAtTime(listener.position.z, currentTime);

      // Update orientation
      this.listenerNode.forwardX.setValueAtTime(listener.orientation.forward.x, currentTime);
      this.listenerNode.forwardY.setValueAtTime(listener.orientation.forward.y, currentTime);
      this.listenerNode.forwardZ.setValueAtTime(listener.orientation.forward.z, currentTime);

      this.listenerNode.upX.setValueAtTime(listener.orientation.up.x, currentTime);
      this.listenerNode.upY.setValueAtTime(listener.orientation.up.y, currentTime);
      this.listenerNode.upZ.setValueAtTime(listener.orientation.up.z, currentTime);

      this.emit('listenerPositionUpdated', listener);
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'LISTENER_UPDATE_FAILED',
        message: `Failed to update listener position: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
    }
  }

  /**
   * Update environment geometry and acoustics
   */
  public async updateEnvironment(geometry: EnvironmentGeometry, acoustics: AcousticProperties): Promise<void> {
    try {
      this.environmentGeometry = geometry;
      this.acousticProperties = acoustics;

      // Update reverb settings based on acoustics
      await this.updateReverbSettings(acoustics);

      // Recalculate acoustic properties for all sources
      this.recalculateAcoustics();

      this.emit('environmentUpdated', { geometry, acoustics });
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'ENVIRONMENT_UPDATE_FAILED',
        message: `Failed to update environment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
      throw error;
    }
  }

  /**
   * Set master volume
   */
  public setMasterVolume(volume: number): void {
    try {
      if (!this.masterGainNode) {
        throw new Error('Master gain node not initialized');
      }

      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.masterGainNode.gain.setValueAtTime(
        clampedVolume,
        this.audioContext!.currentTime
      );

      this.emit('masterVolumeChanged', clampedVolume);
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'VOLUME_UPDATE_FAILED',
        message: `Failed to set master volume: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
    }
  }

  /**
   * Get current spatial audio state
   */
  public getState(): SpatialAudioState {
    return {
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
      sourceCount: this.audioSources.size,
      masterVolume: this.masterGainNode?.gain.value || 0,
      sampleRate: this.audioContext?.sampleRate || 0,
      currentTime: this.audioContext?.currentTime || 0,
      environmentGeometry: this.environmentGeometry,
      acousticProperties: this.acousticProperties
    };
  }

  /**
   * Remove an audio source
   */
  public async removeSource(sourceId: string): Promise<void> {
    try {
      const source = this.audioSources.get(sourceId);
      if (!source) {
        return;
      }

      // Stop the source if playing
      if (source.isPlaying) {
        await this.stopSource(sourceId);
      }

      // Disconnect nodes
      source.node.disconnect();
      source.gainNode?.disconnect();
      source.pannerNode?.disconnect();

      // Clean up references
      this.audioSources.delete(sourceId);
      this.pannerNodes.delete(sourceId);

      this.emit('sourceRemoved', { sourceId });
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'SOURCE_REMOVE_FAILED',
        message: `Failed to remove audio source: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
      throw error;
    }
  }

  /**
   * Suspend audio processing (for optimization)
   */
  public async suspend(): Promise<void> {
    try {
      if (this.audioContext && this.audioContext.state === 'running') {
        await this.audioContext.suspend();
        this.isProcessing = false;
        this.emit('suspended');
      }
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'SUSPEND_FAILED',
        message: `Failed to suspend audio context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
      throw error;
    }
  }

  /**
   * Resume audio processing
   */
  public async resume(): Promise<void> {
    try {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        this.isProcessing = true;
        this.emit('resumed');
      }
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'RESUME_FAILED',
        message: `Failed to resume audio context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
      throw error;
    }
  }

  /**
   * Cleanup and dispose of resources
   */
  public async dispose(): Promise<void> {
    try {
      // Stop all sources
      for (const [sourceId] of this.audioSources) {
        await this.removeSource(sourceId);
      }

      // Clear intervals
      if (this.realtimeUpdateInterval) {
        clearInterval(this.realtimeUpdateInterval);
        this.realtimeUpdateInterval = null;
      }

      // Disconnect and cleanup audio nodes
      this.processingWorklet?.disconnect();
      this.streamManager?.disconnect();
      this.masterGainNode?.disconnect();

      // Close audio context
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      // Clear all maps and references
      this.audioSources.clear();
      this.audioBuffers.clear();
      this.pannerNodes.clear();
      this.convolverNodes.clear();

      this.isInitialized = false;
      this.isProcessing = false;

      this.emit('disposed');
    } catch (error) {
      const spatialError: SpatialAudioError = {
        code: 'DISPOSE_FAILED',
        message: `Failed to dispose spatial audio service: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.emit('error', spatialError);
      throw error;
    }
  }

  // Private methods

  private validateConfig(): void {
    if (!this.config.sampleRate || this.config.sampleRate < 8000 || this.config.sampleRate > 96000) {
      throw new Error('Invalid sample rate. Must be between 8000 and 96000 Hz');
    }

    if (!this.config.bufferSize || !Number.isInteger(Math.log2(this.config.bufferSize))) {
      throw new Error('Buffer size must be a power of 2');
    }

    if (this.config.maxSources && this.config.maxSources < 1) {
      throw new Error('Maximum sources must be at least 1');
    }
  }

  private async initializeAudioContext(): Promise<void> {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    
    if (!AudioContextClass) {
      throw new Error('Web Audio API not supported');
    }

    this.audioContext = new AudioContextClass({
      sampleRate: this.config.sampleRate,
      latencyHint: this.config.latencyHint || 'interactive'
    });

    // Handle audio context state changes
    this.audioContext.addEventListener('statechange', () => {
      this.emit('stateChange', this.audioContext!.state);
    });

    // Resume context if needed (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.isProcessing = true;
  }

  private async setupAudioGraph(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Create master gain node
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.setValueAtTime(
      this.config.masterVolume || 1.0,
      this.audioContext.currentTime
    );

    // Connect to destination
    this.masterGainNode.connect(this.audioContext.destination);

    // Setup listener
    this.listenerNode = this.audioContext.listener;

    // Create stream manager for WebRTC if needed
    if (this.config.enableWebRTC) {
      this.streamManager = this.audioContext.createMediaStreamDestination();
      this.masterGainNode.connect(this.streamManager);
    }
  }

  private async loadHRTFData(): Promise<void> {
    if (!this.config.enableHRTF) {
      return;
    }

    try {
      // Load HRTF impulse responses (placeholder for actual HRTF data)
      const hrtfResponse = await fetch('/audio/hrtf/default.json');
      this.hrtfData = await hrtfResponse.json();
    } catch (error) {
      console.warn('Failed to load HRTF data, using default panning model');
    }
  }

  private async setupAudioWorklet(): Promise<void> {
    if (!this.audioContext || !this.config.enableWorklet) {
      return;
    }

    try {
      await this.audioContext.audioWorklet.addModule('/audio-worklets/spatial-processor.js');
      
      this.processingWorklet = new AudioWorkletNode(this.audioContext, 'spatial-processor', {
        processorOptions: {
          bufferSize: this.config.bufferSize,
          enableHRTF: this.config.enableHRTF
        }
      });

      this.processingWorklet.connect(this.masterGainNode!);
    } catch (error) {
      console.warn('Failed to setup AudioWorklet, falling back to ScriptProcessor');
    }
  }

  private async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    if (this.audioBuffers.has(url)) {
      return this.audioBuffers.get(url)!;
    }

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);

    this.audioBuffers.set(url, audioBuffer);
    return audioBuffer;
  }

  private updateP