# Deploy Spatial Audio Processing Microservice

# Spatial Audio Processing Microservice Documentation

## Purpose
The Spatial Audio Processing Microservice provides advanced 3D spatial audio processing for CRAIverse environments. Utilizing the Web Audio API and Head-Related Transfer Function (HRTF) algorithms, it enhances immersive sound experiences by accurately simulating how users perceive sound in three-dimensional space.

## Usage
To deploy and utilize the Spatial Audio Processing Microservice, integrate the service into your CRAIverse application. Ensure the Web Audio API is supported by the target environment. The microservice processes audio sources based on listener position and orientation, environmental acoustics, and HRTF configurations.

## Parameters/Props

### Interfaces

**Position3D**  
- **x**: number - X-coordinate in 3D space.  
- **y**: number - Y-coordinate in 3D space.  
- **z**: number - Z-coordinate in 3D space.  

**Orientation3D**  
- **forward**: Position3D - The forward direction of the listener.  
- **up**: Position3D - The upward direction of the listener.  

**AudioSource**  
- **id**: string - Unique identifier for the audio source.  
- **position**: Position3D - 3D position of the audio source.  
- **audioBuffer**: AudioBuffer - Optional audio buffer for playback.  
- **audioElement**: HTMLAudioElement - Optional HTML audio element.  
- **mediaStream**: MediaStream - Optional stream for real-time audio.  
- **volume**: number - Volume level of the audio source.  
- **loop**: boolean - Indicates if the audio should loop.  
- **distance**: Object - Configuration for distance attenuation.  
- **cone**: Object (optional) - Configuration for audio cone properties.  

**AudioListener**  
- **position**: Position3D - Current position of the listener.  
- **orientation**: Orientation3D - Current orientation of the listener.  
- **velocity**: Position3D (optional) - Movement speed of the listener.  

**EnvironmentAcoustics**  
- **roomSize**: Position3D - Dimensions of the acoustic environment.  
- **reverberation**: Object - Properties defining reverberation characteristics.  
- **absorption**: number - Material absorption properties.  
- **occlusion**: Object - Occlusion settings affecting sound propagation.  
- **materialProperties**: Map<string, AcousticMaterial> - Acoustic properties for different materials.  

**HRTFConfig**  
- **sampleRate**: number - Sample rate for HRTF processing.  
- **filterLength**: number - Length of the HRTF filters.  
- **elevations**: number[] - List of elevation angles for HRTF.  
- **azimuths**: number[] - List of azimuth angles for HRTF.  
- **datasetUrl**: string - URL of the HRTF dataset.  
- **interpolation**: 'linear' | 'cubic' - Interpolation method for HRTF.  

## Return Values
The service processes audio input and provides binaural output consisting of left and right audio channels. It also returns metadata containing relevant information about the audio processing.

### BinauralOutput
- **leftChannel**: Float32Array - Binaural audio data for the left channel.  
- **rightChannel**: Float32Array - Binaural audio data for the right channel.  
- **metadata**: Object - Additional processing information.

## Examples
1. **Defining an Audio Source**:
   ```typescript
   const audioSource: AudioSource = {
       id: 'sound1',
       position: { x: 1, y: 0, z: 5 },
       volume: 0.8,
       loop: true,
       distance: {
           model: 'inverse',
           refDistance: 1,
           maxDistance: 10,
           rolloffFactor: 1
       },
       cone: {
           innerAngle: 360,
           outerAngle: 180,
           outerGain: 0.5
       }
   };
   ```

2. **Configuring a Listener**:
   ```typescript
   const audioListener: AudioListener = {
       position: { x: 0, y: 0, z: 0 },
       orientation: {
           forward: { x: 0, y: 0, z: -1 },
           up: { x: 0, y: 1, z: 0 }
       }
   };
   ```

3. **Setting Up HRTF Configuration**:
   ```typescript
   const hrConfig: HRTFConfig = {
       sampleRate: 44100,
       filterLength: